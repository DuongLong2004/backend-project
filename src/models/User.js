const { DataTypes } = require("sequelize");
const sequelize     = require("../config/db");

/**
 * User model — đại diện cho bảng users trong DB.
 *
 * Các fields chính:
 *   - id, name, email, password, age, role, avatar (cũ)
 *   - isVerified, verificationToken, verificationTokenExpiresAt (Phần 2)
 *   - passwordResetToken, passwordResetExpiresAt (Phần 3)
 */
const User = sequelize.define(
  "User",
  {
    id: {
      type:          DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey:    true,
    },
    name: {
      type:      DataTypes.STRING,
      allowNull: false,
      validate:  { notEmpty: true },
    },
    email: {
      type:      DataTypes.STRING,
      allowNull: false,
      unique:    true,
      validate:  { isEmail: true },
    },
    password: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    age: {
      type:      DataTypes.INTEGER,
      allowNull: true,
      validate:  { min: 0 },
    },
    role: {
      type:         DataTypes.STRING,
      allowNull:    false,
      defaultValue: "user",
    },
    avatar: {
      type:         DataTypes.STRING,
      allowNull:    true,
      defaultValue: null,
    },

    // ─── Email Verification fields (Phần 2) ─────────────────────────────

    /**
     * Trạng thái đã verify email.
     * - false: User mới register, chưa click link trong email
     * - true:  Đã verify thành công, được phép login
     */
    isVerified: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },

    /**
     * Token random 64 ký tự hex (32 bytes) gửi qua email verify.
     * Set NULL sau khi verify thành công để không reuse được.
     */
    verificationToken: {
      type:         DataTypes.STRING(64),
      allowNull:    true,
      defaultValue: null,
    },

    /**
     * Thời điểm verification token hết hạn (24h kể từ lúc tạo).
     */
    verificationTokenExpiresAt: {
      type:         DataTypes.DATE,
      allowNull:    true,
      defaultValue: null,
    },

    // ─── Password Reset fields (Phần 3) ─────────────────────────────────

    /**
     * Token random 64 ký tự hex (32 bytes) gửi qua email reset password.
     * Set NULL sau khi reset thành công để không reuse được.
     */
    passwordResetToken: {
      type:         DataTypes.STRING(64),
      allowNull:    true,
      defaultValue: null,
    },

    /**
     * Thời điểm password reset token hết hạn (1 GIỜ kể từ lúc tạo).
     * Sensitive hơn verify nên expire nhanh hơn.
     */
    passwordResetExpiresAt: {
      type:         DataTypes.DATE,
      allowNull:    true,
      defaultValue: null,
    },
  },
  {
    tableName:  "users",
    timestamps: true,
    indexes: [
      { fields: ["role"], name: "idx_users_role" },
      // Index verificationToken (Phần 2) để verify endpoint query nhanh
      { fields: ["verificationToken"],   name: "idx_users_verification_token" },
      // Index passwordResetToken (Phần 3) để reset endpoint query nhanh
      { fields: ["passwordResetToken"],  name: "idx_users_password_reset_token" },
    ],
  }
);

module.exports = User;