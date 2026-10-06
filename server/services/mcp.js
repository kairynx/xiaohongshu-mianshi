const MCP_URL = process.env.MCP_URL || 'http://localhost:18060/mcp';

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

function resolveTimeout(method, params = {}, timeoutMs) {
  if (typeof timeoutMs === 'number' && timeoutMs > 0) return timeoutMs;
  if (method === 'initialize') return 20000;
  if (method === 'notifications/initialized') return 15000;
  if (method === 'tools/call') {
    if (params?.name === 'search_feeds') return 45000;
    if (params?.name === 'get_feed_detail') return 60000;
    return 60000;
  }
  return 60000;
}

// 发起 MCP 请求（带 id，期望返回）
async function mcpRequest(method, params = {}, timeoutMs) {
  const id = ++mcpRequestId;
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (mcpSessionId) headers['Mcp-Session-Id'] = mcpSessionId;

  const response = await fetchWithTimeout(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id })
  }, resolveTimeout(method, params, timeoutMs));

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

// 发起 MCP 通知（无 id）
async function mcpNotify(method, params = {}, timeoutMs) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' };
  if (mcpSessionId) headers['Mcp-Session-Id'] = mcpSessionId;
  await fetchWithTimeout(MCP_URL, {
    method: 'POST', headers,
    body: JSON.stringify({ jsonrpc: '2.0', method, params })
  }, resolveTimeout(method, params, timeoutMs));
}

// 初始化 MCP 会话（HTTP transport，不需要 SSE GET）
async function ensureMcpInit() {
  if (mcpInitialized) return;

  console.log('  Initializing MCP session...');
  const result = await mcpRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'mianshi-app', version: '1.0.0' }
  });
  console.log('  MCP initialize: ' + JSON.stringify(result?.serverInfo || result).slice(0, 100));

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
async function callMcp(name, args = {}, timeoutMs) {
  await ensureMcpInit();
  try {
    return await mcpRequest('tools/call', { name, arguments: args }, timeoutMs);
  } catch (e) {
    const reason = e.name === 'AbortError' || e.message?.includes('aborted') ? 'timeout' : e.message;
    console.log(`  MCP call failed (${reason}), resetting session and retrying...`);
    resetSession();
    await ensureMcpInit();
    return await mcpRequest('tools/call', { name, arguments: args }, timeoutMs);
  }
}

// 解析 MCP content 数组
function parseContent(c) {
  if (!c) return null;
  if (Array.isArray(c)) {
    const texts = [];
    for (const item of c) {
      if (item.type === 'text') {
        try { texts.push(JSON.parse(item.text)); } catch { texts.push(item.text); }
      }
    }
    if (texts.length === 0) return null;
    if (texts.length === 1) return texts[0];
    for (const t of texts) {
      if (t && typeof t === 'object' && (t.note || t.data?.note || t.feed_id)) return t;
    }
    return texts;
  }
  return c;
}

// 随机延迟，模仿人为操作，降低封号风险（默认 3-12 秒）
function humanDelay(minSec = 3, maxSec = 12) {
  const sec = minSec + Math.random() * (maxSec - minSec);
  console.log(`  [throttle] 随机延迟 ${sec.toFixed(1)}s（模仿人为操作）`);
  return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

module.exports = { callMcp, parseContent, resetSession, humanDelay };
