# 前端面试八股大纲（按出现概率排序）

面向小厂前端 / 前端实习岗位。基于牛客、掘金、GitHub、知乎、CSDN 常见考点 + 你的简历技术栈。

---

## 使用说明

按"出现概率"由高到低排序，从上往下背，性价比最高。每个知识点会用**七维度**展开：

1. **使用场景和目的** — 什么时候用、解决什么问题
2. **底层实现（原理）** — 内部怎么跑的
3. **使用方式和实现细节** — API、参数、错误兜底
4. **竞对方案对比** — 有什么替代品、各自优缺点
5. **延伸八股** — 相关技术栈
6. **不用库自己实现** — 手写版
7. **进一步优化** — 边界优化、性能优化

---

## 一、简历项目相关（★★★★★ 必考）

面试官一定会问项目细节。见 `PROJECT_DEEP_QA.md` 单独文档。

- 小红书面经助手（本项目）
  - MCP 协议 + JSON-RPC + SSE
  - OCR 流水线（Tesseract + sharp）
  - Web Worker 倒排索引
  - React Context + useReducer
  - 乐观更新 + 失败回滚
  - Docker 部署

- 营销页面搭建平台
  - 画布交互引擎（拖拽、缩放、旋转、自由布局）
  - 撤销/重做（命令模式 + 历史栈）
  - 组件库封装
  - Pinia 状态管理

---

## 二、JavaScript 基础（★★★★★ 每场必考）

按频率：

1. **闭包**（几乎必问）
2. **原型链 / prototype / __proto__**
3. **this 指向**（call/apply/bind）
4. **Promise / async await**
5. **事件循环（Event Loop）/ 宏任务微任务**
6. **箭头函数 vs 普通函数**
7. **var / let / const 区别**
8. **深拷贝 / 浅拷贝**
9. **防抖 / 节流**
10. **数据类型判断（typeof / instanceof）**
11. **new 操作符做了什么**
12. **ES6 新特性（解构、扩展、Symbol、Map/Set）**

---

## 三、React 生态（★★★★★ 简历重点）

按频率：

1. **useState / useEffect / useMemo / useCallback**
2. **Hooks 使用限制（为什么不能在循环/条件里用）**
3. **useState 是同步还是异步**
4. **useEffect 依赖数组 / 清理函数**
5. **React 组件通信（props / Context / Ref）**
6. **useContext + useReducer 替代 Redux 的场景**
7. **虚拟 DOM 是什么 / 为什么用**
8. **diff 算法 / key 的作用**
9. **Fiber 架构**
10. **受控组件 vs 非受控组件**
11. **Class 组件 vs 函数组件**
12. **React 18 新特性（并发渲染、Suspense）**
13. **React 性能优化（memo / lazy / Suspense）**

---

## 四、CSS（★★★★☆ 高频）

按频率：

1. **Flex 布局**（每场必问）
2. **盒模型（content-box / border-box）**
3. **CSS 居中的 N 种方法**
4. **BFC 是什么 / 触发条件**
5. **position 定位（static/relative/absolute/fixed/sticky）**
6. **Grid 布局**
7. **CSS 选择器优先级**
8. **rem / em / vw / vh 区别**
9. **CSS 动画（transition / animation / transform）**
10. **移动端适配（vw / rem / 1px 边框）**

---

## 五、HTTP 网络（★★★★☆ 高频）

按频率：

1. **HTTP 常见状态码**（200/301/302/304/400/401/403/404/500）
2. **HTTP 缓存机制**（强缓存 vs 协商缓存、Cache-Control、ETag）
3. **HTTP 1.0 / 1.1 / 2.0 / 3.0 区别**
4. **HTTPS 原理**（TLS 握手、证书）
5. **GET vs POST 区别**
6. **跨域及解决方案**（CORS、JSONP、Nginx 反代）
7. **TCP 三次握手 / 四次挥手**
8. **WebSocket vs SSE vs 长轮询**

---

## 六、Vue 生态（★★★★☆ 你有 Vue3 项目）

按频率：

1. **Vue 响应式原理（Vue3 Proxy vs Vue2 defineProperty）**
2. **Composition API vs Options API**
3. **ref vs reactive**
4. **computed vs watch**
5. **Vue diff 算法**
6. **v-if vs v-show**
7. **组件通信（props / emit / provide-inject / Pinia）**
8. **Pinia vs Vuex**
9. **Vue Router 原理（hash 模式 vs history 模式）**
10. **Vue 生命周期**

---

## 七、浏览器 & 性能（★★★☆☆ 中频）

按频率：

1. **浏览器渲染流程**（HTML 解析、CSSOM、Render Tree、Layout、Paint、Composite）
2. **重绘 vs 回流**
3. **事件循环（浏览器端）**
4. **本地存储（localStorage / sessionStorage / Cookie / IndexedDB）**
5. **性能优化**（懒加载、代码分割、CDN、缓存策略）
6. **首屏优化 / 白屏优化**
7. **XSS / CSRF 攻击 + 防御**
8. **Service Worker / PWA**

---

## 八、TypeScript（★★★☆☆ 你项目 2 用到）

按频率：

1. **interface vs type**
2. **泛型 Generic**
3. **常用类型（Partial / Pick / Omit / Record）**
4. **联合类型 vs 交叉类型**
5. **as 断言 vs 类型守卫**
6. **never / unknown / any 区别**

---

## 九、工程化（★★★☆☆ 中频）

按频率：

1. **Vite 为什么比 Webpack 快**
2. **Webpack 打包流程**
3. **Tree Shaking**
4. **HMR 热更新原理**
5. **Loader vs Plugin**
6. **Babel 是什么 / 干什么**
7. **npm / yarn / pnpm 区别**
8. **Git 常用命令 / rebase vs merge**

---

## 十、算法与数据结构（★★☆☆☆ 小厂偶尔考）

按频率：

1. **数组去重 N 种方式**
2. **数组扁平化 flat**
3. **手写 Promise / Promise.all**
4. **手写 debounce / throttle**
5. **手写深拷贝**
6. **手写 new / call / apply / bind**
7. **手写 instanceof**
8. **手写发布订阅 EventBus**
9. **常见算法题**（两数之和、翻转链表、爬楼梯）

---

## 十一、AI Native / MCP / LLM（★★★★★ 你的差异化亮点）

因为你简历上有 MCP、Prompt 工程、Claude Code / Codex，面试官会重点问。

按频率：

1. **MCP 协议是什么**
2. **JSON-RPC 2.0 结构**
3. **SSE vs WebSocket**
4. **LLM API 调用**（OpenAI 兼容协议）
5. **Prompt 工程**（few-shot、CoT、约束）
6. **Agent vs Workflow**
7. **RAG 是什么**
8. **Tool Use（Function Calling）**
9. **Token 成本控制**
10. **AI 编程工具经验**（Claude Code / Codex 差异）

---

## 十二、行为面 / 项目故事（★★★☆☆ HR 面必问）

- 自我介绍（30 秒 / 2 分钟版）
- 为什么做 AI 面经助手项目
- 项目最难的问题
- 项目最有成就感的时刻
- 项目局限
- 未来学习计划
- 为什么选前端 / 为什么想加入这家公司

---

## 学习顺序建议（按 ROI）

第一阶段（1 周）：
1. 项目 7 维度（照着 `PROJECT_DEEP_QA.md` 背）
2. JS 闭包 / 原型链 / this / Promise / 事件循环
3. React Hooks / useState / useEffect

第二阶段（1 周）：
4. CSS Flex / 居中 / 盒模型 / BFC
5. HTTP 状态码 / 缓存 / 跨域
6. Vue 响应式 / Composition API

第三阶段（3-5 天）：
7. 浏览器渲染 / 事件循环 / 性能优化
8. TypeScript 基础
9. 工程化 Vite / Webpack

第四阶段（3 天）：
10. AI Native 相关（你已经熟，复习即可）
11. 手写题（Promise / debounce / 深拷贝）
12. 行为面故事

---

**接下来我按第二部分（JS 基础）开始详细讲，你可以随时说"继续 React 部分"跳到别的模块。**
