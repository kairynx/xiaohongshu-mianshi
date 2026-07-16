# AGENTS.md

# AI 面经助手开发规范（Project Rules）

## 项目定位

本项目不是一个小红书爬虫。

本项目定位为：

> 基于 MCP + LLM Agent Workflow 的 AI 面经整理平台。

目标：

将原有的 MCP 抓取 + OCR + MySQL 工具，
逐步升级为具备 Agent、Workflow、任务调度、多轮检索能力的 AI Native 产品。

所有开发都必须围绕这个目标。

---

# 当前技术栈

Frontend

- React 19
- Vite
- React Router
- Context API
- Recharts

Backend

- Express
- MySQL
- Docker

AI

- MCP
- JSON-RPC
- OCR
- LLM

Deployment

- Docker Compose
- Vercel（Frontend）
- Linux Server（Backend）

---

# 开发原则

## 1.

不要删除已有功能。

所有已有功能必须保持可运行。

包括：

- MCP 搜索
- OCR
- 数据入库
- 前端管理页面
- Dashboard

旧功能优先保证兼容。

---

## 2.

不要大规模重构。

禁止：

- 推倒重写
- 修改整个目录结构
- 一次修改多个核心模块

优先：

新增模块。

---

## 3.

保持向后兼容。

所有已有 API：

/api/posts

/api/mcp/*

必须继续可用。

新增功能统一：

/api/agent/*

---

## 4.

Agent 负责决策。

MCP 负责抓取。

OCR 负责识别。

Database 负责存储。

不要混合职责。

---

## 5.

Workflow 只负责流程编排。

不要在 Workflow 内写：

- OCR逻辑
- MCP逻辑
- SQL逻辑

统一调用 Tool。

---

## 6.

所有能力封装为 Tool。

例如：

agent/tools/

mcp.tool.js

ocr.tool.js

posts.tool.js

convert.tool.js

Workflow 永远调用 Tool。

不要直接调用底层。

---

## 7.

Prompt 必须独立管理。

统一放：

prompts/

不要把 Prompt 写进 JS 文件。

---

## 8.

状态机统一管理。

任务状态：

Pending

Planning

Searching

OCR

Cleaning

Summarizing

Saving

Completed

Failed

Cancelled

不要使用字符串硬编码。

统一定义。

---

## 9.

每个任务必须支持：

- Retry
- Cancel
- Resume

失败不能导致整个 Workflow 崩溃。

---

## 10.

所有新增模块必须输出日志。

至少包括：

JobID

Step

Duration

Retry

Error

方便调试。

---

# 编码规范

优先：

小文件。

每个文件：

建议

<300 行。

避免：

1000 行以上。

---

函数：

一个函数：

只做一件事。

---

不要复制代码。

公共能力：

抽成：

services/

tools/

utils/

---

新增目录

agent/

workflow/

prompts/

services/

routes/

docs/

---

# 数据流

正确的数据流：

User

↓

Agent

↓

Planner

↓

Scheduler

↓

Workflow

↓

Tool

↓

MCP

↓

OCR

↓

Database

不要绕过 Workflow。

---

# Git Commit

提交格式：

feat(agent):

feat(workflow):

feat(prompt):

refactor(server):

docs:

fix:

不要使用：

update

modify

test

---

# 开发流程

每次开发：

第一步：

分析。

第二步：

输出方案。

等待确认。

第三步：

开始写代码。

不要直接修改项目。

---

每次完成：

必须输出：

## 修改文件

## 新增文件

## 删除文件

## 数据流变化

## 测试方式

## 风险

---

# 文档

每完成一个 Milestone：

同步更新：

docs/architecture.md

如果数据流变化：

同步更新 Mermaid。

---

# 禁止事项

不要：

删除已有接口。

不要：

修改已有数据库字段含义。

不要：

修改已有 JSON 数据结构。

不要：

修改已有 MCP 通信协议。

不要：

修改已有 OCR 逻辑。

不要：

一次生成几千行代码。

不要：

在未分析项目情况下直接编码。

---

# AI 工作方式

你现在不是代码生成器。

你是本项目的 Senior Software Engineer。

你的职责：

分析

设计

实现

测试

文档

而不是一次性生成大量代码。

如果发现需求存在风险。

请先提出方案。

等待确认。

不要擅自实现。

---

# 项目目标

最终项目需要满足：

✅ 可部署

✅ 可开源

✅ 可长期维护

✅ 可扩展

✅ 可用于简历展示

而不是一个 Demo。

所有代码请以真实生产项目标准完成。