# 面试问答准备

**项目：AI 面经助手（基于 MCP + LLM Agent + Workflow）**

本文档为技术面试准备。分类：项目介绍、架构、技术选型、LLM/Agent、工程实践、挑战与解决。

---

## 一、项目介绍

### Q1：介绍下这个项目（30 秒版）

我做了一个 AI Native 的面经助手。核心不是爬虫，而是把面经从"原始文本"变成"结构化学习资产"。

技术栈是 React 19 + Express + MySQL + MCP + DeepSeek。

亮点是**三层 Agent 架构**：抓取 Agent（Planner + Reflector 多轮循环）、整理 Agent（Extractor + Classifier 结构化）、学习 Agent（Aggregator 知识点聚合 + Interviewer/Grader 模拟面试 + RAG QA）。

一句话总结：不是一个 LLM 帮爬虫更聪明，而是**8 个不同角色的 LLM 分工协作**。

### Q2：介绍下这个项目（2 分钟版）

**背景**：秋招准备时我在小红书上翻了大量面经，痛点是内容零散、无法归纳、不能反复练习。

**解决**：我做了个工具，把小红书面经抓下来，用 LLM 结构化成"公司 / 岗位 / 面试题 / 知识点"字段，然后用户可以收藏、聚合知识点、生成模拟题练习、随时问答。

**技术架构**：三层。

第一层是**抓取**：用户输入"字节前端实习" → Planner 用 LLM 生成搜索关键词 → MCP 服务（无头浏览器）真实爬小红书 → OCR 提取图片文字 → Reflector 判断抓够没，没够就换关键词再抓，多轮循环。

第二层是**整理**：Extractor 从原文提取面试题、知识点、公司岗位 → Classifier 判断这条面经和用户目标的相关度打分 → 存进 MySQL 的 posts.meta JSON 列和 posts.relevance 列。

第三层是**学习**（在做）：Aggregator 分析用户收藏的所有面经，输出"这些知识点你要按什么顺序学"；Interviewer 出模拟题，用户答题后 Grader 打分反馈；顶部还有 RAG 问答，问"字节一面常问啥" LLM 会综合多条面经给答案。

**工程亮点**：不用任何 LLM SDK，纯 fetch 实现 OpenAI 兼容协议，一份代码适配 DeepSeek / OpenAI / 本地 Ollama。Prompt 全部外置在 markdown 文件里，方便迭代。前后端通过 SSE 实时推 Agent 的决策日志，用户能看到"AI 现在在想什么"。

### Q3：为什么做这个项目？

三个原因：

1. **真实需求**：秋招我自己就在用小红书翻面经，痛点很真实
2. **技术验证**：想验证"LLM Agent + Workflow"能不能真正落地成产品，而不是 Demo
3. **面试展示**：AI 相关岗位是热点，一个完整的 AI Native 项目比刷 LeetCode 更能证明能力

---

## 二、架构与设计

### Q4：为什么设计成三层 Agent，而不是一个大 Agent？

**关注点分离**。

- 抓取 Agent 只解决"数据从哪来"
- 整理 Agent 只解决"数据长啥样"
- 学习 Agent 只解决"用户怎么用"

三层之间**只通过数据库通信**，不互相调用。这是经典的 Pipeline 架构，好处：

1. **故障隔离**：LLM 挂了不影响抓取，抓取挂了不影响用户查看已入库数据
2. **成本可控**：每层独立限流，比如整理层可以异步慢慢跑，不阻塞抓取
3. **可插拔**：整理层甚至可以完全禁用（LLM 不可用时），系统降级为纯搜索工具

### Q5：为什么用 Strangler Fig Pattern？

项目最初是一个 828 行的单文件 `server/index.js`，所有逻辑堆在一起。我要在上面加 Agent 层，两个选择：

- **推倒重来**：一次性重构，风险高、周期长
- **Strangler Fig**：一步步抽出 service，用新的 Agent 层调用抽出的 service，旧 API 保持可用

我选后者。**每一步都是可回滚的、可验证的**。第一步只抽 validation 30 行代码，验证行为不变；下一步抽 db，再验证；一直到全部抽干净，index.js 从 828 行缩到 38 行入口。

这个过程分了 5 个 Milestone，每步半小时到 1 小时。**任何时候中断都能上线**。

### Q6：为什么加 `services/` 层？

之前所有函数都在 `server/index.js` 模块作用域里，共享 `mcpSessionId`、`dbPool` 这些模块级变量。**这不是"耦合"，是"无边界"**——任何路由都能直接改任何状态。

抽 `services/` 后，每个 service 是独立模块，状态封装在内部，通过导出的函数访问。`routes/` 只做 HTTP 层的事，不碰任何底层状态。

这是经典的**分层**。虽然对小项目"过度设计"，但为了 Agent 层能干净地调用 service（避免 Agent 直接发 HTTP 调自己），必须做。

### Q7：为什么 Job Store 用内存，不落库？

**分阶段落地**。

Job Store 的核心价值是"页面关闭后任务继续"，内存实现已经满足。落库需要设计 schema、迁移 SQL、加索引，在项目早期引入 DB 变更风险偏高。

我做了个约定：**Phase 1 内存，Phase 2 落库，接口不变**。到时候只换 `jobStore.js` 内部实现，路由和调用方零改动。

这是 YAGNI（You Aren't Gonna Need It）原则的应用。

### Q8：Agent 层放在哪里？为什么？

**Express 和 MCP/OCR/DB 之间**，作为"编排 intelligence 层"。

- Agent **不负责**浏览器自动化（MCP 干这个）
- Agent **不负责**像素级 OCR（sharp + Tesseract 干这个）
- Agent **负责**：规划抓取策略、评估结果、结构化抽取、失败决策、任务调度

关键设计：Agent 通过 **Tool 包装**调用现有能力（例如 `crawlKeywords` 内部就是 `callMcp`），不重复造轮子。

---

## 三、技术选型

### Q9：为什么用 DeepSeek 而不是 OpenAI？

三个理由：

1. **成本**：DeepSeek 每百万 token ¥1（缓存命中）/ ¥8，OpenAI GPT-4o-mini 换算后差不多但 DeepSeek 缓存命中率高
2. **中文效果**：面经场景以中文为主，DeepSeek 表达和抽取更贴切
3. **国内可达**：OpenAI 需要代理，DeepSeek 直连
4. **面试加分**：简历写"接入 DeepSeek"，被问"为什么不用 OpenAI"可以答"国产大模型技术栈评估、成本控制、合规性"，是加分回答

**代码层完全不绑定**：用 OpenAI 兼容协议 + 纯 fetch，切换 Provider 只改 `.env` 三行配置。

### Q10：为什么不用 LangChain / OpenAI SDK？

**要展示"我理解协议"，不是"我会调库"**。

不用 SDK 的三个好处：

1. **切模型零成本**：换 Provider 只改 BASE_URL，SDK 绑定时可能需要换整个客户端
2. **依赖轻**：`package.json` 里 zero LLM dependency，构建快
3. **可控**：streaming、retry、timeout 全部自己写，遇到 bug 我知道怎么定位

具体到代码，`agent/llm.js` 只有 80 行，实现了 `chat()` 和 `chatJSON()` 两个函数覆盖全项目所有 LLM 场景。

### Q11：为什么用 SSE 而不是 WebSocket？

**单向推送足够**。

- Job 状态推送是**服务端 → 客户端**单向，不需要双向
- SSE 用原生 `EventSource` API，浏览器自动重连
- SSE 走 HTTP，穿透代理和防火墙比 WS 强
- SSE 服务端实现简单，一个 `res.write("data: {...}\n\n")` 就行

**如果未来需要双向**（比如实时聊天式问答），再上 WebSocket。当前场景过度选择。

### Q12：为什么 React 19 + Context，不用 Redux / Zustand？

**规模不够**。

当前全局状态只有 `posts / filteredPosts / dashboardStats`，用 `useReducer + Context` 处理够了。引入 Redux 会带来 boilerplate（action / reducer / selector），性价比低。

**如果状态变复杂**（比如加了实时协作、多用户），会考虑 Zustand（轻量、无 Provider 嵌套问题）。

### Q13：为什么前端做 Web Worker 搜索？

原始 posts 数组可能上千条，主线程做倒排索引 + 模糊搜索会阻塞 UI。

Web Worker 在独立线程做：
- 分词
- 倒排索引构建
- 关键词匹配

主线程只负责传输入和渲染结果。这是**性能优化**的经典模式。

---

## 四、LLM / Agent 深度问题

### Q14：Planner 是怎么工作的？

用户输入 goal（如"字节跳动前端实习"），Planner 要输出 5-10 个适合小红书搜索的关键词。

**关键设计**：

1. **不让 LLM 自己解析 goal**：先用启发式（公司/岗位映射表）从 goal 中提取 company、role、stage 三个字段
2. **把提取结果显式传给 LLM**：Prompt 里明确"公司是 X，岗位是 Y，请围绕这两个词展开"
3. **输出后做命中率校验**：如果 company 非空，keywords 中至少 60% 必须包含 company；不满足就走 fallback

这样解决了两个问题：
- LLM 有时候会忽略 goal 里的关键信息，自由发挥
- LLM 有时候会生成"字节跳动前端实习面经"这种长拼接词，不是小红书用户真实搜索词

**Prompt 里加了 few-shot 和硬约束（3 词以内、有空格、≤15 字符）**。

### Q15：Reflector 怎么判断"抓够了"？

Reflector 是多轮抓取的决策器。每轮抓完后，把这一轮结果传给 Reflector，输出 decision: continue | stop。

**输入**：
- 用户 goal
- 已尝试过的关键词
- 本轮抓到的面经摘要（title + content 前 200 字 + likes/collects）
- 当前轮次 / 最大轮次

**判断维度**（Prompt 里明确）：
- 数量：至少 10 条相关面经
- 相关度：内容和 goal 匹配度
- 多样性：覆盖不同公司/轮次

**硬规则**（代码里强制，不信任 LLM）：
- round >= maxRounds → 直接 stop
- collected.length >= 20 → 直接 stop（够多了）
- LLM 不可用 → 直接 stop（防止无限循环）

**为什么加硬规则？** LLM 有时候会 hallucinate 说"应该继续"但其实数据够了。硬规则是**安全边界**。

### Q16：Extractor 抽取什么字段？

面经原文（含正文和 OCR 图片文本）→ 结构化 JSON：

```
{
  company: "字节",           // 公司简称
  role: "前端",              // 岗位
  stage: "实习",             // 实习 | 校招 | 社招 | 未知
  rounds: ["一面", "技术面"], // 涉及轮次
  questions: [
    { question: "手写 Promise.all", topic: "JS 基础", difficulty: "medium" }
  ],
  topics: ["React", "JS 基础", "浏览器"], // 全文知识点
  summary: "...",            // AI 摘要
  quality_score: 0.7         // 内容完整度
}
```

**为什么这么设计？** 每个字段服务下游具体功能：

- `company/role/stage` → Classifier 打分依据
- `questions[]` → Interviewer 出题参考
- `topics[]` → Aggregator 频次统计
- `summary` → PostDetail 展示
- `quality_score` → 排序/筛选

**输入截断到 8000 字符**：省 token，且面经很少超过这个长度。

### Q17：Classifier 怎么打相关度分？

综合 4 个维度，加权平均：

- `company_match × 0.35`：公司匹配（1.0 完全匹配，0.5 大厂类似，0.0 完全不同）
- `role_match × 0.35`：岗位匹配
- `stage_match × 0.15`：阶段匹配
- `content_useful × 0.15`：内容对目标的参考价值

**为什么公司和岗位权重高？** 秋招场景下，"腾讯后端面经"对"字节前端"参考价值有限，即使内容质量高。

**优先信任 Extractor 的 meta**：如果 meta.company 已有值，Classifier 直接用；没有再从 content 自己判断。**节省 token + 结果一致性**。

### Q18：Prompt 为什么外置在 markdown 文件？

三个原因：

1. **不改代码就能改 Prompt**：产品经理都能编辑
2. **可以 diff、可以 code review、可以 A/B**：Prompt 是核心资产，需要版本控制
3. **可以做变量替换**：`{{goal}}`、`{{company}}` 等占位符，`promptLoader.js` 加载时替换

`promptLoader.js` 有内存缓存，开发时用 `PROMPT_NO_CACHE=1` 环境变量绕过。

### Q19：Agent 里的 Fallback 策略是怎样的？

**核心原则：LLM 不可用时系统不能瘫痪**。

每个 Agent 都有 fallback：

- **Planner**：从 goal 用启发式提取 company/role/stage，生成默认关键词组
- **Reflector**：直接返回 stop（保守策略，防止无限循环）
- **Extractor**：返回空 meta 结构，`extractError` 字段记录原因
- **Classifier**：返回中位分 0.5，`source: 'fallback'` 标记
- **Aggregator**：用简单 topic 频次统计
- **Interviewer**：从 practices 表随机拿历史题

**Fallback 不是"降级"，是"保底"**。用户永远能得到响应，只是质量下降。

### Q20：怎么处理 LLM 输出不稳定的问题？

四个层次：

1. **response_format: json_object**：强制 JSON 输出
2. **try/catch JSON.parse**：解析失败返回 null，不 throw
3. **字段级校验**：解析成功后校验每个字段类型、长度、枚举值，非法值兜底
4. **强制业务规则**：例如 Planner 的"命中率校验"、Reflector 的"maxRounds 硬限制"

**关键理念**：不信任 LLM 的输出，永远做兜底和校验。

### Q21：LLM 的 temperature 怎么选？

分场景：

- **Planner (0.5)**：关键词生成需要一点创造性，避免总是同样的组合
- **Reflector (0.2)**：判断类任务需要稳定
- **Extractor (0.15)**：抽取任务需要稳定，同样内容多次抽取结果要一致
- **Classifier (0.1)**：打分任务需要稳定，temperature 越低越好
- **Interviewer (0.7)**：出题需要多样性，避免总是同一道题
- **Grader (0.2)**：评分需要客观

**理由**：创造性任务高 temperature，判断性任务低 temperature。

---

## 五、工程实践

### Q22：怎么保证 Agent 幂等？

**Enrich 场景**：已经 extract 过的 post 默认跳过。

判断逻辑：
```
如果 post.meta 存在，且 meta.company/role/questions 中至少一项非空，
且没有 extractError → 跳过 extract 步骤
```

Classify 相对便宜且 goal 可能变，每次都重跑。

### Q23：怎么控制 LLM 成本？

四个手段：

1. **内容截断**：Extractor 输入截到 8000 字符，Reflector 面经摘要只传 200 字
2. **数量限制**：Reflector 最多传 20 条摘要，Aggregator 最多 30 条
3. **优先级排序**：按 likes 或 relevance 降序，只保留 Top N
4. **Prompt 缓存**：`promptLoader` 内存缓存，DeepSeek 缓存命中降低成本

**预估**：一个用户完整跑通 M2-M4 一次约 500 条面经，消耗 300 万 token ≈ ¥15-25。

### Q24：SSE 连接怎么保活？

Express 里每 15 秒 write 一个注释行：

```
res.write(': keep-alive\n\n')
```

**为什么？** 中间代理（如 nginx）可能因为长时间无数据关掉连接。SSE 规范里以 `:` 开头的行是注释，被客户端忽略但保持连接活跃。

**清理逻辑**：客户端断开时 `req.on('close')` 触发，清理 keep-alive 定时器和 EventEmitter 监听。

### Q25：MCP 会话怎么管理？

MCP 是外部无头浏览器服务，会话过期或崩溃会导致所有后续请求失败。

**策略**：

1. **首次调用时 initialize**：`ensureMcpInit()` 幂等，多次调用只初始化一次
2. **失败自动重试**：`callMcp` catch 里 `resetSession()` + 重试 1 次
3. **搜索前强制 reset**：每次 `search_feeds` 和 `batch` 前主动 `resetSession()`，避免旧会话超时
4. **分工具超时**：`initialize` 20s、`search_feeds` 45s、`get_feed_detail` 60s

**已知局限**：MCP 会话是模块级单例，多个抓取 Job 并发时会互相干扰。**当前用串行执行规避**。

### Q26：OCR 怎么处理？

**流程**：

1. 下载图片到临时文件（带 UA + Referer 避免反爬）
2. `sharp` 预处理：灰度 + 归一化 + 放大到 2000px + 锐化
3. Tesseract 识别（PSM 6 块文本模式，`chi_sim+eng` 中英混合）
4. 质量检测：中文字符 ≥ 2 且乱码占比 < 50%
5. 不合格时回退 PSM 3（全自动分割）
6. 后处理：去乱码行、合并多空行

**性能**：单张图 3-5 秒，每条 feed 最多处理 3 张。

**限制**：需要系统安装 Tesseract 二进制，Docker 镜像预装。

### Q27：怎么防止小红书反爬？

**三个策略**：

1. **限流**：每条 feed 详情之间 sleep 2 秒
2. **Cookie 持久化**：xiaohongshu-mcp 保存登录 Cookie 到 `docker-data/cookies.json`
3. **会话隔离**：每次搜索前 `resetSession()`，模拟"新用户"

**局限**：如果小红书升级反爬（如 IP 限制、Cloudflare 挑战），当前方案会失效。真正生产化需要代理池 + 更复杂的浏览器指纹。

### Q28：数据库 schema 迁移怎么做？

**启动时自动迁移**：

- `initDB` 里对 posts 表尝试 `ADD COLUMN meta` / `ADD COLUMN relevance`
- 用 try/catch 包裹，捕获 duplicate column 错误当作成功
- `SHOW COLUMNS` 检查后再决定要不要 ALTER（兼容 MySQL 5.7）
- 失败只 warn 不 throw，防止启动阻塞

**局限**：没有真正的 migration 工具（如 Prisma Migrate、Flyway），复杂 schema 演进会痛。

**为什么不用 Prisma？** 当前 schema 简单（posts + notes + practices 三表），引入 ORM 是过度设计。**未来 schema 变复杂时再评估**。

---

## 六、挑战与解决

### Q29：项目遇到最难的问题是什么？

**LLM 输出不稳定，尤其是复杂中文 instruction following**。

比如 Planner 一开始经常生成"字节跳动前端实习面经"这种长拼接词，虽然 Prompt 里写了"3 词以内、有空格、≤15 字"，DeepSeek 依然会漂。

**解决路径**（三次迭代）：

1. **v1**：改 Prompt，加硬约束和 few-shot → 部分改善，但依然会漂
2. **v2**：在代码层加输出校验，长关键词强制走 fallback → 稳定了，但 fallback 触发率太高
3. **v3**：改进 Prompt 结构——不让 LLM 自己解析 goal，而是先用启发式提取 company/role/stage，然后把这些**显式**传给 LLM。同时加"命中率校验"（company 非空时至少 60% 关键词必须包含 company）

**教训**：**Prompt 工程不是万能的，代码层必须做兜底和校验**。

### Q30：怎么定位"HTTP 200 却报错"的诡异问题？

一次前端报错 "HTTP 200"，看起来矛盾。

**排查过程**：

1. 直接 curl 后端 API → 发现返回的是 HTML（`Content-Type: text/html`）
2. 定位到根因：后端进程没重启，`/api/notes` 路由没生效，请求被 SPA fallback 拦截返回了 `dist/index.html`
3. 前端 `res.json()` 解析 HTML 失败，抛出 `HTTP ${res.status}` = "HTTP 200"

**教训**：

- 前端错误信息要**准确**：不是"HTTP 200"，是"Expected JSON, got HTML"
- 后端 SPA fallback 应该**只处理 GET 非 /api/* 路径**，防止误伤
- 排查从"直接 curl 验证 API"开始，隔离前端变量

### Q31：怎么处理 MCP 抓取超时？

**问题**：Planner 有时生成"字节跳动前端实习面经"这种长关键词，MCP 内部无头浏览器搜索小红书这种词返回极慢或超时，整个 Job 卡 2 分钟。

**修复分三层**：

1. **源头**：修 Planner Prompt，限制关键词长度和词数
2. **超时**：MCP 请求超时从 120s 缩到 45s（`search_feeds`），失败快速跳过
3. **降级**：单条 feed 失败不阻塞整个 Job，Reflector 会看到"这个关键词失败了"，下一轮换关键词

**教训**：**先修源头，超时兜底，最后降级**。不要一上来就调大超时。

### Q32：怎么保证 fallback 关键词质量？

之前的 fallback 就是简单拼接：`goal + " 面经"`、`goal + " 一面"` 等。goal 是"字节跳动前端实习"时会生成"字节跳动前端实习 面经"，长得离谱。

**改进后的 fallback**：

1. 内置公司简称映射表（字节跳动 → 字节，阿里巴巴 → 阿里）
2. 内置岗位简称映射表（前端开发 → 前端）
3. 从 goal 提取 tokens
4. 按规则组合：`[公司 岗位]`、`[公司 面经]`、`[岗位 面经]` 等，每个 ≤ 3 词、≤ 15 字符

**教训**：**Fallback 也是产品**，不能敷衍。

### Q33：项目最有挑战的架构决策是什么？

**决定 Enrich 是同步还是异步**。

选择 A：抓取完立即同步 enrich，用户等一会但一次拿到完整结构化数据

选择 B：抓取立即返回，enrich 后台异步跑，用户先看到原始数据，稍后自动刷新看到结构化

**我选 B**，理由：

1. 用户体验：抓取本身已经 30-60 秒，同步 enrich 再加 30 秒，用户会感觉"卡死了"
2. 失败隔离：LLM 挂了不影响抓取结果，用户至少能看到原始数据
3. 资源利用：enrich 可以在低峰期跑（未来加定时任务）

**代价**：需要独立的 Job 追踪 enrich 进度，前端需要处理"数据先出现，稍后自动结构化"的 UI 状态。

### Q34：怎么防止无限循环？

**Reflector 多轮循环有三层防护**：

1. **maxRounds 硬限制**：默认 3，用户传入的值 clamp 到 [1, 5]
2. **collected 数量硬限制**：达到 20 条直接停
3. **LLM 不可用时默认 stop**：不给 LLM 决定"继续"的权力

**教训**：**任何允许 LLM 参与决策的循环，必须在代码层有硬边界**。

---

## 七、亮点与改进

### Q35：项目最大的技术亮点是什么？

**三层 Agent 架构 + Prompt 工程沉淀**。

具体来说：

1. **8 个 LLM 角色分工**：Planner / Reflector / Extractor / Classifier / Aggregator / Interviewer / Grader / QA，每个职责清晰、Prompt 独立、可单独调优
2. **纯 fetch 实现 OpenAI 兼容协议**：一份代码适配 DeepSeek / OpenAI / 本地 Ollama，切换成本零
3. **多层 Fallback + 硬约束**：LLM 挂了系统不瘫痪，输出漂了自动兜底
4. **Prompt 外置 + 变量替换**：Prompt 是核心资产，独立版本控制

### Q36：项目最大的产品亮点是什么？

**从"搜索"升级到"学习闭环"**。

传统面经工具只做搜索：输入关键词 → 返回列表。用户看完就走。

我这个项目：
- 抓取 → 结构化 → 相关度打分 → 收藏 → 知识点聚合 → 学习路径推荐 → 模拟面试 → 智能问答

**用户产生学习资产（笔记、收藏、练习记录），越用价值越大**。

### Q37：如果继续做，会怎么改进？

**产品方向**：

1. **RAG 升级**：MySQL 全文检索改为向量数据库（pgvector / sqlite-vec），语义检索比关键词检索更准
2. **多用户支持**：加登录（OAuth 或简单 email），支持数据同步
3. **主动推送**：新面经自动匹配用户目标，每天推送 5 条最相关的
4. **移动端**：React Native 或 PWA，随时刷面经

**技术方向**：

1. **Job Store 落库**：迁移到 Redis 或 MySQL，支持重启后恢复
2. **MCP 会话池**：支持并发抓取
3. **成本监控**：LLM 调用埋点，追踪每个用户每天消耗
4. **A/B 测试**：不同 Prompt 版本并行运行，用效果指标选优
5. **Prompt 版本管理**：类似 LangSmith / Weights & Biases，Prompt 迭代有版本记录

### Q38：项目局限是什么？

**诚实的回答**：

1. **依赖外部 MCP 服务**：xiaohongshu-mcp 挂了整个抓取瘫痪
2. **反爬能力弱**：单 IP、无代理池、Cookie 简单持久化
3. **多用户并发未验证**：Job Store 内存、MCP 会话单例，压力测试没做
4. **Prompt 稳定性**：LLM 输出偶尔漂移，兜底虽然有但用户可能感知
5. **没有 A/B 测试机制**：Prompt 效果好坏靠人工判断
6. **前端组件复用度低**：NoteCard 和 PostCard 有重复代码

### Q39：为什么用户体验设计成这样？

**分步式展示**：

用户体验分三层：

1. **抓取阶段**：SSE 实时推 Agent 决策日志，让用户看到"AI 现在在生成计划、AI 现在在第 1 轮抓取、AI 现在在反思"，形成 AI 的"透明感"
2. **浏览阶段**：PostDetail 三个 Tab（内容 / 笔记 / 结构化），用户可以自己深入或浅出
3. **学习阶段**：LearnPage 一屏看清"知识点排行 + 学习路径 + 薄弱方向"，MockPage 一题一评分

**核心理念**：**用户不是被动接收 AI 结果，而是能感知 AI 的思考过程**。这是 AI Native 产品和传统产品的核心区别。

---

## 八、一句话回答库（面试速查）

| 问题 | 回答 |
|------|------|
| 项目定位？| AI Native 面经助手，把面经从原始文本变成结构化学习资产 |
| 技术栈？| React 19 + Express + MySQL + MCP + DeepSeek，纯 fetch 无 SDK |
| 架构？| 三层 Agent：抓取（Planner+Reflector）、整理（Extractor+Classifier）、学习（Aggregator+Interviewer+Grader+QA） |
| 为什么 DeepSeek？| 便宜、中文强、国内直连、面试加分 |
| 为什么不用 SDK？| 切模型零成本、依赖轻、面试可讲协议实现 |
| 为什么 SSE？| 单向推送足够，浏览器原生 EventSource，穿透代理 |
| 最难的问题？| LLM 输出不稳定，通过 Prompt 工程 + 代码兜底 + 硬约束三层解决 |
| 最大亮点？| 8 个 LLM 角色分工 + Prompt 外置 + 多层 Fallback |
| 局限？| MCP 依赖强、反爬弱、多用户未压测 |
| 下一步？| RAG 升级向量检索 + Job Store 落库 + 多用户支持 |

---

## 九、面试常见追问

### Q40：Agent 和 Workflow 有什么区别？

**Agent 是决策者**：接收上下文，用 LLM 输出下一步动作
**Workflow 是执行流水线**：把多个 Agent + 服务串起来，管理状态、错误、重试

在本项目：
- `agent/planner.js` 是 Agent
- `workflow/smartCrawlRunner.js` 是 Workflow

Workflow 负责编排（"先调 Planner，再调 crawlKeywords，再调 Reflector"），Agent 负责决策（"关键词是什么"、"要不要继续"）。

### Q41：怎么保证 Agent 不"跑偏"？

**三层防护**：

1. **Prompt 硬约束**：输出格式、字段范围、业务规则都在 Prompt 里
2. **输出校验**：LLM 返回后代码层再验一遍
3. **业务硬规则**：不允许 LLM 决定的边界（如 maxRounds、maxCollected）代码层强制执行

**核心理念**：LLM 是决策助手，不是决策者。**最终决策权在代码**。

### Q42：如果 Prompt 效果不好怎么调？

**迭代方法论**：

1. **明确失败案例**：找 3-5 个"应该输出 A 但输出了 B"的具体案例
2. **分析原因**：LLM 忽略了什么信息？误解了什么？
3. **改 Prompt**：加约束、加 few-shot、改结构
4. **验证**：跑同样的 case 看是否修复
5. **回归**：跑其他 case 看是否引入新问题

**不要**：一次改多个东西，无法定位是哪个改动生效。

### Q43：为什么 promptLoader 有缓存？

Prompt 从磁盘读，每次调用重复读浪费 IO。缓存后：

- 首次读盘 + 存 Map
- 后续从 Map 直接拿

**开发时禁用缓存**：`PROMPT_NO_CACHE=1` 环境变量。改了 prompt 立即生效不用重启。

### Q44：为什么变量替换用 `{{var}}` 而不是模板字符串？

Prompt 是纯文本文件，不是 JS 代码。用 `${var}` 需要 eval 或 template literal，安全和性能都不好。

`{{var}}` 是 Mustache/Handlebars 惯例，简单正则替换，安全无副作用。

**未提供的变量**：保留原样 + 打 warn，不报错。方便调试。

### Q45：为什么 Prompt 是 markdown 不是 JSON/YAML？

**可读性优先**。

Prompt 本质是给 LLM 看的自然语言，markdown 最接近自然写作。用 JSON/YAML 会让内容变成"字符串数组"，编辑体验差。

**tradeoff**：markdown 没法结构化解析。但 Prompt 本来就不需要结构化，只需要变量替换。

### Q46：怎么做 Prompt A/B 测试？

**当前没做**（诚实回答）。

**未来会怎么做**：

1. Prompt 加版本号（planner-v1.md、planner-v2.md）
2. 环境变量或数据库控制哪个 goal 走哪个版本
3. 记录每次调用的 version + 输出 + 用户后续行为（是否修改关键词、是否收藏结果）
4. 汇总统计每个版本的"有效率"

参考 LangSmith / PromptLayer 的做法。

---

## 十、行为面 / 项目故事

### Q47：为什么一个人做这个项目？

**主要动机**：秋招准备时觉得市面上没有一个"真正 AI Native"的面经工具，都是搜索引擎+堆列表。想自己做一个，同时验证"LLM Agent 能不能落地"。

**项目周期**：大约 3 周，业余时间。

**决策模式**：所有架构决策我自己做，Codex/Claude 只写代码。Prompt 工程和 Agent 边界完全我定。

### Q48：项目最有成就感的时刻？

**Reflector 第一次正确决定"停"**。

之前 Reflector 一直漂：数据够了它说继续，数据不够它说停。改了三版 Prompt 后终于稳定。看到 Job steps 里"第 2 轮：反思结果：stop - 已抓到 15 条相关面经，覆盖字节前端主流问题" 那一瞬间，感觉 Agent 真的"懂"了。

### Q49：项目遇到最想放弃的时刻？

**MCP 反复超时那几天**。

一个 Job 提交下去，10 秒后卡住，1 分钟、2 分钟、5 分钟...最后 timeout。以为是自己代码问题，各种加日志、改超时、重启服务。后来定位到是 Planner 生成了"字节跳动前端实习面经"这种畸形关键词，MCP 里的浏览器加载小红书这种词永远返回不了。

**教训**：**问题发生在链路末端，但根因可能在链路源头**。

### Q50：如果重做一遍，你会怎么做？

**架构上**：

1. **先设计好 Agent 边界再动手**：我最初只想着"加 LLM"，中途反复调整 Agent 划分（8 个角色不是一开始就定的）
2. **Prompt 工程先行**：Prompt 应该在写代码前就大致成型，跑一批测试 case 验证效果，然后再写业务逻辑

**工程上**：

3. **TypeScript**：项目现在是 JS，重构成 TS 收益会很大（类型安全、IDE 智能提示）
4. **测试**：现在没写任何单元测试，工程规范上是失分项
5. **CI/CD**：GitHub Actions 加个 lint + build 检查

**产品上**：

6. **用户系统早点做**：现在 userId 是浏览器 uuid，多设备切换体验差
7. **数据质量监控**：LLM 输出偶尔漂，需要仪表盘看每天有多少 fallback 触发

---

**Good luck 面试！这个项目本身是很有说服力的作品，讲的时候记得强调"我做的是决策者，不是代码搬运工"。**
