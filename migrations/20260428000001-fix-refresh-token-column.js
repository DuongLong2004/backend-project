"use strict";



module.exports = {
  async up(queryInterface, Sequelize) {
    // Bước 1: Đổi kiểu cột từ TEXT sang VARCHAR(512)
    await queryInterface.changeColumn("users", "refreshToken", {
      type: Sequelize.STRING(512),
      allowNull: true,
      defaultValue: null,
    });

    // Bước 2: Thêm index trên cột refreshToken
    // Trước đây TEXT không index được, giờ VARCHAR(512) thì được
    await queryInterface.addIndex("users", ["refreshToken"], {
      name: "idx_users_refresh_token",
    });
  },

  async down(queryInterface, Sequelize) {
    // Rollback: xóa index trước, rồi đổi lại về TEXT
    await queryInterface.removeIndex("users", "idx_users_refresh_token");

    await queryInterface.changeColumn("users", "refreshToken", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  },
};