"use strict";

/**
 * Migration: Add email verification fields to users table.
 *
 * Thêm 3 columns:
 *   - isVerified: boolean — đánh dấu user đã verify email chưa
 *   - verificationToken: string(64) — random token gửi qua email
 *   - verificationTokenExpiresAt: datetime — thời gian hết hạn token
 *
 * Index trên verificationToken để query verify endpoint nhanh.
 *
 * Chạy migration:
 *   npx sequelize-cli db:migrate
 *
 * Rollback nếu cần:
 *   npx sequelize-cli db:migrate:undo
 */

module.exports = {
  // ── UP: Thêm columns + index ────────────────────────────────────────────
  async up(queryInterface, Sequelize) {
    /*
     * Bước 1: Thêm column isVerified
     *
     * defaultValue: false → user mới register sẽ chưa verified.
     *
     * Lưu ý: User CŨ trong DB cũng sẽ có isVerified = false
     * → cần handle trong service: nếu là user cũ thì auto-verify
     * hoặc gửi email verify cho họ. Mình sẽ xử lý ở Phần 5+.
     *
     * Tạm thời: nếu deploy production, nên chạy SQL update sau migration:
     *   UPDATE users SET isVerified = true WHERE createdAt < '2026-05-05'
     */
    await queryInterface.addColumn("users", "isVerified", {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    });

    /*
     * Bước 2: Thêm column verificationToken
     *
     * Length 64 vì token được generate bằng:
     *   crypto.randomBytes(32).toString("hex") → 64 ký tự hex
     *
     * allowNull: true vì sau khi verify xong → set NULL.
     */
    await queryInterface.addColumn("users", "verificationToken", {
      type:         Sequelize.STRING(64),
      allowNull:    true,
      defaultValue: null,
    });

    /*
     * Bước 3: Thêm column verificationTokenExpiresAt
     *
     * Lưu thời điểm token hết hạn (24h kể từ lúc gửi).
     * Verify endpoint sẽ check now > expiresAt → reject.
     */
    await queryInterface.addColumn("users", "verificationTokenExpiresAt", {
      type:         Sequelize.DATE,
      allowNull:    true,
      defaultValue: null,
    });

    /*
     * Bước 4: Thêm index trên verificationToken.
     *
     * Lý do: Endpoint GET /api/auth/verify-email?token=xxx sẽ query:
     *   WHERE verificationToken = ?
     * → Có index thì query 1ms, không có thì full table scan.
     */
    await queryInterface.addIndex("users", ["verificationToken"], {
      name: "idx_users_verification_token",
    });
  },

  // ── DOWN: Rollback — xóa index trước, rồi xóa columns ──────────────────
  async down(queryInterface) {
    // MySQL không cho xóa column đang có index → phải xóa index trước
    await queryInterface.removeIndex("users", "idx_users_verification_token");
    await queryInterface.removeColumn("users", "verificationTokenExpiresAt");
    await queryInterface.removeColumn("users", "verificationToken");
    await queryInterface.removeColumn("users", "isVerified");
  },
};