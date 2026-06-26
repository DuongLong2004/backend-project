const request = require("supertest");

// ════════════════════════════════════════════════════════════════════════════
// MOCKS
// ════════════════════════════════════════════════════════════════════════════

jest.mock("../../src/config/redis", () => ({
  client: {
    isReady: false,
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(true),
  },
  scanKeys: jest.fn().mockResolvedValue([]),
  createSession: jest.fn().mockResolvedValue(true),
  getSession: jest.fn().mockResolvedValue(null),
  touchSession: jest.fn().mockResolvedValue(true),
  deleteSession: jest.fn().mockResolvedValue(true),
  listSessions: jest.fn().mockResolvedValue([]),
  deleteAllSessions: jest.fn().mockResolvedValue(true),
  deleteOtherSessions: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/services/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountLockedEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
  hasMany: jest.fn(),
  belongsTo: jest.fn(),
}));

jest.mock("../../src/models/index", () => ({
  User: require("../../src/models/User"),
  Product: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    increment: jest.fn().mockResolvedValue(true),
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  },
  ProductSpec: {
    bulkCreate: jest.fn(),
    destroy: jest.fn(),
    belongsTo: jest.fn(),
  },
  Review: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  },
  Order: {
    findOne: jest.fn(),
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  },
  sequelize: {
    sync: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
    fn: jest.fn().mockReturnValue("fn"),
    col: jest.fn().mockReturnValue("col"),
    literal: jest.fn().mockReturnValue({}),
    escape: jest.fn((val) => `'${val}'`),
    transaction: jest.fn().mockImplementation(async (cb) =>
      cb({ LOCK: { UPDATE: "UPDATE" } })
    ),
  },
}));

jest.mock("../../src/middlewares/auth.middleware", () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 1, role: "user" };
    next();
  },
}));

const app = require("../../src/app");
const { Product, Review, Order } = require("../../src/models/index");

// ════════════════════════════════════════════════════════════════════════════
// GET /api/products
// ════════════════════════════════════════════════════════════════════════════

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

  it("should return empty array if no products", async () => {
    Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const res = await request(app).get("/api/products");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/products/:id
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/products/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return product detail", async () => {
    Product.findByPk.mockResolvedValue({
      id: 1,
      title: "iPhone 16",
      price: 33990000,
      specs: [],
    });

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

// ════════════════════════════════════════════════════════════════════════════
// GET /api/products/:id/reviews
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/products/:id/reviews", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return reviews with avgRating and totalReviews", async () => {
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

  it("should return hasMore true khi còn reviews (cursor pagination)", async () => {
    const fakeReviews = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      rating: 5,
      comment: "Good",
      createdAt: new Date(Date.now() - i * 1000),
      User: { id: 1, name: "User" },
    }));
    Review.findAll.mockResolvedValue(fakeReviews);
    Product.findByPk.mockResolvedValue({ avgRating: 4.5, totalReviews: 20 });

    const res = await request(app).get("/api/products/1/reviews?limit=10");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.hasMore).toBe(true);
    expect(res.body.data.reviews).toHaveLength(10);
    expect(res.body.data.nextCursor).not.toBeNull();
  });

  it("should return 400 nếu cursor không hợp lệ", async () => {
    const res = await request(app).get("/api/products/1/reviews?cursor=not-a-timestamp");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Invalid cursor");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/products/:id/reviews
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/products/:id/reviews", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 400 if rating invalid (> 5)", async () => {
    const res = await request(app).post("/api/products/1/reviews").send({ rating: 6 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Rating phải từ 1 đến 5");
  });

  it("should return 403 if user has not purchased the product", async () => {
    Order.findOne.mockResolvedValue(null);

    const res = await request(app).post("/api/products/1/reviews").send({ rating: 5 });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Bạn cần mua và nhận hàng thành công mới được đánh giá!");
  });

  it("should return 400 if user already reviewed this product", async () => {
    Order.findOne.mockResolvedValue({ id: 1 });
    Review.findOne.mockResolvedValue({ id: 1 });

    const res = await request(app).post("/api/products/1/reviews").send({ rating: 5 });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Bạn đã đánh giá sản phẩm này rồi!");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/products/:id/reviews/:reviewId
// ════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/products/:id/reviews/:reviewId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 404 if review not found", async () => {
    Review.findByPk.mockResolvedValue(null);

    const res = await request(app).delete("/api/products/1/reviews/999");

    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if not owner of review", async () => {
    // req.user.id = 1, nhưng review thuộc userId = 99
    Review.findByPk.mockResolvedValue({ id: 1, userId: 99, productId: 1 });

    const res = await request(app).delete("/api/products/1/reviews/1");

    expect(res.statusCode).toBe(403);
  });

  it("should delete review successfully", async () => {
    Review.findByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      productId: 1,
      destroy: jest.fn().mockResolvedValue(true),
    });
    Review.findOne.mockResolvedValue({ avgRating: 0, totalReviews: 0 });
    Product.update.mockResolvedValue(true);

    const res = await request(app).delete("/api/products/1/reviews/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Đã xóa đánh giá");
  });
});