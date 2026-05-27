# 面经助手 — 小红书面经抓取与管理系统

自动从小红书搜索互联网岗位面试经验，通过 OCR 图文识别提取面经内容，存入 MySQL 数据库，并提供 Web 管理界面。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + React Router + Recharts + Vite |
| 后端 | Express 5 (Node.js) |
| 数据库 | MySQL (mysql2) |
| OCR | Tesseract + sharp 预处理 |
| 抓取 | xiaohongshu-mcp (MCP 协议浏览器自动化) |
| 部署 | Docker Compose |

## 架构

```
┌─────────────┐     REST API      ┌──────────────┐     MCP JSON-RPC     ┌──────────────────┐
│  React 前端  │ ◄──────────────► │  Express 后端  │ ◄─────────────────► │ xiaohongshu-mcp  │
│  (Vite)     │                   │  (Node.js)   │                      │  (浏览器自动化)    │
└─────────────┘                   └──────┬───────┘                      └──────────────────┘
                                         │
                                    MySQL │
                                   ┌──────┴───────┐
                                   │   面经数据库   │
                                   └──────────────┘
```

**数据流：** 前端发起抓取 → 后端调用 MCP 服务搜索小红书 → 获取帖子详情 → 下载图片 → ImageMagick 预处理 → Tesseract OCR 识别 → 清理后处理 → 存入 MySQL → 前端展示

## OCR 管线

```
原始图片 → 下载 → sharp 预处理(灰度 + 归一化 + 放大2000px + 锐化)
→ Tesseract OCR (chi_sim+eng, PSM 6→3 兜底)
→ 后处理清洗(过滤乱码行 + 合并空行) → 入库
```

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < init-db.sql
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入你的数据库连接信息
```

### 3. 启动 MCP 服务 + 面经助手

```bash
docker compose up -d
```

访问 http://localhost:5173

### 本地开发（不使用 Docker）

```bash
# 终端1: 启动 xiaohongshu-mcp 服务
./xiaohongshu-mcp-darwin-arm64  # macOS
# 或下载对应平台的二进制: https://github.com/xpzouying/xiaohongshu-mcp

# 终端2: 启动后端
npm install
npm run server

# 终端3: 启动前端
npm run dev
```

## 功能

- **多岗位搜索** — 前端/后端/测试开发/移动端/产品经理，支持自定义关键词
- **OCR 图文识别** — 自动提取小红书帖子图片中的面试内容
- **分类管理** — 按岗位、公司分类浏览面经
- **数据看板** — 阅读进度、分类分布、热门标签等可视化统计
- **笔记功能** — 在帖子详情中记录个人学习笔记
- **优先级标注** — 高/中/低优先级筛选，按日期/点赞数/收藏数排序
