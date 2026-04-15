// module.exports = (requiredRole) => {
//   return (req, res, next) => {
//     if (!req.user) {
//       return res.status(401).json({
//         status: "error",
//         message: "Unauthorized",
//         data: null,
//       });
//     }

//     if (req.user.role !== requiredRole) {
//       return res.status(403).json({
//         status: "error",
//         message: "Forbidden – insufficient permission",
//         data: null,
//       });
//     }

//     next();
//   };
// };


const AppError = require("../utils/AppError");

// ✅ Dùng next(new AppError()) — nhất quán với toàn project
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
