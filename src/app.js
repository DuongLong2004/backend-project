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

const userRoutes     = require("./router/user.route");
const authRoutes     = require("./router/auth.route");
const orderRoutes    = require("./router/order.route");
const productRoutes  = require("./router/product.route");
const reviewRoutes   = require("./router/review.route");
const uploadRoutes   = require("./router/upload.route");
const wishlistRoutes = require("./router/wishlist.route");
const placementRouter = require("./router/placement.route");

app.use("/api/users",    userRoutes);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth",     authRoutes);
app.use("/api/orders",   orderRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products/:id/reviews", reviewRoutes);
app.use("/uploads", express.static("src/uploads"));
app.use("/api",          uploadRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/placements", placementRouter);

const swaggerUi   = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ===================== 404 HANDLER ===================== */
app.use((req, res) => {
  res.status(404).json({
    status:  "error",
    message: `Route ${req.method} ${req.originalUrl} not found`,
    data:    null,
  });
});

/* ================= ERROR HANDLER ================== */
const errorMiddleware = require("./middlewares/error.middleware");
app.use(errorMiddleware);

/* ===================== DB SYNC ===================== */
const syncDB = async () => {
  try {
    if (process.env.NODE_ENV === "production") {
      await sequelize.sync();
    } else {
      await sequelize.sync();
    }
    console.log("-> Database synced");
  } catch (err) {
    console.error(" X DB sync error:", err);
  }
};

syncDB();

module.exports = app;