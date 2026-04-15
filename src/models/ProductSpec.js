const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ProductSpec = sequelize.define("ProductSpec", {
  id:        { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  specKey:   { type: DataTypes.STRING(100) },
  specValue: { type: DataTypes.STRING(255) },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: "product_specs",
  timestamps: true,
});

module.exports = ProductSpec;