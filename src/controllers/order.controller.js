const orderService     = require("../services/order.service");
const catchAsync       = require("../utils/catchAsync");
const { sendResponse } = require("../utils/response");

// POST /api/orders
exports.createOrder = catchAsync(async (req, res) => {
  const data = await orderService.createOrder({
    userId:       req.user.id,
    items:        req.body.items,
    shippingInfo: req.body.shippingInfo,
    payMethod:    req.body.payMethod,
  });
  return sendResponse(res, 201, "success", "Order created", data);
});

// GET /api/orders/me
exports.getMyOrders = catchAsync(async (req, res) => {
  const data = await orderService.getMyOrders({
    userId: req.user.id,
    limit:  parseInt(req.query.limit) || 10,
    cursor: req.query.cursor || null,
  });
  return sendResponse(res, 200, "success", "OK", data);
});

// GET /api/orders/:id
exports.getOrderById = catchAsync(async (req, res) => {
  const data = await orderService.getOrderById({
    orderId:     req.params.id,
    requestUser: req.user,
  });
  return sendResponse(res, 200, "success", "OK", data);
});

// PATCH /api/orders/:id/cancel
exports.cancelOrder = catchAsync(async (req, res) => {
  await orderService.cancelOrder({
    orderId:     req.params.id,
    requestUser: req.user,
  });
  return sendResponse(res, 200, "success", "Order cancelled");
});

// GET /api/orders  (admin)
exports.getAllOrders = catchAsync(async (req, res) => {
  const data = await orderService.getAllOrders({
    page:   parseInt(req.query.page)  || 1,
    limit:  parseInt(req.query.limit) || 20,
    status: req.query.status,
  });
  return sendResponse(res, 200, "success", "OK", data);
});

// PATCH /api/orders/:id/status  (admin)
exports.updateOrderStatus = catchAsync(async (req, res) => {
  await orderService.updateOrderStatus({
    orderId:   req.params.id,
    newStatus: req.body.status,
  });
  return sendResponse(res, 200, "success", "Order status updated");
});