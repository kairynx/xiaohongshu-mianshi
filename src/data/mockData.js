// 模拟小红书面经数据 + MCP浏览器真实抓取数据
const mockData = [
  // ========== 前端开发 ==========
  {
    id: 1,
    title: '字节跳动前端一面面经（已OC）',
    author: '前端小王',
    avatar: '👨‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-09',
    source: '小红书',
    likes: 2341,
    collects: 1892,
    tags: ['字节跳动', '前端', 'React', '一面'],
    content: `## 字节跳动前端一面面经

### 基本信息
- 岗位：前端开发工程师（抖音电商方向）
- 时间：2026年4月8日
- 形式：视频面试，约60分钟
- 结果：通过 ✅

### 面试内容

**1. 自我介绍 + 项目深挖（15min）**
- 让我详细介绍最近负责的项目
- 追问了React Fiber架构的理解
- 虚拟DOM的diff算法原理
- 项目中如何做性能优化

**2. JavaScript基础（20min）**
- 闭包的原理和应用场景
- Promise.all和Promise.race的区别
- 事件循环（Event Loop）机制
- 原型链相关题目
- this指向问题（箭头函数vs普通函数）

**3. React相关（15min）**
- useState和useEffect的实现原理
- React Hooks的闭包陷阱
- useMemo和useCallback的使用场景
- React 18的新特性（Concurrent Mode）
- Redux和Zustand的区别

**4. 算法题（10min）**
- 实现一个深拷贝函数
- 手写Promise.all

### 总结
面试官很专业，会根据你的回答深入追问。建议把基础知识打牢，项目经验要能说清楚技术选型的原因。`,
    status: 'read',
    priority: 'high'
  },
  {
    id: 2,
    title: '腾讯前端三面面经分享',
    author: '码农阿杰',
    avatar: '👨‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-08',
    source: '小红书',
    likes: 1856,
    collects: 1423,
    tags: ['腾讯', '前端', 'Vue', '三面'],
    content: `## 腾讯前端三面面经

### 基本信息
- 岗位：前端开发（微信支付团队）
- 时间：2026年4月7日
- 形式：现场面试
- 结果：待定

### 三面内容

**1. 项目架构设计（20min）**
- 大型前端项目的架构设计思路
- 微前端方案的选型和落地
- 组件库的设计和规范

**2. 综合技术（20min）**
- Webpack和Vite的构建原理
- 前端监控方案（错误监控、性能监控）
- CI/CD流程设计
- 单元测试策略

**3. 系统设计（15min）**
- 设计一个在线协作编辑器
- WebSocket和WebRTC的选择
- OT算法和CRDT算法的理解

**4. 职业规划（5min）**
- 未来3年的技术规划
- 对前端工程化的理解`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 3,
    title: '美团前端校招面经（附答案）',
    author: '秋招选手',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-07',
    source: '小红书',
    likes: 3210,
    collects: 2678,
    tags: ['美团', '前端', '校招', 'CSS'],
    content: `## 美团前端校招面经

### 基本信息
- 岗位：前端开发工程师（校招）
- 时间：2026年4月6日
- 形式：视频面试

### 面试题目

**HTML/CSS**
1. BFC的理解和触发条件
2. Flex布局常用属性
3. CSS选择器优先级
4. 移动端适配方案（rem/vw）
5. CSS动画性能优化

**JavaScript**
1. var/let/const区别
2. 解构赋值的用法
3. ES6新特性总结
4. 模块化规范（CommonJS vs ES Module）

**框架**
1. Vue的响应式原理
2. Vue3和Vue2的区别
3. 组件通信方式
4. 路由守卫的使用

**算法**
1. 数组去重
2. 二叉树遍历
3. 排序算法比较`,
    status: 'read',
    priority: 'high'
  },
  {
    id: 4,
    title: '阿里前端P7面经，难度拉满',
    author: '阿里追梦人',
    avatar: '👨‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-06',
    source: '小红书',
    likes: 4521,
    collects: 3890,
    tags: ['阿里', '前端', 'P7', '高级'],
    content: `## 阿里前端P7面经

### 基本信息
- 岗位：前端技术专家（P7）
- 部门：淘天集团
- 轮次：四面（交叉面+HR面）

### 一面：技术深度
- 浏览器渲染原理（关键渲染路径）
- Service Worker和PWA实践
- WebAssembly在前端的应用
- 大规模数据的前端渲染方案（虚拟滚动）

### 二面：架构能力
- 前端基础设施建设
- 研发效能提升方案
- 跨端方案（Taro/uni-app/RN）
- 前端安全（XSS/CSRF/点击劫持）

### 三面：技术视野
- AI在前端的应用（Copilot/Cursor）
- Web3D和WebGPU
- 低代码平台的架构设计
- 前端智能化实践

### 四面：综合素质
- 团队管理经验
- 技术决策的方法论
- 跨部门协作案例`,
    status: 'unread',
    priority: 'high'
  },

  // ========== 后端开发 ==========
  {
    id: 5,
    title: '字节后端Java开发一面面经',
    author: 'Java老司机',
    avatar: '👨‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-09',
    source: '小红书',
    likes: 1987,
    collects: 1654,
    tags: ['字节跳动', 'Java', '后端', '一面'],
    content: `## 字节跳动后端Java一面面经

### 基本信息
- 岗位：后端开发工程师（飞书团队）
- 时间：2026年4月8日
- 形式：视频面试

### 面试内容

**1. Java基础（15min）**
- HashMap底层实现（数组+链表+红黑树）
- ConcurrentHashMap的实现原理
- JVM内存模型和垃圾回收
- 类加载机制（双亲委派模型）

**2. 数据库（15min）**
- MySQL索引原理（B+树）
- 事务隔离级别
- MVCC的实现原理
- SQL优化经验
- 分库分表方案

**3. 中间件（15min）**
- Redis数据类型和应用场景
- Redis缓存击穿/穿透/雪崩
- 消息队列的使用场景
- Kafka和RocketMQ的对比

**4. 算法（15min）**
- LRU缓存实现
- 反转链表
- 二叉树的层序遍历`,
    status: 'read',
    priority: 'high'
  },
  {
    id: 6,
    title: '腾讯Go语言后端面经',
    author: 'Go菜鸟',
    avatar: '👨‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-08',
    source: '小红书',
    likes: 1543,
    collects: 1234,
    tags: ['腾讯', 'Go', '后端', '微服务'],
    content: `## 腾讯Go语言后端面经

### 基本信息
- 岗位：Go后端开发（微信后台）
- 时间：2026年4月7日

### 面试内容

**1. Go语言特性**
- goroutine和channel的使用
- GMP调度模型
- defer/panic/recover机制
- interface的底层实现
- GC机制（三色标记法）

**2. 系统设计**
- 设计一个短链接系统
- 设计一个秒杀系统
- 分布式ID生成方案
- 分布式锁的实现

**3. 网络编程**
- TCP三次握手四次挥手
- HTTP/2和HTTP/3的区别
- gRPC的使用和原理
- 负载均衡算法

**4. 微服务**
- 服务注册与发现
- 熔断降级策略
- 链路追踪方案
- API网关设计`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 7,
    title: '阿里后端社招面经（三年经验）',
    author: '三年Java',
    avatar: '👩‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-05',
    source: '小红书',
    likes: 2876,
    collects: 2345,
    tags: ['阿里', 'Java', '后端', '社招'],
    content: `## 阿里后端社招面经

### 基本信息
- 岗位：Java后端开发（P6）
- 经验：3年
- 部门：蚂蚁集团

### 面试重点

**Spring生态**
- Spring IOC和AOP原理
- Spring Boot自动配置
- Spring Cloud组件
- 事务传播机制

**分布式系统**
- 分布式事务（2PC/TCC/Saga）
- CAP理论和BASE理论
- 分布式一致性协议（Raft/Paxos）
- 分布式文件系统

**高并发**
- 线程池参数配置
- 限流算法（令牌桶/漏桶）
- 异步编程模型
- 性能调优经验

**项目经验**
- 高并发场景的处理方案
- 系统重构的经验
- 技术难点攻克过程`,
    status: 'read',
    priority: 'high'
  },

  // ========== 测试开发 ==========
  {
    id: 8,
    title: '字节测试开发面经（自动化方向）',
    author: '测开小姐姐',
    avatar: '👩‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2026-04-09',
    source: '小红书',
    likes: 1234,
    collects: 987,
    tags: ['字节跳动', '测试开发', '自动化', 'Python'],
    content: `## 字节测试开发面经

### 基本信息
- 岗位：测试开发工程师
- 方向：自动化测试
- 时间：2026年4月8日

### 面试内容

**1. 测试基础（15min）**
- 软件测试的分类
- 测试用例设计方法（等价类/边界值/场景法）
- Bug的生命周期
- 测试流程和规范

**2. 自动化测试（20min）**
- Selenium/Playwright的使用
- Appium移动端自动化
- 接口自动化测试框架
- pytest/unittest框架对比
- POM设计模式

**3. 编程能力（15min）**
- Python基础（装饰器/生成器）
- 数据结构和算法
- 正则表达式
- 文件处理和JSON解析

**4. 性能测试（10min）**
- JMeter的使用
- 性能测试指标（TPS/QPS/响应时间）
- 性能瓶颈分析方法
- 压测方案设计`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 9,
    title: '腾讯测开面经，含性能测试',
    author: '测试工程师',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2026-04-07',
    source: '小红书',
    likes: 987,
    collects: 765,
    tags: ['腾讯', '测试开发', '性能测试', 'CI/CD'],
    content: `## 腾讯测开面经

### 基本信息
- 岗位：测试开发工程师
- 部门：QQ团队

### 面试内容

**1. 测试理论**
- 测试金字塔模型
- 持续集成/持续交付
- 代码覆盖率
- 回归测试策略

**2. 工具链**
- Jenkins/GitLab CI配置
- Docker容器化测试环境
- SonarQube代码检查
- Allure测试报告

**3. 安全测试**
- SQL注入测试
- XSS漏洞检测
- CSRF攻击测试
- 敏感信息泄露检测

**4. 场景题**
- 如何测试一个登录功能
- 如何测试一个支付系统
- 如何设计自动化测试框架
- 如何做全链路压测`,
    status: 'read',
    priority: 'medium'
  },
  {
    id: 10,
    title: '美团测开校招面经（很详细）',
    author: '校招小白',
    avatar: '👩‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2026-04-06',
    source: '小红书',
    likes: 2100,
    collects: 1789,
    tags: ['美团', '测试开发', '校招', '详细'],
    content: `## 美团测开校招面经

### 基本信息
- 岗位：测试开发工程师（校招）
- 时间：2026年4月5日

### 一面：基础知识
- Linux常用命令
- SQL语句（增删改查、多表联查）
- HTTP协议状态码
- TCP/UDP区别
- 进程和线程的区别

### 二面：编程能力
- 用Python实现一个简单的计算器
- 字符串反转
- 链表操作
- 排序算法

### 三面：综合素质
- 如何保证测试质量
- 与开发产生分歧怎么处理
- 加班看法
- 职业规划`,
    status: 'unread',
    priority: 'low'
  },

  // ========== 移动端开发 ==========
  {
    id: 11,
    title: '字节iOS开发面经（Swift方向）',
    author: 'iOS开发者',
    avatar: '👨‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2026-04-08',
    source: '小红书',
    likes: 1654,
    collects: 1321,
    tags: ['字节跳动', 'iOS', 'Swift', '移动端'],
    content: `## 字节iOS开发面经

### 基本信息
- 岗位：iOS开发工程师
- 方向：抖音客户端
- 时间：2026年4月7日

### 面试内容

**1. Swift基础**
- 值类型vs引用类型
- 协议和泛型
- async/await异步编程
- 内存管理（ARC/weak/unowned）
- Codable序列化

**2. iOS进阶**
- UIKit和SwiftUI对比
- RunLoop机制
- Autolayout原理
- TableView性能优化
- 离屏渲染问题

**3. 架构设计**
- MVVM/MVP/VIPER架构
- 组件化方案
- 依赖注入
- 路由设计

**4. 算法**
- 两数之和
- 有效括号
- 二分查找`,
    status: 'read',
    priority: 'high'
  },
  {
    id: 12,
    title: '腾讯Android开发面经（Kotlin）',
    author: '安卓小王子',
    avatar: '👨‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2026-04-07',
    source: '小红书',
    likes: 1432,
    collects: 1098,
    tags: ['腾讯', 'Android', 'Kotlin', '移动端'],
    content: `## 腾讯Android开发面经

### 基本信息
- 岗位：Android开发工程师
- 部门：微信团队
- 时间：2026年4月6日

### 面试内容

**1. Kotlin基础**
- 协程（Coroutine）原理
- Flow和LiveData
- 空安全机制
- 扩展函数
- 内联函数

**2. Android核心**
- Activity启动模式
- Fragment生命周期
- RecyclerView优化
- Binder机制
- Handler消息机制

**3. 性能优化**
- 内存泄漏检测
- ANR分析和解决
- 启动速度优化
- 包体积优化
- 电量优化

**4. 架构**
- Jetpack组件
- MVVM架构实践
- 模块化开发
- 插件化技术`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 13,
    title: 'Flutter跨端开发面经总结',
    author: 'Flutter爱好者',
    avatar: '👩‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2026-04-05',
    source: '小红书',
    likes: 876,
    collects: 654,
    tags: ['Flutter', '跨端', 'Dart', '移动端'],
    content: `## Flutter跨端开发面经

### 基本信息
- 岗位：Flutter开发工程师
- 公司：某互联网大厂

### 面试内容

**1. Dart语言**
- Dart异步模型（Future/Stream）
- Mixin的使用
- Isolate多线程
- 泛型和空安全

**2. Flutter核心**
- Widget生命周期
- Element/RenderObject
- 状态管理（Provider/Riverpod）
- 路由管理
- 平台通道（Platform Channel）

**3. 性能优化**
- Widget重建优化
- 列表性能优化
- 图片缓存策略
- 编译优化

**4. 实战经验**
- Flutter和原生交互
- 混合开发方案
- 热更新方案
- CI/CD集成`,
    status: 'read',
    priority: 'low'
  },

  // ========== 产品经理 ==========
  {
    id: 14,
    title: '字节产品经理一面面经（抖音方向）',
    author: '产品小白',
    avatar: '👩‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-04-09',
    source: '小红书',
    likes: 3456,
    collects: 2876,
    tags: ['字节跳动', '产品经理', '抖音', '一面'],
    content: `## 字节产品经理一面面经

### 基本信息
- 岗位：产品经理（抖音电商）
- 时间：2026年4月8日
- 形式：视频面试

### 面试内容

**1. 自我介绍 + 简历深挖（15min）**
- 介绍一段最亮眼的实习经历
- 产品从0到1的过程
- 如何定义产品需求优先级

**2. 产品设计（20min）**
- 设计一个短视频带货功能
- 如何提升用户下单转化率
- 竞品分析：抖音电商 vs 快手电商
- 如何衡量产品成功

**3. 数据分析（15min）**
- DAU下降如何分析
- A/B测试的设计和评估
- 用户留存率提升策略
- 漏斗分析模型

**4. 开放问题（10min）**
- 对AI+电商的看法
- 如何发现用户痛点
- 最喜欢/不喜欢的产品及原因`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 15,
    title: '腾讯产品经理校招面经（超详细）',
    author: '校招产品人',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-04-08',
    source: '小红书',
    likes: 4123,
    collects: 3567,
    tags: ['腾讯', '产品经理', '校招', '详细'],
    content: `## 腾讯产品经理校招面经

### 基本信息
- 岗位：产品策划（校招）
- 部门：QQ团队
- 时间：2026年4月7日

### 一面：产品基础
- 什么是好产品
- 产品经理的核心能力
- 如何做用户调研
- PRD文档怎么写
- 需求评审流程

### 二面：产品设计
- 设计一个陌生人社交功能
- 微信朋友圈如何优化
- 如何提升QQ年轻用户活跃度
- 设计一个会员体系

### 三面：综合能力
- 如何处理与开发的冲突
- 如何说服老板支持你的方案
- 最近关注的产品动态
- 对AI产品的看法

### HR面
- 为什么选择腾讯
- 职业规划
- 优缺点
- 期望薪资`,
    status: 'read',
    priority: 'high'
  },
  {
    id: 16,
    title: '美团产品经理面经（本地生活方向）',
    author: '产品打工人',
    avatar: '👩‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-04-06',
    source: '小红书',
    likes: 2345,
    collects: 1987,
    tags: ['美团', '产品经理', '本地生活', '社招'],
    content: `## 美团产品经理面经

### 基本信息
- 岗位：高级产品经理
- 方向：本地生活
- 经验：3年

### 面试内容

**1. 行业理解**
- 本地生活市场竞争格局
- 美团vs抖音本地生活
- O2O商业模式分析
- 即时零售趋势

**2. 产品能力**
- 商家端产品设计
- 配送调度系统设计
- 用户补贴策略
- 会员体系设计

**3. 数据驱动**
- GMV拆解分析
- 用户LTV计算
- ROI评估方法
- 归因分析模型

**4. 管理能力**
- 如何带领产品团队
- 跨部门协作经验
- 产品规划方法论
- 资源分配策略`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 17,
    title: '快手产品经理面经（国际化方向）',
    author: '出海产品人',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-04-04',
    source: '小红书',
    likes: 1567,
    collects: 1234,
    tags: ['快手', '产品经理', '国际化', '短视频'],
    content: `## 快手产品经理面经

### 基本信息
- 岗位：产品经理（国际化）
- 产品：Kwai
- 时间：2026年4月3日

### 面试内容

**1. 国际化理解**
- 海外短视频市场分析
- 不同地区用户习惯差异
- 本地化策略
- 合规和隐私保护

**2. 产品设计**
- 如何提升海外用户留存
- 设计一个创作者激励体系
- 直播打赏功能优化
- 内容审核策略

**3. 增长策略**
- 海外用户获取渠道
- 病毒式传播设计
- 社交裂变玩法
- KOL合作策略

**4. 英语能力**
- 英文自我介绍
- 英文讨论产品设计方案`,
    status: 'read',
    priority: 'low'
  },
  {
    id: 18,
    title: '网易产品经理面经（游戏方向）',
    author: '游戏产品人',
    avatar: '👩‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-04-03',
    source: '小红书',
    likes: 1890,
    collects: 1567,
    tags: ['网易', '产品经理', '游戏', '运营'],
    content: `## 网易产品经理面经

### 基本信息
- 岗位：游戏产品经理
- 时间：2026年4月2日

### 面试内容

**1. 游戏理解**
- 最近玩的游戏及分析
- 游戏付费设计
- 游戏社交系统
- 游戏平衡性设计

**2. 产品能力**
- 游戏数据分析
- 玩家行为分析
- 活动策划
- 版本迭代规划

**3. 运营能力**
- 游戏社区运营
- KOL管理
- 玩家反馈处理
- 危机公关

**4. 综合素质**
- 对游戏行业的看法
- 游戏审美能力
- 团队协作经验`,
    status: 'unread',
    priority: 'low'
  },

  // ========== 🔥 MCP浏览器真实抓取数据 ==========

  // --- 前端开发（真实抓取） ---
  {
    id: 101,
    title: '京东前端一面面经',
    author: 'momo',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-09',
    source: '小红书（真实抓取）',
    likes: 64,
    collects: 114,
    tags: ['京东', '前端面试', '互联网大厂', '前端', '京东面试'],
    content: `## 京东前端一面面经

### 基本信息
- 作者：momo
- 发布时间：1天前
- 来源：小红书真实抓取
- 标签：#前端面试 #互联网大厂 #前端 #京东 #京东面试

### 面试内容
发面经，攒人品upupupup🤯

（面经详细内容在帖子图片中，共3张图，包含京东前端一面完整面试题目和回答要点）`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 102,
    title: '腾讯前端暑期实习面经',
    author: 'Phaer',
    avatar: '👨‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-04',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', '前端', '暑期实习'],
    content: `## 腾讯前端暑期实习面经

### 基本信息
- 作者：Phaer
- 发布时间：6天前
- 来源：小红书真实抓取

### 面试内容
腾讯前端暑期实习面试经验分享`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 103,
    title: '腾讯音乐前端三面面经',
    author: '曦鹤y0g',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-08',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯音乐', '前端', '三面'],
    content: `## 腾讯音乐前端三面面经

### 基本信息
- 作者：曦鹤y0g
- 发布时间：2天前
- 来源：小红书真实抓取

### 面试内容
腾讯音乐前端三面完整面经`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 104,
    title: '暑期实习—百度前端三面面经',
    author: '曦鹤y0g',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-09',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['百度', '前端', '暑期实习', '三面'],
    content: `## 暑期实习—百度前端三面面经

### 基本信息
- 作者：曦鹤y0g
- 发布时间：昨天 22:33
- 来源：小红书真实抓取

### 面试内容
百度前端暑期实习三面经验分享`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 105,
    title: '已入职字节跳前端岗36k，面试很水不用焦虑',
    author: '芝士棒',
    avatar: '👨‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-10',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '前端', '已入职', '36k'],
    content: `## 已入职字节跳前端岗36k，面试很水不用焦虑

### 基本信息
- 作者：芝士棒
- 发布时间：6小时前
- 来源：小红书真实抓取

### 面试内容
作者已成功入职字节跳动前端岗位，薪资36k，分享面试经历和心得`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 106,
    title: '27届腾讯前端暑期提前批一二三面，OC附简历',
    author: '喜喜玺玺',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2026-04-01',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', '前端', '暑期提前批', 'OC'],
    content: `## 27届腾讯前端暑期提前批一二三面，OC附简历

### 基本信息
- 作者：喜喜玺玺
- 发布时间：04-01
- 来源：小红书真实抓取

### 面试内容
27届腾讯前端暑期提前批一面、二面、三面完整面经，已OC，附简历模板`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 107,
    title: '美团前端暑期实习面经',
    author: '程陶陶的陶程程',
    avatar: '👩‍💻',
    category: 'frontend',
    categoryName: '前端开发',
    date: '2025-04-08',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '前端', '暑期实习'],
    content: `## 美团前端暑期实习面经

### 基本信息
- 作者：程陶陶的陶程程
- 发布时间：2025-04-08
- 来源：小红书真实抓取

### 面试内容
美团前端暑期实习面试经验`,
    status: 'unread',
    priority: 'medium'
  },

  // --- 后端开发（真实抓取） ---
  {
    id: 201,
    title: '美团 后端开发一面面经（挂）',
    author: '囍帖街',
    avatar: '👨‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-10',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '后端开发', '一面', '挂'],
    content: `## 美团 后端开发一面面经（挂）

### 基本信息
- 作者：囍帖街
- 发布时间：26分钟前
- 来源：小红书真实抓取

### 面试内容
美团后端开发一面面经，结果为挂，分享失败经验供参考`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 202,
    title: '20260409字节后端开发一面',
    author: '白色&枫信子',
    avatar: '👩‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-10',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '后端开发', '一面'],
    content: `## 20260409字节后端开发一面

### 基本信息
- 作者：白色&枫信子
- 发布时间：8小时前
- 来源：小红书真实抓取

### 面试内容
2026年4月9日字节跳动后端开发一面完整面经`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 203,
    title: '京东java后端暑期面经',
    author: '不七而遇',
    avatar: '👨‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-10',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['京东', 'Java', '后端', '暑期'],
    content: `## 京东java后端暑期面经

### 基本信息
- 作者：不七而遇
- 发布时间：2小时前
- 来源：小红书真实抓取

### 面试内容
京东Java后端暑期实习面试经验`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 204,
    title: '20260408美团暑期后端二面',
    author: '白色&枫信子',
    avatar: '👩‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-09',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '后端', '暑期', '二面'],
    content: `## 20260408美团暑期后端二面

### 基本信息
- 作者：白色&枫信子
- 发布时间：1天前
- 来源：小红书真实抓取

### 面试内容
2026年4月8日美团暑期后端开发二面面经`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 205,
    title: '腾讯CSIG后台开发一面',
    author: '养生小子',
    avatar: '👨‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2026-04-09',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', 'CSIG', '后台开发', '一面'],
    content: `## 腾讯CSIG后台开发一面

### 基本信息
- 作者：养生小子
- 发布时间：昨天 23:54
- 来源：小红书真实抓取

### 面试内容
腾讯CSIG后台开发一面面试经验`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 206,
    title: '哔哩哔哩后端日常实习一面面经',
    author: '月如风',
    avatar: '👩‍💻',
    category: 'backend',
    categoryName: '后端开发',
    date: '2024-12-28',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['哔哩哔哩', '后端', '日常实习', '一面'],
    content: `## 哔哩哔哩后端日常实习一面面经

### 基本信息
- 作者：月如风
- 发布时间：2024-12-28
- 来源：小红书真实抓取

### 面试内容
哔哩哔哩后端开发日常实习一面完整面经`,
    status: 'unread',
    priority: 'low'
  },

  // --- 测试开发（真实抓取） ---
  {
    id: 301,
    title: '字节暑期实习测开一面',
    author: '红雨瓢泼',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2026-03-25',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '测开', '暑期实习', '一面'],
    content: `## 字节暑期实习测开一面

### 基本信息
- 作者：红雨瓢泼
- 发布时间：03-25
- 来源：小红书真实抓取

### 面试内容
字节跳动暑期实习测试开发一面面经`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 302,
    title: 'b 站测开实习面经',
    author: 'Richard Clayderm',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2025-08-13',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['哔哩哔哩', '测开', '实习'],
    content: `## b 站测开实习面经

### 基本信息
- 作者：Richard Clayderm
- 发布时间：2025-08-13
- 来源：小红书真实抓取

### 面试内容
哔哩哔哩测试开发实习面试经验`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 303,
    title: '字节跳动测开一面',
    author: '小虾米秋招ing',
    avatar: '👩‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2025-09-12',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '测开', '一面'],
    content: `## 字节跳动测开一面

### 基本信息
- 作者：小虾米秋招ing
- 发布时间：2025-09-12
- 来源：小红书真实抓取

### 面试内容
字节跳动测试开发一面完整面经`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 304,
    title: '美团测开二面面经（已oc）',
    author: '李大的状状（已黑化）',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2025-04-01',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '测开', '二面', 'OC'],
    content: `## 美团测开二面面经（已oc）

### 基本信息
- 作者：李大的状状（已黑化）
- 发布时间：2025-04-01
- 来源：小红书真实抓取

### 面试内容
美团测试开发二面面经，已获得OC（Offer Call）`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 305,
    title: '百度测开三轮面试面经',
    author: '现在是十点',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2025-03-28',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['百度', '测开', '三轮面试'],
    content: `## 百度测开三轮面试面经

### 基本信息
- 作者：现在是十点
- 发布时间：2025-03-28
- 来源：小红书真实抓取

### 面试内容
百度测试开发三轮面试完整面经`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 306,
    title: '网易-游戏测试开发实习-面经',
    author: '算法小登sfxd',
    avatar: '👨‍💻',
    category: 'testdev',
    categoryName: '测试开发',
    date: '2026-02-27',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['网易', '游戏测试', '测试开发', '实习'],
    content: `## 网易-游戏测试开发实习-面经

### 基本信息
- 作者：算法小登sfxd
- 发布时间：02-27
- 来源：小红书真实抓取

### 面试内容
网易游戏测试开发实习面试经验`,
    status: 'unread',
    priority: 'medium'
  },

  // --- 移动端开发（真实抓取） ---
  {
    id: 401,
    title: '京东|移动端开发面经',
    author: '枫～',
    avatar: '👩‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2026-03-04',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['京东', '移动端开发'],
    content: `## 京东|移动端开发面经

### 基本信息
- 作者：枫～
- 发布时间：03-04
- 来源：小红书真实抓取

### 面试内容
京东移动端开发面试经验分享`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 402,
    title: '字节春招移动端 一/二面',
    author: '煎饼小狗',
    avatar: '🐶',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2025-04-08',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '移动端', '春招', '一面', '二面'],
    content: `## 字节春招移动端 一/二面

### 基本信息
- 作者：煎饼小狗
- 发布时间：2025-04-08
- 来源：小红书真实抓取

### 面试内容
字节跳动春招移动端开发一面和二面完整面经`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 403,
    title: '腾讯‖移动客户端开发面真题拆解分析',
    author: '哒哒兔求职（Offer版）',
    avatar: '🐰',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2025-08-30',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', '移动客户端', '真题'],
    content: `## 腾讯‖移动客户端开发面真题拆解分析

### 基本信息
- 作者：哒哒兔求职（Offer版）
- 发布时间：2025-08-30
- 来源：小红书真实抓取

### 面试内容
腾讯移动客户端开发面试真题详细拆解分析`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 404,
    title: '腾讯wxg移动客户端开发暑期实习面经',
    author: '早睡不了一点',
    avatar: '👨‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2025-05-29',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', 'WXG', '移动客户端', '暑期实习'],
    content: `## 腾讯wxg移动客户端开发暑期实习面经

### 基本信息
- 作者：早睡不了一点
- 发布时间：2025-05-29
- 来源：小红书真实抓取

### 面试内容
腾讯WXG移动客户端开发暑期实习面经`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 405,
    title: '美团移动端面经 已OC',
    author: '好东西',
    avatar: '👨‍💻',
    category: 'mobile',
    categoryName: '移动端开发',
    date: '2025-09-28',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '移动端', 'OC'],
    content: `## 美团移动端面经 已OC

### 基本信息
- 作者：好东西
- 发布时间：2025-09-28
- 来源：小红书真实抓取

### 面试内容
美团移动端开发面经，已获得OC`,
    status: 'unread',
    priority: 'high'
  },

  // --- 产品经理（真实抓取） ---
  {
    id: 501,
    title: '鹅厂AI产品面经复盘 ( 已offer )',
    author: '芋泥波波',
    avatar: '👩‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-03-11',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', 'AI产品', '面经复盘', '已offer'],
    content: `## 鹅厂AI产品面经复盘 ( 已offer )

### 基本信息
- 作者：芋泥波波
- 发布时间：03-11
- 来源：小红书真实抓取

### 面试内容
腾讯AI产品经理面试复盘，已获得offer`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 502,
    title: '字节产品经理一面凉经…',
    author: '马里奥（闯关版）',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2025-02-20',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['字节跳动', '产品经理', '一面', '凉经'],
    content: `## 字节产品经理一面凉经…

### 基本信息
- 作者：马里奥（闯关版）
- 发布时间：2025-02-20
- 来源：小红书真实抓取

### 面试内容
字节跳动产品经理一面失败经验分享（凉经）`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 503,
    title: '腾讯🐧CSIG产品经理（技术背景）面经（已oc）',
    author: 'Blonc',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2025-12-22',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['腾讯', 'CSIG', '产品经理', '技术背景', 'OC'],
    content: `## 腾讯🐧CSIG产品经理（技术背景）面经（已oc）

### 基本信息
- 作者：Blonc
- 发布时间：2025-12-22
- 来源：小红书真实抓取

### 面试内容
腾讯CSIG产品经理面试经验，技术背景转产品，已OC`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 504,
    title: '京东技术产品经理一面面经丨金融转互联网版',
    author: '绵绵冰',
    avatar: '👩‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2025-06-24',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['京东', '技术产品经理', '金融转互联网'],
    content: `## 京东技术产品经理一面面经丨金融转互联网版

### 基本信息
- 作者：绵绵冰
- 发布时间：2025-06-24
- 来源：小红书真实抓取

### 面试内容
京东技术产品经理一面面经，金融行业转互联网方向`,
    status: 'unread',
    priority: 'medium'
  },
  {
    id: 505,
    title: '美团产品面经 ( 已offer )',
    author: '哈喽的6次方',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-03-31',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['美团', '产品经理', '已offer'],
    content: `## 美团产品面经 ( 已offer )

### 基本信息
- 作者：哈喽的6次方
- 发布时间：03-31
- 来源：小红书真实抓取

### 面试内容
美团产品经理面试经验，已获得offer`,
    status: 'unread',
    priority: 'high'
  },
  {
    id: 506,
    title: '0产品经验｜拿下得物产品经理offer❓（附面经',
    author: 'Wave',
    avatar: '👨‍💼',
    category: 'product',
    categoryName: '产品经理',
    date: '2026-01-13',
    source: '小红书（真实抓取）',
    likes: 0,
    collects: 0,
    tags: ['得物', '产品经理', '零经验', 'offer'],
    content: `## 0产品经验｜拿下得物产品经理offer❓（附面经

### 基本信息
- 作者：Wave
- 发布时间：01-13
- 来源：小红书真实抓取

### 面试内容
零产品经验如何拿下得物产品经理offer，附完整面经`,
    status: 'unread',
    priority: 'medium'
  }
];

export default mockData;

// 分类配置
export const categories = [
  { key: 'all', label: '全部', icon: '📋', color: '#6366f1' },
  { key: 'frontend', label: '前端开发', icon: '🖥️', color: '#3b82f6' },
  { key: 'backend', label: '后端开发', icon: '⚙️', color: '#10b981' },
  { key: 'testdev', label: '测试开发', icon: '🧪', color: '#f59e0b' },
  { key: 'mobile', label: '移动端开发', icon: '📱', color: '#ef4444' },
  { key: 'product', label: '产品经理', icon: '📊', color: '#8b5cf6' }
];

// 公司列表
export const companies = ['字节跳动', '腾讯', '阿里', '美团', '快手', '网易', '百度', '京东', '拼多多'];
