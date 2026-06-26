// ════════════════════════════════════════════════════════════════════════════
// MOCKS
// ════════════════════════════════════════════════════════════════════════════

// order.service.js import sequelize trực tiếp từ config/db
jest.mock("../../src/config/db", () => ({
  transaction: jest.fn().mockImplementation(async (cb) =>
    cb({ LOCK: { UPDATE: "UPDATE" } })
  ),
  query: jest.fn(),
}));

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

const { Order, OrderItem, Product, ProductPlacement } = require("../../src/models/index");
const redis = require("../../src/config/redis");

// Helper tạo shippingInfo hợp lệ
const validShipping = { name: "A", phone: "0909", email: "a@gmail.com", address: "123" };

// ════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE — createOrder
// ════════════════════════════════════════════════════════════════════════════

describe("orderService.createOrder — validation", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 if items is empty array", async () => {
    await expect(
      orderService.createOrder({ userId: 1, items: [], shippingInfo: validShipping })
    ).rejects.toMatchObject({ statusCode: 400, message: "Order must have at least 1 item" });
  });

  it("should throw 400 if shippingInfo is null", async () => {
    await expect(
      orderService.createOrder({ userId: 1, items: [{ productId: 1, quantity: 1 }], shippingInfo: null })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 400 if shippingInfo.phone is missing", async () => {
    await expect(
      orderService.createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        shippingInfo: { name: "A", email: "a@gmail.com", address: "123" },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 404 if product not found inside transaction", async () => {
    Product.findByPk.mockResolvedValue(null);

    await expect(
      orderService.createOrder({ userId: 1, items: [{ productId: 999, quantity: 1 }], shippingInfo: validShipping })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should throw 400 if stock insufficient", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 1000, stock: 2 });

    await expect(
      orderService.createOrder({ userId: 1, items: [{ productId: 1, quantity: 5 }], shippingInfo: validShipping })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("chỉ còn") });
  });
});

describe("orderService.createOrder — flash sale", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 409 if flash sale stockSold = stockLimit (hết suất)", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone Flash", price: 33990000, stock: 50 });
    ProductPlacement.findOne.mockResolvedValue({
      id: 5, productId: 1, placement: "flashsale",
      stockLimit: 100, stockSold: 100,
      salePrice: 25000000, saleStartAt: null, saleEndAt: null,
    });

    await expect(
      orderService.createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 1, placementId: 5 }],
        shippingInfo: validShipping,
      })
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("hết suất flash sale") });
  });

  it("should throw 409 if flash sale stockLeft < quantity", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 1000, stock: 50 });
    ProductPlacement.findOne.mockResolvedValue({
      id: 5, productId: 1, placement: "flashsale",
      stockLimit: 10, stockSold: 8, // còn 2 suất
      salePrice: 800, saleStartAt: null, saleEndAt: null,
    });

    await expect(
      orderService.createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 5, placementId: 5 }], // muốn 5 nhưng chỉ còn 2
        shippingInfo: validShipping,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should apply flash sale price when sale active (no time constraint)", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 33990000, stock: 50 });
    ProductPlacement.findOne.mockResolvedValue({
      id: 5, productId: 1, placement: "flashsale",
      stockLimit: 100, stockSold: 0,
      salePrice: 25000000, saleStartAt: null, saleEndAt: null,
    });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 25000000 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);
    ProductPlacement.increment.mockResolvedValue(true);

    const result = await orderService.createOrder({
      userId: 1,
      items: [{ productId: 1, quantity: 1, placementId: 5 }],
      shippingInfo: validShipping,
    });

    expect(result).toHaveProperty("orderId");
    // Phải dùng salePrice (25000000), không phải giá gốc
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 25000000 }),
      expect.anything()
    );
  });

  it("should NOT apply flash sale price when saleEndAt is in the past", async () => {
    const pastDate = new Date(Date.now() - 60 * 1000);
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 33990000, stock: 50 });
    ProductPlacement.findOne.mockResolvedValue({
      id: 5, productId: 1, placement: "flashsale",
      stockLimit: 100, stockSold: 0,
      salePrice: 25000000, saleStartAt: null, saleEndAt: pastDate, // đã hết hạn
    });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 33990000 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);
    ProductPlacement.increment.mockResolvedValue(true);

    await orderService.createOrder({
      userId: 1,
      items: [{ productId: 1, quantity: 1, placementId: 5 }],
      shippingInfo: validShipping,
    });

    // Phải dùng giá gốc (33990000)
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 33990000 }),
      expect.anything()
    );
  });
});

describe("orderService.createOrder — pricing & defaults", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should use regular price when no placementId", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 33990000, stock: 50 });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 33990000 * 2 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);

    const result = await orderService.createOrder({
      userId: 1,
      items: [{ productId: 1, quantity: 2 }],
      shippingInfo: validShipping,
    });

    expect(result).toHaveProperty("orderId");
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ totalAmount: 33990000 * 2 }),
      expect.anything()
    );
  });

  it("should default payMethod to 'cod' when not provided", async () => {
    Product.findByPk.mockResolvedValue({ id: 1, title: "iPhone", price: 1000, stock: 10 });
    Order.create.mockResolvedValue({ id: 1, totalAmount: 1000 });
    OrderItem.bulkCreate.mockResolvedValue([]);
    Product.increment.mockResolvedValue(true);

    await orderService.createOrder({
      userId: 1,
      items: [{ productId: 1, quantity: 1 }],
      shippingInfo: validShipping,
    });

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ payMethod: "cod" }),
      expect.anything()
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE — getMyOrders
// ════════════════════════════════════════════════════════════════════════════

describe("orderService.getMyOrders — cursor pagination", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 for invalid cursor format (NaN)", async () => {
    await expect(
      orderService.getMyOrders({ userId: 1, cursor: "not-a-number" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid cursor" });
  });

  it("should throw 400 for cursor = 0", async () => {
    await expect(
      orderService.getMyOrders({ userId: 1, cursor: "0" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should handle valid cursor (timestamp string)", async () => {
    const ts = (Date.now() - 10000).toString();
    Order.findAll.mockResolvedValue([]);

    const result = await orderService.getMyOrders({ userId: 1, cursor: ts });

    expect(result.hasMore).toBe(false);
    expect(result.data).toHaveLength(0);
  });

  it("should cap limit at MAX_PAGE_LIMIT", async () => {
    Order.findAll.mockResolvedValue([]);

    await orderService.getMyOrders({ userId: 1, limit: 9999 });

    const callArgs = Order.findAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(51);
  });

  it("should return hasMore=false and nextCursor=null when no extra item", async () => {
    Order.findAll.mockResolvedValue([
      { id: 1, createdAt: new Date() },
      { id: 2, createdAt: new Date() },
    ]);

    const result = await orderService.getMyOrders({ userId: 1, limit: 10 });

    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.data).toHaveLength(2);
  });

  it("should return hasMore=true and nextCursor when extra item exists", async () => {
    const fakeOrders = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      createdAt: new Date(Date.now() - i * 1000),
    }));
    Order.findAll.mockResolvedValue(fakeOrders);

    const result = await orderService.getMyOrders({ userId: 1, limit: 10 });

    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).not.toBeNull();
    expect(result.data).toHaveLength(10);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE — getAllOrders (admin)
// ════════════════════════════════════════════════════════════════════════════

describe("orderService.getAllOrders — admin", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should return all orders with pagination meta", async () => {
    Order.findAndCountAll = jest.fn().mockResolvedValue({ count: 25, rows: [{ id: 1 }, { id: 2 }] });

    const result = await orderService.getAllOrders({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(25);
    expect(result.meta.totalPages).toBe(3); // Math.ceil(25/10)
    expect(result.meta.page).toBe(1);
  });

  it("should filter by valid status", async () => {
    Order.findAndCountAll = jest.fn().mockResolvedValue({ count: 5, rows: [] });

    await orderService.getAllOrders({ status: "pending" });

    const callArgs = Order.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where.status).toBe("pending");
  });

  it("should ignore invalid status filter", async () => {
    Order.findAndCountAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });

    await orderService.getAllOrders({ status: "invalid-status" });

    const callArgs = Order.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where).not.toHaveProperty("status");
  });

  it("should use default page=1 and limit=20 when not provided", async () => {
    Order.findAndCountAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });

    await orderService.getAllOrders();

    const callArgs = Order.findAndCountAll.mock.calls[0][0];
    expect(callArgs.limit).toBe(20);
    expect(callArgs.offset).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE — updateOrderStatus (admin)
// ════════════════════════════════════════════════════════════════════════════

describe("orderService.updateOrderStatus — admin", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 for invalid status", async () => {
    await expect(
      orderService.updateOrderStatus({ orderId: 1, newStatus: "flying" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Invalid status" });
  });

  it("should throw 404 if order not found", async () => {
    Order.findByPk.mockResolvedValue(null);

    await expect(
      orderService.updateOrderStatus({ orderId: 999, newStatus: "confirmed" })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should throw 400 if order already completed", async () => {
    Order.findByPk.mockResolvedValue({ id: 1, status: "completed", OrderItems: [], update: jest.fn() });

    await expect(
      orderService.updateOrderStatus({ orderId: 1, newStatus: "confirmed" })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("completed") });
  });

  it("should throw 400 if order already cancelled", async () => {
    Order.findByPk.mockResolvedValue({ id: 1, status: "cancelled", OrderItems: [], update: jest.fn() });

    await expect(
      orderService.updateOrderStatus({ orderId: 1, newStatus: "confirmed" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should update status successfully (pending → confirmed)", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    Order.findByPk.mockResolvedValue({ id: 1, status: "pending", OrderItems: [], update: updateMock });

    await orderService.updateOrderStatus({ orderId: 1, newStatus: "confirmed" });

    expect(updateMock).toHaveBeenCalledWith({ status: "confirmed" }, expect.anything());
  });

  it("should restore stock when status updated to cancelled", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    Order.findByPk.mockResolvedValue({
      id: 1, status: "confirmed",
      OrderItems: [{ productId: 1, quantity: 2, placementId: null }],
      update: updateMock,
    });
    Product.increment.mockResolvedValue(true);

    await orderService.updateOrderStatus({ orderId: 1, newStatus: "cancelled" });

    expect(Product.increment).toHaveBeenCalledWith(
      { stock: 2, sold: -2 },
      expect.objectContaining({ where: { id: 1 } })
    );
    expect(updateMock).toHaveBeenCalledWith({ status: "cancelled" }, expect.anything());
  });

  it("should decrement placement stockSold when cancelled with placementId", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    Order.findByPk.mockResolvedValue({
      id: 1, status: "pending",
      OrderItems: [{ productId: 1, quantity: 3, placementId: 5 }],
      update: updateMock,
    });
    Product.increment.mockResolvedValue(true);
    ProductPlacement.increment.mockResolvedValue(true);

    await orderService.updateOrderStatus({ orderId: 1, newStatus: "cancelled" });

    expect(ProductPlacement.increment).toHaveBeenCalledWith(
      { stockSold: -3 },
      expect.objectContaining({ where: expect.objectContaining({ id: 5 }) })
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ORDER SERVICE — cancelOrder
// ════════════════════════════════════════════════════════════════════════════

describe("orderService.cancelOrder", () => {
  const orderService = require("../../src/services/order.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 409 if order was already processed by another request (affectedRows=0)", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1, userId: 1, status: "pending", OrderItems: [], update: jest.fn(),
    });
    Order.update.mockResolvedValue([0]); // optimistic lock fail

    await expect(
      orderService.cancelOrder({ orderId: 1, requestUser: { id: 1, role: "user" } })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should restore stock and placement stockSold when placementId exists", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1, userId: 1, status: "pending",
      OrderItems: [{ productId: 1, quantity: 2, placementId: 5 }],
      update: jest.fn(),
    });
    Order.update.mockResolvedValue([1]);
    Product.increment.mockResolvedValue(true);
    ProductPlacement.increment.mockResolvedValue(true);

    await orderService.cancelOrder({ orderId: 1, requestUser: { id: 1, role: "user" } });

    expect(Product.increment).toHaveBeenCalledWith(
      { stock: 2, sold: -2 },
      expect.objectContaining({ where: { id: 1 } })
    );
    expect(ProductPlacement.increment).toHaveBeenCalledWith(
      { stockSold: -2 },
      expect.objectContaining({ where: expect.objectContaining({ id: 5 }) })
    );
  });

  it("should NOT call ProductPlacement.increment if no placementId", async () => {
    Order.findByPk.mockResolvedValue({
      id: 1, userId: 1, status: "pending",
      OrderItems: [{ productId: 1, quantity: 2, placementId: null }],
      update: jest.fn(),
    });
    Order.update.mockResolvedValue([1]);
    Product.increment.mockResolvedValue(true);

    await orderService.cancelOrder({ orderId: 1, requestUser: { id: 1, role: "user" } });

    expect(ProductPlacement.increment).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — getPlacements
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.getPlacements — validation", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 for invalid placement type", async () => {
    await expect(placementService.getPlacements("invalid")).rejects.toMatchObject({
      statusCode: 400,
      message: "placement không hợp lệ",
    });
  });

  it("should throw 400 when placement is null", async () => {
    await expect(placementService.getPlacements(null)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 400 when placement is empty string", async () => {
    await expect(placementService.getPlacements("")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("placementService.getPlacements — data", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should return products for valid placement (homepage)", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        id: 1,
        sortOrder: 1,
        product: {
          toJSON: () => ({ id: 1, title: "iPhone 16", price: 33990000, brand: "Apple" }),
        },
      },
    ]);

    const result = await placementService.getPlacements("homepage");

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("placementId", 1);
    expect(result[0]).toHaveProperty("sortOrder", 1);
    expect(result[0]).toHaveProperty("title", "iPhone 16");
  });

  it("should include flashsale fields (salePrice, stockLimit, stockLeft) for flashsale placement", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        id: 5,
        sortOrder: 1,
        salePrice: 25000000,
        saleStartAt: null,
        saleEndAt: null,
        stockLimit: 100,
        stockSold: 30,
        product: {
          toJSON: () => ({ id: 1, title: "iPhone Flash", price: 33990000 }),
        },
      },
    ]);

    const result = await placementService.getPlacements("flashsale");

    expect(result[0]).toHaveProperty("salePrice", 25000000);
    expect(result[0]).toHaveProperty("stockLimit", 100);
    expect(result[0]).toHaveProperty("stockSold", 30);
    expect(result[0]).toHaveProperty("stockLeft", 70); // 100 - 30
  });

  it("should return stockLeft=null when stockLimit is null (không giới hạn suất)", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        id: 5,
        sortOrder: 1,
        salePrice: 25000000,
        saleStartAt: null,
        saleEndAt: null,
        stockLimit: null,
        stockSold: 0,
        product: {
          toJSON: () => ({ id: 1, title: "Flash No Limit", price: 33990000 }),
        },
      },
    ]);

    const result = await placementService.getPlacements("flashsale");

    expect(result[0].stockLeft).toBeNull();
  });

  it("should NOT include flashsale fields for non-flashsale placements", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        id: 1,
        sortOrder: 1,
        product: {
          toJSON: () => ({ id: 1, title: "iPhone", price: 33990000 }),
        },
      },
    ]);

    const result = await placementService.getPlacements("phones");

    expect(result[0]).not.toHaveProperty("salePrice");
    expect(result[0]).not.toHaveProperty("stockLeft");
  });

  it("should return empty array when no products in placement", async () => {
    ProductPlacement.findAll.mockResolvedValue([]);

    const result = await placementService.getPlacements("laptops");

    expect(result).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — createPlacement
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.createPlacement — validation", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 if productId missing", async () => {
    await expect(
      placementService.createPlacement({ placement: "homepage" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Thiếu productId hoặc placement" });
  });

  it("should throw 400 if placement missing", async () => {
    await expect(
      placementService.createPlacement({ productId: 1 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 400 for invalid placement type", async () => {
    await expect(
      placementService.createPlacement({ productId: 1, placement: "sidebar" })
    ).rejects.toMatchObject({ statusCode: 400, message: "placement không hợp lệ" });
  });

  it("should throw 404 if product not found", async () => {
    Product.findByPk.mockResolvedValue(null);

    await expect(
      placementService.createPlacement({ productId: 999, placement: "homepage" })
    ).rejects.toMatchObject({ statusCode: 404, message: "Sản phẩm không tồn tại" });
  });

  it("should throw 409 if product already in placement", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    ProductPlacement.findOne.mockResolvedValue({ id: 99 });

    await expect(
      placementService.createPlacement({ productId: 1, placement: "homepage" })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("should throw 400 for flashsale without salePrice", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    ProductPlacement.findOne.mockResolvedValue(null);
    ProductPlacement.max = jest.fn().mockResolvedValue(0);

    await expect(
      placementService.createPlacement({ productId: 1, placement: "flashsale" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Flash sale cần có salePrice" });
  });
});

describe("placementService.createPlacement — success", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should create homepage placement with correct sortOrder", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    ProductPlacement.findOne.mockResolvedValue(null);
    ProductPlacement.max = jest.fn().mockResolvedValue(3); // max hiện tại = 3
    ProductPlacement.create = jest.fn().mockResolvedValue({ id: 10, sortOrder: 4 });

    const result = await placementService.createPlacement({ productId: 1, placement: "homepage" });

    expect(ProductPlacement.create).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 4, placement: "homepage" })
    );
    expect(result).toHaveProperty("id", 10);
  });

  it("should set sortOrder=1 when no existing placements (max returns null)", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    ProductPlacement.findOne.mockResolvedValue(null);
    ProductPlacement.max = jest.fn().mockResolvedValue(null);
    ProductPlacement.create = jest.fn().mockResolvedValue({ id: 1, sortOrder: 1 });

    await placementService.createPlacement({ productId: 1, placement: "homepage" });

    expect(ProductPlacement.create).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 1 })
    );
  });

  it("should create flashsale placement with all flash sale fields", async () => {
    Product.findByPk.mockResolvedValue({ id: 1 });
    ProductPlacement.findOne.mockResolvedValue(null);
    ProductPlacement.max = jest.fn().mockResolvedValue(0);
    ProductPlacement.create = jest.fn().mockResolvedValue({ id: 11, sortOrder: 1 });

    await placementService.createPlacement({
      productId: 1,
      placement: "flashsale",
      salePrice: 25000000,
      saleStartAt: new Date(),
      saleEndAt: new Date(Date.now() + 3600000),
      stockLimit: 100,
    });

    expect(ProductPlacement.create).toHaveBeenCalledWith(
      expect.objectContaining({ salePrice: 25000000, stockLimit: 100, stockSold: 0 })
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — updatePlacement
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.updatePlacement", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 404 if placement not found", async () => {
    ProductPlacement.findByPk.mockResolvedValue(null);

    await expect(
      placementService.updatePlacement({ id: 999, salePrice: 1000 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should update salePrice and return stockLeft correctly", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    ProductPlacement.findByPk.mockResolvedValue({
      id: 5,
      salePrice: 20000000,
      stockLimit: 100,
      stockSold: 30,
      update: updateMock,
      toJSON: () => ({ id: 5, salePrice: 25000000, stockLimit: 100, stockSold: 30 }),
    });

    const result = await placementService.updatePlacement({ id: 5, salePrice: 25000000 });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ salePrice: 25000000 }));
    expect(result).toHaveProperty("stockLeft", 70); // 100 - 30
  });

  it("should set stockLimit=null and return stockLeft=null", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    ProductPlacement.findByPk.mockResolvedValue({
      id: 5,
      update: updateMock,
      toJSON: () => ({ id: 5, stockLimit: null, stockSold: 0 }),
    });

    const result = await placementService.updatePlacement({ id: 5, stockLimit: null });

    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ stockLimit: null }));
    expect(result.stockLeft).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — resetStock
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.resetStock", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 404 if placement not found", async () => {
    ProductPlacement.findByPk.mockResolvedValue(null);

    await expect(placementService.resetStock(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should reset stockSold to 0 and return correct stockLeft", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    ProductPlacement.findByPk.mockResolvedValue({
      id: 5, stockLimit: 100, stockSold: 80, update: updateMock,
    });

    const result = await placementService.resetStock(5);

    expect(updateMock).toHaveBeenCalledWith({ stockSold: 0 });
    expect(result.stockSold).toBe(0);
    expect(result.stockLeft).toBe(100);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — deletePlacement & deleteBulk
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.deletePlacement", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 404 if placement not found", async () => {
    ProductPlacement.findByPk.mockResolvedValue(null);

    await expect(placementService.deletePlacement(999)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("should delete placement successfully", async () => {
    const destroyMock = jest.fn().mockResolvedValue(true);
    ProductPlacement.findByPk.mockResolvedValue({ id: 5, destroy: destroyMock });

    await placementService.deletePlacement(5);

    expect(destroyMock).toHaveBeenCalledTimes(1);
  });
});

describe("placementService.deleteBulk", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 if ids is empty array", async () => {
    await expect(placementService.deleteBulk([])).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should throw 400 if ids is not an array (null)", async () => {
    await expect(placementService.deleteBulk(null)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should delete multiple placements and return deleted count", async () => {
    ProductPlacement.destroy = jest.fn().mockResolvedValue(3);

    const result = await placementService.deleteBulk([1, 2, 3]);

    expect(ProductPlacement.destroy).toHaveBeenCalledWith({ where: { id: [1, 2, 3] } });
    expect(result).toEqual({ deleted: 3 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLACEMENT SERVICE — getPlacementsAdmin
// ════════════════════════════════════════════════════════════════════════════

describe("placementService.getPlacementsAdmin", () => {
  const placementService = require("../../src/services/placement.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 for invalid placement", async () => {
    await expect(placementService.getPlacementsAdmin("invalid")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("should return admin placement list without flashsale fields for non-flashsale", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 1, placement: "homepage", sortOrder: 1,
          product: { id: 1, title: "iPhone" },
        }),
      },
    ]);

    const result = await placementService.getPlacementsAdmin("homepage");

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toHaveProperty("id", 1);
    expect(result[0]).not.toHaveProperty("stockLeft");
  });

  it("should include stockLeft for flashsale in admin view", async () => {
    ProductPlacement.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 5, placement: "flashsale",
          stockLimit: 100, stockSold: 40,
          salePrice: 25000000,
          product: { id: 1, title: "Flash Product" },
        }),
      },
    ]);

    const result = await placementService.getPlacementsAdmin("flashsale");

    expect(result[0]).toHaveProperty("stockLeft", 60); // 100 - 40
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION SERVICE — listSessions
// ════════════════════════════════════════════════════════════════════════════

describe("sessionService.listSessions", () => {
  const sessionService = require("../../src/services/session.service");

  beforeEach(() => jest.clearAllMocks());

  it("should mark current device with isCurrent=true", async () => {
    redis.listSessions.mockResolvedValue([
      { deviceId: "device-A", deviceName: "Chrome on Windows", ip: "127.0.0.1", createdAt: "2025-01-01T00:00:00Z", lastActive: "2025-01-02T00:00:00Z" },
      { deviceId: "device-B", deviceName: "Safari on iPhone", ip: "192.168.1.1", createdAt: "2025-01-01T00:00:00Z", lastActive: "2025-01-03T00:00:00Z" },
    ]);

    const result = await sessionService.listSessions({ userId: 1, currentDeviceId: "device-A" });

    expect(result).toHaveLength(2);
    expect(result.find((s) => s.deviceId === "device-A").isCurrent).toBe(true);
    expect(result.find((s) => s.deviceId === "device-B").isCurrent).toBe(false);
  });

  it("should return empty array when no sessions", async () => {
    redis.listSessions.mockResolvedValue([]);

    const result = await sessionService.listSessions({ userId: 1, currentDeviceId: "device-X" });

    expect(result).toEqual([]);
  });

  it("should NOT expose refreshToken in returned data", async () => {
    redis.listSessions.mockResolvedValue([
      {
        deviceId: "device-A",
        deviceName: "Chrome on Windows",
        ip: "127.0.0.1",
        refreshToken: "secret-token-should-not-be-returned",
        createdAt: "2025-01-01T00:00:00Z",
        lastActive: "2025-01-02T00:00:00Z",
      },
    ]);

    const result = await sessionService.listSessions({ userId: 1, currentDeviceId: "device-A" });

    expect(result[0]).not.toHaveProperty("refreshToken");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION SERVICE — revokeSession
// ════════════════════════════════════════════════════════════════════════════

describe("sessionService.revokeSession", () => {
  const sessionService = require("../../src/services/session.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 if targetDeviceId is missing", async () => {
    await expect(
      sessionService.revokeSession({ userId: 1, targetDeviceId: null, currentDeviceId: "device-A" })
    ).rejects.toMatchObject({ statusCode: 400, message: "Device ID is required" });
  });

  it("should throw 400 if trying to revoke current device", async () => {
    await expect(
      sessionService.revokeSession({ userId: 1, targetDeviceId: "device-A", currentDeviceId: "device-A" })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Không thể") });
  });

  it("should call deleteSession for valid target device", async () => {
    redis.deleteSession.mockResolvedValue(true);

    await sessionService.revokeSession({ userId: 1, targetDeviceId: "device-B", currentDeviceId: "device-A" });

    expect(redis.deleteSession).toHaveBeenCalledWith(1, "device-B");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SESSION SERVICE — revokeOtherSessions
// ════════════════════════════════════════════════════════════════════════════

describe("sessionService.revokeOtherSessions", () => {
  const sessionService = require("../../src/services/session.service");

  beforeEach(() => jest.clearAllMocks());

  it("should throw 400 if currentDeviceId is missing", async () => {
    await expect(
      sessionService.revokeOtherSessions({ userId: 1, currentDeviceId: null })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("should call deleteOtherSessions with correct params", async () => {
    redis.deleteOtherSessions.mockResolvedValue(true);

    await sessionService.revokeOtherSessions({ userId: 1, currentDeviceId: "device-A" });

    expect(redis.deleteOtherSessions).toHaveBeenCalledWith(1, "device-A");
  });
});