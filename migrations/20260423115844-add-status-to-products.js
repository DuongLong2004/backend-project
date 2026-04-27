/**
 * Migration: add-status-to-products
 *
 * Chạy lệnh tạo file này:
 *   npx sequelize-cli migration:generate --name add-status-to-products
 *
 * Sau đó copy nội dung này vào file vừa tạo, rồi chạy:
 *   npx sequelize-cli db:migrate
 *
 * Nếu cần rollback:
 *   npx sequelize-cli db:migrate:undo
 */

"use strict";

module.exports = {
  // ── UP: thêm cột + index ──────────────────────────────────────────────
  async up(queryInterface, Sequelize) {
    // 1. Thêm cột status vào bảng products
    await queryInterface.addColumn("products", "status", {
      type: Sequelize.ENUM("active", "draft", "outofstock"),
      defaultValue: "active",
      allowNull: false,
      // Tất cả sản phẩm cũ sẽ được set = "active" (đang bán)
      // → không ảnh hưởng ListProduct hiện tại
    });

    // 2. Thêm index đơn trên status
    //    Tối ưu query: WHERE status = 'active'
    await queryInterface.addIndex("products", ["status"], {
      name: "idx_products_status",
    });

    // 3. Thêm composite index status + category
    //    Tối ưu query: WHERE status = 'active' AND category = 'phone'
    //    ListProduct thường filter cả 2 cùng lúc
    await queryInterface.addIndex("products", ["status", "category"], {
      name: "idx_products_status_category",
    });
  },

  // ── DOWN: rollback — xóa index trước, rồi xóa cột ───────────────────
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("products", "idx_products_status_category");
    await queryInterface.removeIndex("products", "idx_products_status");
    await queryInterface.removeColumn("products", "status");
  },
};