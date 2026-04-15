const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Backend API Documentation",
      version: "1.0.0",
      description: "API docs cho Backend Project – Junior Backend",
    },
    servers: [
      { url: "http://localhost:5000", description: "Local server" },
    ],
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