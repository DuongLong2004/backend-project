"use strict";

module.exports = {
  async up(queryInterface) {
    // Xóa index trước, sau đó mới xóa column
    // MySQL không cho xóa column đang được index nếu không xóa index trước
    await queryInterface.removeIndex("users", "idx_users_refresh_token");
    await queryInterface.removeColumn("users", "refreshToken");
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "refreshToken", {
      type:         Sequelize.STRING(512),
      allowNull:    true,
      defaultValue: null,
    });

    await queryInterface.addIndex("users", ["refreshToken"], {
      name: "idx_users_refresh_token",
    });
  },
};