
// const { Op } = require("sequelize");
// const sequelize = require("../config/db");
// const { Order, OrderItem, Product } = require("../models/index");
// const { sendResponse } = require("../utils/response");
// const AppError = require("../utils/AppError");
// const catchAsync = require("../utils/catchAsync");

// // ─────────────────────────────────────────────
// // Helper: parse price string → number
// // ─────────────────────────────────────────────
// const parsePrice = (priceStr) => {
//   if (typeof priceStr === "number") return priceStr;
//   return parseFloat(String(priceStr).replace(/[^0-9.]/g, ""));
// };

// // ─────────────────────────────────────────────
// // POST /orders — Tạo đơn hàng
// // ─────────────────────────────────────────────
// exports.createOrder = catchAsync(async (req, res, next) => {
//   const userId = req.user.id;
//   const { items, shippingInfo, payMethod } = req.body;

//   if (!items || items.length === 0) {
//     return next(new AppError("Order must have at least 1 item", 400));
//   }

//   // ✅ Dùng transaction để tránh race condition
//   const result = await sequelize.transaction(async (t) => {
//     let totalAmount = 0;
//     const orderItemsData = [];

//     for (const item of items) {
//       // ✅ Lock row khi đọc stock — ngăn 2 request đọc cùng lúc
//       const product = await Product.findByPk(item.productId, {
//         lock: t.LOCK.UPDATE,
//         transaction: t,
//       });

//       if (!product) {
//         throw new AppError(`Product ${item.productId} not found`, 404);
//       }

//       if (product.stock < item.quantity) {
//         throw new AppError(
//           `Sản phẩm "${product.title}" chỉ còn ${product.stock} cái trong kho`,
//           400
//         );
//       }

//       const unitPrice = parsePrice(product.price);
//       totalAmount += unitPrice * item.quantity;
//       orderItemsData.push({
//         productId: product.id,
//         quantity:  item.quantity,
//         price:     unitPrice,
//       });
//     }

//     const order = await Order.create({
//       userId,
//       totalAmount,
//       shippingName:    shippingInfo?.name,
//       shippingPhone:   shippingInfo?.phone,
//       shippingEmail:   shippingInfo?.email,
//       shippingAddress: shippingInfo?.address,
//       payMethod:       payMethod || "cod",
//     }, { transaction: t });

//     const itemsWithOrderId = orderItemsData.map((i) => ({
//       ...i,
//       orderId: order.id,
//     }));
//     await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });

//     // ✅ Trừ stock + tăng sold — nằm trong cùng transaction
//     for (const item of items) {
//       await Product.increment(
//         { stock: -item.quantity, sold: item.quantity },
//         { where: { id: item.productId }, transaction: t }
//       );
//     }

//     return order;
//   });

//   return sendResponse(res, 201, "success", "Order created", {
//     orderId:     result.id,
//     totalAmount: result.totalAmount,
//   });
// });

// // ─────────────────────────────────────────────
// // GET /orders/me — User xem đơn của mình
// // ✅ Cursor-based pagination — phù hợp cho infinite scroll
// // Dùng createdAt làm cursor thay vì OFFSET
// // Tại sao không dùng offset: OFFSET lớn = MySQL scan nhiều rows = chậm
// // Cursor query: WHERE createdAt < cursor → luôn O(1) dù có bao nhiêu đơn
// //
// // Cách dùng:
// //   Lần đầu: GET /orders/me?limit=10
// //   Trang tiếp: GET /orders/me?cursor=<nextCursor>&limit=10
// // ─────────────────────────────────────────────
// exports.getMyOrders = catchAsync(async (req, res, next) => {
//   const limit  = parseInt(req.query.limit)  || 10;
//   const cursor = req.query.cursor || null; // cursor = createdAt của item cuối

//   const where = { userId: req.user.id };

//   // ✅ Nếu có cursor → chỉ lấy orders cũ hơn cursor đó
//   if (cursor) {
//     where.createdAt = { [Op.lt]: new Date(parseInt(cursor)) };
//   }

//   // ✅ Lấy thêm 1 item để biết còn trang tiếp không
//   const orders = await Order.findAll({
//     where,
//     attributes: [
//       "id", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod",
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }],
//     }],
//     order: [["createdAt", "DESC"]],
//     limit: limit + 1, // lấy thêm 1 để check hasMore
//   });

//   // ✅ Kiểm tra còn trang tiếp không
//   const hasMore = orders.length > limit;
//   const data    = hasMore ? orders.slice(0, -1) : orders;

//   // ✅ nextCursor = timestamp của item cuối cùng
//   const nextCursor = hasMore
//     ? data[data.length - 1].createdAt.getTime().toString()
//     : null;

//   return sendResponse(res, 200, "success", "OK", {
//     data,
//     hasMore,
//     nextCursor, // Client dùng cursor này để load trang tiếp
//   });
// });

// // ─────────────────────────────────────────────
// // GET /orders/:id — Xem chi tiết 1 đơn
// // ─────────────────────────────────────────────
// exports.getOrderById = catchAsync(async (req, res, next) => {
//   const order = await Order.findOne({
//     where: { id: req.params.id },
//     attributes: [
//       "id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod",
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }],
//     }],
//   });

//   if (!order) return next(new AppError("Order not found", 404));

//   // ✅ User chỉ xem được đơn của mình, admin xem được tất cả
//   if (order.userId !== req.user.id && req.user.role !== "admin") {
//     return next(new AppError("Forbidden", 403));
//   }

//   return sendResponse(res, 200, "success", "OK", order);
// });

// // ─────────────────────────────────────────────
// // PATCH /orders/:id/cancel — User huỷ đơn
// // ─────────────────────────────────────────────
// exports.cancelOrder = catchAsync(async (req, res, next) => {
//   const order = await Order.findByPk(req.params.id, {
//     include: [{ model: OrderItem }],
//   });

//   if (!order) return next(new AppError("Order not found", 404));
//   if (order.userId !== req.user.id) return next(new AppError("Forbidden", 403));
//   if (order.status === "completed")  return next(new AppError("Cannot cancel a completed order", 400));
//   if (order.status === "cancelled")  return next(new AppError("Order already cancelled", 400));

//   // ✅ Hoàn stock trong transaction
//   await sequelize.transaction(async (t) => {
//     await order.update({ status: "cancelled" }, { transaction: t });

//     for (const item of order.OrderItems) {
//       await Product.increment(
//         { stock: item.quantity, sold: -item.quantity },
//         { where: { id: item.productId }, transaction: t }
//       );
//     }
//   });

//   return sendResponse(res, 200, "success", "Order cancelled");
// });

// // ─────────────────────────────────────────────
// // GET /orders — Admin xem tất cả đơn
// // ─────────────────────────────────────────────
// exports.getAllOrders = catchAsync(async (req, res, next) => {
//   const orders = await Order.findAll({
//     attributes: [
//       "id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod",
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img"] }],
//     }],
//     order: [["createdAt", "DESC"]],
//   });

//   return sendResponse(res, 200, "success", "OK", orders);
// });

// // ─────────────────────────────────────────────
// // PATCH /orders/:id/status — Admin cập nhật trạng thái
// // ─────────────────────────────────────────────
// exports.updateOrderStatus = catchAsync(async (req, res, next) => {
//   const { status } = req.body;
//   const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

//   if (!validStatuses.includes(status)) {
//     return next(new AppError("Invalid status", 400));
//   }

//   const order = await Order.findByPk(req.params.id);
//   if (!order) return next(new AppError("Order not found", 404));

//   if (
//     order.status === "completed" ||
//     order.status === "cancelled"
//   ) {
//     return next(new AppError(`Cannot change status from "${order.status}"`, 400));
//   }

//   await order.update({ status });

//   return sendResponse(res, 200, "success", "Order status updated", {
//     id:     order.id,
//     status: order.status,
//   });
// });


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

  const result = await sequelize.transaction(async (t) => {
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      // ── 1. Lock product row ──────────────────────────────────
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

      // ── 2. Kiểm tra flash sale stock nếu item có placementId ──
      // FE gửi lên placementId khi mua từ trang flash sale
      let flashPlacement = null;
      if (item.placementId) {
        flashPlacement = await ProductPlacement.findOne({
          where: {
            id:        item.placementId,
            productId: item.productId,
            placement: 'flashsale',
          },
          lock: t.LOCK.UPDATE, // lock để tránh 2 user cùng mua lúc hết suất
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

      // ── 3. Tính giá — ưu tiên salePrice nếu có ──────────────
      // FE gửi salePrice lên khi mua từ flash sale
      // BE double-check với DB thay vì tin hoàn toàn vào FE
      let unitPrice = parsePrice(product.price);

      if (item.placementId && flashPlacement && flashPlacement.salePrice) {
        // Verify sale còn hiệu lực
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
        placementId: item.placementId || null, // lưu để biết đây là flash sale item
      });
    }

    // ── 4. Tạo order ─────────────────────────────────────────
    const order = await Order.create({
      userId,
      totalAmount,
      shippingName:    shippingInfo?.name,
      shippingPhone:   shippingInfo?.phone,
      shippingEmail:   shippingInfo?.email,
      shippingAddress: shippingInfo?.address,
      payMethod:       payMethod || "cod",
    }, { transaction: t });

    await OrderItem.bulkCreate(
      orderItemsData.map(i => ({ ...i, orderId: order.id })),
      { transaction: t }
    );

    // ── 5. Trừ stock kho + tăng sold ─────────────────────────
    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity, sold: item.quantity },
        { where: { id: item.productId }, transaction: t }
      );
    }

    // ── 6. Tăng stockSold flash sale (cùng transaction) ──────
    // Chỉ tăng cho items có placementId hợp lệ
    for (const item of orderItemsData) {
      if (!item.placementId) continue;

      await ProductPlacement.increment(
        { stockSold: item.quantity },
        {
          where: {
            id:        item.placementId,
            placement: 'flashsale',
          },
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
   GET /orders/me  — User xem đơn của mình
   Cursor-based pagination
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
  const order = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem }],
  });

  if (!order) return next(new AppError("Order not found", 404));
  if (order.userId !== req.user.id) return next(new AppError("Forbidden", 403));
  if (order.status === "completed")  return next(new AppError("Cannot cancel a completed order", 400));
  if (order.status === "cancelled")  return next(new AppError("Order already cancelled", 400));

  await sequelize.transaction(async (t) => {
    await order.update({ status: "cancelled" }, { transaction: t });

    for (const item of order.OrderItems) {
      // ── Hoàn stock kho ──────────────────────────────────────
      await Product.increment(
        { stock: item.quantity, sold: -item.quantity },
        { where: { id: item.productId }, transaction: t }
      );

      // ── Hoàn stockSold flash sale nếu có ───────────────────
      if (item.placementId) {
        await ProductPlacement.increment(
          { stockSold: -item.quantity },
          {
            where: {
              id:        item.placementId,
              placement: 'flashsale',
              // Đảm bảo không xuống âm
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
   GET /orders  — Admin
───────────────────────────────────────────── */
exports.getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.findAll({
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
  });

  return sendResponse(res, 200, "success", "OK", orders);
});

/* ─────────────────────────────────────────────
   PATCH /orders/:id/status  — Admin
───────────────────────────────────────────── */
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

  if (!validStatuses.includes(status))
    return next(new AppError("Invalid status", 400));

  const order = await Order.findByPk(req.params.id);
  if (!order) return next(new AppError("Order not found", 404));

  if (order.status === "completed" || order.status === "cancelled")
    return next(new AppError(`Cannot change status from "${order.status}"`, 400));

  await order.update({ status });

  return sendResponse(res, 200, "success", "Order status updated", {
    id:     order.id,
    status: order.status,
  });
});