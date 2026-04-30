const request = require("supertest");
const bcrypt  = require("bcrypt");
const jwt     = require("jsonwebtoken");

jest.mock("../../src/config/redis", () => ({
  isReady: false,
  get:   jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue(true),
  keys:  jest.fn().mockResolvedValue([]),
  del:   jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/models/User", () => ({
  findOne:   jest.fn(),
  create:    jest.fn(),
  findAll:   jest.fn(),
  findByPk:  jest.fn(),
  update:    jest.fn(),
  hasMany:   jest.fn(),
  belongsTo: jest.fn(),
}));

jest.mock("../../src/models/index", () => ({
  User: require("../../src/models/User"),
  Order: {
    create:  jest.fn(), findAll: jest.fn(),
    findOne: jest.fn(), findByPk: jest.fn(),
    update:  jest.fn().mockResolvedValue([1]),
    hasMany: jest.fn(), belongsTo: jest.fn(),
  },
  OrderItem: {
    bulkCreate: jest.fn(), belongsTo: jest.fn(),
  },
  Product: {
    findByPk:        jest.fn(),
    findAll:         jest.fn(),
    findAndCountAll: jest.fn(),
    create:          jest.fn(),
    update:          jest.fn(),
    increment:       jest.fn().mockResolvedValue(true),
    hasMany:         jest.fn(),
    belongsTo:       jest.fn(),
  },
  ProductSpec: {
    bulkCreate: jest.fn(),
    destroy:    jest.fn(),
    belongsTo:  jest.fn(),
  },
  Review: {
    findAll:   jest.fn(),
    findOne:   jest.fn(),
    findByPk:  jest.fn(),
    create:    jest.fn(),
    hasMany:   jest.fn(),
    belongsTo: jest.fn(),
  },
  Wishlist: {
    findAll:      jest.fn(),
    findOne:      jest.fn(),
    findOrCreate: jest.fn(),
    hasMany:      jest.fn(),
    belongsTo:    jest.fn(),
  },
  ProductPlacement: {
    findOne:   jest.fn(),
    increment: jest.fn().mockResolvedValue(true),
    belongsTo: jest.fn(),
    hasMany:   jest.fn(),
  },
  sequelize: {
    sync:        jest.fn().mockResolvedValue(true),
    define:      jest.fn(),
    fn:          jest.fn().mockReturnValue("fn"),
    col:         jest.fn().mockReturnValue("col"),
    transaction: jest.fn().mockImplementation(async (cb) => cb({
      LOCK: { UPDATE: "UPDATE" },
    })),
  },
}));

// Mock verifyToken: req.user = { id: 1, role: "user" }
// Tất cả test ownership đều dùng id=1 để match
jest.mock("../../src/middlewares/auth.middleware", () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 1, role: "user" };
    next();
  },
}));

const app = require("../../src/app");
const User = require("../../src/models/User");
const { Order, OrderItem, Product, Review, Wishlist } = require("../../src/models/index");

const generateRefreshToken = (userId) =>
  jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET || "super_refresh_secret_key_456",
    { expiresIn: "7d" }
  );

// ============================================================
// AUTH TESTS
// ============================================================

describe("POST /api/auth/register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should register successfully", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 1, name: "New User", email: "new@gmail.com", role: "user" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "New User", email: "new@gmail.com", password: "123456" });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
  });

  it("should return 409 if email already exists", async () => {
    User.findOne.mockResolvedValue({ id: 1, email: "existing@gmail.com" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "User", email: "existing@gmail.com", password: "123456" });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Email already exists");
  });

  it("should return 400 if fields missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@gmail.com" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should login successfully", async () => {
    const hashedPassword = await bcrypt.hash("123456", 10);
    User.findOne.mockResolvedValue({
      id: 1, name: "Test User", email: "test@gmail.com",
      password: hashedPassword, role: "user",
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: "123456" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
  });

  it("should return 401 if email not found", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/login").send({ email: "wrong@gmail.com", password: "123456" });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should return 401 if password wrong", async () => {
    const hashedPassword = await bcrypt.hash("123456", 10);
    User.findOne.mockResolvedValue({ id: 1, email: "test@gmail.com", password: hashedPassword, role: "user", update: jest.fn() });
    const res = await request(app).post("/api/auth/login").send({ email: "test@gmail.com", password: "wrongpass" });
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 if fields missing", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "test@gmail.com" });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/auth/refresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should refresh token successfully", async () => {
    const refreshToken = generateRefreshToken(1);
    User.findOne.mockResolvedValue({ id: 1, email: "test@gmail.com", role: "user", refreshToken, update: jest.fn().mockResolvedValue(true) });
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
  });

  it("should return 400 if refreshToken missing", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Refresh token is required");
  });

  it("should return 401 if refreshToken invalid", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: "invalid.token.here" });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired refresh token");
  });

  it("should return 401 if refreshToken revoked", async () => {
    const refreshToken = generateRefreshToken(1);
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Refresh token has been revoked");
  });
});

describe("POST /api/auth/logout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should logout successfully", async () => {
    const refreshToken = generateRefreshToken(1);
    User.findOne.mockResolvedValue({ id: 1, refreshToken, update: jest.fn().mockResolvedValue(true) });
    const res = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should return 400 if refreshToken missing", async () => {
    const res = await request(app).post("/api/auth/logout").send({});
    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if refreshToken not found", async () => {
    User.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/logout").send({ refreshToken: "invalid.token" });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid refresh token");
  });
});

// ============================================================
// USER TESTS
// ============================================================

describe("GET /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return user by id (owner)", async () => {
    // verifyToken mock trả id=1, test GET /api/users/1 → match owner
    User.findByPk.mockResolvedValue({ id: 1, name: "Test", email: "t@gmail.com", role: "user" });
    const res = await request(app).get("/api/users/1");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("should return 403 if not owner and not admin", async () => {
    // verifyToken mock trả id=1, test GET /api/users/2 → khác owner → 403
    const res = await request(app).get("/api/users/2");
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("should return 404 if user not found", async () => {
    // id=1 match owner nên qua được ownership check
    User.findByPk.mockResolvedValue(null);
    const res = await request(app).get("/api/users/1");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

describe("PUT /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update user successfully (owner)", async () => {
    // verifyToken mock trả id=1, test PUT /api/users/1 → match owner
    User.findByPk.mockResolvedValue({
      id: 1, name: "Old", email: "t@gmail.com", age: 20, role: "user",
      update: jest.fn().mockResolvedValue(true),
    });
    const res = await request(app).put("/api/users/1").send({ name: "New Name" });
    expect(res.statusCode).toBe(200);
  });

  it("should return 403 if not owner and not admin", async () => {
    // verifyToken mock trả id=1, test PUT /api/users/2 → khác owner → 403
    const res = await request(app).put("/api/users/2").send({ name: "Hacked" });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("should return 404 if user not found", async () => {
    User.findByPk.mockResolvedValue(null);
    const res = await request(app).put("/api/users/1").send({ name: "X" });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 403 if not admin", async () => {
    // verifyToken mock trả role="user" → checkRole("admin") chặn lại
    const res = await request(app).delete("/api/users/1");
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================
// PRODUCT TESTS
// ============================================================

describe("GET /api/products", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return list of products", async () => {
    Product.findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [
        { id: 1, title: "iPhone 16", price: 33990000 },
        { id: 2, title: "Samsung S25", price: 25490000 },
      ],
    });
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("meta");
  });

  it("should support pagination", async () => {
    Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    const res = await request(app).get("/api/products?page=2&limit=5");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.page).toBe(2);
  });

  it("should return empty if no products", async () => {
    Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    const res = await request(app).get("/api/products");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
  });
});

describe("GET /api/products/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return product detail", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone 16", price: 33990000, specs: [] });
    const res = await request(app).get("/api/products/1");
    expect(res.statusCode).toBe(200);
  });

  it("should return 404 if product not found", async () => {
    Product.findByPk.mockResolvedValue(null);
    const res = await request(app).get("/api/products/999");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Product not found");
  });
});

// ============================================================
// ORDER TESTS
// ============================================================

describe("POST /api/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create order successfully", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 33990000, stock: 10 });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 67980000 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);

    const res = await request(app).post("/api/orders").send({
      items: [{ productId: 1, quantity: 2 }],
      shippingInfo: { name: "An", phone: "0909123456", email: "a@gmail.com", address: "123 ABC" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("orderId");
  });

  it("should return 400 if items empty", async () => {
    const res = await request(app).post("/api/orders").send({ items: [] });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Order must have at least 1 item");
  });

  it("should return 404 if product not found", async () => {
    Product.findByPk.mockResolvedValue(null);
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: 999, quantity: 1 }],
      shippingInfo: { name: "An", phone: "0909123456", email: "a@gmail.com", address: "123 ABC" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("should return 400 if out of stock", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 33990000, stock: 0 });
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: 1, quantity: 5 }],
      shippingInfo: { name: "An", phone: "0909123456", email: "a@gmail.com", address: "123 ABC" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("chỉ còn");
  });
});

describe("GET /api/orders/me", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return orders", async () => {
    Order.findAll.mockResolvedValue([{ id: 1, status: "pending" }]);
    const res = await request(app).get("/api/orders/me");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data).toHaveProperty("hasMore");
    expect(res.body.data).toHaveProperty("nextCursor");
  });

  it("should return empty array", async () => {
    Order.findAll.mockResolvedValue([]);
    const res = await request(app).get("/api/orders/me");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
    expect(res.body.data.hasMore).toBe(false);
    expect(res.body.data.nextCursor).toBeNull();
  });
});

describe("GET /api/orders/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return order detail", async () => {
    Order.findOne.mockResolvedValue({ id: 1, userId: 1, status: "pending", OrderItems: [] });
    const res = await request(app).get("/api/orders/1");
    expect(res.statusCode).toBe(200);
  });

  it("should return 404 if not found", async () => {
    Order.findOne.mockResolvedValue(null);
    const res = await request(app).get("/api/orders/999");
    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if not owner", async () => {
    Order.findOne.mockResolvedValue({ id: 1, userId: 99, status: "pending", OrderItems: [] });
    const res = await request(app).get("/api/orders/1");
    expect(res.statusCode).toBe(403);
  });
});

describe("PATCH /api/orders/:id/cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should cancel order", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1, userId: 1, status: "pending",
      OrderItems: [],
      update: jest.fn().mockResolvedValue(true),
    });
    Order.update.mockResolvedValue([1]);

    const res = await request(app).patch("/api/orders/1/cancel");
    expect(res.statusCode).toBe(200);
  });

  it("should return 404", async () => {
    Order.findByPk.mockResolvedValue(null);
    const res = await request(app).patch("/api/orders/999/cancel");
    expect(res.statusCode).toBe(404);
  });

  it("should return 400 if completed", async () => {
    Order.findByPk.mockResolvedValue({ id: 1, userId: 1, status: "completed", OrderItems: [], update: jest.fn() });
    const res = await request(app).patch("/api/orders/1/cancel");
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Cannot cancel a completed order");
  });

  it("should return 400 if already cancelled", async () => {
    Order.findByPk.mockResolvedValue({ id: 1, userId: 1, status: "cancelled", OrderItems: [], update: jest.fn() });
    const res = await request(app).patch("/api/orders/1/cancel");
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Order already cancelled");
  });

  it("should return 403 if not owner", async () => {
    Order.findByPk.mockResolvedValue({ id: 1, userId: 99, status: "pending", OrderItems: [], update: jest.fn() });
    const res = await request(app).patch("/api/orders/1/cancel");
    expect(res.statusCode).toBe(403);
  });
});

// ============================================================
// REVIEW TESTS
// ============================================================

describe("GET /api/products/:id/reviews", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return reviews", async () => {
    Review.findAll.mockResolvedValue([
      { id: 1, rating: 5, comment: "Great!", User: { id: 1, name: "User 1" } },
    ]);
    Product.findByPk.mockResolvedValue({ avgRating: 5, totalReviews: 1 });
    const res = await request(app).get("/api/products/1/reviews");
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("reviews");
    expect(res.body.data).toHaveProperty("avgRating");
    expect(res.body.data).toHaveProperty("totalReviews");
  });

  it("should return empty reviews with avgRating 0", async () => {
    Review.findAll.mockResolvedValue([]);
    Product.findByPk.mockResolvedValue({ avgRating: 0, totalReviews: 0 });
    const res = await request(app).get("/api/products/999/reviews");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.avgRating).toBe(0);
    expect(res.body.data.totalReviews).toBe(0);
  });
});

describe("POST /api/products/:id/reviews", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 400 if rating invalid", async () => {
    const res = await request(app).post("/api/products/1/reviews").send({ rating: 6 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Rating phải từ 1 đến 5");
  });

  it("should return 403 if not purchased", async () => {
    Order.findOne.mockResolvedValue(null);
    const res = await request(app).post("/api/products/1/reviews").send({ rating: 5 });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Bạn cần mua và nhận hàng thành công mới được đánh giá!");
  });

  it("should return 400 if already reviewed", async () => {
    Order.findOne.mockResolvedValue({ id: 1 });
    Review.findOne.mockResolvedValue({ id: 1 });
    const res = await request(app).post("/api/products/1/reviews").send({ rating: 5 });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Bạn đã đánh giá sản phẩm này rồi!");
  });
});

describe("DELETE /api/products/:id/reviews/:reviewId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 404 if review not found", async () => {
    Review.findByPk.mockResolvedValue(null);
    const res = await request(app).delete("/api/products/1/reviews/999");
    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if not owner", async () => {
    Review.findByPk.mockResolvedValue({ id: 1, userId: 99, productId: 1 });
    const res = await request(app).delete("/api/products/1/reviews/1");
    expect(res.statusCode).toBe(403);
  });

  it("should delete review successfully", async () => {
    Review.findByPk.mockResolvedValue({
      id: 1, userId: 1, productId: 1,
      destroy: jest.fn().mockResolvedValue(true),
    });
    Review.findOne.mockResolvedValue({ avgRating: 0, totalReviews: 0 });
    Product.update.mockResolvedValue(true);

    const res = await request(app).delete("/api/products/1/reviews/1");
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Đã xóa đánh giá");
  });
});

// ============================================================
// WISHLIST TESTS
// ============================================================

describe("GET /api/wishlist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return wishlist", async () => {
    Wishlist.findAll.mockResolvedValue([{ id: 1, productId: 1 }]);
    const res = await request(app).get("/api/wishlist");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return empty wishlist", async () => {
    Wishlist.findAll.mockResolvedValue([]);
    const res = await request(app).get("/api/wishlist");
    expect(res.body.data).toHaveLength(0);
  });
});

describe("GET /api/wishlist/ids", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return product ids", async () => {
    Wishlist.findAll.mockResolvedValue([{ productId: 1 }, { productId: 2 }]);
    const res = await request(app).get("/api/wishlist/ids");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("POST /api/wishlist/:productId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should add to wishlist", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone" });
    Wishlist.findOrCreate.mockResolvedValue([{ id: 1 }, true]);
    const res = await request(app).post("/api/wishlist/1");
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Đã thêm vào yêu thích! ❤️");
  });

  it("should return 404 if product not found", async () => {
    Product.findByPk.mockResolvedValue(null);
    const res = await request(app).post("/api/wishlist/999");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Sản phẩm không tồn tại");
  });

  it("should return 400 if already in wishlist", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    Wishlist.findOrCreate.mockResolvedValue([{ id: 1 }, false]);
    const res = await request(app).post("/api/wishlist/1");
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Sản phẩm đã có trong danh sách yêu thích!");
  });
});

describe("DELETE /api/wishlist/:productId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should remove from wishlist", async () => {
    Wishlist.findOne.mockResolvedValue({ id: 1, destroy: jest.fn() });
    const res = await request(app).delete("/api/wishlist/1");
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Đã xóa khỏi yêu thích");
  });

  it("should return 404 if not in wishlist", async () => {
    Wishlist.findOne.mockResolvedValue(null);
    const res = await request(app).delete("/api/wishlist/999");
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Không tìm thấy trong danh sách yêu thích");
  });
});