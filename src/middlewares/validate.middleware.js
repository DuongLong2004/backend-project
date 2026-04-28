const xss = require("xss");


const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script"],
};

const sanitizeValue = (value) => {
  if (typeof value !== "string") return value;
  return xss(value.trim(), xssOptions);
};


const sanitizeDeep = (data) => {
  if (typeof data === "string") return sanitizeValue(data);

  if (Array.isArray(data)) return data.map(sanitizeDeep);

  if (data !== null && typeof data === "object") {
    const result = {};
    for (const key in data) {
      result[key] = sanitizeDeep(data[key]);
    }
    return result;
  }

  
  return data;
};


module.exports = (schema) => {
  return (req, res, next) => {
    // Bước 1: Sanitize toàn bộ req.body (kể cả nested object/array)
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeDeep(req.body);
    }

    // Bước 2: Validate schema sau khi đã sanitize
    if (schema) {
      const { error } = schema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: "error",
          message: error.details[0].message,
          data: null,
        });
      }
    }

    next();
  };
};