const { Op }    = require("sequelize");
const { Product, ProductSpec } = require("../models/index");
const AppError  = require("../utils/AppError");
const { clearCache } = require("../middlewares/cache.middleware");

const VALID_STATUSES = ["active", "draft", "outofstock"];

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

// Tách chuỗi "Apple,Samsung" → ["Apple", "Samsung"]
const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(",").map((s) => s.trim()).filter(Boolean);
};

// Build rows cho bảng product_specs từ các field thông số
const buildSpecs = ({ display, screenTech, ram, rom, chip, camera, battery, charging, nation }) =>
  [
    { specKey: "display",    specValue: display,    sortOrder: 1 },
    { specKey: "screenTech", specValue: screenTech, sortOrder: 2 },
    { specKey: "ram",        specValue: ram,        sortOrder: 3 },
    { specKey: "rom",        specValue: rom,        sortOrder: 4 },
    { specKey: "chip",       specValue: chip,       sortOrder: 5 },
    { specKey: "camera",     specValue: camera,     sortOrder: 6 },
    { specKey: "battery",    specValue: battery,    sortOrder: 7 },
    { specKey: "charging",   specValue: charging,   sortOrder: 8 },
    { specKey: "nation",     specValue: nation,     sortOrder: 9 },
  ].filter((s) => s.specValue);

// ─────────────────────────────────────────────
// getProducts(query)
// → { data, meta }
// ─────────────────────────────────────────────
exports.getProducts = async (query) => {
  const page   = parseInt(query.page)  || 1;
  const limit  = parseInt(query.limit) || 10;
  const offset = (page - 1) * limit;

  const {
    search, brand, category,
    minPrice, maxPrice,
    ram, rom, chip, camera, battery, display,
    status,
  } = query;

  const where = {};

  // Smart Search — tách keyword thành từng từ, mỗi từ phải có trong title (AND)
  // VD: "iphone 15" → WHERE title LIKE '%iphone%' AND title LIKE '%15%'
  if (search && search.trim()) {
    const words = search.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      where.title = { [Op.like]: `%${words[0]}%` };
    } else {
      where[Op.and] = words.map((word) => ({
        title: { [Op.like]: `%${word}%` },
      }));
    }
  }

  if (category) where.category = category;

  const brands = parseArray(brand);
  if (brands.length === 1) where.brand = brands[0];
  if (brands.length  > 1) where.brand = { [Op.in]: brands };

  if (minPrice !== undefined && minPrice !== "") {
    where.price = { ...where.price, [Op.gte]: parseFloat(minPrice) };
  }
  if (maxPrice !== undefined && maxPrice !== "") {
    where.price = { ...where.price, [Op.lte]: parseFloat(maxPrice) };
  }

  // Filter thông số kỹ thuật — hỗ trợ multi-value "8 GB,12 GB"
  const addSpecFilter = (field, rawVal) => {
    const vals = parseArray(rawVal);
    if (!vals.length) return;
    where[field] =
      vals.length === 1
        ? { [Op.like]: `%${vals[0]}%` }
        : { [Op.or]: vals.map((v) => ({ [Op.like]: `%${v}%` })) };
  };

  addSpecFilter("ram",     ram);
  addSpecFilter("rom",     rom);
  addSpecFilter("chip",    chip);
  addSpecFilter("camera",  camera);
  addSpecFilter("battery", battery);
  addSpecFilter("display", display);

  if (status && VALID_STATUSES.includes(status)) {
    where.status = status;
  }

  const { count, rows } = await Product.findAndCountAll({
    where,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
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
// getProductById(id)
// → Product (kèm specs)
// ─────────────────────────────────────────────
exports.getProductById = async (id) => {
  const product = await Product.findByPk(id, {
    include: [
      {
        model:      ProductSpec,
        as:         "specs",
        attributes: ["specKey", "specValue", "sortOrder"],
        order:      [["sortOrder", "ASC"]],
      },
    ],
  });

  if (!product) throw new AppError("Product not found", 404);
  return product;
};

// ─────────────────────────────────────────────
// createProduct(body)
// → Product
// ─────────────────────────────────────────────
exports.createProduct = async (body) => {
  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    status,
  } = body;

  if (!brand || !title || !price || !category) {
    throw new AppError("Thiếu thông tin bắt buộc: brand, title, price, category", 400);
  }

  const product = await Product.create({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description,
    stock:  stock  || 50,
    sold:   sold   || 0,
    status: VALID_STATUSES.includes(status) ? status : "active",
  });

  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(
      specsData.map((s) => ({ ...s, productId: product.id }))
    );
  }

  await clearCache("/api/products");
  return product;
};

// ─────────────────────────────────────────────
// updateProduct(id, body)
// → Product
// ─────────────────────────────────────────────
exports.updateProduct = async (id, body) => {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError("Product not found", 404);

  const {
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    status,
  } = body;

  await product.update({
    brand, title, img, discount, price, oldPrice,
    category, nation, display, screenTech, ram, rom,
    chip, camera, battery, charging, description, stock, sold,
    ...(VALID_STATUSES.includes(status) && { status }),
  });

  // Rebuild specs — xóa cũ rồi tạo mới
  await ProductSpec.destroy({ where: { productId: product.id } });
  const specsData = buildSpecs({ display, screenTech, ram, rom, chip, camera, battery, charging, nation });
  if (specsData.length > 0) {
    await ProductSpec.bulkCreate(
      specsData.map((s) => ({ ...s, productId: product.id }))
    );
  }

  await clearCache("/api/products");
  return product;
};

// ─────────────────────────────────────────────
// deleteProduct(id)
// → void
// ─────────────────────────────────────────────
exports.deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError("Product not found", 404);

  await ProductSpec.destroy({ where: { productId: product.id } });
  await product.destroy();
  await clearCache("/api/products");
};