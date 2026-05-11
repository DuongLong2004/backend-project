const app = require("./app");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

/*
 * Graceful shutdown — đợi requests hiện tại xử lý xong trước khi tắt.
 *
 * PM2/Railway gửi SIGTERM khi cần restart/redeploy. Nếu không handle:
 *   - Active requests bị cut giữa chừng → user thấy error
 *   - DB connections không close đẹp → có thể leak
 *
 * Flow:
 *   1. Nhận SIGTERM → stop accept connections mới
 *   2. Đợi các requests đang xử lý hoàn thành
 *   3. Đóng server → process exit code 0
 */
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      logger.error(`Error during shutdown: ${err.message}`);
      process.exit(1);
    }
    logger.info("Server closed successfully");
    process.exit(0);
  });

  // Force exit sau 10s nếu không close kịp (tránh hang forever)
  setTimeout(() => {
    logger.error("Forced shutdown after 10s timeout");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

/*
 * Catch unhandled errors để app không crash silent.
 * Trong production, các lỗi này sẽ được PM2 restart, nhưng mình log
 * lại để có audit trail debug sau.
 */
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});