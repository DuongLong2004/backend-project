module.exports = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
        data: null,
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden – insufficient permission",
        data: null,
      });
    }

    next();
  };
};
