const redis = require("../config/redis");
const logger = require("../utils/logger");

// ✅ TTL mặc định: 5 phút
const DEFAULT_TTL = 60 * 5;

/**
 * Cache middleware — dùng cho GET endpoints
 *
 * Cách hoạt động:
 *   1. Request đến → tạo cache key từ URL + query string
 *   2. Kiểm tra Redis có key này chưa
 *      → CÓ: trả về data từ Redis ngay (cache HIT) — không query DB
 *      → KHÔNG: cho request đi tiếp, sau khi controller trả response thì lưu vào Redis
 *
 * Cách dùng:
 *   router.get("/", cache(), productController.getProducts)
 *   router.get("/", cache(60 * 10), productController.getProducts)  // TTL 10 phút
 */
const cache = (ttl = DEFAULT_TTL) => {
  return async (req, res, next) => {
    // Bỏ qua cache nếu Redis chưa kết nối
    if (!redis.isReady) {
      return next();
    }

    // ✅ Cache key = full URL + query string
    // VD: "cache:/api/products?page=1&limit=10&category=phone"
    const key = `cache:${req.originalUrl}`;

    try {
      const cached = await redis.get(key);

      if (cached) {
        logger.info(`Cache HIT: ${key}`);
        // Trả về data từ Redis, thêm header để FE biết đây là cached response
        return res.status(200).json({
          ...JSON.parse(cached),
          _cache: "HIT",
        });
      }

      logger.info(`Cache MISS: ${key}`);

      // Ghi đè res.json để bắt response trước khi gửi về client
      // → lưu vào Redis đồng thời trả về cho client
      const originalJson = res.json.bind(res);
      res.json = async (data) => {
        // Chỉ cache response thành công (status 2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            await redis.setEx(key, ttl, JSON.stringify(data));
          } catch (err) {
            logger.warn(`Cache set failed: ${err.message}`);
          }
        }
        return originalJson(data);
      };

      next();
    } catch (err) {
      // Nếu Redis lỗi → vẫn cho request đi tiếp bình thường
      logger.warn(`Cache middleware error: ${err.message}`);
      next();
    }
  };
};

/**
 * Xóa cache theo pattern
 * Dùng khi admin thêm/sửa/xóa sản phẩm → xóa cache products
 *
 * Cách dùng:
 *   await clearCache("/api/products")  // xóa tất cả key có prefix này
 */
const clearCache = async (urlPrefix) => {
  if (!redis.isReady) return;

  try {
    // Tìm tất cả key có prefix này
    const pattern = `cache:${urlPrefix}*`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(keys);
      logger.info(`Cache cleared: ${keys.length} keys với prefix "${urlPrefix}"`);
    }
  } catch (err) {
    logger.warn(`Cache clear failed: ${err.message}`);
  }
};

module.exports = { cache, clearCache };