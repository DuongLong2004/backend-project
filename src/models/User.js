const { DataTypes } = require("sequelize");
const sequelize     = require("../config/db");

/**
 * User model — đại diện cho bảng users trong DB.
 *
 * Các fields chính:
 *   - id, name, email, password, age, role, avatar (cũ)
 *   - isVerified: trạng thái đã verify email (Phần 2)
 *   - verificationToken: token random gửi qua email để verify (Phần 2)
 *   - verificationTokenExpiresAt: thời điểm token hết hạn (Phần 2)
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
     * Token random 64 ký tự hex (32 bytes) gửi qua email.
     * Set NULL sau khi verify thành công để không reuse được.
     */
    verificationToken: {
      type:         DataTypes.STRING(64),
      allowNull:    true,
      defaultValue: null,
    },

    /**
     * Thời điểm token hết hạn (24h kể từ lúc tạo).
     * Verify endpoint check: now > expiresAt → reject.
     */
    verificationTokenExpiresAt: {
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
      // Index verificationToken để verify endpoint query nhanh
      { fields: ["verificationToken"], name: "idx_users_verification_token" },
    ],
  }
);

module.exports = User;