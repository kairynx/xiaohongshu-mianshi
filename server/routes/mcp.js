const express = require('express');
const router = express.Router();
const { callMcp, parseContent, resetSession, humanDelay } = require('../services/mcp');
const { ocrFeedDetail } = require('../services/ocr');
const { sanitizeString } = require('../services/validation');
const { getQuota, isOverLimit, addFetched, DAILY_LIMIT } = require('../services/quotaTracker');

router.get('/status', async (req, res) => {
  try {
    const r = await callMcp('check_login_status');
    const parsed = parseContent(r?.content);
    res.json({ connected: true, data: parsed });
  } catch (e) {
    res.json({ connected: false, error: e.message });
  }
});

router.get('/login/qrcode', async (req, res) => {
  try {
    const r = await callMcp('get_login_qrcode');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/login/qrcode/img', async (req, res) => {
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

router.get('/login/check', async (req, res) => {
  try {
    const r = await callMcp('check_login_status');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/quota', (req, res) => {
  res.json({ success: true, data: getQuota() });
});

// ============ MCP 搜索（减少会话重置，降低封号风险） ============

router.get('/search', async (req, res) => {
  try {
    const keyword = sanitizeString(req.query.keyword || '', 200);
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });

    // 不再每次搜索前强制重置会话，只在失败时重试
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

router.get('/feed/:feedId', async (req, res) => {
  try {
    const feedId = sanitizeString(req.params.feedId, 64);
    const xsec_token = sanitizeString(req.query.xsec_token || '', 200);
    if (!feedId || !xsec_token) return res.status(400).json({ success: false, error: 'feedId and xsec_token required' });
    const r = await callMcp('get_feed_detail', { feed_id: feedId, xsec_token });
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// 批量获取帖子详情（带限流 + OCR + 会话恢复 + 日配额）
router.post('/feed/batch', async (req, res) => {
  try {
    const { feeds, ocr = true } = req.body;
    if (!feeds || !Array.isArray(feeds)) return res.status(400).json({ success: false, error: 'invalid feeds' });
    if (feeds.length > 20) return res.status(400).json({ success: false, error: 'too many feeds (max 20)' });

    const results = [];
    const limit = Math.min(feeds.length, 10);

    // 日配额提醒（软限制，不阻断）
    if (isOverLimit()) {
      console.log(`  ⚠️ 今日已抓取超过建议量 ${DAILY_LIMIT} 条，注意封号风险`);
    }
    console.log(`  Batch: ${limit} feeds (quota: ${getQuota().used}/${DAILY_LIMIT})`);

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

      // 提取文字描述——兼容多种 MCP 响应结构
      const note = detail?.data?.note || detail?.note || detail;
      const noteType = note?.type || '';

      let content = note?.desc || note?.description || note?.title || '';

      // 如果直接字段为空，尝试从子对象/字符串元素中提取
      if (!content && note && typeof note === 'object') {
        const values = Array.isArray(note) ? note : Object.values(note);
        // 1) 先找有内容字段的子对象
        for (const item of values) {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            content = item.desc || item.description || item.title || item.text || '';
            if (content) break;
          }
        }
        // 2) 兜底：全是短字符串（MCP 把文字拆成了单字），拼接起来
        if (!content) {
          const strings = values.filter(v => typeof v === 'string');
          if (strings.length > 10) {
            content = strings.join('');
            console.log(`    → 拼接 ${strings.length} 个字符串片段，结果 ${content.length} 字`);
          }
        }
      }
      if (!content) {
        content = detail?.desc || detail?.title || '';
      }

      const imageCount = note?.imageList?.length || note?.image_list?.length || 0;
      const hasVideo = !!(note?.video || detail?.data?.video);

      // 诊断
      if (!content && imageCount === 0 && !hasVideo && note) {
        const keys = Object.keys(note);
        const numericKeys = keys.filter(k => /^\d+$/.test(k));
        console.log(`    ⚠️ content empty! total keys:${keys.length}, numeric:${numericKeys.length}, named:${keys.filter(k => !/^\d+$/.test(k)).join(',')}`);
        if (numericKeys.length > 0) {
          const firstVal = note[numericKeys[0]];
          console.log(`    note[0] type: ${typeof firstVal}, sample: ${JSON.stringify(firstVal).slice(0, 200)}`);
        }
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

      addFetched(1);

      // 限流：随机间隔 3-12 秒，模仿人为操作，降低封号风险
      if (i < limit - 1) await humanDelay();
    }

    const quota = getQuota();
    console.log(`  Batch detail done: ${results.length}/${limit} (quota: ${quota.used}/${DAILY_LIMIT})`);
    res.json({ success: true, data: results, total: results.length, quota });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/feeds', async (req, res) => {
  try {
    const r = await callMcp('list_feeds');
    res.json({ success: true, data: parseContent(r?.content) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
