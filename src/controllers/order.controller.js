const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { Order, OrderItem, Product, ProductPlacement } = require("../models/index");
const { sendResponse } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

const parsePrice = (priceStr) => {
  if (typeof priceStr === "number") return priceStr;
  return parseFloat(String(priceStr).replace(/[^0-9.]/g, ""));
};

/* ─────────────────────────────────────────────
   POST /orders  — Tạo đơn hàng
───────────────────────────────────────────── */
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { items, shippingInfo, payMethod } = req.body;

  if (!items || items.length === 0)
    return next(new AppError("Order must have at least 1 item", 400));

  if (!shippingInfo?.name || !shippingInfo?.phone || !shippingInfo?.email || !shippingInfo?.address)
    return next(new AppError("Shipping info (name, phone, email, address) is required", 400));

  const result = await sequelize.transaction(async (t) => {
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const product = await Product.findByPk(item.productId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!product)
        throw new AppError(`Product ${item.productId} not found`, 404);

      if (product.stock < item.quantity)
        throw new AppError(
          `Sản phẩm "${product.title}" chỉ còn ${product.stock} cái trong kho`,
          400
        );

      let flashPlacement = null;
      if (item.placementId) {
        flashPlacement = await ProductPlacement.findOne({
          where: {
            id:        item.placementId,
            productId: item.productId,
            placement: "flashsale",
          },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (flashPlacement && flashPlacement.stockLimit !== null) {
          const stockLeft = flashPlacement.stockLimit - flashPlacement.stockSold;

          if (stockLeft <= 0)
            throw new AppError(
              `Sản phẩm "${product.title}" đã hết suất flash sale`,
              409
            );

          if (stockLeft < item.quantity)
            throw new AppError(
              `Sản phẩm "${product.title}" chỉ còn ${stockLeft} suất flash sale`,
              409
            );
        }
      }

      let unitPrice = parsePrice(product.price);

      if (item.placementId && flashPlacement?.salePrice) {
        const now = new Date();
        const saleActive =
          (!flashPlacement.saleStartAt || flashPlacement.saleStartAt <= now) &&
          (!flashPlacement.saleEndAt   || flashPlacement.saleEndAt   >= now);

        if (saleActive) {
          unitPrice = parsePrice(flashPlacement.salePrice);
        }
      }

      totalAmount += unitPrice * item.quantity;
      orderItemsData.push({
        productId:   product.id,
        quantity:    item.quantity,
        price:       unitPrice,
        placementId: item.placementId || null,
      });
    }

    const order = await Order.create({
      userId,
      totalAmount,
      shippingName:    shippingInfo.name,
      shippingPhone:   shippingInfo.phone,
      shippingEmail:   shippingInfo.email,
      shippingAddress: shippingInfo.address,
      payMethod:       payMethod || "cod",
    }, { transaction: t });

    await OrderItem.bulkCreate(
      orderItemsData.map(i => ({ ...i, orderId: order.id })),
      { transaction: t }
    );

    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity, sold: item.quantity },
        { where: { id: item.productId }, transaction: t }
      );
    }

    for (const item of orderItemsData) {
      if (!item.placementId) continue;

      await ProductPlacement.increment(
        { stockSold: item.quantity },
        {
          where: { id: item.placementId, placement: "flashsale" },
          transaction: t,
        }
      );
    }

    return order;
  });

  return sendResponse(res, 201, "success", "Order created", {
    orderId:     result.id,
    totalAmount: result.totalAmount,
  });
});

/* ─────────────────────────────────────────────
   GET /orders/me  — Cursor-based pagination
───────────────────────────────────────────── */
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const limit  = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor || null;

  const where = { userId: req.user.id };
  if (cursor) {
    where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
  }

  const orders = await Order.findAll({
    where,
    attributes: [
      "id", "status", "totalAmount", "createdAt",
      "shippingName", "shippingPhone", "shippingEmail",
      "shippingAddress", "payMethod",
    ],
    include: [{
      model: OrderItem,
      attributes: ["quantity", "price"],
      include: [{ model: Product, attributes: ["id", "title", "img", "price"] }],
    }],
    order: [["createdAt", "DESC"]],
    limit: limit + 1,
  });

  const hasMore    = orders.length > limit;
  const data       = hasMore ? orders.slice(0, -1) : orders;
  const nextCursor = hasMore
    ? data[data.length - 1].createdAt.getTime().toString()
    : null;

  return sendResponse(res, 200, "success", "OK", { data, hasMore, nextCursor });
});

/* ─────────────────────────────────────────────
   GET /orders/:id
───────────────────────────────────────────── */
exports.getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({
    where: { id: req.params.id },
    attributes: [
      "id", "userId", "status", "totalAmount", "createdAt",
      "shippingName", "shippingPhone", "shippingEmail",
      "shippingAddress", "payMethod",
    ],
    include: [{
      model: OrderItem,
      attributes: ["quantity", "price"],
      include: [{ model: Product, attributes: ["id", "title", "img", "price"] }],
    }],
  });

  if (!order) return next(new AppError("Order not found", 404));

  if (order.userId !== req.user.id && req.user.role !== "admin")
    return next(new AppError("Forbidden", 403));

  return sendResponse(res, 200, "success", "OK", order);
});

/* ─────────────────────────────────────────────
   PATCH /orders/:id/cancel
───────────────────────────────────────────── */
exports.cancelOrder = catchAsync(async (req, res, next) => {
  await sequelize.transaction(async (t) => {
    // ── Bước 1: Load order kèm items, lock row để đọc thông tin ──
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem }],
      lock: t.LOCK.UPDATE, // ✅ Lock row — chặn request đồng thời đọc cùng lúc
      transaction: t,
    });

    if (!order) throw new AppError("Order not found", 404);
    if (order.userId !== req.user.id) throw new AppError("Forbidden", 403);
    if (order.status === "completed") throw new AppError("Cannot cancel a completed order", 400);
    if (order.status === "cancelled") throw new AppError("Order already cancelled", 400);

    // ── Bước 2: Atomic UPDATE — chỉ update nếu status vẫn còn cancellable ──
    // WHERE id = ? AND status IN ('pending', 'confirmed')
    // Nếu status đã bị đổi bởi request khác → affectedRows = 0 → throw error
    const [affectedRows] = await Order.update(
      { status: "cancelled" },
      {
        where: {
          id:     order.id,
          status: { [Op.in]: ["pending", "confirmed"] },
        },
        transaction: t,
      }
    );

    // affectedRows = 0 → status đã bị thay đổi bởi request khác trước đó
    if (affectedRows === 0) {
      throw new AppError("Order đã được xử lý bởi một yêu cầu khác, vui lòng thử lại", 409);
    }

    // ── Bước 3: Hoàn stock + sold sau khi cancel thành công ──
    for (const item of order.OrderItems) {
      await Product.increment(
        { stock: item.quantity, sold: -item.quantity },
        { where: { id: item.productId }, transaction: t }
      );

      // Hoàn stockSold flash sale nếu có
      if (item.placementId) {
        await ProductPlacement.increment(
          { stockSold: -item.quantity },
          {
            where: {
              id:        item.placementId,
              placement: "flashsale",
              // Đảm bảo stockSold không bị âm
              stockSold: { [Op.gte]: item.quantity },
            },
            transaction: t,
          }
        );
      }
    }
  });

  return sendResponse(res, 200, "success", "Order cancelled");
});

/* ─────────────────────────────────────────────
   GET /orders  — Admin + Pagination
───────────────────────────────────────────── */
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const page   = parseInt(req.query.page)   || 1;
  const limit  = parseInt(req.query.limit)  || 20;
  const offset = (page - 1) * limit;
  const status = req.query.status;

  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
  const where = {};
  if (status && validStatuses.includes(status)) {
    where.status = status;
  }

  const { count, rows } = await Order.findAndCountAll({
    where,
    attributes: [
      "id", "userId", "status", "totalAmount", "createdAt",
      "shippingName", "shippingPhone", "shippingEmail",
      "shippingAddress", "payMethod",
    ],
    include: [{
      model: OrderItem,
      attributes: ["quantity", "price"],
      include: [{ model: Product, attributes: ["id", "title", "img"] }],
    }],
    order: [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return sendResponse(res, 200, "success", "OK", {
    data: rows,
    meta: {
      total:      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  });
});

/* ─────────────────────────────────────────────
   PATCH /orders/:id/status  — Admin
───────────────────────────────────────────── */
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

  if (!validStatuses.includes(status))
    return next(new AppError("Invalid status", 400));

  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(req.params.id, {
      include: [{ model: OrderItem }],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!order) throw new AppError("Order not found", 404);

    if (order.status === "completed" || order.status === "cancelled")
      throw new AppError(`Cannot change status from "${order.status}"`, 400);

    
    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.OrderItems) {
        await Product.increment(
          { stock: item.quantity, sold: -item.quantity },
          { where: { id: item.productId }, transaction: t }
        );

        if (item.placementId) {
          await ProductPlacement.increment(
            { stockSold: -item.quantity },
            {
              where: {
                id:        item.placementId,
                placement: "flashsale",
                stockSold: { [Op.gte]: item.quantity },
              },
              transaction: t,
            }
          );
        }
      }
    }

    await order.update({ status }, { transaction: t });
  });

  return sendResponse(res, 200, "success", "Order status updated");
});