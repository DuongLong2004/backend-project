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
    hasMany: jest.fn(),
    belongsTo: jest.fn(),
  },
  Wishlist: {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findOrCreate: jest.fn(),
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
const { Product, Wishlist } = require("../../src/models/index");

// ════════════════════════════════════════════════════════════════════════════
// GET /api/wishlist
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/wishlist", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return wishlist items", async () => {
    Wishlist.findAll.mockResolvedValue([{ id: 1, productId: 1 }]);

    const res = await request(app).get("/api/wishlist");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return empty wishlist", async () => {
    Wishlist.findAll.mockResolvedValue([]);

    const res = await request(app).get("/api/wishlist");

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// GET /api/wishlist/ids
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/wishlist/ids", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return array of product ids", async () => {
    Wishlist.findAll.mockResolvedValue([{ productId: 1 }, { productId: 2 }]);

    const res = await request(app).get("/api/wishlist/ids");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("should return empty array if wishlist empty", async () => {
    Wishlist.findAll.mockResolvedValue([]);

    const res = await request(app).get("/api/wishlist/ids");

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// POST /api/wishlist/:productId
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/wishlist/:productId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should add product to wishlist successfully", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone" });
    Wishlist.findOrCreate.mockResolvedValue([{ id: 1 }, true]); // created = true

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

  it("should return 400 if product already in wishlist", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    Wishlist.findOrCreate.mockResolvedValue([{ id: 1 }, false]); // created = false

    const res = await request(app).post("/api/wishlist/1");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Sản phẩm đã có trong danh sách yêu thích!");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/wishlist/:productId
// ════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/wishlist/:productId", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should remove product from wishlist successfully", async () => {
    Wishlist.findOne.mockResolvedValue({
      id: 1,
      destroy: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).delete("/api/wishlist/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Đã xóa khỏi yêu thích");
  });

  it("should return 404 if product not in wishlist", async () => {
    Wishlist.findOne.mockResolvedValue(null);

    const res = await request(app).delete("/api/wishlist/999");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Không tìm thấy trong danh sách yêu thích");
  });
});