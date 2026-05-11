const swaggerJsdoc = require("swagger-jsdoc");

/*
 * ═══════════════════════════════════════════════════════════════════════
 * SWAGGER SERVER URLS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Logic:
 *   - Production: chỉ hiện BASE_URL (Railway public domain)
 *   - Development: hiện cả BASE_URL (nếu có) + localhost để test
 *
 * BASE_URL trong production phải là URL Railway, VD:
 *   https://backend-project-production.up.railway.app
 * ═══════════════════════════════════════════════════════════════════════
 */
const buildServers = () => {
  const baseUrl = process.env.BASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && baseUrl) {
    // Production: chỉ list URL prod
    return [{ url: baseUrl, description: "Production server" }];
  }

  // Development: list local + prod (nếu có)
  const servers = [{ url: baseUrl || "http://localhost:5000", description: "Local server" }];

  // Nếu dev có set BASE_URL khác localhost (VD test với Railway từ local) → thêm fallback
  if (baseUrl && baseUrl !== "http://localhost:5000") {
    servers.push({ url: "http://localhost:5000", description: "Local fallback" });
  }

  return servers;
};

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Backend API Documentation",
      version: "1.0.0",
      description: "API docs cho Backend Project – Junior Backend",
    },
    servers: buildServers(),
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/router/*.js"], // ✅ đọc JSDoc từ các file route
};

module.exports = swaggerJsdoc(options);
