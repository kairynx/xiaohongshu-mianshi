import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CATEGORY_BG_COLORS, CATEGORY_COLORS } from '../constants';
import { Globe, Search, RefreshCw, CheckCircle, AlertCircle, Loader, Wifi, WifiOff, Link, ExternalLink } from 'lucide-react';
import './CrawlPage.css';

// 统一使用相对路径，Docker 和本地开发都通过同一端口访问
const API_BASE = '/api';

const SEARCH_KEYWORDS = [
  '互联网面经 前端',
  '互联网面经 后端',
  '互联网面经 测试开发',
  '互联网面经 移动端',
  '互联网面经 产品经理',
  '字节跳动 面经',
  '腾讯 面经',
  '阿里 面经',
  '美团 面经',
];

export default function CrawlPage() {
  const { addPosts, posts } = useApp();
  const [mode, setMode] = useState('mcp'); // 'mcp' | 'simulate'
  const [mcpStatus, setMcpStatus] = useState('checking'); // checking, connected, disconnected
  const [loginStatus, setLoginStatus] = useState(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [selectedKeywords, setSelectedKeywords] = useState(() => {
    const saved = localStorage.getItem('crawl_keywords');
    return saved ? JSON.parse(saved) : SEARCH_KEYWORDS.slice(0, 5);
  });
  // 自定义关键词单独存储，取消勾选不会丢失
  const [customKeywords, setCustomKeywords] = useState(() => {
    const saved = localStorage.getItem('crawl_custom_keywords');
    return saved ? JSON.parse(saved) : [];
  });
  const [customKeyword, setCustomKeyword] = useState('');
  const [crawlLog, setCrawlLog] = useState([]);
  const [crawlResults, setCrawlResults] = useState([]);
  const [sortBy, setSortBy] = useState('综合');

  const addLog = (message, type = 'info') => {
    setCrawlLog(prev => [...prev, { time: new Date().toLocaleTimeString(), message, type }]);
  };

  // 检查 MCP 服务状态
  useEffect(() => {
    checkMcpStatus();
  }, []);

  const checkMcpStatus = async () => {
    setMcpStatus('checking');
    try {
      const res = await fetch(`${API_BASE}/mcp/status`);
      const data = await res.json();
      if (data.connected) {
        setMcpStatus('connected');
        setLoginStatus(data.data);
        addLog('✅ MCP 服务已连接', 'success');
      } else {
        setMcpStatus('disconnected');
        addLog(`❌ MCP 服务未连接: ${data.error || '未知错误'}`, 'error');
      }
    } catch {
      setMcpStatus('disconnected');
      addLog('❌ 无法连接到后端服务，请确保已启动: node server/index.js', 'error');
    }
  };

  // 检查登录状态
  const handleCheckLogin = async () => {
    try {
      addLog('🔍 正在检查小红书登录状态...', 'info');
      const res = await fetch(`${API_BASE}/mcp/login/check`);
      const data = await res.json();
      if (data.success) {
        setLoginStatus(data.data);
        addLog(`✅ 登录状态: ${JSON.stringify(data.data)}`, 'success');
      } else {
        addLog(`❌ 检查登录失败: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`❌ 请求失败: ${err.message}`, 'error');
    }
  };

  // MCP 真实抓取
  const mcpCrawl = async () => {
    if (selectedKeywords.length === 0) {
      addLog('请至少选择一个搜索关键词', 'error');
      return;
    }

    setIsCrawling(true);
    setCrawlLog([]);
    setCrawlResults([]);

    addLog('🚀 开始通过 MCP 服务抓取小红书面经...', 'info');
    addLog(`📋 已选择 ${selectedKeywords.length} 个关键词`, 'info');
    addLog(`📊 排序方式: ${sortBy}`, 'info');

    let allResults = [];

    for (let i = 0; i < selectedKeywords.length; i++) {
      const keyword = selectedKeywords[i];
      addLog(`🔍 正在搜索: "${keyword}"...`, 'info');

      try {
        const res = await fetch(`${API_BASE}/mcp/search?keyword=${encodeURIComponent(keyword)}`, { signal: AbortSignal.timeout(300000) });
        const data = await res.json();

        if (data.success && data.data) {
          const items = Array.isArray(data.data) ? data.data : (data.data.feeds || data.data.notes || data.data.items || []);
          addLog(`✅ "${keyword}" 找到 ${items.length} 条结果`, 'success');
          allResults = [...allResults, ...items];
        } else {
          addLog(`⚠️ "${keyword}" 未找到结果: ${data.error || '空数据'}`, 'error');
        }
      } catch (err) {
        addLog(`❌ "${keyword}" 搜索失败: ${err.message}`, 'error');
      }
    }

    // 转换数据格式
    if (allResults.length > 0) {
      // 先获取帖子详情（面试内容）
      addLog(`📖 正在获取 ${Math.min(allResults.length, 10)} 篇帖子详情（含图片OCR识别，每篇约10秒）...`, 'info');
      try {
        const batchRes = await fetch(`${API_BASE}/mcp/feed/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feeds: allResults })
        });
        const batchData = await batchRes.json();
        if (batchData.success && batchData.data.length > 0) {
          allResults = batchData.data;
          addLog(`✅ 成功获取 ${batchData.total} 篇帖子详情`, 'success');
        } else {
          addLog(`⚠️ 部分详情获取失败，使用列表数据`, 'error');
        }
      } catch (err) {
        addLog(`⚠️ 详情获取失败: ${err.message}，使用列表数据`, 'error');
      }

      // 再转换数据格式
      addLog('🔄 正在转换数据格式...', 'info');
      try {
        const convertRes = await fetch(`${API_BASE}/crawl/convert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results: allResults, keyword: selectedKeywords.join(' ') })
        });
        const convertData = await convertRes.json();

        if (convertData.success) {
          setCrawlResults(convertData.data);
          addLog(`🎉 数据转换完成！共 ${convertData.total} 条面经`, 'success');
        }
      } catch (err) {
        addLog(`⚠️ 数据转换失败: ${err.message}`, 'error');
        addLog('📋 使用原始数据格式', 'info');
      }
    }

    addLog(`📊 抓取完成！共获取 ${allResults.length} 条原始数据`, 'success');
    setIsCrawling(false);
  };

  // 模拟抓取（离线模式）
  const simulateCrawl = async () => {
    if (selectedKeywords.length === 0) {
      addLog('请至少选择一个搜索关键词', 'error');
      return;
    }

    setIsCrawling(true);
    setCrawlLog([]);
    setCrawlResults([]);

    addLog('🚀 开始模拟抓取（离线模式）...', 'info');
    addLog(`📋 已选择 ${selectedKeywords.length} 个关键词`, 'info');

    const categoryMap = { '前端': 'frontend', '后端': 'backend', '测试': 'testdev', '移动': 'mobile', '产品': 'product' };
    const categoryNames = { frontend: '前端开发', backend: '后端开发', testdev: '测试开发', mobile: '移动端开发', product: '产品经理' };

    for (let i = 0; i < selectedKeywords.length; i++) {
      const keyword = selectedKeywords[i];
      addLog(`🔍 正在搜索: "${keyword}"...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

      let detectedCategory = 'frontend';
      for (const [key, value] of Object.entries(categoryMap)) {
        if (keyword.includes(key)) { detectedCategory = value; break; }
      }

      const newPostCount = Math.floor(Math.random() * 3) + 1;
      addLog(`✅ "${keyword}" 找到 ${newPostCount} 条新面经`, 'success');

      for (let j = 0; j < newPostCount; j++) {
        const newPost = {
          id: Date.now() + i * 100 + j,
          title: `${keyword} - 模拟面经 #${posts.length + crawlResults.length + j + 1}`,
          author: `用户${Math.floor(Math.random() * 9000) + 1000}`,
          avatar: ['👨‍💻', '👩‍💻', '👨‍💼', '👩‍💼'][Math.floor(Math.random() * 4)],
          category: detectedCategory,
          categoryName: categoryNames[detectedCategory],
          date: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000).toISOString().slice(0, 10),
          source: '小红书（模拟）',
          likes: Math.floor(Math.random() * 5000) + 100,
          collects: Math.floor(Math.random() * 3000) + 50,
          tags: keyword.split(' ').filter(Boolean),
          content: `## ${keyword} 面经\n\n### 基本信息\n- 来源：小红书\n- 关键词：${keyword}\n- 抓取时间：${new Date().toLocaleString()}\n\n### 面试内容\n\n这是一条通过关键词"${keyword}"模拟抓取的面经内容。\n\n**技术面试：**\n- 项目经验相关提问\n- 基础知识考察\n- 算法编程题\n\n**HR面试：**\n- 自我介绍\n- 职业规划\n- 薪资期望`,
          status: 'unread',
          priority: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)]
        };
        setCrawlResults(prev => [...prev, newPost]);
      }
    }

    addLog(`🎉 模拟抓取完成！`, 'success');
    setIsCrawling(false);
  };

  const handleKeywordToggle = (keyword) => {
    setSelectedKeywords(prev => {
      const next = prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword];
      localStorage.setItem('crawl_keywords', JSON.stringify(next));
      return next;
    });
  };

  const handleAddCustomKeyword = () => {
    const kw = customKeyword.trim();
    if (kw && !customKeywords.includes(kw)) {
      setCustomKeywords(prev => {
        const next = [...prev, kw];
        localStorage.setItem('crawl_custom_keywords', JSON.stringify(next));
        return next;
      });
      // 添加时自动勾选
      setSelectedKeywords(prev => {
        const next = [...prev, kw];
        localStorage.setItem('crawl_keywords', JSON.stringify(next));
        return next;
      });
      setCustomKeyword('');
    }
  };

  const handleSaveResults = () => {
    if (crawlResults.length > 0) {
      addPosts(crawlResults);
      addLog(`💾 已保存 ${crawlResults.length} 条面经到数据库`, 'success');
      setCrawlResults([]);
    }
  };

  const startCrawl = mode === 'mcp' ? mcpCrawl : simulateCrawl;

  return (
    <div className="crawl-page">
      <div className="page-header">
        <h1>🌐 数据抓取</h1>
        <p className="page-desc">通过 xiaohongshu-mcp 服务抓取最新的互联网行业面经数据</p>
      </div>

      {/* MCP 服务状态卡片 */}
      <div className="crawl-section mcp-status-card">
        <div className="mcp-status-header">
          <h3 className="section-title">
            {mcpStatus === 'connected' ? <Wifi size={18} color="#10b981" /> : <WifiOff size={18} color="#ef4444" />}
            MCP 服务状态
          </h3>
          <div className="status-badges">
            <span className={`status-badge ${mcpStatus}`}>
              {mcpStatus === 'checking' ? '检测中...' : mcpStatus === 'connected' ? '已连接' : '未连接'}
            </span>
            <button className="refresh-btn" onClick={checkMcpStatus}>
              <RefreshCw size={14} />
              重新检测
            </button>
          </div>
        </div>

        {mcpStatus === 'connected' && (
          <div className="mcp-actions">
            <button className="mcp-action-btn" onClick={handleCheckLogin}>
              🔑 检查登录状态
            </button>
            {loginStatus && (
              <span className="login-info">
                {loginStatus.logged_in !== false ? '✅ 已登录' : '⚠️ 未登录，请先登录小红书'}
              </span>
            )}
          </div>
        )}

        {mcpStatus === 'disconnected' && (
          <div className="mcp-help">
            <p><strong>如何连接 MCP 服务？</strong></p>
            <ol>
              <li>安装并启动 <a href="https://github.com/xpzouying/xiaohongshu-mcp" target="_blank" rel="noreferrer">xiaohongshu-mcp</a> 服务</li>
              <li>运行登录工具完成小红书登录</li>
              <li>启动后端代理: <code>node server/index.js</code></li>
              <li>点击"重新检测"按钮</li>
            </ol>
            <p className="fallback-hint">
              如果暂时无法连接 MCP 服务，可以切换到<strong>模拟模式</strong>体验抓取流程。
            </p>
          </div>
        )}
      </div>

      {/* 模式切换 */}
      <div className="mode-switch">
        <button
          className={`mode-btn ${mode === 'mcp' ? 'active' : ''}`}
          onClick={() => setMode('mcp')}
          disabled={mcpStatus !== 'connected'}
        >
          🔗 MCP 真实抓取
        </button>
        <button
          className={`mode-btn ${mode === 'simulate' ? 'active' : ''}`}
          onClick={() => setMode('simulate')}
        >
          🎮 模拟抓取
        </button>
      </div>

      {/* 搜索设置 */}
      <div className="crawl-section">
        <h3 className="section-title">
          <Search size={18} />
          搜索关键词
        </h3>
        <p className="section-desc">选择要抓取的面经关键词{mode === 'mcp' ? '，将通过 MCP 服务真实搜索小红书' : ''}</p>

        {mode === 'mcp' && (
          <div className="sort-options">
            <label>排序方式：</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="综合">综合</option>
              <option value="最新">最新</option>
              <option value="最多点赞">最多点赞</option>
              <option value="最多收藏">最多收藏</option>
              <option value="最多评论">最多评论</option>
            </select>
            <label className="filter-label">时间范围：一周内</label>
          </div>
        )}

        <div className="keywords-grid">
          {[...SEARCH_KEYWORDS, ...customKeywords.filter(k => !SEARCH_KEYWORDS.includes(k))].map(keyword => {
            const isCustom = customKeywords.includes(keyword) && !SEARCH_KEYWORDS.includes(keyword);
            return (
              <button
                key={keyword}
                className={`keyword-chip ${selectedKeywords.includes(keyword) ? 'selected' : ''}`}
                onClick={() => handleKeywordToggle(keyword)}
              >
                {keyword}
                {selectedKeywords.includes(keyword) && <span className="check">✓</span>}
                {isCustom && (
                  <span
                    className="remove-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCustomKeywords(prev => {
                        const next = prev.filter(k => k !== keyword);
                        localStorage.setItem('crawl_custom_keywords', JSON.stringify(next));
                        return next;
                      });
                      setSelectedKeywords(prev => {
                        const next = prev.filter(k => k !== keyword);
                        localStorage.setItem('crawl_keywords', JSON.stringify(next));
                        return next;
                      });
                    }}
                    title="删除此关键词"
                  >×</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="custom-keyword">
          <input
            type="text"
            placeholder="添加自定义关键词..."
            value={customKeyword}
            onChange={(e) => setCustomKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustomKeyword()}
          />
          <button onClick={handleAddCustomKeyword}>添加</button>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="crawl-actions">
        <button
          className={`crawl-btn ${isCrawling ? 'crawling' : ''}`}
          onClick={startCrawl}
          disabled={isCrawling || (mode === 'mcp' && mcpStatus !== 'connected')}
        >
          {isCrawling ? (
            <><Loader size={18} className="spin" /> 正在抓取中...</>
          ) : (
            <><Globe size={18} /> {mode === 'mcp' ? 'MCP 真实抓取' : '模拟抓取'}</>
          )}
        </button>

        {crawlResults.length > 0 && (
          <button className="save-btn" onClick={handleSaveResults}>
            <CheckCircle size={18} />
            保存结果 ({crawlResults.length} 条)
          </button>
        )}
      </div>

      {/* 抓取日志 */}
      <div className="crawl-section">
        <h3 className="section-title">
          <RefreshCw size={18} />
          抓取日志
        </h3>
        <div className="crawl-log">
          {crawlLog.length === 0 ? (
            <div className="log-empty">
              <Globe size={32} />
              <p>选择关键词后点击"开始抓取"</p>
            </div>
          ) : (
            crawlLog.map((log, i) => (
              <div key={i} className={`log-item ${log.type}`}>
                <span className="log-time">{log.time}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 抓取结果预览 */}
      {crawlResults.length > 0 && (
        <div className="crawl-section">
          <h3 className="section-title">
            <CheckCircle size={18} />
            抓取结果预览 ({crawlResults.length} 条)
          </h3>
          <div className="results-preview">
            {crawlResults.map(post => (
              <div key={post.id} className="result-item">
                <span className="result-category" style={{
                  background: CATEGORY_BG_COLORS[post.category],
                  color: CATEGORY_COLORS[post.category]
                }}>
                  {post.categoryName}
                </span>
                <span className="result-title">{post.title}</span>
                <span className="result-meta">❤️ {post.likes} | ⭐ {post.collects}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="crawl-notice">
        <AlertCircle size={16} />
        <p>
          <strong>架构说明：</strong>
          本项目通过 <a href="https://github.com/xpzouying/xiaohongshu-mcp" target="_blank" rel="noreferrer">xiaohongshu-mcp</a> 服务连接小红书。
          后端代理层（server/index.js）将 MCP 协议封装为 REST API，前端通过 HTTP 请求获取数据。
          所有数据仅用于个人学习参考。
        </p>
      </div>
    </div>
  );
}
