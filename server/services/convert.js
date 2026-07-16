const crypto = require('crypto');

function convertFeeds(results, category, keyword) {
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
  return out;
}

module.exports = { convertFeeds };
