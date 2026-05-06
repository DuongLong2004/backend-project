"use strict";

/**
 * Migration: Add password reset fields to users table.
 *
 * Thêm 2 columns:
 *   - passwordResetToken: string(64) — random token gửi qua email reset
 *   - passwordResetExpiresAt: datetime — thời gian hết hạn token (1 giờ)
 *
 * Index trên passwordResetToken để query reset endpoint nhanh.
 *
 * Chạy migration:
 *   npx sequelize-cli db:migrate
 *
 * Rollback:
 *   npx sequelize-cli db:migrate:undo
 */

module.exports = {
  // ── UP: Thêm columns + index ────────────────────────────────────────────
  async up(queryInterface, Sequelize) {
    /*
     * Bước 1: Thêm column passwordResetToken
     *
     * Length 64 vì token được generate bằng:
     *   crypto.randomBytes(32).toString("hex") → 64 ký tự hex
     *
     * allowNull: true vì:
     *   - User chưa request reset → NULL
     *   - Sau khi reset xong → set về NULL (để không reuse)
     */
    await queryInterface.addColumn("users", "passwordResetToken", {
      type:         Sequelize.STRING(64),
      allowNull:    true,
      defaultValue: null,
    });

    /*
     * Bước 2: Thêm column passwordResetExpiresAt
     *
     * Lưu thời điểm token hết hạn (1 GIỜ kể từ lúc gửi).
     * Reset endpoint check: now > expiresAt → reject.
     *
     * Lý do 1h thay vì 24h như verify:
     *   - Reset password là sensitive operation hơn
     *   - Token leak qua email → cần expire nhanh
     *   - User thường reset ngay khi nhận email, không để lâu
     */
    await queryInterface.addColumn("users", "passwordResetExpiresAt", {
      type:         Sequelize.DATE,
      allowNull:    true,
      defaultValue: null,
    });

    /*
     * Bước 3: Thêm index trên passwordResetToken.
     *
     * Endpoint POST /api/auth/reset-password sẽ query:
     *   WHERE passwordResetToken = ?
     * → Có index thì O(log n), không có thì full table scan.
     */
    await queryInterface.addIndex("users", ["passwordResetToken"], {
      name: "idx_users_password_reset_token",
    });
  },

  // ── DOWN: Rollback — xóa index trước, rồi xóa columns ──────────────────
  async down(queryInterface) {
    // MySQL không cho xóa column đang có index → phải xóa index trước
    await queryInterface.removeIndex("users", "idx_users_password_reset_token");
    await queryInterface.removeColumn("users", "passwordResetExpiresAt");
    await queryInterface.removeColumn("users", "passwordResetToken");
  },
};