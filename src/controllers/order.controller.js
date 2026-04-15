// const { Order, OrderItem, Product } = require("../models/index");
// const { sendResponse } = require("../utils/response");
// const AppError = require("../utils/AppError");
// const asyncWrapper = require("../utils/asyncWrapper");

// const parsePrice = (priceStr) => {
//   return parseFloat(priceStr.replace(/[^0-9]/g, ""));
// };

// exports.createOrder = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const { items, shippingInfo, payMethod } = req.body;

//   if (!items || items.length === 0) {
//     throw new AppError("Order must have at least 1 item", 400);
//   }

//   let totalAmount = 0;
//   const orderItemsData = [];

//   for (const item of items) {
//     const product = await Product.findByPk(item.productId);
//     if (!product) throw new AppError(`Product ${item.productId} not found`, 404);
//     const unitPrice = parsePrice(product.price);
//     totalAmount += unitPrice * item.quantity;
//     orderItemsData.push({
//       productId: product.id,
//       quantity: item.quantity,
//       price: unitPrice,
//     });
//   }

//   const order = await Order.create({
//     userId,
//     totalAmount,
//     shippingName:    shippingInfo?.name,
//     shippingPhone:   shippingInfo?.phone,
//     shippingEmail:   shippingInfo?.email,
//     shippingAddress: shippingInfo?.address,
//     payMethod:       payMethod || "cod",
//   });

//   const itemsWithOrderId = orderItemsData.map(i => ({ ...i, orderId: order.id }));
//   await OrderItem.bulkCreate(itemsWithOrderId);

//   return sendResponse(res, 201, "success", "Order created", {
//     orderId: order.id,
//     totalAmount,
//   });
// });

// exports.getMyOrders = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const orders = await Order.findAll({
//     where: { userId },
//     attributes: ["id", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod"
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }]
//     }],
//     order: [["createdAt", "DESC"]],
//   });
//   return sendResponse(res, 200, "success", "OK", orders);
// });

// exports.getOrderById = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const order = await Order.findOne({
//     where: { id: req.params.id },
//     attributes: ["id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod"
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }]
//     }],
//   });

//   if (!order) throw new AppError("Order not found", 404);
//   if (order.userId !== userId && req.user.role !== "admin") {
//     throw new AppError("Forbidden", 403);
//   }

//   return sendResponse(res, 200, "success", "OK", order);
// });

// exports.cancelOrder = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const order = await Order.findByPk(req.params.id);

//   if (!order) throw new AppError("Order not found", 404);
//   if (order.userId !== userId) throw new AppError("Forbidden", 403);
//   if (order.status === "completed") throw new AppError("Cannot cancel a completed order", 400);
//   if (order.status === "cancelled") throw new AppError("Order already cancelled", 400);

//   await order.update({ status: "cancelled" });
//   return sendResponse(res, 200, "success", "Order cancelled");
// });

// // GET /orders – Admin xem tất cả ✅ có shipping info
// exports.getAllOrders = asyncWrapper(async (req, res, next) => {
//   const orders = await Order.findAll({
//     attributes: [
//       "id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail", // ✅
//       "shippingAddress", "payMethod"                    // ✅
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img"] }]
//     }],
//     order: [["createdAt", "DESC"]],
//   });
//   return sendResponse(res, 200, "success", "OK", orders);
// });

// // PATCH /orders/:id/status – Admin cập nhật status
// exports.updateOrderStatus = asyncWrapper(async (req, res, next) => {
//   const { status } = req.body;
//   const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

//   if (!validStatuses.includes(status)) {
//     throw new AppError("Invalid status", 400);
//   }

//   const order = await Order.findByPk(req.params.id);
//   if (!order) throw new AppError("Order not found", 404);

//   await order.update({ status });
//   return sendResponse(res, 200, "success", "Order status updated", { id: order.id, status });
// });


// const { Order, OrderItem, Product } = require("../models/index");
// const { sendResponse } = require("../utils/response");
// const AppError = require("../utils/AppError");
// const asyncWrapper = require("../utils/asyncWrapper");

// const parsePrice = (priceStr) => {
//   return parseFloat(priceStr.replace(/[^0-9]/g, ""));
// };

// exports.createOrder = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const { items, shippingInfo, payMethod } = req.body;

//   if (!items || items.length === 0) {
//     throw new AppError("Order must have at least 1 item", 400);
//   }

//   let totalAmount = 0;
//   const orderItemsData = [];

//   // ✅ Kiểm tra stock trước khi tạo order
//   for (const item of items) {
//     const product = await Product.findByPk(item.productId);
//     if (!product) throw new AppError(`Product ${item.productId} not found`, 404);

//     // ✅ Kiểm tra còn hàng không
//     if (product.stock < item.quantity) {
//       throw new AppError(
//         `Sản phẩm "${product.title}" chỉ còn ${product.stock} cái trong kho!`, 400
//       );
//     }

//     const unitPrice = parsePrice(product.price);
//     totalAmount += unitPrice * item.quantity;
//     orderItemsData.push({
//       productId: product.id,
//       quantity:  item.quantity,
//       price:     unitPrice,
//     });
//   }

//   const order = await Order.create({
//     userId,
//     totalAmount,
//     shippingName:    shippingInfo?.name,
//     shippingPhone:   shippingInfo?.phone,
//     shippingEmail:   shippingInfo?.email,
//     shippingAddress: shippingInfo?.address,
//     payMethod:       payMethod || "cod",
//   });

//   const itemsWithOrderId = orderItemsData.map(i => ({ ...i, orderId: order.id }));
//   await OrderItem.bulkCreate(itemsWithOrderId);

//   // ✅ Trừ stock + tăng sold sau khi tạo order thành công
//   for (const item of items) {
//     await Product.increment(
//       { stock: -item.quantity, sold: item.quantity },
//       { where: { id: item.productId } }
//     );
//   }

//   return sendResponse(res, 201, "success", "Order created", {
//     orderId: order.id,
//     totalAmount,
//   });
// });

// exports.getMyOrders = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const orders = await Order.findAll({
//     where: { userId },
//     attributes: ["id", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod"
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }]
//     }],
//     order: [["createdAt", "DESC"]],
//   });
//   return sendResponse(res, 200, "success", "OK", orders);
// });

// exports.getOrderById = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const order = await Order.findOne({
//     where: { id: req.params.id },
//     attributes: ["id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod"
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img", "price"] }]
//     }],
//   });

//   if (!order) throw new AppError("Order not found", 404);
//   if (order.userId !== userId && req.user.role !== "admin") {
//     throw new AppError("Forbidden", 403);
//   }

//   return sendResponse(res, 200, "success", "OK", order);
// });

// exports.cancelOrder = asyncWrapper(async (req, res, next) => {
//   const userId = req.user.id;
//   const order  = await Order.findByPk(req.params.id, {
//     include: [{ model: OrderItem }]
//   });

//   if (!order) throw new AppError("Order not found", 404);
//   if (order.userId !== userId) throw new AppError("Forbidden", 403);
//   if (order.status === "completed") throw new AppError("Cannot cancel a completed order", 400);
//   if (order.status === "cancelled") throw new AppError("Order already cancelled", 400);

//   await order.update({ status: "cancelled" });

//   // ✅ Hoàn lại stock khi huỷ đơn
//   for (const item of order.OrderItems) {
//     await Product.increment(
//       { stock: item.quantity, sold: -item.quantity },
//       { where: { id: item.productId } }
//     );
//   }

//   return sendResponse(res, 200, "success", "Order cancelled");
// });

// // GET /orders – Admin xem tất cả
// exports.getAllOrders = asyncWrapper(async (req, res, next) => {
//   const orders = await Order.findAll({
//     attributes: [
//       "id", "userId", "status", "totalAmount", "createdAt",
//       "shippingName", "shippingPhone", "shippingEmail",
//       "shippingAddress", "payMethod"
//     ],
//     include: [{
//       model: OrderItem,
//       attributes: ["quantity", "price"],
//       include: [{ model: Product, attributes: ["id", "title", "img"] }]
//     }],
//     order: [["createdAt", "DESC"]],
//   });
//   return sendResponse(res, 200, "success", "OK", orders);
// });

// // PATCH /orders/:id/status – Admin cập nhật status
// exports.updateOrderStatus = asyncWrapper(async (req, res, next) => {
//   const { status } = req.body;
//   const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

//   if (!validStatuses.includes(status)) {
//     throw new AppError("Invalid status", 400);
//   }

//   const order = await Order.findByPk(req.params.id);
//   if (!order) throw new AppError("Order not found", 404);

//   await order.update({ status });
//   return sendResponse(res, 200, "success", "Order status updated", { id: order.id, status });
// });


const { Op } = require("sequelize");
const sequelize = require("../config/db");
const { Order, OrderItem, Product } = require("../models/index");
const { sendResponse } = require("../utils/response");
const AppError = require("../utils/AppError");
const catchAsync = require("../utils/catchAsync");

// ─────────────────────────────────────────────
// Helper: parse price string → number
// ─────────────────────────────────────────────
const parsePrice = (priceStr) => {
  if (typeof priceStr === "number") return priceStr;
  return parseFloat(String(priceStr).replace(/[^0-9.]/g, ""));
};

// ─────────────────────────────────────────────
// POST /orders — Tạo đơn hàng
// ─────────────────────────────────────────────
exports.createOrder = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { items, shippingInfo, payMethod } = req.body;

  if (!items || items.length === 0) {
    return next(new AppError("Order must have at least 1 item", 400));
  }

  // ✅ Dùng transaction để tránh race condition
  // Nếu bất kỳ bước nào lỗi → rollback toàn bộ
  const result = await sequelize.transaction(async (t) => {
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      // ✅ Lock row khi đọc stock — ngăn 2 request đọc cùng lúc
      const product = await Product.findByPk(item.productId, {
        lock: t.LOCK.UPDATE,
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

      const unitPrice = parsePrice(product.price);
      totalAmount += unitPrice * item.quantity;
      orderItemsData.push({
        productId: product.id,
        quantity:  item.quantity,
        price:     unitPrice,
      });
    }

    // Tạo order
    const order = await Order.create({
      userId,
      totalAmount,
      shippingName:    shippingInfo?.name,
      shippingPhone:   shippingInfo?.phone,
      shippingEmail:   shippingInfo?.email,
      shippingAddress: shippingInfo?.address,
      payMethod:       payMethod || "cod",
    }, { transaction: t });

    // Tạo order items
    const itemsWithOrderId = orderItemsData.map((i) => ({
      ...i,
      orderId: order.id,
    }));
    await OrderItem.bulkCreate(itemsWithOrderId, { transaction: t });

    // ✅ Trừ stock + tăng sold — nằm trong cùng transaction
    for (const item of items) {
      await Product.increment(
        { stock: -item.quantity, sold: item.quantity },
        { where: { id: item.productId }, transaction: t }
      );
    }

    return order;
  });

  return sendResponse(res, 201, "success", "Order created", {
    orderId:     result.id,
    totalAmount: result.totalAmount,
  });
});

// ─────────────────────────────────────────────
// GET /orders/me — User xem đơn của mình
// ─────────────────────────────────────────────
exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.findAll({
    where: { userId: req.user.id },
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
  });

  return sendResponse(res, 200, "success", "OK", orders);
});

// ─────────────────────────────────────────────
// GET /orders/:id — Xem chi tiết 1 đơn
// ─────────────────────────────────────────────
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

  // ✅ User chỉ xem được đơn của mình, admin xem được tất cả
  if (order.userId !== req.user.id && req.user.role !== "admin") {
    return next(new AppError("Forbidden", 403));
  }

  return sendResponse(res, 200, "success", "OK", order);
});

// ─────────────────────────────────────────────
// PATCH /orders/:id/cancel — User huỷ đơn
// ─────────────────────────────────────────────
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByPk(req.params.id, {
    include: [{ model: OrderItem }],
  });

  if (!order) return next(new AppError("Order not found", 404));
  if (order.userId !== req.user.id) return next(new AppError("Forbidden", 403));
  if (order.status === "completed")  return next(new AppError("Cannot cancel a completed order", 400));
  if (order.status === "cancelled")  return next(new AppError("Order already cancelled", 400));

  // ✅ Hoàn stock trong transaction
  await sequelize.transaction(async (t) => {
    await order.update({ status: "cancelled" }, { transaction: t });

    for (const item of order.OrderItems) {
      await Product.increment(
        { stock: item.quantity, sold: -item.quantity },
        { where: { id: item.productId }, transaction: t }
      );
    }
  });

  return sendResponse(res, 200, "success", "Order cancelled");
});

// ─────────────────────────────────────────────
// GET /orders — Admin xem tất cả đơn
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// PATCH /orders/:id/status — Admin cập nhật trạng thái
// ─────────────────────────────────────────────
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ["pending", "confirmed", "completed", "cancelled"];

  if (!validStatuses.includes(status)) {
    return next(new AppError("Invalid status", 400));
  }

  const order = await Order.findByPk(req.params.id);
  if (!order) return next(new AppError("Order not found", 404));

  // ✅ Không cho phép chuyển ngược trạng thái (completed → pending)
  const statusFlow = { pending: 0, confirmed: 1, completed: 2, cancelled: 3 };
  if (
    order.status === "completed" ||
    order.status === "cancelled"
  ) {
    return next(new AppError(`Cannot change status from "${order.status}"`, 400));
  }

  await order.update({ status });

  return sendResponse(res, 200, "success", "Order status updated", {
    id:     order.id,
    status: order.status,
  });
});