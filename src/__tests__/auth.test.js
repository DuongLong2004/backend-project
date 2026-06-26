const request = require("supertest");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ════════════════════════════════════════════════════════════════════════════
// MOCKS — dùng chung cho toàn bộ auth tests
// ════════════════════════════════════════════════════════════════════════════

jest.mock("../../src/config/redis", () => ({
  client: {
    isReady: false,
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(true),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(true),
  },
  scanKeys: jest.fn().mockResolvedValue([]),
  createSession: jest.fn().mockResolvedValue(true),
  getSession: jest.fn().mockResolvedValue(null),
  touchSession: jest.fn().mockResolvedValue(true),
  deleteSession: jest.fn().mockResolvedValue(true),
  listSessions: jest.fn().mockResolvedValue([]),
  deleteAllSessions: jest.fn().mockResolvedValue(true),
  deleteOtherSessions: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/services/email.service", () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendAccountLockedEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../src/models/User", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  update: jest.fn(),
  hasMany: jest.fn(),
  belongsTo: jest.fn(),
}));

jest.mock("../../src/models/index", () => ({
  User: require("../../src/models/User"),
  sequelize: {
    sync: jest.fn().mockResolvedValue(true),
    define: jest.fn(),
    fn: jest.fn().mockReturnValue("fn"),
    col: jest.fn().mockReturnValue("col"),
    literal: jest.fn().mockReturnValue({}),
    escape: jest.fn((val) => `'${val}'`),
    transaction: jest.fn().mockImplementation(async (cb) =>
      cb({ LOCK: { UPDATE: "UPDATE" } })
    ),
  },
}));

jest.mock("../../src/middlewares/auth.middleware", () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 1, role: "user" };
    next();
  },
}));

const app = require("../../src/app");
const User = require("../../src/models/User");
const emailService = require("../../src/services/email.service");
const { getSession } = require("../../src/config/redis");

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const VALID_PASSWORD = "Test1234";
const NEW_PASSWORD = "NewPass1234";
const INVALID_PASSWORDS = {
  TOO_SHORT: "Test1",
  NO_NUMBER: "OnlyLetters",
  NO_LETTER: "12345678",
};

const generateRefreshToken = (userId, deviceId = "test-device-uuid") =>
  jwt.sign(
    { id: userId, deviceId },
    process.env.JWT_REFRESH_SECRET || "super_refresh_secret_key_456",
    { expiresIn: "7d" }
  );

// ════════════════════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/register", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should register successfully and trigger email send", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      name: "New User",
      email: "new@gmail.com",
      role: "user",
      isVerified: false,
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "New User", email: "new@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.data.isVerified).toBe(false);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("should still return 201 even if email send fails (best-effort)", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      id: 1,
      name: "New User",
      email: "new@gmail.com",
      role: "user",
      isVerified: false,
    });
    emailService.sendVerificationEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "New User", email: "new@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(201);
  });

  it("should return 409 if email already exists", async () => {
    User.findOne.mockResolvedValue({ id: 1, email: "existing@gmail.com" });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "User", email: "existing@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Email already exists");
  });

  it("should return 400 if fields missing", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "test@gmail.com" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if password too short", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "User", email: "test@gmail.com", password: INVALID_PASSWORDS.TOO_SHORT });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("ít nhất 8 ký tự");
  });

  it("should return 400 if password has no number", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "User", email: "test@gmail.com", password: INVALID_PASSWORDS.NO_NUMBER });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("chữ cái và 1 số");
  });

  it("should return 400 if password has no letter", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "User", email: "test@gmail.com", password: INVALID_PASSWORDS.NO_LETTER });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("chữ cái và 1 số");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should login successfully when verified", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    User.findOne.mockResolvedValue({
      id: 1,
      name: "Test User",
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user.isVerified).toBe(true);
  });

  it("should return 403 if email not verified", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    User.findOne.mockResolvedValue({
      id: 1,
      name: "Unverified User",
      email: "unverified@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: false,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "unverified@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("xác thực");
  });

  it("should return 401 if email not found", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "wrong@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid email or password");
  });

  it("should return 401 if password wrong", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: "WrongPass1" });

    expect(res.statusCode).toBe(401);
  });

  it("should return 400 if fields missing", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 401 when Google-only user tries to login with password", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      name: "Google User",
      email: "google@gmail.com",
      password: null,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "google@gmail.com", password: "AnyPass1234" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain("Google");
  });

  it("should NOT increment failedLoginAttempts for Google-only user", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "google@gmail.com",
      password: null,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      update: updateMock,
    });

    await request(app)
      .post("/api/auth/login")
      .send({ email: "google@gmail.com", password: "AnyPass1234" });

    expect(updateMock).not.toHaveBeenCalled();
  });

  // ── Account lockout ──────────────────────────────────────────────────────

  it("should increment failedLoginAttempts on wrong password", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    const updateMock = jest.fn().mockResolvedValue(true);

    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 2,
      lockedUntil: null,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: "WrongPass1" });

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("attemptsRemaining", 2);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ failedLoginAttempts: 3 })
    );
  });

  it("should reset failedLoginAttempts to 0 on successful login", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    const updateMock = jest.fn().mockResolvedValue(true);

    User.findOne.mockResolvedValue({
      id: 1,
      name: "Test User",
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 3,
      lockedUntil: null,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });

  it("should lock account and send email after 5 failed attempts", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    const updateMock = jest.fn().mockResolvedValue(true);

    User.findOne.mockResolvedValue({
      id: 1,
      name: "Test User",
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 4,
      lockedUntil: null,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: "WrongPass1" });

    expect(res.statusCode).toBe(423);
    expect(res.body).toHaveProperty("lockedUntil");
    expect(res.body).toHaveProperty("minutesRemaining", 15);
    expect(res.body.message).toContain("tạm khoá");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      })
    );
    expect(emailService.sendAccountLockedEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendAccountLockedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "test@gmail.com", userName: "Test User" })
    );
  });

  it("should reject login with 423 if account is currently locked", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    const futureLockTime = new Date(Date.now() + 10 * 60 * 1000);

    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 5,
      lockedUntil: futureLockTime,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(423);
    expect(res.body).toHaveProperty("lockedUntil");
    expect(res.body).toHaveProperty("minutesRemaining");
    expect(res.body.message).toContain("tạm thời bị khoá");
    expect(emailService.sendAccountLockedEmail).not.toHaveBeenCalled();
  });

  it("should allow login after lockout expired", async () => {
    const hashedPassword = await bcrypt.hash(VALID_PASSWORD, 12);
    const pastLockTime = new Date(Date.now() - 60 * 1000);
    const updateMock = jest.fn().mockResolvedValue(true);

    User.findOne.mockResolvedValue({
      id: 1,
      name: "Test User",
      email: "test@gmail.com",
      password: hashedPassword,
      role: "user",
      isVerified: true,
      failedLoginAttempts: 5,
      lockedUntil: pastLockTime,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@gmail.com", password: VALID_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(updateMock).toHaveBeenCalledWith({
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VERIFY EMAIL
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/auth/verify-email", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should verify email successfully (JSON mode)", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      name: "Test User",
      verificationToken: "valid_token_xyz",
      verificationTokenExpiresAt: futureDate,
      isVerified: false,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).get("/api/auth/verify-email?token=valid_token_xyz&format=json");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("thành công");
    expect(res.body.data.isVerified).toBe(true);
  });

  it("should redirect to FE success page (HTML mode)", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      name: "Test User",
      verificationToken: "valid_token_xyz",
      verificationTokenExpiresAt: futureDate,
      isVerified: false,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).get("/api/auth/verify-email?token=valid_token_xyz");

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/verify-email-success");
  });

  it("should return 400 if token missing (JSON mode)", async () => {
    const res = await request(app).get("/api/auth/verify-email?format=json");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("required");
  });

  it("should redirect to error page if token missing (HTML mode)", async () => {
    const res = await request(app).get("/api/auth/verify-email");

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/verify-email-error");
    expect(res.headers.location).toContain("missing_token");
  });

  it("should return 400 if token invalid (JSON mode)", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/auth/verify-email?token=invalid_xxx&format=json");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("không hợp lệ");
  });

  // Merge từ 2 case trùng nhau: vừa check 400 vừa check cleanup token
  it("should return 400 and cleanup token if expired (JSON mode)", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const updateMock = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      verificationToken: "expired_token",
      verificationTokenExpiresAt: pastDate,
      isVerified: false,
      update: updateMock,
    });

    const res = await request(app).get("/api/auth/verify-email?token=expired_token&format=json");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("hết hạn");
    // Cleanup: token phải bị xóa khỏi DB
    expect(updateMock).toHaveBeenCalledWith({
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });
  });

  it("should return 400 if token already used (findOne returns null)", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app).get("/api/auth/verify-email?token=used_token&format=json");

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("không hợp lệ");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RESEND VERIFICATION
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/resend-verification", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should resend verification email successfully", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "unverified@gmail.com",
      name: "User",
      isVerified: false,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("should return 200 even if email not found (anti-enumeration)", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "nonexistent@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it("should return 400 if email already verified", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "verified@gmail.com",
      name: "User",
      isVerified: true,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "verified@gmail.com" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("đã được xác thực");
  });

  it("should return 500 if email service fails during resend", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "unverified@gmail.com",
      name: "User",
      isVerified: false,
      update: jest.fn().mockResolvedValue(true),
    });
    emailService.sendVerificationEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await request(app)
      .post("/api/auth/resend-verification")
      .send({ email: "unverified@gmail.com" });

    // Khác register (best-effort), resend throw 500 khi email fail
    expect(res.statusCode).toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FORGOT PASSWORD
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should send reset email successfully for verified user", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      name: "Test User",
      password: "$2b$12$fakeHashedPasswordForTest",
      isVerified: true,
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("Nếu email tồn tại");
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@gmail.com",
        userName: "Test User",
        token: expect.any(String),
      })
    );
  });

  it("should return 200 silent success if email not found (anti-enumeration)", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nonexistent@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("should return 200 silent success if user not verified (anti-enumeration)", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "unverified@gmail.com",
      name: "User",
      isVerified: false,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "unverified@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  // Google-only: password = null → silent success, không gửi email
  it("should return 200 silent success for Google-only user (no password to reset)", async () => {
    User.findOne.mockResolvedValue({
      id: 1,
      email: "google@gmail.com",
      name: "Google User",
      password: null,
      isVerified: true,
      update: jest.fn(),
    });

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "google@gmail.com" });

    expect(res.statusCode).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("should cleanup token and return 500 if email send fails", async () => {
    const updateMock = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      name: "User",
      password: "$2b$12$fakeHashedPasswordForTest",
      isVerified: true,
      update: updateMock,
    });
    emailService.sendPasswordResetEmail.mockRejectedValueOnce(new Error("SMTP down"));

    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "test@gmail.com" });

    expect(res.statusCode).toBe(500);
    // update gọi 2 lần: lần 1 set token, lần 2 cleanup
    expect(updateMock).toHaveBeenCalledTimes(2);
    expect(updateMock).toHaveBeenLastCalledWith({
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
  });

  it("should return 400 if email format invalid", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if email missing", async () => {
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({});

    expect(res.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RESET PASSWORD
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should reset password successfully and revoke all sessions", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    const updateMock = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      name: "User",
      passwordResetToken: "valid_reset_token",
      passwordResetExpiresAt: futureDate,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "valid_reset_token", newPassword: NEW_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("thành công");
    expect(res.body.data.email).toBe("test@gmail.com");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        password: expect.any(String),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      })
    );
    // Password phải được hash
    expect(updateMock.mock.calls[0][0].password).not.toBe(NEW_PASSWORD);

    const { deleteAllSessions } = require("../../src/config/redis");
    expect(deleteAllSessions).toHaveBeenCalledWith(1);
  });

  it("should return 400 if token invalid", async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "invalid_token", newPassword: NEW_PASSWORD });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("không hợp lệ");
  });

  it("should return 400 if token expired and cleanup token", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000);
    const updateMock = jest.fn().mockResolvedValue(true);
    User.findOne.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      passwordResetToken: "expired_token",
      passwordResetExpiresAt: pastDate,
      update: updateMock,
    });

    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "expired_token", newPassword: NEW_PASSWORD });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("hết hạn");
    expect(updateMock).toHaveBeenCalledWith({
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    });
  });

  it("should return 400 if newPassword too short", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "valid_token", newPassword: INVALID_PASSWORDS.TOO_SHORT });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("ít nhất 8 ký tự");
  });

  it("should return 400 if newPassword has no number", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "valid_token", newPassword: INVALID_PASSWORDS.NO_NUMBER });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("chữ cái và 1 số");
  });

  it("should return 400 if token missing", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ newPassword: NEW_PASSWORD });

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if newPassword missing", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "valid_token" });

    expect(res.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CHANGE PASSWORD
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/change-password", () => {
  beforeEach(() => jest.clearAllMocks());

  const createMockUser = async (plainPassword = VALID_PASSWORD, opts = {}) => {
    const hashed = plainPassword ? await bcrypt.hash(plainPassword, 12) : null;
    return {
      id: 1,
      name: "Test User",
      email: "test@gmail.com",
      role: "user",
      isVerified: true,
      password: hashed,
      update: jest.fn().mockResolvedValue(true),
      ...opts,
    };
  };

  it("should change password successfully and return new tokens", async () => {
    const mockUser = await createMockUser(VALID_PASSWORD);
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/change-password").send({
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("thành công");
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.data.user.email).toBe("test@gmail.com");
    // Password phải được hash
    expect(mockUser.update.mock.calls[0][0].password).not.toBe(NEW_PASSWORD);

    const { deleteAllSessions, createSession } = require("../../src/config/redis");
    expect(deleteAllSessions).toHaveBeenCalledWith(1);
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, refreshToken: expect.any(String), deviceId: expect.any(String) })
    );
  });

  it("should allow Google-only user to set password without currentPassword", async () => {
    const mockUser = await createMockUser(null); // password = null
    mockUser.name = "Google User";
    mockUser.email = "google@gmail.com";
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ newPassword: "NewPass1234" }); // không truyền currentPassword

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
    expect(res.body.data).toHaveProperty("refreshToken");
    expect(res.body.message).toContain("Đặt mật khẩu thành công");
    // Password phải được hash đúng
    const savedHash = mockUser.update.mock.calls[0][0].password;
    expect(savedHash).not.toBe("NewPass1234");
    expect(await bcrypt.compare("NewPass1234", savedHash)).toBe(true);
  });

  it("should return 400 if newPassword fails policy for Google-only user", async () => {
    const mockUser = await createMockUser(null);
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ newPassword: "short" });

    expect(res.statusCode).toBe(400);
  });

  it("should return 401 if currentPassword is wrong", async () => {
    const mockUser = await createMockUser(VALID_PASSWORD);
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/change-password").send({
      currentPassword: "WrongPass1234",
      newPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain("không đúng");
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it("should return 400 if newPassword === currentPassword", async () => {
    const mockUser = await createMockUser(VALID_PASSWORD);
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request(app).post("/api/auth/change-password").send({
      currentPassword: VALID_PASSWORD,
      newPassword: VALID_PASSWORD,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("khác mật khẩu hiện tại");
    expect(mockUser.update).not.toHaveBeenCalled();
  });

  it("should return 400 if newPassword fails password policy", async () => {
    const res = await request(app).post("/api/auth/change-password").send({
      currentPassword: VALID_PASSWORD,
      newPassword: INVALID_PASSWORDS.TOO_SHORT,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("ít nhất 8 ký tự");
  });

  it("should return 400 if currentPassword missing", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ newPassword: NEW_PASSWORD });

    expect(res.statusCode).toBe(400);
  });

  it("should return 400 if newPassword missing", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .send({ currentPassword: VALID_PASSWORD });

    expect(res.statusCode).toBe(400);
  });

  it("should return 404 if user not found (token valid nhưng user đã bị xóa)", async () => {
    User.findByPk.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/change-password").send({
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REFRESH TOKEN
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/refresh", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should refresh token successfully", async () => {
    const refreshToken = generateRefreshToken(1, "test-device-uuid");
    getSession.mockResolvedValue({
      refreshToken,
      deviceName: "Test Device",
      userAgent: "test",
      ip: "::1",
    });
    User.findByPk.mockResolvedValue({
      id: 1,
      email: "test@gmail.com",
      role: "user",
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("accessToken");
  });

  it("should return 400 if refreshToken missing", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Refresh token is required");
  });

  it("should return 401 if refreshToken invalid", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "invalid.token.here" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid or expired refresh token");
  });

  it("should return 401 if session revoked (token not in Redis)", async () => {
    const refreshToken = generateRefreshToken(1, "test-device-uuid");
    getSession.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Session has been revoked");
  });

  it("should cleanup orphan token and return 401 if user not found", async () => {
    const { deleteSession } = require("../../src/config/redis");
    const refreshToken = generateRefreshToken(1, "test-device-uuid");
    getSession.mockResolvedValue({
      refreshToken,
      deviceName: "Test Device",
      userAgent: "test",
      ip: "::1",
    });
    User.findByPk.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("User not found");
    expect(deleteSession).toHaveBeenCalledWith(1, "test-device-uuid");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// LOGOUT (idempotent)
// ════════════════════════════════════════════════════════════════════════════

describe("POST /api/auth/logout", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should logout successfully with valid token", async () => {
    const refreshToken = generateRefreshToken(1, "test-device-uuid");

    const res = await request(app).post("/api/auth/logout").send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should return 200 even if refreshToken missing (idempotent)", async () => {
    const res = await request(app).post("/api/auth/logout").send({});

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should return 200 even if refreshToken invalid (idempotent)", async () => {
    const res = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: "invalid.token.here" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });

  it("should return 200 even if session already revoked (idempotent)", async () => {
    const refreshToken = generateRefreshToken(1, "test-device-uuid");
    getSession.mockResolvedValue(null);

    const res = await request(app).post("/api/auth/logout").send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Logged out successfully");
  });
});