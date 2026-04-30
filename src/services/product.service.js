const { Op }         = require("sequelize");
const sequelize      = require("../config/db");
const { Product, ProductSpec } = require("../models/index");
const AppError       = require("../utils/AppError");
const { clearCache } = require("../middlewares/cache.middleware");

const VALID_STATUSES = ["active", "draft", "outofstock"];

const parseArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return val.split(",").map((s) => s.trim()).filter(Boolean);
};

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

/**
 * Strip MySQL FULLTEXT boolean operators khỏi input trước khi đưa vào
 * MATCH AGAINST query để tránh syntax error và ngăn operator injection.
 */
const sanitizeFulltextSearch = (str) =>
  str.replace(/[+\-><()~*"@]+/g, " ").trim();

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

  const where      = {};
  const extraWhere = [];

  if (search && search.trim()) {
    const sanitized = sanitizeFulltextSearch(search.trim());

    if (sanitized) {
      /*
       * MATCH AGAINST thay vì LIKE '%...%'
       * LIKE với wildcard prefix không dùng được index → full table scan
       * FULLTEXT index (title, brand, description) đã tạo ở migration 20260430071036
       * IN BOOLEAN MODE cho phép multi-word, không bị chặn bởi minimum word length
       */
      extraWhere.push(
        sequelize.literal(
          `MATCH(title, brand, description) AGAINST('${sanitized}' IN BOOLEAN MODE)`
        )
      );
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

  if (extraWhere.length > 0) {
    where[Op.and] = [...(where[Op.and] || []), ...extraWhere];
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

  // Rebuild specs: xóa cũ → tạo mới để đảm bảo sync
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

exports.deleteProduct = async (id) => {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError("Product not found", 404);

  await ProductSpec.destroy({ where: { productId: product.id } });
  await product.destroy();
  await clearCache("/api/products");
};