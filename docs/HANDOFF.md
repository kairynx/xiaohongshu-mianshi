# 项目交接文档

面向 DeepSeek / 后续 AI 工程师。本文档包含：
1. 当前项目进度全景
2. 环境准备与启动清单
3. 立即待修问题
4. 剩余 Milestone 的完整 Prompt（M4-3、M4-4、M4-5、M5）
5. 已知限制与设计约定

---

## 一、当前进度全景

### 项目定位

AI Native 面经助手。不是爬虫、不是 Demo。核心是让面经从"原始文本"变为"结构化学习资产"。

架构分三层：
- **抓取 Agent**：Planner 生成关键词 → MCP 抓取 → Reflector 判断继续/停止（多轮循环）
- **整理 Agent**：Extractor 结构化抽取 → Classifier 相关度打分
- **学习 Agent**（未完成）：Aggregator 知识点聚合 → Interviewer 出模拟题 → Grader 评分 → RAG QA 问答

### Milestone 状态表

| Milestone | 内容 | 状态 |
|-----------|------|------|
| M0-1 ~ M0-5 | 后端从单文件重构为 services/routes 分层 | ✅ 完成 |
| M1-1 ~ M1-4 | Job Store + SSE + crawlRunner + CrawlPage Server 模式 | ✅ 完成 |
| M2-1 | llm.js + promptLoader.js | ✅ 完成 |
| M2-2 | Planner + /api/agent/plan | ✅ 完成 |
| M2-3 | Reflector + smartCrawlRunner + /api/agent/smart-jobs | ✅ 完成 |
| M2-4 | 前端 AgentPage | ✅ 完成（智能抓取多轮 UI）|
| M2 补丁 | Planner 收敛：命中率校验 + Prompt 优化 + MCP 超时分工具 | ✅ 完成 |
| M3-1 | Extractor + posts.meta 列 | ✅ 完成 |
| M3-2 | Classifier + posts.relevance 列 | ✅ 完成 |
| M3-3 | enrichRunner 异步管道 | ✅ 手动触发验证通过；smart-jobs 全链路验证未完成（MCP 抓取偶发超时）|
| M3-4 | PostDetail 结构化字段展示 + 相关度徽章 | ✅ 完成 |
| M4-1 | notes 表 + REST API + PostDetail 集成 | ✅ 完成 |
| M4-2 | NotesPage 收藏列表页 | ⚠️ 完成但有遗留（见下节）|
| M4-3 | Aggregator + LearnPage 知识点地图 | ⏳ 未开始 |
| M4-4 | Interviewer + Grader + MockPage 模拟面试 | ⏳ 未开始 |
| M4-5 | RAG QA + 全局搜索改为 AI 问答 | ⏳ 未开始 |
| M5 | 部署收尾：docker-compose、.env、README 更新 | ⏳ 未开始 |

---

## 二、环境准备

### 必需服务

| 服务 | 端口 | 用途 |
|------|------|------|
| Node.js（v18+） | - | 运行后端和前端 |
| MySQL | 3306 | 数据存储（posts / notes 两表 + 未来 practices）|
| xiaohongshu-mcp | 18060 | 小红书抓取（外部 MCP 服务，无头浏览器）|
| Tesseract OCR | - | 图片文字识别，需要中文语言包 chi_sim |

### `.env` 配置模板

```env
# MySQL
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=你的密码
DB_NAME=mianshi_app

# MCP
MCP_URL=http://localhost:18060/mcp
COOKIES_PATH=./docker-data/cookies/cookies.json

# OCR
TESSERACT_PATH=tesseract    # Windows: D:\TesseractOCR\tesseract.exe

# LLM（DeepSeek）
LLM_API_KEY=sk-你的deepseek key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
LLM_TIMEOUT=60000
```

### 启动命令

```bash
# 后端
cd D:\xhs-mianshi\xiaohongshu-mianshi
node server/index.js

# 前端（开发模式）
npm run dev

# 或生产构建后统一从 3001 访问
npm run build
node server/index.js  # 会同时托管 dist/
```

### 首次启动会自动做

- 数据库 schema 迁移（posts.meta、posts.relevance、notes 表）
- MySQL 连接失败会 warn，但不阻塞启动（LLM/API 不受影响）
- LLM_API_KEY 为空时 planner 走 fallback，reflector 直接停

---

## 三、立即待修问题

### 问题 1：PostDetail 里 toggleStarred 有多余 fetch

**文件**：`src/components/PostDetail.jsx` 的 `toggleStarred` 函数（约 149-162 行）

**Bug**：调用了 `/api/posts/:id` PUT，试图更新 starred 字段。但 posts 表根本没有 starred 字段，该字段属于 notes 表。这个请求会静默失败，被 catch 吞掉，误导后续调试。

**修复 Prompt**：

```
修改 src/components/PostDetail.jsx 中 toggleStarred 函数。

删除对 /api/posts/${post.id} 的 PUT 请求，只保留 saveNote(post.id, { starred: next }) 调用。
理由：starred 是 notes 表字段，不属于 posts。

不修改其他逻辑。
```

### 问题 2：smart-jobs → enrich 全链路验证未完成

**现状**：M3-3 已实现 smart-jobs 完成后自动触发 enrichRunner，但因 MCP 抓取偶发超时，未跑到完整闭环验证。

**建议**：M4 阶段完成后，在部署阶段进行一次真实端到端测试：
1. 前端提交 goal → 观察主 Job 完成
2. 查询主 Job.result.enrichJobId
3. 用 enrichJobId 查询 enrich Job 状态，确认 extract + classify 都跑过
4. 打开 /notes 或 /posts 详情页，确认结构化字段和 relevance 已展示

若发现 enrich Job 没自动触发，检查 `smartCrawlRunner.js` 里主 Job done 前是否调用了 `enrichRunner.createAndRunEnrichJob(allInsertedIds, goal)`。

### 问题 3：`.env` 上仓库风险

**必须确认**：`.gitignore` 已包含 `.env`。

```bash
grep -n "^\.env$" .gitignore
```

若没有输出，立即补上：

```
echo .env >> .gitignore
```

若 `.env` 曾经被 commit 过，去 DeepSeek 控制台**轮换 API Key**。

---

## 四、剩余 Milestone Prompt

以下 Prompt 可以直接复制给 DeepSeek 或其他 AI 执行。所有 Prompt 都遵循「不写代码，让 AI 自主实现」的风格。

---

### M4-3 — Aggregator + LearnPage（知识点聚合）

**目标**：让用户在 `/learn` 页面看到"基于我收藏的面经，最高频的知识点是什么、按什么顺序学习"。这是学习工具区别于搜索引擎的关键功能。

**Prompt**：

```
本 Milestone 实现基于用户收藏面经的知识点聚合功能。

===== 后端 =====

文件 1：server/prompts/aggregator.md
Prompt 设计要求（自主设计具体内容）：
- 系统角色：学习路径规划师
- 输入变量：
  * {{goal}}：用户目标
  * {{posts_meta}}：多条面经的 meta.questions 和 meta.topics 汇总 JSON
- 任务：
  1. 从所有 questions/topics 中统计高频知识点，输出频次排行
  2. 按学习路径逻辑给出建议顺序（先基础后进阶）
  3. 识别用户当前最弱的方向（quality_score 低或 questions 少的领域）
- 输出严格 JSON，字段：
  * topics_ranking: [{ topic, count, difficulty, importance }] 排序
  * learning_path: [{ order, topic, reason }] 建议学习顺序
  * weak_areas: string[] 推荐补强的方向
  * summary: 一段中文总结

文件 2：server/agent/aggregator.js
职责：加载 aggregator.md、调用 LLM、返回聚合结果。
要求：
- 暴露 aggregate(goal, posts) → 聚合对象
- posts 是从 DB 读出来的面经数组，内部提取 meta.questions/topics
- 若 posts 数量为 0：返回空聚合，不调 LLM
- posts 超过 30 条时按 relevance 降序取前 30（省 token）
- content 里不需要传原文，只传 meta 摘要，减少 token
- 兜底：LLM 失败时用启发式（简单 topic 频次统计）

文件 3：server/routes/agent.js
新增：POST /api/agent/aggregate
- 请求体：{ goal: string, source: 'starred' | 'notes' | 'all', postIds?: string[] }
- source='starred'：查询该用户 starred=true 的 notes 关联的 posts
- source='notes'：该用户所有 notes 关联的 posts
- source='all' + postIds：用指定的 post ids
- 校验 X-User-Id 头
- 调用 aggregator.aggregate
- 返回 { success, data: aggregation }

===== 前端 =====

文件 4：src/pages/LearnPage.jsx
布局：
1. 顶部：目标输入 + "来源选择"（已收藏 / 有笔记 / 全部）+ "开始分析"按钮
2. 加载状态：loader
3. 结果展示：
   a) 知识点频次排行：柱状图或条形列表，topic 名称 + count 数字
   b) 学习路径：编号卡片列表，每张卡片有 topic、原因、序号
   c) 薄弱方向：警告色 chip 列表
   d) AI 总结：段落文本
4. "重新分析"按钮

文件 5：src/pages/LearnPage.css
自主设计。风格与 NotesPage 保持一致。

文件 6：src/App.jsx 新增路由 /learn
文件 7：src/components/Sidebar.jsx 新增导航项"学习路径"，图标用 Brain 或 GraduationCap

不要动 CrawlPage、AgentPage、NotesPage、PostDetail。
不要引入新 npm 依赖。柱状图用纯 CSS 或 SVG 简单实现，不用 Recharts（虽然项目已装但 LearnPage 追求轻量）。
```

**验收**：收藏 3-5 条面经后打开 `/learn`，输入"字节前端"，看到知识点排行 + 学习路径 + 薄弱方向。

---

### M4-4 — Interviewer + Grader + MockPage（模拟面试）

**目标**：让用户在 `/mock` 页面点"来一题"，系统基于收藏面经出一道模拟题，用户答题后 LLM 打分反馈。这是把学习闭环推向 "practice → feedback" 的关键。

**Prompt**：

```
本 Milestone 实现模拟面试功能。

===== 后端 =====

文件 1：server/prompts/interviewer.md
Prompt 设计要求：
- 系统角色：面试出题官
- 输入：
  * {{goal}}：用户目标
  * {{topics}}：用户已掌握或欠缺的知识点列表（从 M4-3 aggregator 结果传入）
  * {{recent_questions}}：最近 5 道已练习过的题（避免重复出题）
- 任务：出一道适合当前用户目标的面试题
- 输出严格 JSON：
  * question: 题目原文
  * topic: 所属知识点
  * difficulty: easy | medium | hard
  * reference_answer: 参考答案（Markdown 格式，可分点）
  * scoring_criteria: [{ dimension, description, weight }] 评分维度（如"正确性 50%"、"完整性 30%"、"深度 20%"）
  * hints: string[] 提示（用户答不出时给的引导）

文件 2：server/prompts/grader.md
Prompt 设计要求：
- 系统角色：面试评审官
- 输入：
  * {{question}}：题目
  * {{reference_answer}}：参考答案
  * {{scoring_criteria}}：评分维度
  * {{user_answer}}：用户答案
- 任务：客观评分 + 建设性反馈
- 输出严格 JSON：
  * total_score: 0-100 整数
  * dimension_scores: [{ dimension, score, max, comment }] 各维度得分
  * strengths: string[] 亮点
  * improvements: string[] 改进建议（具体，可执行）
  * missing_points: string[] 参考答案里覆盖但用户没提到的关键点
  * verdict: string 一句话总评

文件 3：server/agent/interviewer.js
- 暴露 generateQuestion(goal, topics, recentQuestions) → question 对象
- 兜底：LLM 失败时从 practices 表随机拿一道历史题（去重）

文件 4：server/agent/grader.js
- 暴露 grade(question, userAnswer, reference, criteria) → grade 对象
- 兜底：LLM 失败时给中位分（50）+ 说明"暂时无法评分"

文件 5：server/services/db.js
新增 practices 表：
- id VARCHAR(64) PK
- user_id VARCHAR(64) NOT NULL
- question TEXT
- user_answer TEXT
- reference_answer TEXT
- topic VARCHAR(64)
- difficulty ENUM('easy','medium','hard')
- grade JSON （grade 完整结果）
- source_post_ids JSON （出题依据）
- created_at, updated_at
- 索引：user_id、topic、created_at

新增函数：
- createPractice(userId, data) → practice
- gradePractice(practiceId, grade) → 更新
- listPractices(userId, options) → practice[]
- getPractice(id) → practice | null

文件 6：server/routes/agent.js 新增：
- POST /api/agent/mock/new
  * body: { goal, topics? }（topics 可选，不传则调 aggregator 拿）
  * 校验 X-User-Id
  * 从 practices 表拿最近 5 道题作为 recentQuestions
  * 调 interviewer.generateQuestion
  * createPractice 存题（user_answer 空、grade 空）
  * 返回 { success, data: { practiceId, question, topic, difficulty, hints } }
    - 不返回 reference_answer 和 scoring_criteria（防作弊）

- POST /api/agent/mock/:practiceId/grade
  * body: { user_answer }
  * 从 DB 读 practice
  * 调 grader.grade
  * gradePractice 写回
  * 返回 { success, data: grade }
  * 首次评分后可以返回 reference_answer 让用户对照

- GET /api/agent/mock/history
  * query: limit, offset
  * 返回该用户的 practices 列表

===== 前端 =====

文件 7：src/pages/MockPage.jsx
布局：
1. 顶部：目标输入 + "开始模拟" 按钮
2. 进入模拟后：
   a) 题目卡片：显示 question / topic / difficulty
   b) 提示按钮：点开显示 hints
   c) 答题区：textarea，自动保存草稿到 localStorage
   d) "提交答题"按钮 → 调 grade API
3. 评分结果：
   a) 总分（大数字 + 进度条）
   b) 维度分数条形图
   c) 亮点（绿色 chip 列表）
   d) 改进建议（橙色 chip 列表）
   e) 缺失点（灰色 chip 列表，附参考答案原文）
   f) 一句话总评
4. "再来一题" / "查看历史" 按钮

文件 8：src/pages/MockHistoryPage.jsx（或作为 MockPage 的 Tab）
展示历史练习列表，点击进入某条查看题目 + 用户答案 + 评分。

文件 9：Sidebar + App.jsx
新增导航"模拟面试" → /mock，图标 lucide-react 的 Target 或 GraduationCap。

不要引入新 npm 依赖。
```

**验收**：/mock 页面输入"字节前端实习" → 点"开始模拟" → 出题 → 答题 → 提交 → 拿到分数和建议 → 点"再来一题"重复。

---

### M4-5 — RAG QA（智能问答）

**目标**：用户在顶部搜索框输入"字节前端一面常问啥？"，系统检索相关面经 + LLM 综合答案。这是学习工具的"随时提问"能力。

**Prompt**：

```
本 Milestone 实现基于面经库的智能问答。

===== 后端 =====

文件 1：server/prompts/qa.md
Prompt 设计要求：
- 系统角色：面试知识问答助手
- 输入：
  * {{question}}：用户提问
  * {{retrieved_posts}}：检索到的相关面经数组，每条含 title/summary/questions/topics
- 任务：
  * 综合面经信息给出结构化回答
  * 引用具体的面经作为依据（用编号 [1][2] 标注）
  * 不确定的地方明确说"面经中未涉及"
- 输出严格 JSON：
  * answer: Markdown 格式的回答文本
  * citations: [{ index, postId, title }] 引用来源
  * confidence: 0.0-1.0 置信度
  * related_topics: string[] 相关知识点建议

文件 2：server/agent/qa.js
- 暴露 askQuestion(question, userId?) → qa 对象
- 内部实现检索：
  * 简易版：MySQL 全文检索 posts.title + posts.content + posts.meta（LIKE 或 MATCH AGAINST）
  * 取 Top 10，按 relevance（如果有）+ likes/collects 排序
  * 传给 LLM 前只保留 title、summary、questions 简版，控制 token
- 若 userId 有值：优先从该用户 starred 的 notes 关联 posts 里检索
- 兜底：LLM 失败时返回检索到的 posts 列表 + 提示"LLM 不可用"

文件 3：server/routes/qa.js（新建）
- POST /api/qa
  * body: { question }
  * 可选 header X-User-Id（个性化优先本人收藏）
  * 调 qa.askQuestion
  * 返回 { success, data: qa }

server/index.js 加一行：
app.use('/api/qa', require('./routes/qa'));

===== 前端 =====

文件 4：修改 src/components/Sidebar.jsx
在最顶部（logo 下方）加一个搜索输入框：
- placeholder: "问点什么？例如：字节前端一面常问啥？"
- 输入回车或点击 Send 图标 → 打开 QA 弹窗（或跳转 /qa 页面）

文件 5：src/components/QADialog.jsx（新建）
浮层弹窗（不是全屏页面，参考 PostDetail 的 modal 风格）：
1. 顶部：问题输入框（可再次修改）+ 提交按钮
2. 中间：Markdown 渲染的答案（复用 PostDetail 的 renderContent）
3. 底部：
   - 引用来源列表，每项点击可跳转对应 post 详情
   - 相关话题 chips
   - 置信度徽章
4. 加载状态：loader + "AI 正在检索面经..."
5. 关闭按钮

或者：新建 src/pages/QAPage.jsx 作为独立页面，支持历史记录（进阶）。

文件 6：src/utils/qaApi.js
封装 POST /api/qa 调用。

===== 数据库准备 =====

posts 表若需要全文检索，可选加：
ALTER TABLE posts ADD FULLTEXT INDEX ft_content (title, content) WITH PARSER ngram;
（MySQL 5.7+ 需要 ngram parser 支持中文）

如果全文检索复杂度太高，Phase 1 用简单 LIKE 也可以：
SELECT * FROM posts WHERE title LIKE ? OR content LIKE ? LIMIT 10

不要引入向量数据库（pgvector、qdrant 等），保持 MySQL 单存储。
未来数据量 >1000 条时再评估向量方案。
```

**验收**：/notes 或任意页面顶部搜索框输入"字节前端一面常问啥" → 弹窗展示综合答案 + 引用 2-3 条面经链接。

---

### M5 — 部署收尾

**目标**：让项目能 `docker compose up` 一键启动，环境变量清晰，README 有完整启动说明。

**Prompt**：

```
本 Milestone 收尾部署配置。

===== 文件 1：.env.example 完善 =====

补齐所有 M2-M4 引入的配置项，每项加中文注释：
- DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
- MCP_URL / COOKIES_PATH
- TESSERACT_PATH
- LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_TIMEOUT
- PROMPT_NO_CACHE（可选）

===== 文件 2：docker-compose.yml =====

现有 compose 文件（如果没有则新建）确保：
- app 服务挂载了 agent/、workflow/、prompts/、server/ 目录（如果是 volume 模式）
- 从 .env 读环境变量并传给容器
- MCP 服务与 app 在同一 network
- 端口映射 5173:3001

===== 文件 3：Dockerfile =====

现有 Dockerfile 确保 COPY 覆盖：
- server/
- agent/（如果 agent 在 server/agent 内则自动覆盖）
- workflow/
- prompts/
- 前端 dist/（先 npm run build 再 COPY）

===== 文件 4：README.md =====

改写为完整使用文档，包含：
1. 项目介绍（2-3 段话说明产品定位）
2. 架构图（Mermaid，展示前端/后端/MCP/LLM/DB）
3. 功能列表（分抓取、整理、学习三部分）
4. 快速开始
   a) 前置：MySQL、xiaohongshu-mcp、Tesseract
   b) 克隆 + npm install
   c) cp .env.example .env 并填 LLM_API_KEY
   d) npm run build
   e) node server/index.js
5. Docker 启动
6. 目录结构说明
7. LLM 切换说明（DeepSeek / OpenAI / 本地 Ollama 配置示例）
8. 常见问题（LLM 不通、MCP 超时、DB 连不上）

===== 文件 5：docs/architecture.md 更新 =====

补充 M2-M4 引入的模块：
- Agent 层（planner、reflector、extractor、classifier、aggregator、interviewer、grader、qa）
- Workflow 层（crawlRunner、smartCrawlRunner、enrichRunner）
- 用户资产（notes、practices 表）
- SSE 通信（客户端消费场景）
- Prompt 目录（prompts/*.md）

Mermaid 图更新为最新架构。

===== 文件 6：/api/agent/health 新增 =====

server/routes/agent.js 新增：
GET /api/agent/health
- 检测 LLM 连通性（发一个最简 "hi" 到 LLM）
- 返回 { success, data: { llm: 'ok'|'error', db: 'ok'|'error', message } }
- 用于监控和部署验证
```

**验收**：
- `docker compose up` 后访问 http://localhost:5173 打开首页
- `curl http://localhost:3001/api/agent/health` 全绿
- README 里的所有步骤能被从未接触项目的人复制粘贴执行成功

---

## 五、已知限制与设计约定

### 强制约定

1. **不引入 LLM SDK**：所有 LLM 调用走 `agent/llm.js`，OpenAI 兼容协议 + 纯 fetch
2. **不引入登录鉴权**：`userId` 是浏览器 uuid，一台设备一份数据。多设备同步是未来问题
3. **Job Store 是内存实现**：进程重启后 Job 状态丢失。生产化需迁移到 Redis 或 MySQL 表
4. **MCP 会话是单例**：`mcpSessionId` 是模块级变量，并发抓取任务会互相干扰。当前通过 `resetSession()` 缓解
5. **Extractor 输入截断到 8000 字**：超长面经会丢失末尾。当前面经很少超过这个长度，未来可分段抽取
6. **Classifier 只支持单 goal**：一条 post 被不同 goal classify 会覆盖 `posts.meta.classification.target_goal`。未来若需多 goal 支持，改为独立 classifications 表

### 已知 Bug 与优先级

| 优先级 | 问题 | 位置 |
|-------|------|------|
| P0 | PostDetail toggleStarred 多余 fetch | `src/components/PostDetail.jsx:154` |
| P1 | smart-jobs 完整链路端到端未验证 | 待部署环境验证 |
| P2 | crawlRunner 老 /jobs 端点不触发 enrich | 设计如此，如需自动 enrich 走 smart-jobs |
| P3 | promptLoader 缓存导致 dev 期改 prompt 需重启 | 用 `PROMPT_NO_CACHE=1` 绕过 |

### 性能与成本

- **LLM 成本**：DeepSeek 每 500 条面经完整跑通 M2-M4 约消耗 300 万 token ≈ ¥15-25
- **MCP 抓取速度**：单条 feed 详情 + OCR 约 10-15 秒，10 条 batch ≈ 2-3 分钟
- **OCR 依赖 Tesseract**：Windows 需要设置 TESSERACT_PATH，Docker 镜像已预装
- **多轮抓取上限**：Reflector maxRounds 硬限制 1-5，防止无限循环

---

## 六、下一次接手时的推荐顺序

1. **先修 P0 bug**（PostDetail 多余 fetch）
2. **跑一次完整 smart-jobs 端到端**：验证 M3 全链路。若 MCP 超时严重，进一步调优 MCP 端超时或 batch 数量
3. **进 M4-3 Aggregator + LearnPage**：这是学习闭环的核心亮点，面试展示价值最高
4. **进 M4-4 Interviewer + Grader**：模拟面试是简历最亮点
5. **进 M4-5 RAG QA**：把项目定位从"面经助手"升级为"AI 面试教练"
6. **最后进 M5 部署收尾**：让项目能被别人一键跑起来

**M4-3 → M4-4 → M4-5 是产品价值递进的顺序，也是面试讲故事的顺序。**

---

## 七、写在最后

本项目当前完成度已经接近生产可用，剩余 Milestone 主要是产品功能扩展，不涉及架构变更。所有的架构决策、模块划分、Prompt 工程模式都已经沉淀在代码里，DeepSeek 接手后可以直接消化现有代码风格续跑。

有疑问时，优先读以下文件：
- `docs/architecture.md`：整体架构（M0-M3 阶段的完整设计文档）
- `docs/workflow.md`：抓取工作流
- `server/agent/*.js`：Agent 内部实现范例
- `server/prompts/*.md`：Prompt 工程范例

**遵循的原则始终不变：新增模块、保持兼容、逐步迁移、Strangler Fig Pattern。**
