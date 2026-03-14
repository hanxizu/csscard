# 使用 Playwright 官方完整镜像，包含 Chromium、Firefox、Webkit 和依赖
FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目代码
COPY . .

# Cloud Run 端口
ENV PORT=8080
EXPOSE 8080

# 启动服务
CMD ["npm", "start"]
