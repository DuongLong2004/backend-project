


// // const { DataTypes } = require("sequelize");
// // const sequelize = require("../config/db");

// // const Order = sequelize.define("Order", {
// //   id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
// //   userId: { type: DataTypes.INTEGER, allowNull: false },
// //   status: {
// //     type: DataTypes.ENUM("pending", "confirmed", "completed", "cancelled"),
// //     defaultValue: "pending",
// //   },
// //   totalAmount: { type: DataTypes.FLOAT, defaultValue: 0 },

// //   // ✅ Thông tin giao hàng
// //   shippingName:    { type: DataTypes.STRING },
// //   shippingPhone:   { type: DataTypes.STRING },
// //   shippingEmail:   { type: DataTypes.STRING },
// //   shippingAddress: { type: DataTypes.TEXT },
// //   payMethod:       { type: DataTypes.STRING, defaultValue: "cod" },

// // }, {
// //   tableName: "orders",
// //   timestamps: true,
// //   indexes: [
// //     { fields: ["userId"] },
// //     { fields: ["status"] },
// //   ]
// // });

// // module.exports = Order;


// const { DataTypes } = require("sequelize");
// const sequelize = require("../config/db");

// const Order = sequelize.define("Order", {
//   id: {
//     type: DataTypes.INTEGER,
//     autoIncrement: true,
//     primaryKey: true,
//   },

//   userId: {
//     type: DataTypes.INTEGER,
//     allowNull: false,
//   },

//   status: {
//     type: DataTypes.ENUM("pending", "confirmed", "completed", "cancelled"),
//     defaultValue: "pending",
//     allowNull: false,
//   },

//   // ✅ Dùng DECIMAL thay FLOAT — tránh lỗi làm tròn số tiền
//   totalAmount: {
//     type: DataTypes.DECIMAL(10, 2),
//     defaultValue: 0,
//     allowNull: false,
//     validate: {
//       min: {
//         args: [0],
//         msg: "Total amount must be >= 0",
//       },
//     },
//   },

//   // ─── Thông tin giao hàng ───────────────────────────────
//   shippingName: {
//     type: DataTypes.STRING,
//     allowNull: false,
//     validate: {
//       notEmpty: { msg: "Shipping name is required" },
//       len: {
//         args: [2, 100],
//         msg: "Shipping name must be between 2 and 100 characters",
//       },
//     },
//   },

//   shippingPhone: {
//     type: DataTypes.STRING,
//     allowNull: false,
//     validate: {
//       notEmpty: { msg: "Shipping phone is required" },
//       is: {
//         args: /^[0-9]{9,11}$/,
//         msg: "Shipping phone must be 9–11 digits",
//       },
//     },
//   },

//   shippingEmail: {
//     type: DataTypes.STRING,
//     allowNull: false,
//     validate: {
//       notEmpty: { msg: "Shipping email is required" },
//       isEmail: { msg: "Shipping email is invalid" },
//     },
//   },

//   shippingAddress: {
//     type: DataTypes.TEXT,
//     allowNull: false,
//     validate: {
//       notEmpty: { msg: "Shipping address is required" },
//     },
//   },

//   payMethod: {
//     type: DataTypes.ENUM("cod", "banking", "momo"),
//     defaultValue: "cod",
//     allowNull: false,
//     validate: {
//       isIn: {
//         args: [["cod", "banking", "momo"]],
//         msg: "Invalid payment method",
//       },
//     },
//   },
// }, {
//   tableName: "orders",
//   timestamps: true,
//   indexes: [
//     { fields: ["userId"] },
//     { fields: ["status"] },
//   ],
// });

// module.exports = Order;


const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Order = sequelize.define("Order", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  status: {
    type: DataTypes.ENUM("pending", "confirmed", "completed", "cancelled"),
    defaultValue: "pending",
    allowNull: false,
  },

  // ✅ DECIMAL thay FLOAT — tránh lỗi làm tròn số tiền
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: {
        args: [0],
        msg: "Total amount must be >= 0",
      },
    },
  },

  // ─── Thông tin giao hàng ───────────────────────────────
  shippingName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Shipping name is required" },
      len: {
        args: [2, 100],
        msg: "Shipping name must be between 2 and 100 characters",
      },
    },
  },

  shippingPhone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Shipping phone is required" },
      is: {
        args: /^[0-9]{9,11}$/,
        msg: "Shipping phone must be 9–11 digits",
      },
    },
  },

  shippingEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Shipping email is required" },
      isEmail: { msg: "Shipping email is invalid" },
    },
  },

  shippingAddress: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: "Shipping address is required" },
    },
  },

  payMethod: {
    type: DataTypes.ENUM("cod", "banking", "momo"),
    defaultValue: "cod",
    allowNull: false,
    validate: {
      isIn: {
        args: [["cod", "banking", "momo"]],
        msg: "Invalid payment method",
      },
    },
  },
}, {
  tableName: "orders",
  timestamps: true,
  indexes: [
    // ✅ Index userId — GET /api/orders/me query theo userId thường xuyên
    { fields: ["userId"], name: "idx_orders_user_id" },

    // ✅ Index status — filter đơn hàng theo trạng thái
    { fields: ["status"], name: "idx_orders_status" },

    // ✅ Composite — lấy đơn hàng của user theo status
    // Khi query: WHERE userId = 1 AND status = 'pending'
    { fields: ["userId", "status"], name: "idx_orders_user_status" },
  ],
});

module.exports = Order;