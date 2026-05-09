# 面经助手 - 前端+后端一体化镜像
# 包含: Node.js + React前端 + Express后端代理 + Tesseract OCR

FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install

# 构建前端
COPY . .
RUN npm run build

# 删除开发依赖，只保留生产依赖
RUN npm prune --production
RUN rm -rf src node_modules/.vite

# ============ 生产镜像 ============
FROM node:20-alpine

# 安装 Chromium + Tesseract OCR + 中文字体 + ImageMagick(图片预处理)
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont imagemagick \
    tesseract-ocr tesseract-ocr-data-chi_sim tesseract-ocr-data-eng \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 只复制生产依赖和构建产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV MCP_URL=http://xiaohongshu-mcp:18060/mcp
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["node", "server/index.js"]
