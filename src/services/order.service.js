const { Op }    = require("sequelize");
const sequelize = require("../config/db");
const { Order, OrderItem, Product, ProductPlacement } = require("../models/index");
const AppError  = require("../utils/AppError");

// ─────────────────────────────────────────────
// Private helper
// DECIMAL từ MySQL trả về dạng string → parse về number
// ─────────────────────────────────────────────
const parsePrice = (val) => {
  if (typeof val === "number") return val;
  return parseFloat(String(val).replace(/[^0-9.]/g, ""));
};

// ─────────────────────────────────────────────
// createOrder({ userId, items, shippingInfo, payMethod })
// → { orderId, totalAmount }
// ─────────────────────────────────────────────
exports.createOrder = async ({ userId, items, shippingInfo, payMethod }) => {
  if (!items || items.length === 0) {
    throw new AppError("Order must have at least 1 item", 400);
  }

  if (
    !shippingInfo?.name  ||
    !shippingInfo?.phone ||
    !shippingInfo?.email ||
    !shippingInfo?.address
  ) {
    throw new AppError("Shipping info (name, phone, email, address) is required", 400);
  }

  const result = await sequelize.transaction(async (t) => {
    let totalAmount      = 0;
    const orderItemsData = [];

    for (const item of items) {
      // ── Lock row để tránh race condition oversell ────────────────────
      const product = await Product.findByPk(item.productId, {
        lock:        t.LOCK.UPDATE,
        transaction: t,
      });

      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404);
      }

      if (product.stock < item.quantity) {
        throw new AppError(
          `Sản phẩm "${product.title}" chỉ còn ${product.stock} cái trong kho`,
          400
        );
      }

      // ── Flash sale: check stockLimit còn đủ không ───────────────────
      let flashPlacement = null;
      if (item.placementId) {
        flashPlacement = await ProductPlacement.findOne({
          where: {
            id:        item.placementId,
            productId: item.productId,
            placement: "flashsale",
          },
          lock:        t.LOCK.UPDATE,
          transaction: t,
        });

        if (flashPlacement?.stockLimit !== null && flashPlacement?.stockLimit !== undefined) {
          const stockLeft = flashPlacement.stockLimit - flashPlacement.stockSold;

          if (stockLeft <= 0) {
            throw new AppError(
              `Sản phẩm "${product.title}" đã hết suất flash sale`,
              409
            );
          }

          if (stockLeft < item.quantity) {
            throw new AppError(
              `Sản phẩm "${product.title}" chỉ còn ${stockLeft} suất flash sale`,
              409
            );
          }
        }
      }

      // ── Tính giá: dùng salePrice nếu flash sale đang active ─────────
      let unitPrice = parsePrice(product.price);
      if (item.placementId && flashPlacement?.salePrice) {
        const now        = new Date();
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

    // ── Tạo Order ────────────────────────────────────────────────────
    const order = await Order.create(
      {
        userId,
        totalAmount,
        shippingName:    shippingInfo.name,
        shippingPhone:   shippingInfo.phone,
        shippingEmail:   shippingInfo.email,
        shippingAddress: shippingInfo.address,
        payMethod:       payMethod || "cod",
      },
      { transaction: t }
    );

    // ── Tạo OrderItems ───────────────────────────────────────────────
    await OrderItem.bulkCreate(
      orderItemsData.map((i) => ({ ...i, orderId: order.id })),
      { transaction: t }
    );

    // ── Trừ stock, cộng sold ─────────────────────────────────────────
    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity, sold: item.quantity },
        { where: { id: item.productId }, transaction: t }
      );
    }

    // ── Cộng stockSold flash sale ────────────────────────────────────
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

  return {
    orderId:     result.id,
    totalAmount: result.totalAmount,
  };
};

// ─────────────────────────────────────────────
// getMyOrders({ userId, limit, cursor })
// → { data, hasMore, nextCursor }
// Cursor-based pagination — tránh offset chậm khi data lớn
// ─────────────────────────────────────────────
exports.getMyOrders = async ({ userId, limit = 10, cursor = null }) => {
  const where = { userId };

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
    include: [
      {
        model:      OrderItem,
        attributes: ["quantity", "price"],
        include:    [
          { model: Product, attributes: ["id", "title", "img", "price"] },
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
    limit: limit + 1, // lấy thêm 1 để biết còn trang tiếp không
  });

  const hasMore    = orders.length > limit;
  const data       = hasMore ? orders.slice(0, -1) : orders;
  const nextCursor = hasMore
    ? data[data.length - 1].createdAt.getTime().toString()
    : null;

  return { data, hasMore, nextCursor };
};

// ─────────────────────────────────────────────
// getOrderById({ orderId, requestUser })
// → Order
// ─────────────────────────────────────────────
exports.getOrderById = async ({ orderId, requestUser }) => {
  const order = await Order.findOne({
    where:      { id: orderId },
    attributes: [
      "id", "userId", "status", "totalAmount", "createdAt",
      "shippingName", "shippingPhone", "shippingEmail",
      "shippingAddress", "payMethod",
    ],
    include: [
      {
        model:      OrderItem,
        attributes: ["quantity", "price"],
        include:    [
          { model: Product, attributes: ["id", "title", "img", "price"] },
        ],
      },
    ],
  });

  if (!order) throw new AppError("Order not found", 404);

  // User chỉ xem được đơn của mình, admin xem được tất cả
  if (order.userId !== requestUser.id && requestUser.role !== "admin") {
    throw new AppError("Forbidden", 403);
  }

  return order;
};

// ─────────────────────────────────────────────
// cancelOrder({ orderId, requestUser })
// → void
// Dùng atomic UPDATE để chống race condition double-cancel
// ─────────────────────────────────────────────
exports.cancelOrder = async ({ orderId, requestUser }) => {
  await sequelize.transaction(async (t) => {
    // Lock row — chặn request đồng thời đọc cùng lúc
    const order = await Order.findByPk(orderId, {
      include:     [{ model: OrderItem }],
      lock:        t.LOCK.UPDATE,
      transaction: t,
    });

    if (!order) throw new AppError("Order not found", 404);

    if (order.userId !== requestUser.id) {
      throw new AppError("Forbidden", 403);
    }

    if (order.status === "completed") {
      throw new AppError("Cannot cancel a completed order", 400);
    }

    if (order.status === "cancelled") {
      throw new AppError("Order already cancelled", 400);
    }

    // Atomic UPDATE — chỉ update nếu status vẫn còn cancellable
    // Nếu request khác đã đổi status trước → affectedRows = 0 → throw
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

    if (affectedRows === 0) {
      throw new AppError(
        "Order đã được xử lý bởi một yêu cầu khác, vui lòng thử lại",
        409
      );
    }

    // ── Hoàn stock + sold sau khi cancel ────────────────────────────
    for (const item of order.OrderItems) {
      await Product.increment(
        { stock: item.quantity, sold: -item.quantity },
        { where: { id: item.productId }, transaction: t }
      );

      // Hoàn stockSold flash sale nếu đơn này mua qua flash sale
      if (item.placementId) {
        await ProductPlacement.increment(
          { stockSold: -item.quantity },
          {
            where: {
              id:        item.placementId,
              placement: "flashsale",
              stockSold: { [Op.gte]: item.quantity }, // đảm bảo không âm
            },
            transaction: t,
          }
        );
      }
    }
  });
};

// ─────────────────────────────────────────────
// getAllOrders({ page, limit, status })
// → { data, meta }
// Admin only — offset pagination
// ─────────────────────────────────────────────
exports.getAllOrders = async ({ page = 1, limit = 20, status } = {}) => {
  const offset        = (page - 1) * limit;
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
    include: [
      {
        model:      OrderItem,
        attributes: ["quantity", "price"],
        include:    [
          { model: Product, attributes: ["id", "title", "img"] },
        ],
      },
    ],
    order:  [["createdAt", "DESC"]],
    limit,
    offset,
  });

  return {
    data: rows,
    meta: {
      total:      count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    },
  };
};

// ─────────────────────────────────────────────
// updateOrderStatus({ orderId, newStatus })
// → void
// Admin only — hoàn stock tự động nếu admin cancel
// ─────────────────────────────────────────────
exports.updateOrderStatus = async ({ orderId, newStatus }) => {
  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

  if (!validStatuses.includes(newStatus)) {
    throw new AppError("Invalid status", 400);
  }

  await sequelize.transaction(async (t) => {
    const order = await Order.findByPk(orderId, {
      include:     [{ model: OrderItem }],
      lock:        t.LOCK.UPDATE,
      transaction: t,
    });

    if (!order) throw new AppError("Order not found", 404);

    if (order.status === "completed" || order.status === "cancelled") {
      throw new AppError(`Cannot change status from "${order.status}"`, 400);
    }

    // Hoàn stock nếu admin chuyển sang cancelled
    if (newStatus === "cancelled" && order.status !== "cancelled") {
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

    await order.update({ status: newStatus }, { transaction: t });
  });
};