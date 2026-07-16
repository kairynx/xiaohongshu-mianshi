require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./services/db');

const app = express();
const PORT = 3001;
const MCP_URL = process.env.MCP_URL || 'http://localhost:18060/mcp';
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../docker-data/cookies/cookies.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
// 请求日志：打印所有 /api 请求
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`→ ${req.method} ${req.path}`);
  }
  next();
});
app.use(express.static(path.join(__dirname, '../dist')));

// ============ API 路由 ============

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/mcp', require('./routes/mcp'));
app.use('/api/crawl', require('./routes/crawl'));
app.use('/api/agent', require('./routes/agent'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/qa', require('./routes/qa'));

// SPA 回退（必须在最后）
app.use((req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));

app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT + ', MCP: ' + MCP_URL);
  await initDB();
});
