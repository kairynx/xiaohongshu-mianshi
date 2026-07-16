# 项目七维度深挖

面向面试。每条项目工作按七维度展开：使用场景 → 底层原理 → 实现细节 → 竞对方案 → 延伸八股 → 自己实现 → 优化空间。

---

## 项目一：小红书面经助手

---

### 1.1 MCP 协议集成（JSON-RPC 2.0 over HTTP/SSE）

#### 1️⃣ 使用场景和目的

小红书没有公开 API，直接爬网页会被反爬拦。第三方 `xiaohongshu-mcp` 服务把无头浏览器包成 MCP 协议服务，我用 JSON-RPC 2.0 调它的 `search_feeds` / `get_feed_detail` 工具。

**目的**：把"我的应用"和"爬取实现"解耦。爬取逻辑复杂又易变（反爬对抗），把它抽成外部服务后我的应用只关心业务。

#### 2️⃣ 底层实现（原理）

MCP（Model Context Protocol）是 Anthropic 定的一个协议规范，让 LLM/工具可以标准化调用外部能力。

传输层用 **JSON-RPC 2.0**：请求体固定结构

```json
{ "jsonrpc": "2.0", "method": "tools/call", "params": {...}, "id": 1 }
```

响应体：

```json
{ "jsonrpc": "2.0", "result": {...}, "id": 1 }
```

**会话机制**：首次请求响应头返回 `Mcp-Session-Id`，后续请求带上这个 header，服务端识别同一会话。

**响应格式**：Content-Type 可能是 `application/json` 或 `text/event-stream`（SSE）。SSE 格式：

```
data: {"jsonrpc":"2.0","result":...}\n\n
```

#### 3️⃣ 使用方式和实现细节（含错误兜底）

```js
async function callMcp(name, args, timeoutMs) {
  await ensureMcpInit();  // 幂等初始化会话
  try {
    return await mcpRequest('tools/call', { name, arguments: args }, timeoutMs);
  } catch (e) {
    // 失败自动重试 1 次，重置会话
    resetSession();
    await ensureMcpInit();
    return await mcpRequest('tools/call', { name, arguments: args }, timeoutMs);
  }
}
```

**错误兜底**：
- 会话过期 → `resetSession()` + 重试
- 超时 → `AbortController.abort()`，分工具设置不同超时（search 45s、detail 60s）
- SSE 解析失败 → 抛 `Empty SSE response`
- 单条 feed 失败 → 跳过继续，不阻塞整个 Job

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **MCP 协议**（选） | 标准化、可复用、多工具统一接口 | 需要外部 MCP 服务 |
| 直接调 REST API | 简单直接 | 各服务接口不同，需要写 N 个适配器 |
| GraphQL | 灵活查询 | 学习成本高，小红书不提供 |
| gRPC | 高性能二进制 | 浏览器不友好，需要 gRPC-Web |

#### 5️⃣ 延伸八股

- **JSON-RPC vs REST**：JSON-RPC 是 RPC 风格（面向方法调用），REST 面向资源
- **RPC 常见框架**：gRPC、Thrift、Dubbo、tRPC
- **SSE 原理**：见"1.2 SSE 通信"
- **HTTP 长连接**：Connection: keep-alive

#### 6️⃣ 不用库自己实现

MCP Client 就是纯 fetch，本项目就没用任何 SDK。核心就 3 段：

```js
// 1. 发请求
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Mcp-Session-Id': sid },
  body: JSON.stringify({ jsonrpc: '2.0', method, params, id: ++counter }),
});

// 2. 读 Session-Id
sid = res.headers.get('mcp-session-id');

// 3. 解析响应（JSON 或 SSE）
if (contentType.includes('event-stream')) {
  // 逐行找 data:
} else {
  return (await res.json()).result;
}
```

#### 7️⃣ 优化空间

- **并发**：当前 MCP 会话是模块级单例，多个抓取 Job 会互相干扰。可以做 session pool 支持并发
- **重试策略**：现在只重试 1 次，可以做指数退避（1s、2s、4s）
- **熔断**：连续失败 N 次触发熔断，一段时间内直接 fallback，避免拖垮 MCP 服务

---

### 1.2 SSE 通信（Server-Sent Events）

#### 1️⃣ 使用场景和目的

抓取 Job 是长任务（30-120 秒），需要**服务端实时推送进度**给前端。

**目的**：让用户看到"AI 现在在生成计划 → 开始第 1 轮抓取 → 反思结果：继续"，形成 AI 的透明感。

#### 2️⃣ 底层实现（原理）

SSE 是 HTML5 标准，基于 HTTP 长连接的**服务端单向推送**：

- 客户端：`new EventSource(url)`
- 服务端：设置 `Content-Type: text/event-stream`，用 `res.write` 持续发数据
- 数据格式固定：`data: <content>\n\n`（两个换行是消息边界）
- 浏览器自动重连（默认 3 秒），可通过 `retry:` 字段控制

#### 3️⃣ 使用方式和实现细节

**服务端（Express）**：

```js
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders();

// 每 15s 发保活注释，防止代理超时断连
const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 15000);

const onUpdate = (jobId) => {
  const job = getJob(jobId);
  res.write(`data: ${JSON.stringify({ type: 'update', job })}\n\n`);
  if (job.status === 'done') {
    clearInterval(keepAlive);
    res.end();
  }
};

emitter.on('update', onUpdate);
req.on('close', () => {
  clearInterval(keepAlive);
  emitter.off('update', onUpdate);
});
```

**前端**：

```js
const es = new EventSource('/api/agent/jobs/xxx/events');
es.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  // 更新 UI
};
es.onerror = () => { /* 重连或关闭 */ };
```

**错误兜底**：
- 客户端断开 → `req.on('close')` 清理 EventEmitter 监听
- 中间代理超时 → 15s keep-alive 保活
- 服务端崩溃 → 浏览器自动重连

#### 4️⃣ 竞对方案对比

| 方案 | 方向 | 协议 | 适用 |
|------|------|------|------|
| **SSE**（选） | 单向 S→C | HTTP | 服务端推送日志/进度 |
| WebSocket | 双向 | ws:// | 聊天、实时游戏 |
| 长轮询 | 客户端主动 | HTTP | 兼容性最好但低效 |
| 短轮询 | 客户端定时 | HTTP | 最简单但延迟高 |

#### 5️⃣ 延伸八股

- **HTTP 长连接（keep-alive）**：TCP 连接复用
- **HTTP/2 多路复用**：一个 TCP 连接跑多个流
- **EventEmitter 模式**（Node）：观察者/发布订阅
- **心跳机制**：为什么要 15s 保活（Nginx 默认 60s 断连、CDN 30s）

#### 6️⃣ 不用库自己实现

SSE 客户端手写：

```js
class SimpleSSE {
  constructor(url) {
    this.url = url;
    this.controller = new AbortController();
    this.handlers = {};
    this.connect();
  }
  async connect() {
    const res = await fetch(this.url, { signal: this.controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      // 按 \n\n 切分事件
      const events = buffer.split('\n\n');
      buffer = events.pop();
      for (const event of events) {
        const dataLine = event.split('\n').find(l => l.startsWith('data:'));
        if (dataLine) {
          const data = dataLine.slice(5).trim();
          this.handlers.onmessage?.({ data });
        }
      }
    }
  }
  close() { this.controller.abort(); }
}
```

#### 7️⃣ 优化空间

- **消息重放**：加 `id:` 字段，断线重连后从 `Last-Event-ID` 续传
- **压缩**：SSE 内容可 gzip
- **多路复用**：HTTP/2 下多个 SSE 共享一个 TCP 连接
- **前端 backpressure**：消息太快时前端做节流渲染

---

### 1.3 OCR 图像识别流水线（sharp + Tesseract）

#### 1️⃣ 使用场景和目的

小红书面经很多是**截图**，纯图片没文字。需要从图片里提取文字才能被后续 LLM 分析。

**目的**：让"图片面经"也能进入结构化处理链路，不流失数据。

#### 2️⃣ 底层实现（原理）

**Tesseract** 是 Google 开源的 OCR 引擎，原理是 LSTM 神经网络识别字符。中文识别用 `chi_sim` 训练数据包。

**PSM 参数**（Page Segmentation Mode）决定分割策略：
- PSM 3：全自动分割（默认）
- PSM 6：假设整张图是一块统一的文本（适合截图）

**sharp** 是 Node 端图片处理库，基于 libvips（C 库），比 canvas 快 5-10 倍。

#### 3️⃣ 使用方式和实现细节

**流水线**：

```
下载图片 → sharp 预处理 → Tesseract 识别 → 后处理清洗
```

**预处理提升 OCR 准确率**：

```js
await sharp(inputPath)
  .grayscale()              // 灰度化，去干扰
  .normalize()              // 归一化对比度
  .resize(2000, null)       // 放大到 2000px，字体大 OCR 准
  .sharpen({ sigma: 1.5 })  // 锐化边缘
  .png()
  .toFile(outputPath);
```

**OCR 调用**（execFile 调系统 tesseract 二进制）：

```js
execFile('tesseract', [imagePath, 'stdout',
  '-l', 'chi_sim+eng',     // 中英混合
  '--psm', '6',            // 块文本模式
  '--oem', '1',            // LSTM 模式
], { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, callback);
```

**质量检测**：中文字符 ≥ 2 且乱码占比 < 50%，不合格 → 回退 PSM 3 再试一次。

**错误兜底**：
- tesseract 未安装：捕获 ENOENT 错误，返回空字符串
- 单张图失败：跳过，处理下一张
- 一条 feed 最多处理 3 张图，防止耗时爆炸

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Tesseract 本地**（选） | 免费、离线、可控 | 中文准确率一般 |
| 百度/阿里 OCR API | 准确率高、无需部署 | 收费、有配额、需网络 |
| PaddleOCR | 中文准 | 依赖 Python，Node 集成麻烦 |
| GPT-4V / Claude Vision | 语义理解强 | 贵，每张 $0.01+ |

#### 5️⃣ 延伸八股

- **图像处理基础**：灰度、二值化、直方图均衡化、锐化
- **libvips vs ImageMagick**：libvips 内存少、快
- **Node.js child_process**：execFile / spawn / exec 区别
- **神经网络 OCR**：CRNN、Attention-OCR
- **Buffer / Stream**：图片下载和处理都用 Buffer

#### 6️⃣ 不用库自己实现

自己实现 OCR 几乎不可能（需要机器学习模型），但可以：
- 用 canvas 手写预处理（灰度化就是 R*0.3 + G*0.59 + B*0.11）
- 用 tesseract.js（WebAssembly 版）在浏览器端跑，无系统依赖

```js
// 灰度化手写
function toGrayscale(imageData) {
  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray = imageData.data[i] * 0.3
                + imageData.data[i+1] * 0.59
                + imageData.data[i+2] * 0.11;
    imageData.data[i] = imageData.data[i+1] = imageData.data[i+2] = gray;
  }
}
```

#### 7️⃣ 优化空间

- **并发 OCR**：3 张图串行改为并行（当前每张要 3-5 秒）
- **缓存**：同一张图 URL 已 OCR 过就不重复
- **VLM 混合**：低质量 OCR 结果回退用 GPT-4V/Claude 兜底
- **图片压缩传输**：先前端压缩再上传
- **提前分类**：文本密度高的图才做 OCR，纯装饰图跳过

---

### 1.4 Web Worker + 倒排索引搜索

#### 1️⃣ 使用场景和目的

面经列表可能 1000+ 条，用户搜索"React"要毫秒级返回。主线程做搜索会阻塞 UI 卡顿。

**目的**：搜索计算放到独立线程，主线程只管渲染。

#### 2️⃣ 底层实现（原理）

**Web Worker** 是浏览器提供的多线程 API。主线程和 Worker 之间通过 `postMessage` 通信，数据是**结构化克隆**（不是共享内存，是拷贝）。

**倒排索引**（Inverted Index）：从"文档 → 关键词"反过来变成"关键词 → 文档列表"。

正排：
```
doc1: [react, hook, vue]
doc2: [vue, react]
```

倒排：
```
react: [doc1, doc2]
hook: [doc1]
vue: [doc1, doc2]
```

搜索"react"直接查倒排 O(1) 找到 [doc1, doc2]，比遍历所有文档快。

#### 3️⃣ 使用方式和实现细节

**主线程**（`hooks/useWorkerSearch.js`）：

```js
const worker = new Worker(new URL('../workers/searchWorker.js', import.meta.url));
worker.postMessage({ type: 'index', posts });     // 传数据建索引
worker.postMessage({ type: 'search', query });    // 查询
worker.onmessage = (e) => setResults(e.data);
```

**Worker 内**：

```js
let index = new Map();  // term → Set<postId>

function build(posts) {
  for (const post of posts) {
    const tokens = tokenize(post.title + post.content);
    for (const token of tokens) {
      if (!index.has(token)) index.set(token, new Set());
      index.get(token).add(post.id);
    }
  }
}

function search(query) {
  const tokens = tokenize(query);
  // 多个关键词取交集
  return tokens.map(t => index.get(t) || new Set())
    .reduce((a, b) => new Set([...a].filter(x => b.has(x))));
}
```

**分词**：中文简易 bigram（连续两字为一 token）：

```js
function tokenize(text) {
  const clean = text.toLowerCase().replace(/[^\w一-鿿]+/g, ' ');
  const tokens = [];
  // 英文按空格
  for (const word of clean.split(/\s+/)) tokens.push(word);
  // 中文 bigram
  for (let i = 0; i < clean.length - 1; i++) {
    if (/[一-鿿]/.test(clean[i])) tokens.push(clean.slice(i, i+2));
  }
  return tokens;
}
```

**错误兜底**：
- Worker 报错 → `onerror` 捕获，降级为主线程搜索
- postMessage 传输过大 → 可用 Transferable Objects（ArrayBuffer）

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Worker + 倒排索引**（选） | 快、不阻塞主线程 | 索引占内存 |
| 主线程 filter | 简单 | 数据大时卡顿 |
| 后端搜索 API | 无内存压力 | 网络往返延迟 |
| Fuse.js 模糊搜索 | 支持容错拼写 | 大数据慢 |
| MiniSearch / Lunr | 成熟全文搜索库 | 引入外部依赖 |

#### 5️⃣ 延伸八股

- **Web Worker 通信**：postMessage / structuredClone / Transferable
- **主线程阻塞**：JS 单线程 / requestIdleCallback / requestAnimationFrame
- **Service Worker vs Web Worker vs Shared Worker**：
  - Web Worker：普通计算线程
  - Service Worker：拦截网络请求、离线缓存
  - Shared Worker：多标签页共享
- **搜索算法**：TF-IDF、BM25、编辑距离
- **中文分词**：结巴分词、IK 分词器

#### 6️⃣ 不用库自己实现

上面代码就是从零手写的，没用任何库。

**极简 postMessage 通信**：

```js
// worker.js
self.onmessage = (e) => {
  const result = doHeavyWork(e.data);
  self.postMessage(result);
};

// main.js
const w = new Worker('worker.js');
w.postMessage(input);
w.onmessage = (e) => console.log(e.data);
```

#### 7️⃣ 优化空间

- **增量索引**：新增 post 时增量更新索引，不重建
- **持久化索引**：用 IndexedDB 缓存索引，刷新页面不重建
- **更好的分词**：接 jieba-wasm 或 pinyin-pro
- **模糊匹配**：加编辑距离容忍拼写错误
- **TF-IDF 打分**：结果按相关度排序，不只是二值命中
- **虚拟滚动**：结果太多时用 react-window 只渲染可视区

---

### 1.5 React Context + useReducer 状态管理

#### 1️⃣ 使用场景和目的

全局状态（posts / filteredPosts / dashboardStats / selectedCategory）需要跨组件共享。规模不够大不想引入 Redux。

**目的**：轻量、无第三方依赖、原生 React API。

#### 2️⃣ 底层实现（原理）

**Context**：React 内置的"跨组件传值"机制，避免 props drilling。

**useReducer**：类似 Redux 的 reducer 模式，(state, action) => newState。

**组合**：Context 存 state 和 dispatch，任何后代组件 `useContext` 就能读写。

#### 3️⃣ 使用方式和实现细节

```jsx
const AppContext = createContext(null);

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_POSTS':
      return { ...state, posts: action.payload };
    case 'TOGGLE_STATUS':
      return { ...state, posts: state.posts.map(p =>
        p.id === action.payload ? { ...p, status: 'read' } : p
      )};
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ ...state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
```

**性能坑**：Provider 里 value 每次都新对象，导致所有消费者重渲染。解决：
- 用 `useMemo` 包 value
- 拆多个 Context（state 和 dispatch 分开）

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Context + useReducer**（选） | 零依赖、简单 | 大规模状态难维护、性能坑 |
| Redux Toolkit | 生态完善、devtools 强 | boilerplate 多 |
| Zustand | 轻量、无 Provider 嵌套、TS 友好 | 生态不如 Redux |
| MobX | 响应式、写少 | 心智负担、调试难 |
| Jotai / Recoil | 原子化、粒度细 | 概念新 |

#### 5️⃣ 延伸八股

- **props drilling**：多层 props 传递问题
- **React Context 性能陷阱**：value 变化触发所有消费者重渲染
- **Redux 三原则**：单一数据源、State 只读、纯函数 Reducer
- **状态管理选型思路**：本地 useState → 跨组件 Context → 复杂状态 Redux/Zustand
- **useMemo / React.memo / useCallback**：什么时候用

#### 6️⃣ 不用库自己实现

极简全局状态管理：

```js
// store.js
const listeners = new Set();
let state = { count: 0 };

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getState() { return state; }
export function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach(fn => fn());
}

// hook
export function useStore(selector) {
  const [, force] = useState(0);
  useEffect(() => subscribe(() => force(x => x + 1)), []);
  return selector(state);
}
```

这就是 Zustand 的最小实现。

#### 7️⃣ 优化空间

- **拆 Context**：state 和 dispatch 拆开，写方法的组件不需要跟 state 变化
- **selector 模式**：`useApp(state => state.posts)` 只订阅需要的字段
- **immer**：用 immer 简化不可变更新
- **持久化**：redux-persist / 手写 localStorage 中间件

---

### 1.6 乐观更新 + 失败回滚

#### 1️⃣ 使用场景和目的

用户点"标记已读"→ 前端立刻显示已读 → 后台 API 请求 → 如果失败，回滚。

**目的**：**响应速度感**。用户不需要等网络请求，UI 立刻反馈。

#### 2️⃣ 底层实现（原理）

三步：
1. **快照当前状态**：`prevPosts = state.posts`
2. **立即更新 UI**：`dispatch({ type: 'TOGGLE_STATUS', ... })`
3. **发请求**：如果失败 → `dispatch({ type: 'SET_POSTS', payload: prevPosts })` 回滚

#### 3️⃣ 使用方式和实现细节

```js
const toggleStatus = useCallback((id) => {
  const post = state.posts.find(p => p.id === id);
  const newStatus = post.status === 'read' ? 'unread' : 'read';
  const prevPosts = state.posts;  // 快照

  // 1. 乐观更新
  dispatch({ type: 'TOGGLE_STATUS', payload: { id, newStatus } });

  // 2. 发请求
  fetch(`/api/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  })
    .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
    .catch(() => {
      // 3. 失败回滚 + 提示
      dispatch({ type: 'SET_POSTS', payload: prevPosts });
      dispatch({ type: 'SET_ERROR', payload: '更新状态失败' });
    });
}, [state.posts]);
```

**边界处理**：
- 并发操作：用户快速点两次会有 race condition，可加请求锁
- 网络慢：显示 loading 状态

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **乐观更新**（选） | 响应快 | 需要处理回滚 |
| 悲观更新 | 保证一致性 | 每次操作都等 |
| 乐观 + 队列 | 支持批量 | 复杂 |

React Query / SWR 有内置乐观更新 API。

#### 5️⃣ 延伸八股

- **CAP 理论**：一致性、可用性、分区容错
- **最终一致性**
- **幂等性**：同一请求发多次结果一样（PUT / DELETE）
- **CRDT**：无冲突可复制数据类型（协作场景）
- **React 状态 batch 更新**

#### 6️⃣ 不用库自己实现

上面代码本身就是无库实现。核心就三行：快照 → 乐观 dispatch → catch 回滚。

#### 7️⃣ 优化空间

- **中间件抽象**：写一个 optimistic middleware，所有 mutation 自动 snapshot + rollback
- **合并操作**：多个连续操作合成一个请求（debounce + batch）
- **冲突解决**：多用户并发时用版本号（ETag / If-Match）
- **useOptimistic**（React 19 新 hook）：官方 API，更简洁

---

### 1.7 Docker 部署

#### 1️⃣ 使用场景和目的

项目依赖 Node、MySQL、xiaohongshu-mcp、Tesseract 四个东西。手动部署到新机器要装很多包，还容易环境不一致。

**目的**：一次 `docker compose up`，所有服务跑起来。

#### 2️⃣ 底层实现（原理）

**Docker** 用 Linux Namespace（隔离进程、网络、文件系统） + Cgroup（限制 CPU/内存）实现容器化。镜像分层，每一层是只读文件系统 diff。

**docker-compose**：编排多容器应用的 YAML 配置工具。

#### 3️⃣ 使用方式和实现细节

**Dockerfile 分层构建**（利用缓存）：

```dockerfile
FROM node:20-alpine
WORKDIR /app

# 先 COPY package.json，改代码不重装依赖
COPY package.json package-lock.json ./
RUN npm ci

# 安装系统依赖（Tesseract）
RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-chi_sim

# 再 COPY 代码
COPY . .
RUN npm run build

EXPOSE 3001
CMD ["node", "server/index.js"]
```

**docker-compose.yml**：

```yaml
services:
  app:
    build: .
    ports: ["5173:3001"]
    env_file: .env
    depends_on: [mcp]
  mcp:
    image: xiaohongshu-mcp
    ports: ["18060:18060"]
    volumes: ["./docker-data/cookies:/app/cookies"]
```

**关键实践**：
- `.dockerignore` 排除 node_modules / .git，减小构建上下文
- 多阶段构建：先 builder 阶段编译，再 runtime 阶段只拷贝产物，镜像小
- 用 `host.docker.internal` 从容器访问宿主机 MySQL

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Docker Compose**（选） | 单机开发/部署简单 | 生产集群不够 |
| Kubernetes | 生产级、自动伸缩 | 复杂度高 |
| PM2 直接部署 | 无容器化开销 | 环境依赖麻烦 |
| Serverless（Vercel/Cloud Run） | 无运维 | 冷启动、有限制 |

#### 5️⃣ 延伸八股

- **Docker 分层原理**：镜像层、容器层、Copy-on-Write
- **CMD vs ENTRYPOINT**
- **Volume vs Bind Mount**
- **Docker 网络模式**：bridge / host / overlay
- **多阶段构建**
- **K8s 基础概念**：Pod / Service / Deployment / Ingress

#### 6️⃣ 不用 Docker 自己实现

用 systemd 管理 Node 进程 + 手动装依赖：

```
apt install nodejs mysql tesseract-ocr
useradd -m app
git clone ... /home/app/xhs-mianshi
sudo -u app npm ci --prefix /home/app/xhs-mianshi
# 写 systemd unit file
systemctl enable app.service
```

缺点：环境不一致、无法横向扩展。

#### 7️⃣ 优化空间

- **多阶段构建**：builder + runtime 分开，镜像从 500MB 缩到 100MB
- **healthcheck**：docker-compose 加 healthcheck，MCP 挂了自动重启
- **日志聚合**：docker logs 集成到 ELK 或 Loki
- **CI/CD 自动构建推送**：GitHub Actions build + push GHCR

---

## 项目二：营销页面搭建平台（低代码）

---

### 2.1 画布核心交互引擎（拖拽 / 缩放 / 旋转）

#### 1️⃣ 使用场景和目的

用户在画布上拖拽组件、调整大小、旋转。**目的**：所见即所得的编辑体验。

#### 2️⃣ 底层实现（原理）

**拖拽**：监听 `pointerdown / pointermove / pointerup`，记录起始坐标，实时更新 `transform: translate(x, y)`。

**缩放**：8 个方向的 handle，拖动时根据方向修改 width/height + position。

**旋转**：中心点 + 角度，用 `Math.atan2` 计算鼠标位置到中心的夹角。

关键公式（旋转）：

```
angle = Math.atan2(mouseY - centerY, mouseX - centerX) * 180 / Math.PI
```

#### 3️⃣ 使用方式和实现细节

**组件模型**：

```ts
interface CanvasItem {
  id: string;
  type: 'text' | 'image' | 'button';
  x: number; y: number;
  width: number; height: number;
  rotation: number;
  props: Record<string, any>;
}
```

**渲染**：

```vue
<div v-for="item in items"
     :style="{
       transform: `translate(${item.x}px, ${item.y}px) rotate(${item.rotation}deg)`,
       width: item.width + 'px',
       height: item.height + 'px',
     }"
     @pointerdown="startDrag(item, $event)">
  <component :is="componentMap[item.type]" v-bind="item.props" />
</div>
```

**错误兜底**：
- pointerup 丢失（用户拖到窗口外）→ 监听 `document`
- 缩放太小 → clamp min width/height
- 越界 → 限制在画布范围内

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **自研 transform**（选） | 灵活可控 | 从零实现 |
| moveable.js 库 | 开箱即用、功能全 | 定制难、体积大 |
| interact.js | 手势库 | 抽象层多 |
| Fabric.js / Konva | Canvas 渲染 | 学习成本、DOM 事件失效 |

#### 5️⃣ 延伸八股

- **DOM 事件流**：捕获、目标、冒泡
- **pointer 事件 vs mouse 事件 vs touch 事件**：Pointer Events 是新标准，统一处理鼠标 / 触摸 / 笔
- **CSS transform 硬件加速**：`translate3d` 触发 GPU
- **requestAnimationFrame**：拖拽用 rAF 节流，60fps
- **transform origin**：旋转中心点

#### 6️⃣ 不用库自己实现

上面就是无库实现。核心：

```js
function startDrag(item, e) {
  const startX = e.clientX, startY = e.clientY;
  const originX = item.x, originY = item.y;

  const onMove = (ev) => {
    item.x = originX + (ev.clientX - startX);
    item.y = originY + (ev.clientY - startY);
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}
```

#### 7️⃣ 优化空间

- **rAF 节流**：pointermove 每帧最多更新一次
- **虚拟画布**：组件多时用虚拟渲染
- **多选拖拽**：批量移动
- **磁性吸附**：靠近其他元素时吸附
- **辅助线**：拖拽时显示对齐参考线

---

### 2.2 撤销/重做（命令模式 + 历史栈）

#### 1️⃣ 使用场景和目的

用户操作错了要 `Ctrl+Z` 撤销、`Ctrl+Y` 重做。

**目的**：容错、鼓励用户实验。

#### 2️⃣ 底层实现（原理）

**命令模式**：每个操作封装成一个 Command 对象，包含 `execute()` 和 `undo()` 方法。

**双栈结构**：
- `undoStack`：已执行的命令
- `redoStack`：被撤销的命令

**流程**：
- 执行操作：`execute()` + push undoStack
- Ctrl+Z：pop undoStack → `undo()` → push redoStack
- Ctrl+Y：pop redoStack → `execute()` → push undoStack
- 新操作：清空 redoStack（因为分支变了）

#### 3️⃣ 使用方式和实现细节

**Command 接口**：

```ts
interface Command {
  execute(): void;
  undo(): void;
  label?: string;  // 用于 UI 显示"撤销 移动图层"
}

class MoveCommand implements Command {
  constructor(private item, private from, private to) {}
  execute() { this.item.x = this.to.x; this.item.y = this.to.y; }
  undo()    { this.item.x = this.from.x; this.item.y = this.from.y; }
}
```

**History Manager**：

```ts
class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxSize = 100;

  exec(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];  // 分支变化，清空 redo
    if (this.undoStack.length > this.maxSize) this.undoStack.shift();
  }
  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) { cmd.undo(); this.redoStack.push(cmd); }
  }
  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) { cmd.execute(); this.undoStack.push(cmd); }
  }
}
```

**替代方案：全量快照**

```ts
// 每次操作后完整快照 state
history.push(JSON.parse(JSON.stringify(state)));
```

简单但内存爆炸。命令模式内存友好但每种操作要写 execute + undo。

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **命令模式**（选） | 内存少、语义清晰 | 需要为每种操作写 undo |
| 全量快照 | 简单 | 大 state 内存爆 |
| Immer patches | 自动生成 patch | 依赖 Immer |
| CRDT | 支持协作 | 复杂 |
| 事件溯源 Event Sourcing | 可回放 | 重量级 |

#### 5️⃣ 延伸八股

- **设计模式**：命令、观察者、单例、工厂、策略
- **不可变数据**：immer / structuredClone
- **深拷贝性能**：`JSON.parse(JSON.stringify)` vs structuredClone vs 手写
- **Keyboard 快捷键**：`keydown` + `event.ctrlKey`

#### 6️⃣ 不用库自己实现

上面代码就是无库。快捷键绑定：

```js
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    e.shiftKey ? history.redo() : history.undo();
  }
});
```

#### 7️⃣ 优化空间

- **合并连续操作**：连续拖动 100 次合并为 1 个命令（debounce）
- **命令组合**：CompositeCommand 组合多个命令一次撤销
- **最大历史限制**：avoid 内存爆炸
- **持久化**：sessionStorage 存历史，刷新不丢
- **协作**：多人编辑时用 CRDT / OT

---

### 2.3 组件库封装

#### 1️⃣ 使用场景和目的

平台需要可扩展的组件（文本、图片、按钮、倒计时、表单）。**目的**：新增组件不改画布代码。

#### 2️⃣ 底层实现（原理）

**组件注册表**：每个组件描述自己的元数据（名称、图标、默认 props、schema）。画布用 Vue 的动态组件 `<component :is>` 渲染。

#### 3️⃣ 使用方式和实现细节

```ts
interface ComponentDef {
  name: string;
  type: string;
  icon: string;
  defaultProps: Record<string, any>;
  component: Component;   // Vue 组件
  editorSchema: FieldSchema[];  // 编辑面板配置
}

const registry = new Map<string, ComponentDef>();
export function register(def: ComponentDef) {
  registry.set(def.type, def);
}

// 使用
register({
  name: '文本',
  type: 'text',
  icon: 'icon-text',
  defaultProps: { content: '双击编辑', fontSize: 16 },
  component: TextComponent,
  editorSchema: [
    { key: 'content', type: 'textarea', label: '文字' },
    { key: 'fontSize', type: 'number', label: '字号' },
  ],
});
```

**画布渲染**：

```vue
<component
  :is="registry.get(item.type).component"
  v-bind="item.props"
/>
```

**编辑面板**：根据 `editorSchema` 动态生成表单。

#### 4️⃣ 竞对方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **注册表 + Schema**（选） | 灵活、可扩展 | 需要设计 schema |
| 硬编码 if/else | 简单 | 加组件要改核心代码 |
| Slot 插槽 | 简单 | 无法动态创建 |
| Web Components | 跨框架 | 生态弱 |

#### 5️⃣ 延伸八股

- **Vue 动态组件**：`<component :is>`、`defineAsyncComponent`
- **React 动态组件**：`React.createElement`、按类型 map
- **JSON Schema**：结构化描述数据
- **微前端**：多个应用组合，Module Federation
- **DSL 领域特定语言**：低代码本质是把操作抽象成 DSL

#### 6️⃣ 不用库自己实现

上面就是无库。核心就是 Map + 动态组件。

#### 7️⃣ 优化空间

- **异步加载**：组件太多时用 `defineAsyncComponent` 按需加载
- **版本管理**：组件升级不破坏已保存的页面
- **市场生态**：外部开发者可发布自定义组件
- **AI 生成**：LLM 从自然语言生成组件配置

---

**看完这些，你手上有：**

- **`INTERVIEW_OUTLINE.md`**：全部八股大纲（按概率排序）
- **`PROJECT_DEEP_QA.md`**（本文件）：项目七维度深挖

**接下来讲什么？** 说"继续 JS 基础"我出下一份，按"闭包 → 原型链 → this → Promise → 事件循环"顺序讲。

或者你直接指定某个主题，比如"讲 React Hooks"、"讲 CSS Flex"。
