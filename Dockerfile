# ✅ Base image – Node.js 20
FROM node:20-alpine

# ✅ Tạo thư mục làm việc trong container
WORKDIR /app

# ✅ Copy package.json trước (cache layer)
COPY package*.json ./

# ✅ Install dependencies
RUN npm install --production

# ✅ Copy toàn bộ source code
COPY . .

# ✅ Tạo thư mục cần thiết
RUN mkdir -p src/logs src/uploads

# ✅ Expose port
EXPOSE 5000

# ✅ Chạy app
CMD ["node", "src/server.js"]