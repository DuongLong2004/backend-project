const request = require("supertest");

// ════════════════════════════════════════════════════════════════════════════
// MOCKS
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

// Mock verifyToken: user id=1, role="user"
jest.mock("../../src/middlewares/auth.middleware", () => ({
  verifyToken: (req, res, next) => {
    req.user = { id: 1, role: "user" };
    next();
  },
}));

const app = require("../../src/app");
const User = require("../../src/models/User");

// ════════════════════════════════════════════════════════════════════════════
// GET /api/users/:id
// ════════════════════════════════════════════════════════════════════════════

describe("GET /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return user by id (owner)", async () => {
    User.findByPk.mockResolvedValue({
      id: 1,
      name: "Test",
      email: "t@gmail.com",
      role: "user",
    });

    const res = await request(app).get("/api/users/1");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");
  });

  it("should return 403 if not owner and not admin", async () => {
    // req.user.id = 1, nhưng đang truy cập id = 2
    const res = await request(app).get("/api/users/2");

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("should return 404 if user not found", async () => {
    User.findByPk.mockResolvedValue(null);

    const res = await request(app).get("/api/users/1");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("User not found");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PUT /api/users/:id
// ════════════════════════════════════════════════════════════════════════════

describe("PUT /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should update user successfully (owner)", async () => {
    User.findByPk.mockResolvedValue({
      id: 1,
      name: "Old",
      email: "t@gmail.com",
      age: 20,
      role: "user",
      update: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).put("/api/users/1").send({ name: "New Name" });

    expect(res.statusCode).toBe(200);
  });

  it("should return 403 if not owner and not admin", async () => {
    const res = await request(app).put("/api/users/2").send({ name: "Hacked" });

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  it("should return 404 if user not found", async () => {
    User.findByPk.mockResolvedValue(null);

    const res = await request(app).put("/api/users/1").send({ name: "X" });

    expect(res.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DELETE /api/users/:id
// ════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/users/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("should return 403 if not admin", async () => {
    // req.user.role = "user" → không có quyền xóa
    const res = await request(app).delete("/api/users/1");

    expect(res.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// checkRole middleware
// ════════════════════════════════════════════════════════════════════════════

describe("checkRole middleware", () => {
  const checkRole = require("../../src/middlewares/checkRole");
  const AppError = require("../../src/utils/AppError");

  it("should call next() with no args if role matches", () => {
    const middleware = checkRole("admin");
    const next = jest.fn();

    middleware({ user: { id: 1, role: "admin" } }, {}, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should call next(AppError 403) if role does not match", () => {
    const middleware = checkRole("admin");
    const next = jest.fn();

    middleware({ user: { id: 1, role: "user" } }, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(403);
  });

  it("should call next(AppError 401) if req.user is undefined", () => {
    const middleware = checkRole("admin");
    const next = jest.fn();

    middleware({}, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// error middleware
// ════════════════════════════════════════════════════════════════════════════

describe("error middleware", () => {
  const errorMiddleware = require("../../src/middlewares/error.middleware");
  const AppError = require("../../src/utils/AppError");

  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };
  const makeReq = () => ({ method: "GET", originalUrl: "/api/test" });

  it("should return correct statusCode and message for AppError", () => {
    const err = new AppError("Resource not found", 404);
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      status: "error",
      message: "Resource not found",
      data: null,
    });
  });

  it("should default to 500 for generic Error without statusCode", () => {
    const err = new Error("Something broke");
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("should handle SequelizeValidationError — join all messages", () => {
    const err = {
      name: "SequelizeValidationError",
      errors: [{ message: "Name is required" }, { message: "Email is invalid" }],
    };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Name is required, Email is invalid");
  });

  it("should handle SequelizeUniqueConstraintError with 409", () => {
    const err = { name: "SequelizeUniqueConstraintError" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toBe("Data already exists");
  });

  it("should handle SequelizeForeignKeyConstraintError with 400", () => {
    const err = { name: "SequelizeForeignKeyConstraintError" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Related resource not found");
  });

  it("should handle MulterError with 400", () => {
    const err = { name: "MulterError", message: "File too large" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("File too large");
  });

  it("should handle file type rejection message with 400", () => {
    const err = { message: "Only jpg, jpeg, png files are allowed" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should handle JsonWebTokenError with 401", () => {
    const err = { name: "JsonWebTokenError" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toBe("Invalid token");
  });

  it("should handle TokenExpiredError with 401", () => {
    const err = { name: "TokenExpiredError" };
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].message).toBe("Token expired");
  });

  it("should attach lockedUntil and minutesRemaining when present", () => {
    const err = new AppError("Account locked", 423);
    const lockTime = new Date(Date.now() + 15 * 60 * 1000);
    err.lockedUntil = lockTime;
    err.minutesRemaining = 15;
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.lockedUntil).toEqual(lockTime);
    expect(body.minutesRemaining).toBe(15);
  });

  it("should attach attemptsRemaining when present", () => {
    const err = new AppError("Invalid password", 401);
    err.attemptsRemaining = 3;
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.json.mock.calls[0][0].attemptsRemaining).toBe(3);
  });

  it("should NOT leak stack trace in production", () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const err = new AppError("Error", 500);
    const res = makeRes();

    errorMiddleware(err, makeReq(), res, jest.fn());

    expect(res.json.mock.calls[0][0]).not.toHaveProperty("stack");
    process.env.NODE_ENV = original;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// AppError class
// ════════════════════════════════════════════════════════════════════════════

describe("AppError class", () => {
  const AppError = require("../../src/utils/AppError");

  it("should set status to 'error' for 4xx", () => {
    const err = new AppError("Bad request", 400);

    expect(err.statusCode).toBe(400);
    expect(err.status).toBe("error");
    expect(err.isOperational).toBe(true);
    expect(err.message).toBe("Bad request");
  });

  it("should set status to 'server error' for 5xx", () => {
    const err = new AppError("Internal error", 500);

    expect(err.status).toBe("server error");
  });

  it("should be instanceof Error", () => {
    const err = new AppError("Test", 404);

    expect(err).toBeInstanceOf(Error);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 404 handler
// ════════════════════════════════════════════════════════════════════════════

describe("404 handler", () => {
  it("should return 404 cho route không tồn tại", async () => {
    const res = await request(app).get("/api/route-khong-ton-tai");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toContain("not found");
  });

  it("should include method trong message", async () => {
    const res = await request(app).delete("/api/khong-co-endpoint-nay");

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toContain("DELETE");
  });
});