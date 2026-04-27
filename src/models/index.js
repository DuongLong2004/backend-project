const User        = require("./User");
const Product     = require("./Product");
const Order       = require("./Order");
const OrderItem   = require("./OrderItem");
const Review      = require("./Review");
const Wishlist    = require("./Wishlist");
const ProductSpec = require("./ProductSpec"); 

const sequelize = require("../config/db");


const ProductPlacement = require("./Placement");



// User – Order
User.hasMany(Order, { foreignKey: "userId" });
Order.belongsTo(User, { foreignKey: "userId" });

// Order – OrderItem
Order.hasMany(OrderItem, { foreignKey: "orderId" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

// Product – OrderItem
Product.hasMany(OrderItem, { foreignKey: "productId" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });

// Review associations
User.hasMany(Review, { foreignKey: "userId" });
Review.belongsTo(User, { foreignKey: "userId" });
Product.hasMany(Review, { foreignKey: "productId" });
Review.belongsTo(Product, { foreignKey: "productId" });

// Wishlist associations
User.hasMany(Wishlist, { foreignKey: "userId" });
Wishlist.belongsTo(User, { foreignKey: "userId" });
Product.hasMany(Wishlist, { foreignKey: "productId" });
Wishlist.belongsTo(Product, { foreignKey: "productId" });

// ✅ ProductSpec associations
Product.hasMany(ProductSpec, { foreignKey: "productId", as: "specs" });
ProductSpec.belongsTo(Product, { foreignKey: "productId" });


// Thêm association
Product.hasMany(ProductPlacement, { foreignKey: "productId", as: "placements" });
ProductPlacement.belongsTo(Product, { foreignKey: "productId", as: "product" });

// ✅ 1 dòng export duy nhất
module.exports = {
  User, Product, Order, OrderItem,
  Review, Wishlist, ProductSpec, ProductPlacement, sequelize
};