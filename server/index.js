/**
 * 面经助手 - 后端代理服务
 * 
 * 作为前端和 xiaohongshu-mcp 服务之间的桥梁
 * 将 MCP 协议调用封装为简单的 REST API
 * 
 * 使用前需要先启动 xiaohongshu-mcp 服务：
 *   ./xiaohongshu-mcp-darwin-arm64
 *   或 docker compose up -d
 * 
 * MCP 服务默认运行在 http://localhost:18060/mcp
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// MCP 服务地址（可通过环境变量配置）
const MCP_URL = process.env.MCP_URL || 'http://localhost:18060/mcp';

app.use(cors());
app.use(express.json());

// 让前端静态文件也能通过后端服务访问（可选）
app.use(express.static(path.join(__dirname, '../dist')));

// ============ MCP 协议通信层 ============

let mcpRequestId = 0;

/**
 * 调用 MCP 服务的通用方法
 * @param {string} toolName - MCP 工具名称
 * @param {object} args - 工具参数
 * @returns {object} MCP 返回结果
 */
async function callMcpTool(toolName, args = {}) {
  const id = ++mcpRequestId;
  
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id
    })
  });

  if (!response.ok) {
    throw new Error(`MCP 服务请求失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`MCP 错误: ${data.error.message}`);
  }

  return data.result;
}

/**
 * 解析 MCP 返回的文本内容
 */
function parseMcpContent(content) {
  if (!content) return null;
  if (Array.isArray(content)) {
    // MCP 返回的是 content 数组
    for (const item of content) {
      if (item.type === 'text') {
        try {
          return JSON.parse(item.text);
        } catch {
          return item.text;
        }
      }
    }
  }
  return content;
}

// ============ API 路由 ============

/**
 * 健康检查
 */
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mcpUrl: MCP_URL,
    time: new Date().toISOString() 
  });
});

/**
 * 检查 MCP 服务状态
 */
app.get('/api/mcp/status', async (req, res) => {
  try {
    const result = await callMcpTool('check_login_status');
    res.json({ 
      connected: true, 
      data: parseMcpContent(result?.content) 
    });
  } catch (err) {
    res.json({ 
      connected: false, 
      error: err.message,
      hint: '请确保 xiaohongshu-mcp 服务已启动 (http://localhost:18060/mcp)'
    });
  }
});

/**
 * 获取登录二维码
 */
app.get('/api/mcp/login/qrcode', async (req, res) => {
  try {
    const result = await callMcpTool('get_login_qrcode');
    res.json({ success: true, data: parseMcpContent(result?.content) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 检查登录状态
 */
app.get('/api/mcp/login/check', async (req, res) => {
  try {
    const result = await callMcpTool('check_login_status');
    res.json({ success: true, data: parseMcpContent(result?.content) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🔥 搜索小红书内容（核心接口）
 * 
 * GET /api/mcp/search?keyword=前端面经&sort_by=最新&publish_time=一周内
 */
app.get('/api/mcp/search', async (req, res) => {
  try {
    const { keyword, sort_by, note_type, publish_time, search_scope } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ success: false, error: '请提供搜索关键词 keyword' });
    }

    const args = { keyword };
    
    // 可选筛选参数
    if (sort_by) args.filters = { sort_by };
    if (note_type) args.filters = { ...args.filters, note_type };
    if (publish_time) args.filters = { ...args.filters, publish_time };
    if (search_scope) args.filters = { ...args.filters, search_scope };

    const result = await callMcpTool('search_feeds', args);
    const data = parseMcpContent(result?.content);
    
    res.json({ success: true, data, keyword });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🔥 获取帖子详情（核心接口）
 * 
 * GET /api/mcp/feed/:feedId?xsec_token=xxx
 */
app.get('/api/mcp/feed/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;
    const { xsec_token, load_all_comments } = req.query;

    if (!xsec_token) {
      return res.status(400).json({ success: false, error: '请提供 xsec_token 参数' });
    }

    const args = { feed_id: feedId, xsec_token };
    if (load_all_comments === 'true') args.load_all_comments = true;

    const result = await callMcpTool('get_feed_detail', args);
    const data = parseMcpContent(result?.content);
    
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 获取推荐列表
 */
app.get('/api/mcp/feeds', async (req, res) => {
  try {
    const result = await callMcpTool('list_feeds');
    const data = parseMcpContent(result?.content);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 获取用户主页
 */
app.get('/api/mcp/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { xsec_token } = req.query;

    if (!xsec_token) {
      return res.status(400).json({ success: false, error: '请提供 xsec_token 参数' });
    }

    const result = await callMcpTool('user_profile', { user_id: userId, xsec_token });
    const data = parseMcpContent(result?.content);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============ 数据转换层 ============

/**
 * 将 MCP 搜索结果转换为面经助手的数据格式
 * 
 * POST /api/crawl/convert
 * Body: { results: [...MCP搜索结果], category: 'frontend' }
 */
app.post('/api/crawl/convert', (req, res) => {
  const { results, category } = req.body;
  
  if (!results || !Array.isArray(results)) {
    return res.status(400).json({ success: false, error: '请提供有效的搜索结果' });
  }

  // 分类关键词映射
  const categoryKeywords = {
    frontend: ['前端', 'fe', 'react', 'vue', 'javascript', 'css', 'html', 'web'],
    backend: ['后端', 'java', 'go', 'python', 'c++', '服务端', '后台', 'golang'],
    testdev: ['测试', '测开', 'qa', '自动化测试', 'selenium', '性能测试'],
    mobile: ['移动端', 'ios', 'android', 'flutter', 'react native', 'app', '客户端'],
    product: ['产品', 'pm', '产品经理', '产品设计', '用户研究']
  };

  const categoryNames = {
    frontend: '前端开发',
    backend: '后端开发',
    testdev: '测试开发',
    mobile: '移动端开发',
    product: '产品经理'
  };

  // 自动检测分类
  function detectCategory(title, tags) {
    if (category) return category;
    const text = (title + ' ' + (tags || '')).toLowerCase();
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => text.includes(kw))) return cat;
    }
    return 'frontend'; // 默认
  }

  const converted = results.map((item, index) => {
    const cat = detectCategory(item.title || item.note_title || '', item.tag_list || item.tags || '');
    return {
      id: Date.now() + index,
      title: item.title || item.note_title || '未知标题',
      author: item.nickname || item.author || '未知作者',
      avatar: ['👨‍💻', '👩‍💻', '👨‍💼', '👩‍💼'][Math.floor(Math.random() * 4)],
      category: cat,
      categoryName: categoryNames[cat] || '前端开发',
      date: item.time || item.create_time || new Date().toISOString().slice(0, 10),
      source: '小红书（MCP抓取）',
      likes: parseInt(item.liked_count || item.interact_info?.liked_count || '0'),
      collects: parseInt(item.collected_count || item.interact_info?.collected_count || '0'),
      tags: Array.isArray(item.tag_list) ? item.tag_list : 
            Array.isArray(item.tags) ? item.tags : [],
      content: item.desc || item.content || '',
      noteId: item.note_id || item.id || '',
      xsecToken: item.xsec_token || item.xsec_source || '',
      status: 'unread',
      priority: 'medium'
    };
  });

  res.json({ success: true, data: converted, total: converted.length });
});

// ============ SPA 路由回退 ============
// 所有非 API 请求都返回 index.html，支持前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============ 启动服务 ============

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║     📕 面经助手 - 后端代理服务已启动           ║
╠══════════════════════════════════════════════╣
║  后端地址: http://localhost:${PORT}              ║
║  MCP地址:  ${MCP_URL.padEnd(29)}║
╠══════════════════════════════════════════════╣
║  API 接口:                                     ║
║  GET  /api/mcp/status        - MCP服务状态     ║
║  GET  /api/mcp/login/check   - 检查登录         ║
║  GET  /api/mcp/login/qrcode  - 获取登录二维码   ║
║  GET  /api/mcp/search        - 搜索小红书       ║
║  GET  /api/mcp/feed/:id      - 获取帖子详情     ║
║  GET  /api/mcp/feeds         - 推荐列表         ║
║  POST /api/crawl/convert     - 数据格式转换     ║
╚══════════════════════════════════════════════╝
  `);
});
