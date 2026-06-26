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
  Order: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  },
  OrderItem: {
    bulkCreate: jest.fn(),
    belongsTo: jest.fn(),
  },
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
  ProductPlacement: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByPk: jest.fn(),
    increment: jest.fn().mockResolvedValue(true),
    belongsTo: jest.fn(),
    hasMany: jest.fn(),
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
const { Order, OrderItem, Product, ProductPlacement } = require("../../src/models/index");

// Helper tạo shippingInfo hợp lệ
const validShipping = {
  name: "An",
  phone: "0909123456",
  email: "a@gmail.com",
  address: "123 ABC",
};

// ════════════════════════════════════════════════════════════════════════════
// POST /api/orders
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/orders", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should create order successfully", async () => {
    Product.findByPk.mockResolvedValue({
      id: 1,
      title: "iPhone",
      price: 33990000,
      stock: 10,
    });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 67980000 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ productId: 1, quantity: 2 }], shippingInfo: validShipping });

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("orderId");
  });

  it("should return 400 if items empty", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({ items: [], shippingInfo: validShipping });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Order must have at least 1 item");
  });

  it("should return 400 if shippingInfo missing hoàn toàn", async () => {
    Product.findByPk.mockResolvedValue({
      id: 1, title: "iPhone", price: 33990000, stock: 10,
    });

    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ productId: 1, quantity: 1 }] });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("shippingInfo");
  });

  it("should return 400 if phone invalid format", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send({
        items: [{ productId: 1, quantity: 1 }],
        shippingInfo: { ...validShipping, phone: "abc-not-number" },
      });

    expect(res.statusCode).toBe(400);
  });

  it("should return 404 if product not found", async () => {
    Product.findByPk.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ productId: 999, quantity: 1 }], shippingInfo: validShipping });

    expect(res.statusCode).toBe(404);
  });

  it("should return 400 if out of stock", async () => {
    Product.findByPk.mockResolvedValue({
      id: 1, title: "iPhone", price: 33990000, stock: 0,
    });

    const res = await request(app)
      .post("/api/orders")
      .send({ items: [{ productId: 1, quantity: 5 }], shippingInfo: validShipping });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("chỉ còn");
  });

  it("should return 409 if flash sale out of stock", async () => {
    Product.findByPk.mockResolvedValue({
      id: 1, title: "iPhone Flash", price: 33990000, stock: 50,
    });
    ProductPlacement.findOne.mockResolvedValue({
      id: 5,
      productId: 1,
      placement: "flashsale",
      stockLimit: 100,
      stockSold: 100, // hết suất
      salePrice: 25000000,
      saleStartAt: null,
      saleEndAt: null,
    });

    const res = await request(app)
      .post("/api/orders")
      .send({
        items: [{ productId: 1, quantity: 1, placementId: 5 }],
        shippingInfo: validShipping,
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toContain("hết suất flash sale");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/orders/me
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/orders/me", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return orders với cursor pagination fields", async () => {
    Order.findAll.mockResolvedValue([{ id: 1, status: "pending" }]);

    const res = await request(app).get("/api/orders/me");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data).toHaveProperty("hasMore");
    expect(res.body.data).toHaveProperty("nextCursor");
  });

  it("should return empty array với hasMore false", async () => {
    Order.findAll.mockResolvedValue([]);

    const res = await request(app).get("/api/orders/me");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.data).toHaveLength(0);
    expect(res.body.data.hasMore).toBe(false);
    expect(res.body.data.nextCursor).toBeNull();
  });

  it("should return hasMore true và nextCursor khi còn dữ liệu", async () => {
    // Trả 11 items với limit=10 → hasMore = true
    const fakeOrders = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      status: "pending",
      createdAt: new Date(Date.now() - i * 1000),
    }));
    Order.findAll.mockResolvedValue(fakeOrders);

    const res = await request(app).get("/api/orders/me?limit=10");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.hasMore).toBe(true);
    expect(res.body.data.nextCursor).not.toBeNull();
    expect(res.body.data.data).toHaveLength(10);
  });

  it("should cap limit tại MAX_PAGE_LIMIT", async () => {
    Order.findAll.mockResolvedValue([]);

    await request(app).get("/api/orders/me?limit=9999");

    const callArgs = Order.findAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(51);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/orders/:id
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/orders/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return order detail (owner)", async () => {
    Order.findOne.mockResolvedValue({
      id: 1,
      userId: 1,
      status: "pending",
      OrderItems: [],
    });

    const res = await request(app).get("/api/orders/1");

    expect(res.statusCode).toBe(200);
  });

  it("should return 404 if order not found", async () => {
    Order.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/orders/999");

    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if not owner", async () => {
    // req.user.id = 1, nhưng order thuộc userId = 99
    Order.findOne.mockResolvedValue({
      id: 1,
      userId: 99,
      status: "pending",
      OrderItems: [],
    });

    const res = await request(app).get("/api/orders/1");

    expect(res.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PATCH /api/orders/:id/cancel
// ════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/orders/:id/cancel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should cancel order successfully", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      status: "pending",
      OrderItems: [],
      update: jest.fn().mockResolvedValue(true),
    });
    Order.update.mockResolvedValue([1]);

    const res = await request(app).patch("/api/orders/1/cancel");

    expect(res.statusCode).toBe(200);
  });

  it("should return 404 if order not found", async () => {
    Order.findByPk.mockResolvedValue(null);

    const res = await request(app).patch("/api/orders/999/cancel");

    expect(res.statusCode).toBe(404);
  });

  it("should return 400 if order already completed", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      status: "completed",
      OrderItems: [],
      update: jest.fn(),
    });

    const res = await request(app).patch("/api/orders/1/cancel");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Cannot cancel a completed order");
  });

  it("should return 400 if order already cancelled", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 1,
      status: "cancelled",
      OrderItems: [],
      update: jest.fn(),
    });

    const res = await request(app).patch("/api/orders/1/cancel");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Order already cancelled");
  });

  it("should return 403 if not owner", async () => {
    // req.user.id = 1, nhưng order thuộc userId = 99
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 99,
      status: "pending",
      OrderItems: [],
      update: jest.fn(),
    });

    const res = await request(app).patch("/api/orders/1/cancel");

    expect(res.statusCode).toBe(403);
  });
});