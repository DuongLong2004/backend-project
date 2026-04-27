



// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const OrderItem = sequelize.define("OrderItem", {
//   id: {
//     type: DataTypes.INTEGER,
//     autoIncrement: true,
//     primaryKey: true,
//   },
//   orderId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   productId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },
//   quantity: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//     validate: { min: { args: [1], msg: "Quantity must be >= 1" } },
//   },
//   // ✅ DECIMAL thay FLOAT — tránh lỗi làm tròn số tiền
//   price: {
//     type: DataTypes.DECIMAL(15, 0),
//     allowNull: false,
//     validate: { min: { args: [0], msg: "Price must be >= 0" } },
//   },
// }, {
//   tableName: "order_items",
//   timestamps: false,
// });

// module.exports = OrderItem;


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const OrderItem = sequelize.define("OrderItem", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  productId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  // placementId: lưu lại item này mua từ flash sale nào
  // NULL = mua bình thường (không qua flash sale)
  // có giá trị = mua qua flash sale → dùng để tăng/hoàn stockSold
  placementId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: { args: [1], msg: "Quantity must be >= 1" } },
  },
  price: {
    type: DataTypes.DECIMAL(15, 0),
    allowNull: false,
    validate: { min: { args: [0], msg: "Price must be >= 0" } },
  },
}, {
  tableName: "order_items",
  timestamps: false,
});

module.exports = OrderItem;