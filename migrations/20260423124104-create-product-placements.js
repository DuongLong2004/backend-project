"use strict";

/**
 * Migration: create-product-placements
 *
 * Tạo bảng product_placements để admin gán sản phẩm vào vị trí hiển thị:
 *   - homepage   : Section nổi bật trang chủ
 *   - phones     : Trang danh sách điện thoại (ưu tiên hiện trước)
 *   - laptops    : Trang danh sách laptop (ưu tiên hiện trước)
 *   - flashsale  : Trang Flash Sale (có giá sale riêng + thời gian)
 *
 * Chạy:
 *   npx sequelize-cli migration:generate --name create-product-placements
 *   → copy file này vào → npx sequelize-cli db:migrate
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("product_placements", {
      id: {
        type:          Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
      },

      productId: {
        type:       Sequelize.INTEGER,
        allowNull:  false,
        references: { model: "products", key: "id" },
        onDelete:   "CASCADE", // xóa sp → tự xóa placement
        onUpdate:   "CASCADE",
      },

      // Vị trí hiển thị
      placement: {
        type:      Sequelize.ENUM("homepage", "phones", "laptops", "flashsale"),
        allowNull: false,
      },

      // Thứ tự hiển thị — số nhỏ hơn hiện trước
      sortOrder: {
        type:         Sequelize.INTEGER,
        defaultValue: 0,
        allowNull:    false,
      },

      // ── Flash Sale fields (chỉ dùng khi placement = "flashsale") ──
      // Giá sale riêng — khác giá gốc trong bảng products
      salePrice: {
        type:         Sequelize.DECIMAL(15, 0),
        allowNull:    true,
        defaultValue: null,
      },

      // Thời gian bắt đầu flash sale
      saleStartAt: {
        type:         Sequelize.DATE,
        allowNull:    true,
        defaultValue: null,
      },

      // Thời gian kết thúc flash sale
      saleEndAt: {
        type:         Sequelize.DATE,
        allowNull:    true,
        defaultValue: null,
      },

      createdAt: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    // Index: query theo placement rất thường xuyên
    await queryInterface.addIndex("product_placements", ["placement"], {
      name: "idx_placements_placement",
    });

    // Index: query theo placement + sortOrder để ORDER BY nhanh
    await queryInterface.addIndex("product_placements", ["placement", "sortOrder"], {
      name: "idx_placements_placement_sort",
    });

    // Unique: 1 sản phẩm chỉ xuất hiện 1 lần trong 1 placement
    await queryInterface.addIndex("product_placements", ["productId", "placement"], {
      name:   "idx_placements_product_placement",
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("product_placements");
  },
};