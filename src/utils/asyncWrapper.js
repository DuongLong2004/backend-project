// ✅ Bọc async function – không cần try/catch mọi nơi
const asyncWrapper = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // lỗi tự động đến error middleware
  };
};

module.exports = asyncWrapper;