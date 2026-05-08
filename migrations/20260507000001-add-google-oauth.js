/**
 * Migration: add-google-oauth
 *
 * Mục đích:
 * - Thêm cột `googleId` (Google sub ID, unique, nullable)
 * - Cho phép cột `password` NULL (Google-only user không có password)
 * - Index trên googleId để query nhanh khi login Google
 *
 * Chạy:    npx sequelize-cli db:migrate
 * Rollback: npx sequelize-cli db:migrate:undo
 */

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Thêm cột googleId — nullable, unique
    await queryInterface.addColumn("users", "googleId", {
      type:      Sequelize.STRING(255),
      allowNull: true,
      unique:    true,
      comment:   "Google sub ID — link account Google với user",
    });

    // 2. Cho phép password NULL (Google-only user không cần password)
    await queryInterface.changeColumn("users", "password", {
      type:      Sequelize.STRING(255),
      allowNull: true,
    });

    // 3. Index trên googleId để query findOne({ googleId }) nhanh
    await queryInterface.addIndex("users", ["googleId"], {
      name:   "idx_users_googleId",
      unique: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("users", "idx_users_googleId");
    await queryInterface.removeColumn("users", "googleId");
    await queryInterface.changeColumn("users", "password", {
      type:      Sequelize.STRING(255),
      allowNull: false,
    });
  },
};