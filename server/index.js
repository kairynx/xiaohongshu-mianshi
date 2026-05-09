require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { execFile } = require('child_process');
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

// 初始化 MCP 会话
async function ensureMcpInit() {
  if (mcpInitialized) return;
  await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mianshi-app', version: '1.0.0' }
  });
  await mcpNotify('notifications/initialized', {});
  mcpInitialized = true;
  console.log('  MCP session initialized, sessionId=' + mcpSessionId);
}

// 重置会话
function resetSession() {
  mcpSessionId = null;
  mcpInitialized = false;
  console.log('  MCP session reset');
}

// 调用 MCP 工具（自动初始化 + 仅对非超时错误重试）
async function callMcp(name, args = {}) {
  await ensureMcpInit();
  try {
    return await mcpRequest('tools/call', { name, arguments: args });
  } catch (e) {
    // 超时不重试（重试只会更慢）
    if (e.name === 'AbortError' || e.message?.includes('aborted')) {
      throw new Error('MCP 请求超时（超过300秒），请减少搜索关键词或稍后重试');
    }
    // 其他错误（如会话过期）重试一次
    console.log('  MCP call failed (' + e.message + '), resetting session and retrying...');
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
  const response = await fetchWithTimeout(url, {}, 30000);
  if (!response.ok) throw new Error('图片下载失败: ' + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), 'ocr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  fs.writeFileSync(tmpFile, buffer);
  return tmpFile;
}

/**
 * 图片预处理：转 PNG + 放大 + 灰度 + 增强对比度 + 去噪
 * 使用 ImageMagick (convert 命令)
 * @param {string} inputPath - 原始图片路径
 * @returns {string} 预处理后的图片路径
 */
async function preprocessImage(inputPath) {
  const outputPath = inputPath + '_processed.png';
  try {
    await new Promise((resolve, reject) => {
      execFile('convert', [
        inputPath,
        '-resize', '2000x>',
        '-contrast-stretch', '3%x10%',
        '-unsharp', '1x1+0.5+0',
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
    // 先尝试 PSM 6（块文本），失败再尝试 PSM 3（全自动）和 PSM 4（单列）
    const tryPsm = async (psmModes) => {
      for (const psm of psmModes) {
        try {
          const result = await new Promise((res, rej) => {
            execFile('tesseract', [
              imagePath, 'stdout',
              '-l', 'chi_sim+eng',
              '--psm', String(psm),
              '--oem', '1',           // LSTM 引擎（最准确）
              '-c', 'preserve_interword_spaces=1',  // 保留词间空格
              '--dpi', '300'          // 告诉 tesseract 图片 DPI
            ], {
              timeout: 60000,
              maxBuffer: 10 * 1024 * 1024
            }, (error, stdout, stderr) => {
              if (error) rej(error);
              else res(stdout.trim());
            });
          });
          if (result && result.length > 10) return result;
        } catch {}
      }
      return '';
    };

    tryPsm([6, 3, 4]).then(text => {
      // 清理临时文件
      try { fs.unlinkSync(imagePath); } catch {}
      resolve(text);
    }).catch(() => {
      try { fs.unlinkSync(imagePath); } catch {}
      resolve('');
    });
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
    // 图片预处理
    tmpFile = await preprocessImage(tmpFile);
    // OCR 识别
    const rawText = await ocrImage(tmpFile);
    // 后处理
    return cleanOcrText(rawText);
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
  // 最多处理前 5 张图片（避免太慢）
  const limit = Math.min(images.length, 5);
  for (let i = 0; i < limit; i++) {
    const url = images[i];
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;
    console.log(`    OCR image ${i + 1}/${limit}: ${url.slice(0, 60)}...`);
    const text = await ocrImageUrl(url);
    if (text) texts.push(text);
  }

  return texts.join('\n\n');
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

    let saved = 0;
    for (const post of posts) {
      const id = post.id || crypto.randomUUID();
      const noteId = post.noteId || post.note_id || '';
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
          [post.title || '', post.author || '', post.avatar || '', post.coverUrl || '',
           post.category || 'frontend', post.categoryName || '前端开发',
           post.date || '', post.source || '', post.likes || 0, post.collects || 0,
           JSON.stringify(post.tags || []), post.content || '',
           post.status || 'unread', post.priority || 'medium', existing[0].id]
        );
        saved++;
      } else {
        // 不存在则插入
        await dbPool.query(
          `INSERT INTO posts (id, title, author, avatar, cover_url, category, category_name,
           date, source, likes, collects, tags, content, note_id, xsec_token, status, priority)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, post.title || '', post.author || '', post.avatar || '', post.coverUrl || '',
           post.category || 'frontend', post.categoryName || '前端开发',
           post.date || '', post.source || '', post.likes || 0, post.collects || 0,
           JSON.stringify(post.tags || []), post.content || '',
           noteId, post.xsecToken || post.xsec_token || '',
           post.status || 'unread', post.priority || 'medium']
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
    await dbPool.query('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新帖子状态/优先级
app.put('/api/posts/:id', async (req, res) => {
  try {
    if (!dbPool) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const { status, priority } = req.body;
    if (status !== undefined) {
      await dbPool.query('UPDATE posts SET status = ? WHERE id = ?', [status, req.params.id]);
    }
    if (priority !== undefined) {
      await dbPool.query('UPDATE posts SET priority = ? WHERE id = ?', [priority, req.params.id]);
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
    const { keyword } = req.query;
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
    const { feedId } = req.params;
    const { xsec_token } = req.query;
    if (!xsec_token) return res.status(400).json({ success: false, error: 'xsec_token required' });
    const r = await callMcp('get_feed_detail', { feed_id: feedId, xsec_token });
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 批量获取帖子详情（带限流 + OCR）
app.post('/api/mcp/feed/batch', async (req, res) => {
  try {
    const { feeds, ocr = true } = req.body; // [{id, xsecToken}, ...]
    if (!feeds || !Array.isArray(feeds)) return res.status(400).json({ success: false, error: 'invalid feeds' });

    const results = [];
    const limit = Math.min(feeds.length, 10); // 最多获取前10篇详情，避免太慢

    for (let i = 0; i < limit; i++) {
      const feed = feeds[i];
      if (!feed.id || !feed.xsecToken) continue;
      try {
        console.log(`  Fetching detail ${i + 1}/${limit}: ${feed.id}`);
        const r = await callMcp('get_feed_detail', { feed_id: feed.id, xsec_token: feed.xsecToken });
        const detail = parseContent(r?.content);

        // 提取文字描述（MCP 返回可能是 { data: { note: { desc } } } 或 { note: { desc } }）
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
          // 尝试从其他字段提取
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
          content: content,
          time: note?.time || detail?.time || feed.time,
        });
        // 限流：每次请求间隔 2 秒，避免被小红书封
        if (i < limit - 1) await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.log(`  Detail fetch failed for ${feed.id}: ${e.message}`);
        results.push({ ...feed, detail: null, content: '' });
      }
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
