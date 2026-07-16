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

**数据流：** 前端发起抓取 → 后端调用 MCP 服务搜索小红书 → 获取帖子详情 → 下载图片 → sharp 预处理 → Tesseract OCR 识别 → 清理后处理 → 存入 MySQL → 前端展示

## OCR 管线

```
原始图片 → 下载 → sharp 预处理(灰度 + 归一化 + 放大2000px + 锐化)
→ Tesseract OCR (chi_sim+eng, PSM 6→3 兜底)
→ 后处理清洗(过滤乱码行 + 合并空行) → 入库
```

## Web Worker 搜索

面经列表页使用 Web Worker 实现非阻塞文本搜索。Worker 线程对 title、content、tags、author 字段建立倒排索引（中文逐字 + 英文连续分词），主线程通过 `postMessage` 发送搜索请求，Worker 匹配后返回命中的 post id 列表。主线程收到结果后与分类筛选取交集渲染，`<mark>` 高亮命中关键词。索引构建 debounce 500ms（仅在 posts 变化时触发），搜索 debounce 300ms，避免频繁通信。

## 本地部署

### 1. 环境要求

| 依赖 | 版本/说明 |
|------|----------|
| Node.js | >= 18 |
| MySQL | >= 5.7（需支持 JSON 类型和 utf8mb4） |
| Docker | 用于运行 xiaohongshu-mcp 浏览器自动化服务 |
| Tesseract OCR | 可选，用于图片文字识别（需中文语言包 `chi_sim`） |

### 2. 克隆与安装

```bash
git clone https://github.com/kairynx/xiaohongshu-mianshi.git
cd xiaohongshu-mianshi
npm install
```

### 3. 配置

```bash
cp .env.example .env
```

编辑 `.env`，填入你的配置：

```env
# MySQL（必填）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=你的数据库密码
DB_NAME=mianshi_app

# LLM API Key（使用 AI 功能必填）
LLM_API_KEY=sk-your-deepseek-api-key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TIMEOUT=60000

# MCP 服务地址（Docker 启动无需修改）
MCP_URL=http://localhost:18060/mcp
COOKIES_PATH=./docker-data/cookies/cookies.json

# OCR（Windows 需指定完整路径）
TESSERACT_PATH=tesseract
```

数据库表会在首次启动时自动创建，无需手动执行 SQL。

### 4. 启动服务

需要同时运行三个进程：

```bash
# 终端 1: 仅启动 xiaohongshu-mcp（浏览器自动化，不启动旧版 app 容器）
docker compose up -d xiaohongshu-mcp

# 终端 2: 启动后端（自动创建数据库表）
node server/index.js

# 终端 3: 启动前端开发服务器
npm run dev
```

### 5. 访问

打开浏览器访问 **http://localhost:5174**（Vite 开发服务器）。

如果 5174 被占用，终端会显示实际端口号。不要访问 5173 — 那是 Docker 容器里的旧构建版本。

### 6. 开发验证

确认服务正常运行：

```bash
# 后端健康检查
curl http://localhost:3001/api/health
# → {"status":"ok"}

# LLM 连通性检查
curl http://localhost:3001/api/agent/health
# → {"success":true,"data":{"llm":"ok","db":"ok",...}}

# MCP 服务状态
curl http://localhost:3001/api/mcp/status
# → {"connected":true, "data":"❌ 未登录..."}

# 日配额查询
curl http://localhost:3001/api/mcp/quota
# → {"success":true,"data":{"used":0,"limit":20,"remaining":20}}

# 前端构建验证
npm run build
```

启动后典型页面路径：

| 页面 | 路由 | 说明 |
|------|------|------|
| 首页概览 | `/` | 统计 + 最新面经 |
| 面经列表 | `/posts` | 搜索、筛选、排序 |
| AI 助手 | `/agent` | 智能抓取（输入目标 → 自动搜+结构化） |
| 我的学习 | `/notes` | 收藏 + 笔记管理 |
| 学习路径 | `/learn` | 知识点聚合、学习路线推荐 |
| 模拟面试 | `/mock` | AI 出题 + 答题 + 评分 + 反馈 |
| 数据抓取 | `/crawl` | 手动关键词抓取 + 扫码登录 |
| 数据看板 | `/dashboard` | 可视化统计 |

## AI 功能一览

| 功能 | LLM Agent | 说明 |
|------|-----------|------|
| 智能抓取 | Planner → Reflector | 输入目标，自动规划关键词、多轮抓取、质量评估 |
| 结构化抽取 | Extractor | 从原文提取公司/岗位/面试题/知识点 |
| 相关度分类 | Classifier | 帖子与目标岗位的匹配度打分 |
| 知识点聚合 | Aggregator | 基于收藏面经生成学习路径和薄弱分析 |
| 模拟面试 | Interviewer + Grader | 出题 + 答题 + 多维度评分反馈 |
| 智能问答 | QA | 基于面经库的自然语言问答（侧边栏搜索框） |

## 功能

- **多岗位搜索** — 前端/后端/测试开发/移动端/产品经理，支持自定义关键词
- **OCR 图文识别** — 自动提取小红书帖子图片中的面试内容
- **分类管理** — 按岗位、公司分类浏览面经
- **数据看板** — 阅读进度、分类分布、热门标签等可视化统计
- **笔记功能** — 在帖子详情中记录个人学习笔记
- **Web Worker 搜索** — 中英文混合分词 + 倒排索引，搜索不阻塞主线程 UI 渲染
- **优先级标注** — 高/中/低优先级筛选，按日期/点赞数/收藏数排序
- **扫码登录** — 数据抓取页面内置小红书二维码登录
- **抓取安全** — 随机延迟、会话复用、日配额建议，降低封号风险
