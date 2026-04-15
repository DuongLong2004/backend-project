class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? "error" : "server error";
    this.isOperational = true; // lỗi có thể đoán trước
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;