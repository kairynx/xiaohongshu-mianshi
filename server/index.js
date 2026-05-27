require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3001;
const MCP_URL = process.env.MCP_URL || 'http://localhost:18060/mcp';
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../docker-data/cookies/cookies.json');

// ============ MySQL 数据库 ============
const DB_HOST = process.env.DB_HOST || 'host.docker.internal';
const DB_PORT = parseInt(process.env.DB_PORT || '3306');
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '123456';
const DB_NAME = process.env.DB_NAME || 'mianshi_app';

let dbPool;

async function initDB() {
  try {
    dbPool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4'
    });
    // 测试连接
    const conn = await dbPool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`  MySQL connected: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
  } catch (e) {
    console.log(`  ⚠️ MySQL connection failed: ${e.message}`);
    console.log(`  ⚠️ Data will NOT be persisted. Please check MySQL config.`);
    dbPool = null;
  }
}

// 数据库行 → 前端格式
function rowToPost(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    avatar: row.avatar,
    coverUrl: row.cover_url,
    category: row.category,
    categoryName: row.category_name,
    date: row.date,
    source: row.source,
    likes: row.likes,
    collects: row.collects,
    tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
    content: row.content || '',
    noteId: row.note_id,
    xsecToken: row.xsec_token,
    status: row.status,
    priority: row.priority,
  };
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../dist')));

let mcpSessionId = null;
let mcpInitialized = false;
let mcpRequestId = 0;

// 带超时的 fetch
async function fetchWithTimeout(url, options, timeout = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 发送 MCP 请求（带 id，期望返回）
async function mcpRequest(method, params = {}) {
  const id = ++mcpRequestId;
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (mcpSessionId) headers['Mcp-Session-Id'] = mcpSessionId;

  const response = await fetchWithTimeout(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id })
  }, 120000);

  const sid = response.headers.get('mcp-session-id');
  if (sid) mcpSessionId = sid;

  const ct = response.headers.get('content-type') || '';
  if (ct.includes('text/event-stream')) {
    const text = await response.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const s = line.slice(5).trim();
        if (s) {
          try {
            const d = JSON.parse(s);
            if (d.error) throw new Error(d.error.message || 'MCP error');
            return d.result;
          } catch (e) { if (e.message && !e.message.includes('JSON')) throw e; }
        }
      }
    }
    throw new Error('Empty SSE response');
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'MCP error');
  return data.result;
}

// 发送 MCP 通知（无 id）
async function mcpNotify(method, params = {}) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (mcpSessionId) headers['Mcp-Session-Id'] = mcpSessionId;
  await fetchWithTimeout(MCP_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params })
  }, 30000);
}

// 通过 GET 请求建立 SSE 连接并获取 session ID
async function establishSseSession() {
  return new Promise((resolve) => {
    const httpMod = MCP_URL.startsWith('https') ? require('https') : require('http');
    const req = httpMod.get(MCP_URL, {
      headers: { 'Accept': 'text/event-stream' },
      timeout: 10000
    }, (res) => {
      const sid = res.headers['mcp-session-id'];
      res.destroy();  // 不需要 SSE 消息体，只需要 session ID
      resolve(sid || '');
    });
    req.on('error', () => resolve(''));
    req.on('timeout', () => { req.destroy(); resolve(''); });
  });
}

// 初始化 MCP 会话（Streamable HTTP transport）
async function ensureMcpInit() {
  if (mcpInitialized) return;

  // Step 1: GET 建立 SSE 连接获取 session ID
  if (!mcpSessionId) {
    const sid = await establishSseSession();
    if (sid) {
      mcpSessionId = sid;
      console.log('  SSE session: ' + sid);
    }
  }

  // Step 2: 发送 initialize 请求
  const result = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mianshi-app', version: '1.0.0' }
  });
  console.log('  MCP initialize: ' + JSON.stringify(result?.serverInfo || result).slice(0, 100));

  // Step 3: 发送 initialized 通知
  await mcpNotify('notifications/initialized', {});
  mcpInitialized = true;
  console.log('  MCP session ready, sessionId=' + mcpSessionId);
}

// 重置会话
function resetSession() {
  mcpSessionId = null;
  mcpInitialized = false;
  console.log('  MCP session reset');
}

// 调用 MCP 工具（自动初始化 + 失败重试一次，含会话重置）
async function callMcp(name, args = {}) {
  await ensureMcpInit();
  try {
    return await mcpRequest('tools/call', { name, arguments: args });
  } catch (e) {
    // 所有错误（含超时）都重试一次，因为超时很可能是会话过期导致的
    const reason = e.name === 'AbortError' || e.message?.includes('aborted') ? 'timeout' : e.message;
    console.log(`  MCP call failed (${reason}), resetting session and retrying...`);
    resetSession();
    await ensureMcpInit();
    return await mcpRequest('tools/call', { name, arguments: args });
  }
}

// 解析 MCP content 数组
function parseContent(c) {
  if (!c) return null;
  if (Array.isArray(c)) {
    // 合并所有 text 类型的内容
    const texts = [];
    for (const item of c) {
      if (item.type === 'text') {
        try { texts.push(JSON.parse(item.text)); } catch { texts.push(item.text); }
      }
    }
    if (texts.length === 0) return null;
    if (texts.length === 1) return texts[0];
    // 多个内容块时，优先返回包含 note/data 的对象（帖子详情）
    for (const t of texts) {
      if (t && typeof t === 'object' && (t.note || t.data?.note || t.feed_id)) return t;
    }
    return texts;
  }
  return c;
}

// ============ OCR 图片识别（优化版） ============

/**
 * 下载图片并保存到临时文件
 */
async function downloadImage(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept': 'image/avif,image/webp,image/*,*/*'
    }
  }, 30000);
  if (!response.ok) throw new Error('图片下载失败: ' + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), 'ocr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  fs.writeFileSync(tmpFile, buffer);
  console.log(`    Downloaded ${(buffer.length / 1024).toFixed(0)}KB image`);
  return tmpFile;
}

// 检测可用的 ImageMagick 命令（Windows 用 magick，Linux/Mac 可能用 convert）
let imagemagickCmd = null;
try {
  execSync('magick --version', { stdio: 'ignore' });
  imagemagickCmd = 'magick';
  console.log('  ImageMagick: using "magick" command');
} catch {
  try {
    execSync('convert --version', { stdio: 'ignore' });
    imagemagickCmd = 'convert';
    console.log('  ImageMagick: using "convert" command');
  } catch {
    console.log('  ⚠️ ImageMagick not found, OCR preprocessing disabled');
  }
}

/**
 * 图片预处理：转 PNG + 放大 + 灰度 + 增强对比度 + 去噪
 * 使用 ImageMagick
 * @param {string} inputPath - 原始图片路径
 * @returns {string} 预处理后的图片路径
 */
async function preprocessImage(inputPath) {
  if (!imagemagickCmd) return inputPath;
  const outputPath = inputPath + '_processed.png';
  try {
    await new Promise((resolve, reject) => {
      execFile(imagemagickCmd, [
        inputPath,
        '-colorspace', 'Gray',
        '-normalize',
        '-resize', '2000x>',
        '-unsharp', '1.5x1+0.7+0.02',
        'PNG:' + outputPath
      ], { timeout: 30000 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    try { fs.unlinkSync(inputPath); } catch {}
    return outputPath;
  } catch (e) {
    console.log('    ImageMagick 预处理失败，使用原图:', e.message);
    return inputPath;
  }
}

/**
 * 使用 Tesseract OCR 识别图片中的文字（优化参数）
 * @param {string} imagePath - 图片文件路径
 * @returns {string} 识别出的文字
 */
function ocrImage(imagePath) {
  return new Promise((resolve) => {
    const runOcr = (psm) => new Promise((res) => {
      execFile('tesseract', [
        imagePath, 'stdout',
        '-l', 'chi_sim+eng',
        '--psm', String(psm),
        '--oem', '1',
        '-c', 'preserve_interword_spaces=1'
      ], { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) { res(''); return; }
        res((stdout || '').trim());
      });
    });

    // 判断 OCR 结果是否有效（有足够的中文内容，不是乱码）
    const isValid = (text) => {
      if (!text || text.length < 10) return false;
      const chinese = (text.match(/[一-鿿]/g) || []).length;
      const garbage = (text.match(/[^a-zA-Z0-9一-鿿　-〿＀-￯\s,.;:!?，。；：！？、（）【】《》""''\-—…·\n]/g) || []).length;
      return chinese >= 2 && garbage / text.length < 0.5;
    };

    (async () => {
      let text = await runOcr(6);  // PSM 6: 块文本，适合截图
      if (!isValid(text)) {
        console.log('    PSM 6 结果不佳，尝试 PSM 3（全自动）...');
        const text3 = await runOcr(3);  // PSM 3: 全自动页面分割
        if (isValid(text3)) text = text3;
        else if (text3.length > text.length) text = text3;  // 退而求其次，用更长的那个
      }
      try { fs.unlinkSync(imagePath); } catch {}
      resolve(isValid(text) ? text : (text.length > 10 ? text : ''));
    })();
  });
}

/**
 * OCR 后处理：清理乱码碎片
 * @param {string} text - OCR 原始输出
 * @returns {string} 清理后的文字
 */
function cleanOcrText(text) {
  if (!text) return '';
  return text
    // 去除纯乱码行（连续特殊字符占比超过 60%）
    .split('\n')
    .filter(line => {
      if (line.trim().length === 0) return false;
      const special = (line.match(/[^a-zA-Z0-9\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s,.;:!?，。；：！？、（）【】《》""''\-—…·]/g) || []).length;
      return special / line.length < 0.6;
    })
    // 合并连续空行为单个空行
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * OCR 识别单张图片 URL（完整流程：下载 → 预处理 → 识别 → 后处理）
 */
async function ocrImageUrl(url) {
  if (!url) return '';
  let tmpFile = null;
  try {
    tmpFile = await downloadImage(url);
    console.log(`    Downloaded to ${tmpFile}`);
    // 图片预处理
    tmpFile = await preprocessImage(tmpFile);
    console.log(`    Preprocessed to ${tmpFile}`);
    // OCR 识别
    const rawText = await ocrImage(tmpFile);
    console.log(`    OCR result: ${rawText ? rawText.length + ' chars' : 'empty'}`);
    // 后处理
    const cleaned = cleanOcrText(rawText);
    console.log(`    After cleaning: ${cleaned ? cleaned.length + ' chars' : 'empty'}`);
    return cleaned;
  } catch (e) {
    console.log('    OCR failed for image:', e.message);
    return '';
  } finally {
    // 确保清理临时文件
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch {}
      try { fs.unlinkSync(tmpFile + '_processed.png'); } catch {}
    }
  }
}

/**
 * OCR 识别帖子详情中的所有图片
 * @param {object} detail - 帖子详情
 * @returns {string} 所有图片的 OCR 文本合并
 */
async function ocrFeedDetail(detail) {
  const texts = [];

  // MCP 返回结构可能是 { data: { note: { imageList } } } 或 { note: { imageList } }
  const note = detail?.data?.note || detail?.note || detail;
  const images = [];
  if (note?.imageList) {
    images.push(...note.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (note?.image_list) {
    images.push(...note.image_list.map(img => img.url_default || img.url));
  }
  if (detail?.data?.imageList) {
    images.push(...detail.data.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (detail?.imageList) {
    images.push(...detail.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (detail?.images) {
    images.push(...(Array.isArray(detail.images) ? detail.images : []));
  }

  console.log(`    Found ${images.length} images for OCR`);
  // 最多处理前 3 张图片（避免太慢）
  const limit = Math.min(images.length, 3);
  for (let i = 0; i < limit; i++) {
    const url = images[i];
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;
    console.log(`    OCR image ${i + 1}/${limit}: ${url.slice(0, 60)}...`);
    const text = await ocrImageUrl(url);
    if (text) texts.push(text);
  }

  return texts.join('\n\n');
}

// ============ 输入校验 ============

const VALID_CATEGORIES = ['frontend', 'backend', 'testdev', 'mobile', 'product'];
const VALID_STATUSES = ['read', 'unread'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_CATEGORY_NAMES = ['前端开发', '后端开发', '测试开发', '移动端开发', '产品经理'];

function sanitizeString(val, maxLen = 1000) {
  if (typeof val !== 'string') return '';
  return val.slice(0, maxLen).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function sanitizePost(post) {
  if (!post || typeof post !== 'object') return null;
  return {
    id: typeof post.id === 'string' ? post.id.slice(0, 64) : crypto.randomUUID(),
    title: sanitizeString(post.title, 500),
    author: sanitizeString(post.author, 100),
    avatar: sanitizeString(post.avatar, 500),
    coverUrl: sanitizeString(post.coverUrl, 500),
    category: VALID_CATEGORIES.includes(post.category) ? post.category : 'frontend',
    categoryName: VALID_CATEGORY_NAMES.includes(post.categoryName) ? post.categoryName : '前端开发',
    date: /^\d{4}-\d{2}-\d{2}/.test(post.date) ? post.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    source: sanitizeString(post.source, 200),
    likes: Math.min(Math.max(parseInt(post.likes) || 0, 0), 999999999),
    collects: Math.min(Math.max(parseInt(post.collects) || 0, 0), 999999999),
    tags: Array.isArray(post.tags) ? post.tags.map(t => sanitizeString(String(t), 50)).slice(0, 20) : [],
    content: sanitizeString(post.content, 100000),
    noteId: post.noteId || post.note_id || '',
    xsecToken: post.xsecToken || post.xsec_token || '',
    status: VALID_STATUSES.includes(post.status) ? post.status : 'unread',
    priority: VALID_PRIORITIES.includes(post.priority) ? post.priority : 'medium',
  };
}

// ============ API 路由 ============

// 获取所有帖子（从数据库）
app.get('/api/posts', async (req, res) => {
  try {
    if (!dbPool) return res.json({ success: true, data: [] });
    const [rows] = await dbPool.query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json({ success: true, data: rows.map(rowToPost) });
  } catch (e) {
    console.log('  DB query error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 批量保存帖子（去重：按 note_id 或 id）
app.post('/api/posts', async (req, res) => {
  try {
    if (!dbPool) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const posts = req.body;
    if (!Array.isArray(posts)) return res.status(400).json({ success: false, error: 'expected array' });
    if (posts.length > 500) return res.status(400).json({ success: false, error: 'too many posts (max 500)' });

    let saved = 0;
    for (const rawPost of posts) {
      const post = sanitizePost(rawPost);
      if (!post) continue;
      const id = post.id;
      const noteId = post.noteId;
      // 按 note_id 去重（小红书帖子），如果 note_id 为空则按 id 去重
      const [existing] = noteId
        ? await dbPool.query('SELECT id FROM posts WHERE note_id = ?', [noteId])
        : await dbPool.query('SELECT id FROM posts WHERE id = ?', [id]);

      if (existing.length > 0) {
        // 已存在则更新
        await dbPool.query(
          `UPDATE posts SET title=?, author=?, avatar=?, cover_url=?, category=?, category_name=?,
           date=?, source=?, likes=?, collects=?, tags=?, content=?, status=?, priority=?
           WHERE id=?`,
          [post.title, post.author, post.avatar, post.coverUrl,
           post.category, post.categoryName,
           post.date, post.source, post.likes, post.collects,
           JSON.stringify(post.tags), post.content,
           post.status, post.priority, existing[0].id]
        );
        saved++;
      } else {
        // 不存在则插入
        await dbPool.query(
          `INSERT INTO posts (id, title, author, avatar, cover_url, category, category_name,
           date, source, likes, collects, tags, content, note_id, xsec_token, status, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, post.title, post.author, post.avatar, post.coverUrl,
           post.category, post.categoryName,
           post.date, post.source, post.likes, post.collects,
           JSON.stringify(post.tags), post.content,
           noteId, post.xsecToken,
           post.status, post.priority]
        );
        saved++;
      }
    }
    console.log(`  Saved ${saved}/${posts.length} posts to DB`);
    res.json({ success: true, data: { saved, total: posts.length } });
  } catch (e) {
    console.log('  DB save error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除帖子
app.delete('/api/posts/:id', async (req, res) => {
  try {
    if (!dbPool) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const id = sanitizeString(req.params.id, 64);
    if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
    await dbPool.query('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新帖子状态/优先级
app.put('/api/posts/:id', async (req, res) => {
  try {
    if (!dbPool) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const id = sanitizeString(req.params.id, 64);
    if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
    const { status, priority } = req.body;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'invalid status' });
      await dbPool.query('UPDATE posts SET status = ? WHERE id = ?', [status, id]);
    }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ success: false, error: 'invalid priority' });
      await dbPool.query('UPDATE posts SET priority = ? WHERE id = ?', [priority, id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', mcpUrl: MCP_URL, time: new Date().toISOString() }));

app.get('/api/mcp/status', async (req, res) => {
  try {
    const r = await callMcp('check_login_status');
    const parsed = parseContent(r?.content);
    res.json({ connected: true, data: parsed });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

app.get('/api/mcp/login/qrcode', async (req, res) => {
  try {
    const r = await callMcp('get_login_qrcode');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/mcp/login/qrcode/img', async (req, res) => {
  try {
    const r = await callMcp('get_login_qrcode');
    const c = r?.content;
    if (Array.isArray(c)) {
      for (const i of c) {
        if (i.type === 'image') {
          res.type('image/png');
          return res.send(Buffer.from(i.data, 'base64'));
        }
      }
    }
    res.status(404).send('No QR image');
  } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/mcp/login/check', async (req, res) => {
  try {
    const r = await callMcp('check_login_status');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ============ MCP 搜索（每次强制新建会话避免超时） ============

app.get('/api/mcp/search', async (req, res) => {
  try {
    const keyword = sanitizeString(req.query.keyword || '', 200);
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });

    // 每次搜索前强制重新初始化 MCP 会话（避免旧会话超时）
    resetSession();

    console.log('  MCP Searching: ' + keyword);
    const r = await callMcp('search_feeds', { keyword });
    const raw = parseContent(r?.content);

    let feeds = [];
    if (raw && typeof raw === 'object' && raw.feeds) {
      feeds = raw.feeds.filter(f => f.modelType === 'note').map(f => ({
        id: f.id,
        title: f.noteCard?.displayTitle || '',
        nickname: f.noteCard?.user?.nickname || '',
        avatar: f.noteCard?.user?.avatar || '',
        likedCount: f.noteCard?.interactInfo?.likedCount || '0',
        collectedCount: f.noteCard?.interactInfo?.collectedCount || '0',
        xsecToken: f.xsecToken || '',
        coverUrl: f.noteCard?.cover?.urlDefault || '',
      }));
    }
    console.log('  Found ' + feeds.length + ' notes for: ' + keyword);
    res.json({ success: true, data: { feeds, count: feeds.length }, keyword });
  } catch (e) {
    console.log('  Search error: ' + e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/mcp/feed/:feedId', async (req, res) => {
  try {
    const feedId = sanitizeString(req.params.feedId, 64);
    const xsec_token = sanitizeString(req.query.xsec_token || '', 200);
    if (!feedId || !xsec_token) return res.status(400).json({ success: false, error: 'feedId and xsec_token required' });
    const r = await callMcp('get_feed_detail', { feed_id: feedId, xsec_token });
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 批量获取帖子详情（带限流 + OCR + 会话恢复）
app.post('/api/mcp/feed/batch', async (req, res) => {
  try {
    const { feeds, ocr = true } = req.body;
    if (!feeds || !Array.isArray(feeds)) return res.status(400).json({ success: false, error: 'invalid feeds' });
    if (feeds.length > 20) return res.status(400).json({ success: false, error: 'too many feeds (max 20)' });

    const results = [];
    const limit = Math.min(feeds.length, 10);

    // 强制新建会话，避免旧会话超时导致整批失败
    resetSession();
    console.log(`  Batch: fresh session for ${limit} feeds`);

    for (let i = 0; i < limit; i++) {
      const feed = feeds[i];
      if (!feed.id) continue;

      // 没有 xsecToken 的 feed 无法获取详情，直接用搜索数据
      if (!feed.xsecToken) {
        console.log(`  Skipping detail for ${feed.id}: no xsecToken, using search data`);
        results.push({
          ...feed,
          detail: null,
          content: feed.title || '',
          time: feed.time || new Date().toISOString().slice(0, 10),
        });
        continue;
      }

      let detail = null;
      let fetchError = null;

      // 每个 feed 最多尝试 2 次（首次 + 1 次重试，含会话重置）
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          console.log(`  Fetching detail ${i + 1}/${limit}: ${feed.id}${attempt > 0 ? ' (retry)' : ''}`);
          const r = await callMcp('get_feed_detail', { feed_id: feed.id, xsec_token: feed.xsecToken });
          detail = parseContent(r?.content);
          fetchError = null;
          break;
        } catch (e) {
          fetchError = e;
          if (attempt === 0) {
            console.log(`    Feed ${feed.id} attempt 1 failed: ${e.message}, resetting session...`);
            resetSession();
          }
        }
      }

      if (fetchError || !detail) {
        console.log(`  Detail fetch failed for ${feed.id}: ${fetchError?.message || 'empty response'}`);
        results.push({ ...feed, detail: null, content: '（帖子详情获取失败，可能是反爬限制，建议稍后重试）' });
        // 失败后也做会话重置，避免下一个 feed 受影响
        resetSession();
        continue;
      }

      // 提取文字描述
      const note = detail?.data?.note || detail?.note || detail;
      const noteType = note?.type || '';
      let content = note?.desc || note?.description || note?.title || detail?.desc || detail?.title || '';
      const imageCount = note?.imageList?.length || note?.image_list?.length || 0;
      const hasVideo = !!(note?.video || detail?.data?.video);

      // 诊断：当 note 存在但内容为空时，打印详细结构
      if (note && !content && imageCount === 0 && !hasVideo) {
        console.log(`    ⚠️ note 存在但内容为空！note keys: ${JSON.stringify(Object.keys(note))}`);
        if (detail?.data) console.log(`    detail.data keys: ${JSON.stringify(Object.keys(detail.data))}`);
        if (Array.isArray(detail)) console.log(`    detail 是数组！长度: ${detail.length}`);
        console.log(`    note.type: "${noteType}", note.title: "${(note?.title || '').slice(0, 30)}"`);
        if (note.desc) { content = note.desc; console.log(`    → 从 note.desc 提取到内容`); }
        if (note.description) { content = note.description; console.log(`    → 从 note.description 提取到内容`); }
        if (note.title) { content = note.title; console.log(`    → 从 note.title 提取到内容`); }
      }

      console.log(`    note: ${!!note}, type: ${noteType}, desc: ${content ? content.slice(0, 30) + '...' : '空'}, images: ${imageCount}, video: ${hasVideo}`);

      // 视频类帖子没有图片，跳过 OCR
      if (noteType === 'video' || hasVideo) {
        console.log(`    ⏭️ 视频帖子，跳过 OCR`);
        content = content || '（此帖子为视频类型，暂不支持视频内容提取）';
      } else if (ocr) {
        console.log(`    Running OCR on images...`);
        const ocrText = await ocrFeedDetail(detail);
        if (ocrText) {
          content = content ? content + '\n\n--- 图片内容 ---\n' + ocrText : ocrText;
        }
      }

      results.push({
        ...feed,
        detail: detail,
        content: content || '（此帖子为纯图片内容，OCR 未能识别出文字，建议在小红书 App 内查看原文）',
        time: note?.time || detail?.time || feed.time,
      });

      // 限流：每次请求间隔 2 秒，避免被小红书封
      if (i < limit - 1) await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`  Batch detail done: ${results.length}/${limit}`);
    res.json({ success: true, data: results, total: results.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/api/mcp/feeds', async (req, res) => {
  try {
    const r = await callMcp('list_feeds');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/api/crawl/convert', (req, res) => {
  const { results, category, keyword } = req.body;
  if (!results || !Array.isArray(results)) return res.status(400).json({ success: false, error: 'invalid results' });
  if (results.length > 200) return res.status(400).json({ success: false, error: 'too many results (max 200)' });

  const kw = {
    frontend: ['前端', 'fe', 'react', 'vue', 'javascript', 'css', 'html', 'web'],
    backend: ['后端', 'java', 'go', 'python', 'c++', '服务端', '后台', 'golang'],
    testdev: ['测试', '测开', 'qa', '自动化测试', 'selenium', '性能测试'],
    mobile: ['移动端', 'ios', 'android', 'flutter', 'react native', 'app', '客户端'],
    product: ['产品', 'pm', '产品经理', '产品设计', '用户研究']
  };
  const cn = { frontend: '前端开发', backend: '后端开发', testdev: '测试开发', mobile: '移动端开发', product: '产品经理' };
  const det = (t) => {
    // 优先用搜索关键词分类
    if (keyword) {
      const x = keyword.toLowerCase();
      for (const [c, ks] of Object.entries(kw)) { if (ks.some(k => x.includes(k))) return c; }
    }
    if (category) return category;
    // 其次用标题分类
    const x = t.toLowerCase();
    for (const [c, ks] of Object.entries(kw)) { if (ks.some(k => x.includes(k))) return c; }
    return 'frontend';
  };

  const out = results.map((item, i) => {
    const title = item.title || item.displayTitle || '未知标题';
    const author = item.nickname || item.author || '未知作者';
    const cat = det(title);
    return {
      id: crypto.randomUUID(), title, author,
      avatar: (item.avatar && item.avatar.startsWith('http')) ? item.avatar : ['👨‍💻', '👩‍💻', '👨‍💼', '👩‍💼'][i % 4],
      coverUrl: item.coverUrl || '',
      category: cat, categoryName: cn[cat] || '前端开发',
      date: item.time || item.create_time || new Date().toISOString().slice(0, 10),
      source: '小红书（MCP抓取）',
      likes: parseInt(item.likedCount || item.liked_count || '0'),
      collects: parseInt(item.collectedCount || item.collected_count || '0'),
      tags: Array.isArray(item.tag_list) ? item.tag_list : Array.isArray(item.tags) ? item.tags : [],
      content: item.desc || item.content || '',
      noteId: item.note_id || item.id || '',
      xsecToken: item.xsecToken || item.xsec_token || '',
      status: 'unread', priority: 'medium'
    };
  });
  res.json({ success: true, data: out, total: out.length });
});

// SPA 回退（必须在最后）
app.use((req, res) => res.sendFile(path.join(__dirname, '../dist/index.html')));

app.listen(PORT, async () => {
  console.log('Server running on port ' + PORT + ', MCP: ' + MCP_URL);
  await initDB();
});
