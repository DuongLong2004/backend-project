
// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const sequelize = require("./config/db");

// const app = express();

// app.use(cors());
// app.use(express.json());

// // ROUTES
// const userRoutes = require("./router/user.route");
// app.use("/api/users", userRoutes);

// const authRoutes = require("./router/auth.route");
// app.use("/api/auth", authRoutes);


// // DB SYNC

// sequelize
//   .sync({ alter: true })
//   .then(() => {
//     console.log("✅ Database synced (alter)");
//   })
//   .catch((err) => {
//     console.error("❌ DB sync error:", err);
//   });


// module.exports = app;


// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const sequelize = require("./config/db");

// const app = express();

// app.use(cors());
// app.use(express.json());

// /* ===================== ROUTES ===================== */

// const userRoutes = require("./router/user.route");
// app.use("/api/users", userRoutes);

// const authRoutes = require("./router/auth.route");
// app.use("/api/auth", authRoutes);

// /* ================= ERROR HANDLER ================== */

// // ❗ LUÔN đặt SAU routes
// const errorMiddleware = require("./middlewares/error.middleware");
// app.use(errorMiddleware);

// /* ===================== DB SYNC ===================== */

// sequelize
//   .sync({ alter: true })
//   .then(() => {
//     console.log("✅ Database synced (alter)");
//   })
//   .catch((err) => {
//     console.error("❌ DB sync error:", err);
//   });

  
// module.exports = app;


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sequelize = require("./config/db");

const app = express();

/* ===================== CORS ===================== */

app.use(
  cors({
    origin: "http://localhost:5000", // React frontend
    credentials: true,               // cho phép gửi cookie / token
  })
);

app.use(express.json());

/* ===================== ROUTES ===================== */

const userRoutes = require("./router/user.route");
app.use("/api/users", userRoutes);

const authRoutes = require("./router/auth.route");
app.use("/api/auth", authRoutes);

/* ================= ERROR HANDLER ================== */

// ❗ LUÔN đặt SAU routes
const errorMiddleware = require("./middlewares/error.middleware");
app.use(errorMiddleware);

/* ===================== DB SYNC ===================== */

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("✅ Database synced (alter)");
  })
  .catch((err) => {
    console.error("❌ DB sync error:", err);
  });

module.exports = app;
