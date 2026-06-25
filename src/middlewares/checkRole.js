

const AppError = require("../utils/AppError");


module.exports = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (req.user.role !== requiredRole) {
      return next(new AppError("Forbidden – insufficient permission", 403));
    }

    next();
  };
};
