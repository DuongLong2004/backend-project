// const express = require('express');
// const router = express.Router();
// const { Op } = require('sequelize');
// const { Product, ProductPlacement } = require('../models/index');
// const { sendResponse } = require('../utils/response');
// const AppError = require('../utils/AppError');
// const catchAsync = require('../utils/catchAsync');
// const { verifyToken } = require('../middlewares/auth.middleware');
// const checkRole = require('../middlewares/checkRole');

// const VP = ['homepage', 'phones', 'laptops', 'flashsale'];

// /* ─── GET /placements ─── */
// router.get('/', catchAsync(async (req, res, next) => {
//   const { placement } = req.query;
//   if (!placement || !VP.includes(placement))
//     return next(new AppError('placement khong hop le', 400));

//   const now = new Date();
//   const pw = { placement };

//   if (placement === 'flashsale') {
//     // ✅ FIX: trả về tất cả — active + upcoming (saleStartAt > now)
//     // Chỉ loại bỏ sản phẩm đã KẾT THÚC (saleEndAt < now)
//     // Sản phẩm không có thời gian (null) → luôn hiện
//     pw[Op.or] = [
//       { saleEndAt: null },                  // không set thời gian → luôn hiện
//       { saleEndAt: { [Op.gte]: now } },     // chưa kết thúc (active hoặc upcoming)
//     ];
//   }

//   const rows = await ProductPlacement.findAll({
//     where: pw,
//     order: [['sortOrder', 'ASC']],
//     include: [{
//       model: Product,
//       as: 'product',
//       where: { status: 'active' },
//       attributes: ['id', 'brand', 'title', 'img', 'category', 'price', 'oldPrice', 'discount', 'stock', 'sold', 'avgRating', 'totalReviews'],
//     }],
//   });

//   const data = rows.map(p => {
//     const item = p.product.toJSON();
//     item.placementId = p.id;
//     item.sortOrder   = p.sortOrder;
//     if (placement === 'flashsale') {
//       item.salePrice   = p.salePrice;
//       item.saleStartAt = p.saleStartAt;
//       item.saleEndAt   = p.saleEndAt;
//     }
//     return item;
//   });

//   return sendResponse(res, 200, 'success', 'OK', data);
// }));

// /* ─── GET /placements/admin ─── */
// router.get('/admin', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
//   const { placement } = req.query;
//   if (!placement || !VP.includes(placement))
//     return next(new AppError('placement khong hop le', 400));

//   const rows = await ProductPlacement.findAll({
//     where: { placement },
//     order: [['sortOrder', 'ASC']],
//     include: [{
//       model: Product,
//       as: 'product',
//       attributes: ['id', 'brand', 'title', 'img', 'category', 'price', 'oldPrice', 'stock', 'status'],
//     }],
//   });

//   return sendResponse(res, 200, 'success', 'OK', rows);
// }));

// /* ─── POST /placements ─── */
// router.post('/', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
//   const { productId, placement, salePrice, saleStartAt, saleEndAt } = req.body;
//   if (!productId || !placement)
//     return next(new AppError('Thieu productId hoac placement', 400));
//   if (!VP.includes(placement))
//     return next(new AppError('placement khong hop le', 400));

//   const product = await Product.findByPk(productId);
//   if (!product) return next(new AppError('San pham khong ton tai', 404));

//   const existing = await ProductPlacement.findOne({ where: { productId, placement } });
//   if (existing) return next(new AppError('San pham da duoc them vao vi tri nay roi', 409));

//   const maxOrder = await ProductPlacement.max('sortOrder', { where: { placement } }) || 0;
//   if (placement === 'flashsale' && !salePrice)
//     return next(new AppError('Flash sale can co salePrice', 400));

//   const entry = await ProductPlacement.create({
//     productId, placement,
//     sortOrder:   maxOrder + 1,
//     salePrice:   placement === 'flashsale' ? salePrice   : null,
//     saleStartAt: placement === 'flashsale' ? saleStartAt : null,
//     saleEndAt:   placement === 'flashsale' ? saleEndAt   : null,
//   });

//   return sendResponse(res, 201, 'success', 'Da them san pham vao vi tri!', entry);
// }));

// /* ─── PUT /placements/reorder ─── */
// router.put('/reorder', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
//   const { placement, items } = req.body;
//   if (!placement || !Array.isArray(items) || items.length === 0)
//     return next(new AppError('Can truyen placement va items[]', 400));
//   if (!VP.includes(placement))
//     return next(new AppError('placement khong hop le', 400));

//   await Promise.all(items.map(({ id, sortOrder }) =>
//     ProductPlacement.update({ sortOrder }, { where: { id, placement } })
//   ));

//   return sendResponse(res, 200, 'success', 'Da cap nhat thu tu!');
// }));

// /* ─── PUT /placements/:id ─── */
// router.put('/:id', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
//   const entry = await ProductPlacement.findByPk(req.params.id);
//   if (!entry) return next(new AppError('Khong tim thay placement', 404));

//   const { salePrice, saleStartAt, saleEndAt } = req.body;
//   await entry.update({
//     ...(salePrice   !== undefined && { salePrice }),
//     ...(saleStartAt !== undefined && { saleStartAt }),
//     ...(saleEndAt   !== undefined && { saleEndAt }),
//   });

//   return sendResponse(res, 200, 'success', 'Cap nhat thanh cong!', entry);
// }));

// /* ─── DELETE /placements/:id ─── */
// router.delete('/:id', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
//   const entry = await ProductPlacement.findByPk(req.params.id);
//   if (!entry) return next(new AppError('Khong tim thay placement', 404));

//   await entry.destroy();
//   return sendResponse(res, 200, 'success', 'Da xoa san pham khoi vi tri!');
// }));

// module.exports = router;


const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const { Product, ProductPlacement } = require('../models/index');
const { sendResponse } = require('../utils/response');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken } = require('../middlewares/auth.middleware');
const checkRole = require('../middlewares/checkRole');

const VP = ['homepage', 'phones', 'laptops', 'flashsale'];

/* ─────────────────────────────────────────────
   GET /placements  — FE user
───────────────────────────────────────────── */
router.get('/', catchAsync(async (req, res, next) => {
  const { placement } = req.query;
  if (!placement || !VP.includes(placement))
    return next(new AppError('placement khong hop le', 400));

  const now = new Date();
  const pw = { placement };

  if (placement === 'flashsale') {
    pw[Op.or] = [
      { saleEndAt: null },
      { saleEndAt: { [Op.gte]: now } },
    ];
  }

  const rows = await ProductPlacement.findAll({
    where: pw,
    order: [['sortOrder', 'ASC']],
    include: [{
      model: Product,
      as: 'product',
      where: { status: 'active' },
      attributes: ['id', 'brand', 'title', 'img', 'category', 'price', 'oldPrice', 'discount', 'stock', 'sold', 'avgRating', 'totalReviews'],
    }],
  });

  const data = rows.map(p => {
    const item = p.product.toJSON();
    item.placementId = p.id;
    item.sortOrder   = p.sortOrder;

    if (placement === 'flashsale') {
      item.salePrice   = p.salePrice;
      item.saleStartAt = p.saleStartAt;
      item.saleEndAt   = p.saleEndAt;
      item.stockLimit  = p.stockLimit;
      item.stockSold   = p.stockSold;
      // stockLeft: null = không giới hạn
      item.stockLeft   = p.stockLimit !== null
        ? Math.max(0, p.stockLimit - p.stockSold)
        : null;
    }

    return item;
  });

  return sendResponse(res, 200, 'success', 'OK', data);
}));

/* ─────────────────────────────────────────────
   GET /placements/admin  — admin panel
───────────────────────────────────────────── */
router.get('/admin', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const { placement } = req.query;
  if (!placement || !VP.includes(placement))
    return next(new AppError('placement khong hop le', 400));

  const rows = await ProductPlacement.findAll({
    where: { placement },
    order: [['sortOrder', 'ASC']],
    include: [{
      model: Product,
      as: 'product',
      attributes: ['id', 'brand', 'title', 'img', 'category', 'price', 'oldPrice', 'stock', 'status'],
    }],
  });

  // Thêm stockLeft vào từng row cho admin panel
  const data = rows.map(row => {
    const obj = row.toJSON();
    if (placement === 'flashsale') {
      obj.stockLeft = obj.stockLimit !== null
        ? Math.max(0, obj.stockLimit - obj.stockSold)
        : null;
    }
    return obj;
  });

  return sendResponse(res, 200, 'success', 'OK', data);
}));

/* ─────────────────────────────────────────────
   POST /placements  — thêm sản phẩm vào placement
───────────────────────────────────────────── */
router.post('/', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const { productId, placement, salePrice, saleStartAt, saleEndAt, stockLimit } = req.body;

  if (!productId || !placement)
    return next(new AppError('Thieu productId hoac placement', 400));
  if (!VP.includes(placement))
    return next(new AppError('placement khong hop le', 400));

  const product = await Product.findByPk(productId);
  if (!product) return next(new AppError('San pham khong ton tai', 404));

  const existing = await ProductPlacement.findOne({ where: { productId, placement } });
  if (existing) return next(new AppError('San pham da duoc them vao vi tri nay roi', 409));

  const maxOrder = await ProductPlacement.max('sortOrder', { where: { placement } }) || 0;

  if (placement === 'flashsale' && !salePrice)
    return next(new AppError('Flash sale can co salePrice', 400));

  const entry = await ProductPlacement.create({
    productId,
    placement,
    sortOrder:   maxOrder + 1,
    salePrice:   placement === 'flashsale' ? salePrice   : null,
    saleStartAt: placement === 'flashsale' ? saleStartAt : null,
    saleEndAt:   placement === 'flashsale' ? saleEndAt   : null,
    // stockLimit: chỉ set cho flashsale, parse về int hoặc null
    stockLimit:  placement === 'flashsale' && stockLimit != null
      ? parseInt(stockLimit, 10)
      : null,
    stockSold: 0, // luôn bắt đầu từ 0
  });

  return sendResponse(res, 201, 'success', 'Da them san pham vao vi tri!', entry);
}));

/* ─────────────────────────────────────────────
   PUT /placements/reorder
───────────────────────────────────────────── */
router.put('/reorder', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const { placement, items } = req.body;
  if (!placement || !Array.isArray(items) || items.length === 0)
    return next(new AppError('Can truyen placement va items[]', 400));
  if (!VP.includes(placement))
    return next(new AppError('placement khong hop le', 400));

  await Promise.all(items.map(({ id, sortOrder }) =>
    ProductPlacement.update({ sortOrder }, { where: { id, placement } })
  ));

  return sendResponse(res, 200, 'success', 'Da cap nhat thu tu!');
}));

/* ─────────────────────────────────────────────
   PUT /placements/:id  — admin cập nhật flash sale info
   LƯU Ý: stockSold KHÔNG được cập nhật qua đây
───────────────────────────────────────────── */
router.put('/:id', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError('Khong tim thay placement', 404));

  const { salePrice, saleStartAt, saleEndAt, stockLimit } = req.body;

  await entry.update({
    ...(salePrice   !== undefined && { salePrice }),
    ...(saleStartAt !== undefined && { saleStartAt }),
    ...(saleEndAt   !== undefined && { saleEndAt }),
    // stockLimit có thể set về null (bỏ giới hạn) hoặc số mới
    ...(stockLimit  !== undefined && {
      stockLimit: stockLimit !== null ? parseInt(stockLimit, 10) : null,
    }),
    // stockSold KHÔNG update ở đây dù FE có gửi lên
  });

  // Trả về kèm stockLeft để FE cập nhật UI ngay
  const result = entry.toJSON();
  result.stockLeft = result.stockLimit !== null
    ? Math.max(0, result.stockLimit - result.stockSold)
    : null;

  return sendResponse(res, 200, 'success', 'Cap nhat thanh cong!', result);
}));

/* ─────────────────────────────────────────────
   POST /placements/:id/reset-stock
   Admin reset stockSold về 0 (restart campaign)
───────────────────────────────────────────── */
router.post('/:id/reset-stock', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError('Khong tim thay placement', 404));

  await entry.update({ stockSold: 0 });

  return sendResponse(res, 200, 'success', 'Da reset stockSold ve 0!', {
    id: entry.id,
    stockSold: 0,
    stockLimit: entry.stockLimit,
    stockLeft: entry.stockLimit,
  });
}));

/* ─────────────────────────────────────────────
   DELETE /placements/bulk  — xóa nhiều cùng lúc
───────────────────────────────────────────── */
router.delete('/bulk', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0)
    return next(new AppError('Can truyen ids[]', 400));

  const deleted = await ProductPlacement.destroy({ where: { id: ids } });

  return sendResponse(res, 200, 'success', `Da xoa ${deleted} san pham!`, { deleted });
}));

/* ─────────────────────────────────────────────
   DELETE /placements/:id  — xóa 1
───────────────────────────────────────────── */
router.delete('/:id', verifyToken, checkRole('admin'), catchAsync(async (req, res, next) => {
  const entry = await ProductPlacement.findByPk(req.params.id);
  if (!entry) return next(new AppError('Khong tim thay placement', 404));

  await entry.destroy();
  return sendResponse(res, 200, 'success', 'Da xoa san pham khoi vi tri!');
}));

module.exports = router;