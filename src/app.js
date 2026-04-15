


// // require("dotenv").config();
// // const express = require("express");
// // const cors = require("cors");
// // const helmet = require("helmet");                 // ✅ thêm
// // const rateLimit = require("express-rate-limit"); // ✅ thêm
// // const { sequelize } = require("./models/index");

// // const app = express();

// // /* ===================== SECURITY ===================== */
// // // ✅ Helmet – bảo vệ HTTP headers
// // app.use(helmet());

// // // ✅ Rate limit – max 100 req/15 phút
// // const globalLimiter = rateLimit({
// //   windowMs: 15 * 60 * 1000,
// //   max: 100,
// //   message: {
// //     status: "error",
// //     message: "Too many requests, please try again later",
// //     data: null,
// //   },
// // });
// // app.use(globalLimiter);

// // // ✅ Brute force – max 5 lần login/15 phút
// // const loginLimiter = rateLimit({
// //   windowMs: 15 * 60 * 1000,
// //   max: 5,
// //   message: {
// //     status: "error",
// //     message: "Too many login attempts, please try again after 15 minutes",
// //     data: null,
// //   },
// // });

// // /* ===================== CORS ===================== */
// // app.use(cors({ origin: "http://localhost:5173", credentials: true }));
// // app.use(express.json());

// // const { requestLogger } = require("./middlewares/logger.middleware"); // ✅ thêm
// // app.use(requestLogger); // ✅ thêm sau express.json()

// // /* ===================== ROUTES ===================== */
// // app.get("/", (req, res) => res.send("Backend is running 🚀"));
// // app.get("/health", (req, res) => res.json({ status: "OK", message: "Backend is alive 🚀" }));

// // const userRoutes = require("./router/user.route");
// // app.use("/api/users", userRoutes);

// // const authRoutes = require("./router/auth.route");
// // app.use("/api/auth/login", loginLimiter); // ✅ brute force chỉ cho login
// // app.use("/api/auth", authRoutes);

// // const orderRoutes = require("./router/order.route");
// // app.use("/api/orders", orderRoutes);

// // const productRoutes = require("./router/product.route");
// // app.use("/api/products", productRoutes);



// // // Serve file tĩnh từ thư mục uploads
// // app.use("/uploads", express.static("src/uploads")); // ✅ thêm sau app.use(express.json())

// // // Thêm upload routes
// // const uploadRoutes = require("./router/upload.route");
// // app.use("/api", uploadRoutes); // ✅ thêm cùng chỗ với các routes khác


// // const swaggerUi = require("swagger-ui-express");       // ✅ thêm
// // const swaggerSpec = require("./config/swagger");       // ✅ thêm
// // // ✅ Swagger UI
// // app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// // /* ================= ERROR HANDLER ================== */
// // const errorMiddleware = require("./middlewares/error.middleware");
// // app.use(errorMiddleware);

// // /* ===================== DB SYNC ===================== */
// // sequelize
// //   .sync()
// //   .then(() => console.log("✅ Database synced"))
// //   .catch((err) => console.error("❌ DB sync error:", err));

// // module.exports = app;


// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const rateLimit = require("express-rate-limit");
// const { sequelize } = require("./models/index");

// const app = express();

// /* ===================== SECURITY ===================== */
// app.use(helmet());

// const globalLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 500,
//   message: { status: "error", message: "Too many requests, please try again later", data: null },
// });
// app.use(globalLimiter);

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 5,
//   message: { status: "error", message: "Too many login attempts, please try again after 15 minutes", data: null },
// });

// /* ===================== CORS ===================== */
// app.use(cors({ origin: "http://localhost:5173", credentials: true }));
// app.use(express.json());

// const { requestLogger } = require("./middlewares/logger.middleware");
// app.use(requestLogger);

// /* ===================== ROUTES ===================== */
// app.get("/", (req, res) => res.send("Backend is running 🚀"));
// app.get("/health", (req, res) => res.json({ status: "OK", message: "Backend is alive 🚀" }));

// const userRoutes = require("./router/user.route");
// app.use("/api/users", userRoutes);

// const authRoutes = require("./router/auth.route");
// app.use("/api/auth/login", loginLimiter);
// app.use("/api/auth", authRoutes);

// const orderRoutes = require("./router/order.route");
// app.use("/api/orders", orderRoutes);

// const productRoutes = require("./router/product.route");
// app.use("/api/products", productRoutes);

// // ✅ Review routes – nested dưới products
// const reviewRoutes = require("./router/review.route");
// app.use("/api/products/:id/reviews", reviewRoutes);

// app.use("/uploads", express.static("src/uploads"));

// const uploadRoutes = require("./router/upload.route");
// app.use("/api", uploadRoutes);

// const swaggerUi = require("swagger-ui-express");
// const swaggerSpec = require("./config/swagger");
// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// const wishlistRoutes = require("./router/wishlist.route");
// app.use("/api/wishlist", wishlistRoutes);

// /* ================= ERROR HANDLER ================== */
// const errorMiddleware = require("./middlewares/error.middleware");
// app.use(errorMiddleware);

// /* ===================== DB SYNC ===================== */
// sequelize
//   // .sync()
//   .sync({ alter: true }) // ✅ tự thêm column mới
//   .then(() => console.log("✅ Database synced"))
//   .catch((err) => console.error("❌ DB sync error:", err));

// module.exports = app;


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { sequelize } = require("./models/index");

const app = express();

/* ===================== SECURITY ===================== */
app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { status: "error", message: "Too many requests, please try again later", data: null },
});
app.use(globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { status: "error", message: "Too many login attempts, please try again after 15 minutes", data: null },
});

/* ===================== CORS ===================== */
// ✅ Đọc từ .env thay vì hardcode
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

const { requestLogger } = require("./middlewares/logger.middleware");
app.use(requestLogger);

/* ===================== ROUTES ===================== */
app.get("/", (req, res) => res.send("Backend is running 🚀"));
app.get("/health", (req, res) => res.json({ status: "OK", message: "Backend is alive 🚀" }));

const userRoutes    = require("./router/user.route");
const authRoutes    = require("./router/auth.route");
const orderRoutes   = require("./router/order.route");
const productRoutes = require("./router/product.route");
const reviewRoutes  = require("./router/review.route");
const uploadRoutes  = require("./router/upload.route");
const wishlistRoutes = require("./router/wishlist.route");

app.use("/api/users",    userRoutes);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth",     authRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products/:id/reviews", reviewRoutes);
app.use("/uploads", express.static("src/uploads"));
app.use("/api",          uploadRoutes);
app.use("/api/wishlist", wishlistRoutes);

const swaggerUi   = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ================= ERROR HANDLER ================== */
const errorMiddleware = require("./middlewares/error.middleware");
app.use(errorMiddleware);

/* ===================== DB SYNC ===================== */
// ✅ alter:true chỉ dùng trong development, production không tự động thay đổi schema
const syncDB = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      await sequelize.sync();
    } else {
      await sequelize.sync({ alter: true });
    }
    console.log("✅ Database synced");
  } catch (err) {
    console.error("❌ DB sync error:", err);
  }
};

syncDB();

module.exports = app;

