# DeepSeek 交接文档

本文档用于把本项目交接给 DeepSeek 或其他代码助手继续开发。请直接把「给 DeepSeek 的总 Prompt」复制给 DeepSeek，再按后续 Milestone 逐步推进。

## 1. 项目定位

项目名：AI 面经助手

项目目标：基于 MCP + OCR + LLM Agent Workflow，抓取小红书面经，结构化整理为可搜索、可收藏、可做笔记、可复习的学习资产。

这不是普通爬虫项目。项目核心是：

- MCP 负责小红书搜索和详情抓取。
- OCR 负责提取图片中的面经内容。
- MySQL 负责持久化面经、结构化字段、收藏和笔记。
- LLM Agent 负责关键词规划、多轮抓取决策、面经结构化抽取、相关度分类。
- React 前端负责展示、筛选、收藏、笔记和智能抓取入口。

## 2. 当前技术栈

前端：

- React 19
- Vite
- React Router
- Context API
- Recharts
- lucide-react

后端：

- Node.js
- Express
- MySQL
- mysql2/promise
- dotenv

AI / 抓取：

- 外部 xiaohongshu-mcp 服务
- JSON-RPC over HTTP
- OCR：sharp + Tesseract
- LLM：OpenAI 兼容协议，当前使用 DeepSeek 兼容接口

## 3. 当前目录结构重点

```text
server/
  index.js                  # Express 入口，只挂载路由，不写业务逻辑
  routes/
    posts.js                # 面经 CRUD
    mcp.js                  # MCP 登录、搜索、详情
    crawl.js                # 原始 feed 转 post
    agent.js                # Agent / Job / Planner / Extract / Classify / Enrich API
    notes.js                # 收藏和笔记 API
  services/
    db.js                   # MySQL pool、posts、meta、relevance、notes
    mcp.js                  # MCP JSON-RPC 客户端
    ocr.js                  # OCR 管线
    validation.js           # post 输入清洗
    convert.js              # feed 转 post
    jobStore.js             # 内存 Job Store + SSE emitter
  workflow/
    crawlRunner.js          # 单轮关键词抓取
    smartCrawlRunner.js     # Planner -> Crawl -> Reflector 多轮智能抓取
    enrichRunner.js         # extract + classify 异步 enrich 管道
  agent/
    llm.js                  # 唯一 LLM 调用入口
    promptLoader.js         # prompts/*.md 加载和变量替换
    planner.js              # 目标 -> 搜索关键词
    reflector.js            # 判断是否继续抓取
    extractor.js            # 原文 -> 结构化 meta
    classifier.js           # 原文 + goal -> relevance
  prompts/
    planner.md
    reflector.md
    extractor.md
    classifier.md
    notes.md

src/
  App.jsx
  context/AppContext.jsx
  pages/
    HomePage.jsx
    PostsPage.jsx
    CategoriesPage.jsx
    DashboardPage.jsx
    CrawlPage.jsx          # 手动 / MCP / 服务端抓取
    AgentPage.jsx          # AI 智能抓取入口
    NotesPage.jsx          # 我的学习：收藏和笔记
  components/
    Sidebar.jsx
    PostCard.jsx
    PostDetail.jsx         # 内容 / 笔记 / 结构化详情
    NoteCard.jsx
    Toast.jsx
  utils/
    notesApi.js
    searchIndex.js
```

## 4. 运行方式

### 4.1 环境变量

`.env` 不允许提交到 GitHub。只提交 `.env.example`。

必要配置示例：

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=你的数据库密码
DB_NAME=mianshi_app

MCP_URL=http://localhost:18060/mcp
COOKIES_PATH=./docker-data/cookies/cookies.json

LLM_API_KEY=你的 DeepSeek API Key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TIMEOUT=60000
```

安全规则：

- 不要把真实 `LLM_API_KEY` 写进任何源码、文档、截图、提交记录。
- 不要让代码打印完整 API Key。
- `.env` 必须在 `.gitignore` 中。
- 文档只能写占位符，例如 `sk-xxxx` 或 `你的 DeepSeek API Key`。

### 4.2 启动服务

后端：

```bash
cd D:\xhs-mianshi\xiaohongshu-mianshi
node server/index.js
```

前端：

```bash
cd D:\xhs-mianshi\xiaohongshu-mianshi
npm run dev
```

构建：

```bash
npm run build
```

健康检查：

```bash
curl http://localhost:3001/api/health
```

Notes API 检查：

```bash
curl -s http://localhost:3001/api/notes -H "X-User-Id: test-user-12345"
```

预期返回：

```json
{"success":true,"data":[]}
```

## 5. 当前已完成能力

### 5.1 基础面经管理

- `/api/posts`：面经列表、批量保存、更新状态、删除。
- 前端 `/posts`：列表、搜索、筛选、详情弹窗。
- 前端 `/dashboard`：数据看板。

### 5.2 MCP + OCR 抓取

- `/api/mcp/status`
- `/api/mcp/search`
- `/api/mcp/feed/:feedId`
- `/api/mcp/feed/batch`
- `/api/crawl/convert`
- `server/services/mcp.js` 管理 MCP 会话、JSON-RPC、SSE 响应解析。
- `server/services/ocr.js` 下载图片、sharp 预处理、Tesseract OCR、合并 OCR 文本。

### 5.3 Agent 抓取

- `/api/agent/plan`：自然语言目标生成小红书搜索关键词。
- `/api/agent/jobs`：按关键词创建普通抓取 Job。
- `/api/agent/smart-jobs`：创建智能多轮抓取 Job。
- `/api/agent/jobs/:id`：查询 Job。
- `/api/agent/jobs/:id/events`：SSE 订阅 Job 进度。

智能抓取流程：

```text
用户目标
  -> planner.plan(goal)
  -> 第一批 keywords
  -> crawlKeywords(keywords)
  -> reflector.reflect(...)
  -> continue: 换关键词继续下一轮
  -> stop 或达到 maxRounds
  -> 创建 enrich Job
```

### 5.4 结构化抽取和相关度分类

- `/api/agent/extract`：直接输入 content，返回结构化 meta。
- `/api/agent/extract/:postId`：对已入库 post 抽取 meta 并写库。
- `/api/agent/classify`：直接输入 content + goal，返回相关度。
- `/api/agent/classify/:postId`：对已入库 post 分类并写库。
- `/api/agent/enrich`：对一批 post 异步执行 extract + classify。

数据库字段：

- `posts.meta JSON NULL`
- `posts.relevance FLOAT NULL`

前端 `PostDetail` 已展示：

- 相关度徽章
- 结构化 tab
- 公司、岗位、阶段、轮次、质量分
- 知识点
- AI 摘要
- 面试题列表
- 相关度详情

### 5.5 收藏和笔记

数据库：

- `notes` 表，按 `user_id + post_id` 唯一。
- 收藏 `starred` 属于 `notes` 表，不属于 `posts` 表。

API：

- `GET /api/notes`
- `GET /api/notes/:postId`
- `PUT /api/notes/:postId`
- `DELETE /api/notes/:postId`

前端：

- `PostDetail` 支持收藏和笔记。
- `NotesPage` 展示「我的学习」。
- `NoteCard` 展示收藏、笔记预览和关联 post。
- `Sidebar` 有「AI 助手」「我的学习」入口。

重要修复：

- `PostDetail.toggleStarred` 只能调用 `saveNote(post.id, { starred: next })`。
- 不允许再向 `/api/posts/:id` 提交 `starred`，因为 `starred` 不是 posts 表字段。

## 6. 给 DeepSeek 的总 Prompt

以下内容可以直接复制给 DeepSeek：

```text
你是本项目的 Senior Software Engineer。

项目：AI 面经助手。
定位：基于 MCP + OCR + LLM Agent Workflow 的 AI 面经整理平台。

你不是架构师，不是产品经理，不要重新设计项目。
你的任务是根据既有架构继续实现代码。

必须遵守：

1. 不要重构整体架构。
2. 不要重新规划目录。
3. 不要重新设计数据库。
4. 不要修改已有 API 的语义。
5. 不要修改 MCP 通信协议。
6. 不要修改 OCR 核心逻辑。
7. 优先新增模块，必要时小范围修改现有模块。
8. 不要引入新的框架或大型依赖。
9. Prompt 必须放在 server/prompts/*.md，不要硬编码在 JS 中。
10. LLM 调用只能通过 server/agent/llm.js。
11. 不要把任何 API Key 写入仓库。
12. .env 不允许提交，.env.example 只放占位配置。

当前代码结构：

- server/index.js 是 Express 入口，只挂载路由。
- server/routes/* 是路由层。
- server/services/* 是底层服务。
- server/workflow/* 是流程编排。
- server/agent/* 是 LLM Agent 能力。
- server/prompts/* 是 Prompt。
- src/pages/* 是页面。
- src/components/* 是组件。

当前已完成：

- MCP 抓取、小红书搜索和详情抓取。
- OCR 图片文字识别。
- posts 入库和前端展示。
- AgentPage 智能抓取。
- Planner、Reflector。
- Extractor、Classifier。
- enrich 异步管道。
- PostDetail 结构化展示。
- notes 表、收藏、笔记、NotesPage。

开发前必须先读：

- docs/DEEPSEEK_HANDOFF.md
- docs/INTERVIEW_QA.md
- server/index.js
- server/routes/agent.js
- server/services/db.js
- server/workflow/*.js
- server/agent/*.js
- src/components/PostDetail.jsx
- src/pages/NotesPage.jsx

每次实现只做当前 Milestone，不要提前做下一阶段。

如果发现架构问题，不要自行重构，输出：

## Blocking Issue
说明为什么无法继续，以及需要人类确认什么。

完成后只输出：

## 已修改文件
## 新增文件
## 运行方式
## 测试方法
## 是否完成当前 Milestone
```

## 7. 给 DeepSeek 的任务 Prompt 模板

后续每个任务建议按这个格式给 DeepSeek：

```text
本次只做 Milestone X-Y：<任务名称>。

目标：
<一句话说明目标>

修改范围：
- 允许修改：
  - <文件 1>
  - <文件 2>
- 不允许修改：
  - <文件 A>
  - <文件 B>

具体要求：
1. <要求 1>
2. <要求 2>
3. <要求 3>

不要做：
- 不要引入新依赖
- 不要改现有 API 语义
- 不要改 MCP/OCR 核心逻辑
- 不要动 .env
- 不要把 key 写进仓库

验收：
1. <命令 1>
2. <命令 2>
3. <页面检查>

完成后输出：
## 已修改文件
## 新增文件
## 运行方式
## 测试方法
## 是否完成当前 Milestone
```

## 8. 后续开发路线

以下是建议的后续流程。每个 Milestone 都应该独立完成、独立验证。

### M4-3：学习聚合 Aggregator + LearnPage

目标：把用户收藏和笔记转化为可复习的知识点地图。

建议新增：

- `server/prompts/aggregator.md`
- `server/agent/aggregator.js`
- `server/routes/learn.js` 或挂到 `server/routes/agent.js`
- `src/pages/LearnPage.jsx`
- `src/pages/LearnPage.css`
- `src/components/TopicCard.jsx`

数据来源：

- 当前用户 `notes`
- note.post.meta.topics
- note.post.meta.questions
- note.noteContent
- note.post.relevance

后端 API 建议：

- `GET /api/learn/summary`
- Header: `X-User-Id`
- 返回：

```json
{
  "success": true,
  "data": {
    "topicStats": [],
    "weakTopics": [],
    "reviewPlan": [],
    "questionBank": []
  }
}
```

约束：

- 不要新增表，先从 notes + posts.meta 聚合。
- 如果 LLM 不可用，使用规则聚合 fallback。
- LearnPage 不进 AppContext，独立请求。

验收：

- 收藏 3 条有 meta 的 post。
- 写 1 条笔记。
- 打开 `/learn` 看到知识点统计、薄弱点、复习建议、题目列表。

### M4-4：笔记标签和复习状态

目标：让笔记可管理。

后端：

- 复用 `notes.tags JSON`。
- 可选新增字段需谨慎：如 `review_status`、`last_reviewed_at`，必须先确认。

前端：

- `PostDetail` 笔记 tab 增加标签编辑。
- `NotesPage` 增加标签筛选。
- `NoteCard` 展示 noteTags。

约束：

- 不改 notes 表主语义。
- 不把 tags 混入 posts.tags。

### M5-1：问答助手 QA

目标：用户围绕已收藏/已抓取面经提问，系统基于本地数据回答。

建议新增：

- `server/prompts/qa.md`
- `server/agent/qa.js`
- `server/routes/qa.js`
- `src/pages/QAPage.jsx`

检索策略第一版：

- 不引入向量库。
- 用 MySQL + JS 简单关键词匹配。
- 检索字段：title、content、meta.summary、meta.questions、notes.content。
- 取 top 5-10 条作为上下文给 LLM。

API：

- `POST /api/qa/ask`
- body:

```json
{
  "question": "字节前端一面常问什么？",
  "scope": "all | notes | starred"
}
```

返回：

```json
{
  "success": true,
  "data": {
    "answer": "...",
    "sources": []
  }
}
```

约束：

- 回答必须引用来源 postId/title。
- LLM 不可用时返回检索结果摘要，不报 500。

### M5-2：题库和刷题模式

目标：把 `meta.questions` 沉淀为可刷题列表。

第一版不要新增表：

- 直接从 `posts.meta.questions` 聚合。
- 前端支持按 topic、difficulty、company、role 筛选。
- 点击题目能打开来源 PostDetail。

可选页面：

- `/questions`
- `QuestionCard`
- `QuestionFilter`

### M5-3：批量 Enrich 管理页

目标：解决「只有少数帖子有结构化」的问题。

建议：

- 在 Dashboard 或 AgentPage 增加「批量结构化」入口。
- 后端新增 API：

```text
POST /api/agent/enrich-missing
body: { goal?: string, limit?: number }
```

逻辑：

- 查询 `meta IS NULL OR relevance IS NULL` 的 posts。
- 限制每次最多 20 或 50 条。
- 创建 enrich job。
- 前端用 SSE 看进度。

约束：

- 不要一次性 enrich 全库，避免 LLM 成本和超时。
- 每条失败要记录 step，不要中断整个 job。

### M6-1：Dashboard 指标修正

目标：Dashboard 从 posts 指标升级到学习资产指标。

需要区分：

- 小红书原始收藏数：`posts.collects`
- 用户收藏：`notes.starred`
- 用户笔记数：`notes.content`

建议新增指标：

- 已收藏数量
- 有笔记数量
- 已结构化数量
- 高相关数量
- 高频知识点
- 待复习题目数

约束：

- 不要把 `posts.collects` 当用户收藏。
- 不要在 posts 表新增 `starred`。

### M6-2：Job 持久化

当前 `jobStore` 是内存 Map，服务重启后 Job 丢失。

可选增强：

- 新增 `agent_jobs` 表。
- `jobStore` 改为内存 + DB 双写。
- SSE 仍使用 EventEmitter。

约束：

- 不要破坏现有 `/api/agent/jobs/:id/events`。
- 先保证旧内存实现可回退。

### M7：部署和文档收尾

目标：可开源、可部署、可演示。

内容：

- 整理 README。
- 更新 `.env.example`。
- 更新 Dockerfile / docker-compose。
- 增加故障排查文档。
- 确保 `.env`、cookies、数据库密码不提交。
- 截图和演示流程文档。

## 9. 推荐 Prompt 文件规范

所有新 Prompt 放在：

```text
server/prompts/<name>.md
```

Prompt 必须包含：

- 角色
- 输入变量
- 任务目标
- 输出 JSON schema
- 硬性规则
- few-shot 示例
- 只返回 JSON，不要 markdown 代码块

Prompt Loader 用法：

```js
const { loadPrompt } = require('./promptLoader');
const prompt = loadPrompt('planner', { goal, company, role, stage });
```

LLM 调用只能通过：

```js
const llm = require('./llm');
const result = await llm.chatJSON(messages, { temperature: 0.2, maxTokens: 2000 });
```

## 10. 关键 API 验收命令

Planner：

```bash
curl -X POST http://localhost:3001/api/agent/plan ^
  -H "Content-Type: application/json" ^
  -d "{\"goal\":\"字节跳动前端实习\"}"
```

Smart Job：

```bash
curl -X POST http://localhost:3001/api/agent/smart-jobs ^
  -H "Content-Type: application/json" ^
  -d "{\"goal\":\"字节跳动前端实习\",\"maxRounds\":2}"
```

查询 Job：

```bash
curl http://localhost:3001/api/agent/jobs/<jobId>
```

Extract：

```bash
curl -X POST http://localhost:3001/api/agent/extract ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"字节跳动前端一面：1. 讲一下 React useEffect；2. 手写 Promise.all。\"}"
```

Classify：

```bash
curl -X POST http://localhost:3001/api/agent/classify ^
  -H "Content-Type: application/json" ^
  -d "{\"goal\":\"字节前端实习\",\"content\":\"字节前端一面问了 React 和 Promise。\"}"
```

Enrich：

```bash
curl -X POST http://localhost:3001/api/agent/enrich ^
  -H "Content-Type: application/json" ^
  -d "{\"postIds\":[\"<postId>\"],\"goal\":\"字节前端实习\"}"
```

Notes：

```bash
curl -s http://localhost:3001/api/notes -H "X-User-Id: test-user-12345"
```

收藏：

```bash
curl -X PUT http://localhost:3001/api/notes/<postId> ^
  -H "Content-Type: application/json" ^
  -H "X-User-Id: test-user-12345" ^
  -d "{\"starred\":true}"
```

## 11. 常见故障排查

### `/api/notes` 返回 HTML

原因：

- 后端旧进程没有重启。
- `/api/notes` 路由未挂载或 require 报错。
- 请求打到了 Vite 而不是 Express。

处理：

```bash
netstat -ano | findstr :3001
taskkill /F /PID <PID>
node server/index.js
```

确认日志：

```text
Server running on port 3001
MySQL connected
notes table ready
```

### 收藏按钮变实心后又变空心

重点检查：

- `PostDetail.toggleStarred` 是否只调用 `saveNote(post.id, { starred: next })`。
- 不允许调用 `/api/posts/:id` 写 `starred`。
- Network 里应只有 `PUT /api/notes/:postId`。

### 只有少数帖子有结构化

原因：

- 只有新抓取的 insertedIds 自动触发 enrich。
- 老数据不会自动 enrich。

处理：

- 先手动用 `/api/agent/enrich` 指定 postIds。
- 后续实现 M5-3 `enrich-missing`。

### Dashboard 高优先级或收藏数不更新

需要区分：

- `posts.collects` 是小红书原始收藏数。
- `notes.starred` 是用户自己的收藏。

如果 Dashboard 需要展示用户收藏，必须从 notes 统计，不要复用 posts.collects。

### LLM 不通

检查：

```bash
node -e "const { isEnabled } = require('./server/agent/llm'); console.log(isEnabled())"
```

直接测 DeepSeek：

```bash
curl -X POST https://api.deepseek.com/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_API_KEY" ^
  -d "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
```

注意：不要把真实 Key 发给模型或提交到仓库。

## 12. GitHub 上传前检查清单

必须确认：

- `.env` 未被提交。
- `docker-data/cookies/cookies.json` 未提交真实登录态。
- 没有真实 `LLM_API_KEY`。
- 没有数据库密码硬编码在新增文档或代码中。
- `npm run build` 通过。
- `node server/index.js` 能启动。
- `/api/health` 返回 JSON。
- `/api/notes` 返回 JSON。

建议命令：

```bash
git status
git diff -- .env
git diff -- docker-data/cookies/cookies.json
npm run build
```

如果 `.env` 或 cookies 出现在 `git status`，不要提交。
