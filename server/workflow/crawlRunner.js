const { callMcp, parseContent, resetSession } = require('../services/mcp');
const { ocrFeedDetail } = require('../services/ocr');
const { sanitizePost } = require('../services/validation');
const { getPool, saveOrUpdatePost } = require('../services/db');
const { updateJob, addStep } = require('../services/jobStore');
const { randomUUID } = require('crypto');

const KW_MAP = {
  frontend: ['前端', 'fe', 'react', 'vue', 'javascript', 'css', 'html', 'web'],
  backend: ['后端', 'java', 'go', 'python', 'c++', '服务端', '后台', 'golang'],
  testdev: ['测试', '测开', 'qa', '自动化测试', 'selenium', '性能测试'],
  mobile: ['移动端', 'ios', 'android', 'flutter', 'react native', 'app', '客户端'],
  product: ['产品', 'pm', '产品经理', '产品设计', '用户研究'],
};
const CAT_NAME = { frontend: '前端开发', backend: '后端开发', testdev: '测试开发', mobile: '移动端开发', product: '产品经理' };

function detectCategory(keyword) {
  const x = String(keyword || '').toLowerCase();
  for (const [cat, keys] of Object.entries(KW_MAP)) {
    if (keys.some(k => x.includes(k))) return cat;
  }
  return 'frontend';
}

async function savePosts(posts) {
  const pool = getPool();
  if (!pool) return { saved: 0, insertedIds: [] };
  const conn = await pool.getConnection();
  const insertedIds = [];
  let saved = 0;
  try {
    await conn.beginTransaction();
    for (const rawPost of posts) {
      const post = sanitizePost(rawPost);
      if (!post) continue;
      const result = await saveOrUpdatePost(conn, post);
      if (result.isNew) insertedIds.push(result.id);
      saved++;
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return { saved, insertedIds };
}

function createStepLogger(onStep) {
  return (step, message, error = false) => {
    if (typeof onStep === 'function') onStep(step, message, error);
  };
}

async function crawlKeywords(keywords, options = {}) {
  const onStep = createStepLogger(options.onStep);
  const allowSaveError = options.allowSaveError === true;

  let allFeeds = [];

  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    onStep('search', `搜索「${keyword}」(${i + 1}/${keywords.length})`);
    try {
      resetSession();
      const r = await callMcp('search_feeds', { keyword });
      const raw = parseContent(r?.content);
      const feeds = (raw?.feeds || [])
        .filter(f => f.modelType === 'note')
        .map(f => ({
          id: f.id,
          title: f.noteCard?.displayTitle || '',
          nickname: f.noteCard?.user?.nickname || '',
          avatar: f.noteCard?.user?.avatar || '',
          likedCount: f.noteCard?.interactInfo?.likedCount || '0',
          collectedCount: f.noteCard?.interactInfo?.collectedCount || '0',
          xsecToken: f.xsecToken || '',
          coverUrl: f.noteCard?.cover?.urlDefault || '',
          keyword,
        }));
      onStep('search', `「${keyword}」找到 ${feeds.length} 条`);
      allFeeds = [...allFeeds, ...feeds];
    } catch (e) {
      onStep('search', `「${keyword}」搜索失败: ${e.message}`, true);
    }
  }

  const seen = new Set();
  allFeeds = allFeeds.filter(f => {
    if (!f.id || seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  onStep('dedupe', `去重后 ${allFeeds.length} 条`);

  if (allFeeds.length === 0) {
    return { saved: 0, total: 0, posts: [], detailResults: [], allFeeds: [], insertedIds: [] };
  }

  const limit = Math.min(allFeeds.length, 10);
  onStep('batch', `获取详情，共 ${limit} 条`);
  const detailResults = [];
  resetSession();

  for (let i = 0; i < limit; i++) {
    const feed = allFeeds[i];
    onStep('batch', `详情 ${i + 1}/${limit}: ${feed.title?.slice(0, 20) || feed.id}`);
    try {
      if (!feed.xsecToken) {
        detailResults.push({ ...feed, detail: null, content: feed.title || '' });
        continue;
      }
      let detail = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await callMcp('get_feed_detail', { feed_id: feed.id, xsec_token: feed.xsecToken });
          detail = parseContent(r?.content);
          break;
        } catch (e) {
          if (attempt === 0) resetSession();
          else throw e;
        }
      }
      const note = detail?.data?.note || detail?.note || detail;
      const noteType = note?.type || '';
      let content = note?.desc || note?.description || note?.title || '';
      const hasVideo = !!(note?.video || detail?.data?.video);

      if (!hasVideo && detail) {
        const ocrText = await ocrFeedDetail(detail);
        if (ocrText) content = content ? content + '\n\n--- 图片内容 ---\n' + ocrText : ocrText;
      }

      detailResults.push({
        ...feed,
        detail,
        content: content || '（纯图片内容，OCR 未能识别）',
        time: note?.time || feed.time,
        noteType,
      });
    } catch (e) {
      onStep('batch', `${feed.id} 失败: ${e.message}`, true);
      detailResults.push({ ...feed, detail: null, content: '（详情获取失败）' });
      resetSession();
    }

    if (i < limit - 1) await new Promise(r => setTimeout(r, 2000));
  }

  onStep('save', `转换并入库 ${detailResults.length} 条`);
  const posts = detailResults.map(item => {
    const cat = detectCategory(item.keyword || item.title || '');
    return {
      id: randomUUID(),
      title: item.title || '未知标题',
      author: item.nickname || '未知作者',
      avatar: (item.avatar && item.avatar.startsWith('http')) ? item.avatar : '👤',
      coverUrl: item.coverUrl || '',
      category: cat,
      categoryName: CAT_NAME[cat] || '前端开发',
      date: item.time || new Date().toISOString().slice(0, 10),
      source: '小红书（Agent抓取）',
      likes: parseInt(item.likedCount || '0'),
      collects: parseInt(item.collectedCount || '0'),
      tags: [],
      content: item.content || '',
      noteId: item.id || '',
      xsecToken: item.xsecToken || '',
      status: 'unread',
      priority: 'medium',
    };
  });

  let saved = 0;
  let insertedIds = [];
  try {
    const result = await savePosts(posts);
    saved = result.saved;
    insertedIds = result.insertedIds;
    onStep('save', `入库完成，保存 ${saved} 条`);
  } catch (e) {
    onStep('save', `入库失败: ${e.message}`, true);
    if (!allowSaveError) throw e;
  }

  return { saved, total: posts.length, posts, detailResults, allFeeds, insertedIds };
}

async function runJob(jobId, keywords) {
  updateJob(jobId, { status: 'running' });
  try {
    const result = await crawlKeywords(keywords, {
      onStep: (step, message, error) => addStep(jobId, { step, message, error }),
    });
    updateJob(jobId, { status: 'done', result: { saved: result.saved, total: result.total } });
  } catch (e) {
    updateJob(jobId, { status: 'failed', error: e.message });
  }
}

module.exports = { runJob, crawlKeywords };
