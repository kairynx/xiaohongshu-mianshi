const express = require('express');
const router = express.Router();
const { rowToPost, getPool } = require('../services/db');
const { sanitizePost, sanitizeString, VALID_STATUSES, VALID_PRIORITIES } = require('../services/validation');

// 获取所有帖子（从数据库）
router.get('/', async (req, res) => {
  try {
    if (!getPool()) return res.json({ success: true, data: [] });
    const [rows] = await getPool().query('SELECT * FROM posts ORDER BY created_at DESC');
    res.json({ success: true, data: rows.map(rowToPost) });
  } catch (e) {
    console.log('  DB query error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 批量保存帖子（去重：按 note_id 或 id）
router.post('/', async (req, res) => {
  try {
    if (!getPool()) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const posts = req.body;
    if (!Array.isArray(posts)) return res.status(400).json({ success: false, error: 'expected array' });
    if (posts.length > 500) return res.status(400).json({ success: false, error: 'too many posts (max 500)' });

    const conn = await getPool().getConnection();
    let saved = 0;
    try {
      await conn.beginTransaction();
      for (const rawPost of posts) {
        const post = sanitizePost(rawPost);
        if (!post) continue;
        const id = post.id;
        const noteId = post.noteId;
        const [existing] = noteId
          ? await conn.query('SELECT id FROM posts WHERE note_id = ?', [noteId])
          : await conn.query('SELECT id FROM posts WHERE id = ?', [id]);

        if (existing.length > 0) {
          await conn.query(
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
          await conn.query(
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
      await conn.commit();
      console.log(`  Saved ${saved}/${posts.length} posts to DB`);
      res.json({ success: true, data: { saved, total: posts.length } });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.log('  DB save error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// 删除帖子
router.delete('/:id', async (req, res) => {
  try {
    if (!getPool()) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const id = sanitizeString(req.params.id, 64);
    if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
    await getPool().query('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 更新帖子状态/优先级
router.put('/:id', async (req, res) => {
  try {
    if (!getPool()) return res.status(503).json({ success: false, error: 'MySQL not connected' });
    const id = sanitizeString(req.params.id, 64);
    if (!id) return res.status(400).json({ success: false, error: 'invalid id' });
    const { status, priority } = req.body;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'invalid status' });
      await getPool().query('UPDATE posts SET status = ? WHERE id = ?', [status, id]);
    }
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) return res.status(400).json({ success: false, error: 'invalid priority' });
      await getPool().query('UPDATE posts SET priority = ? WHERE id = ?', [priority, id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
