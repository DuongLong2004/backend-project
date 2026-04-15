

module.exports = (schema) => {
  return (req, res, next) => {
    // ✅ Sanitize input – trim + strip HTML tags chống XSS
    if (req.body && typeof req.body === "object") {
      for (const key in req.body) {
        if (typeof req.body[key] === "string") {
          req.body[key] = req.body[key]
            .trim()                              // xoá khoảng trắng đầu cuối
            .replace(/<[^>]*>/g, "");            // strip HTML tags
        }
      }
    }

    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        status: "error",
        message: error.details[0].message,
        data: null,
      });
    }

    next();
  };
};
