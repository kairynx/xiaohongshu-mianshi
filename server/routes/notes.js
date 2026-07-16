const express = require('express');
const router = express.Router();
const { getNote, listNotesByUser, upsertNote, deleteNote } = require('../services/db');

function getUserId(req) {
  const userId = String(req.header('X-User-Id') || req.query.userId || '').trim();
  if (!userId || userId.length < 2 || userId.length > 64) return null;
  return userId;
}

function getPostId(req) {
  const postId = String(req.params.postId || '').trim();
  if (!postId || postId.length < 2 || postId.length > 64) return null;
  return postId;
}

router.get('/', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'invalid userId' });
    const starredOnly = req.query.starred === 'true' ? true : req.query.starred === 'false' ? false : undefined;
    const limit = req.query.limit !== undefined ? parseInt(req.query.limit, 10) : undefined;
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset, 10) : undefined;
    const notes = await listNotesByUser(userId, { starredOnly, limit, offset });
    res.json({ success: true, data: notes });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:postId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const postId = getPostId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'invalid userId' });
    if (!postId) return res.status(400).json({ success: false, error: 'invalid postId' });
    const note = await getNote(userId, postId);
    res.json({ success: true, data: note });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:postId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const postId = getPostId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'invalid userId' });
    if (!postId) return res.status(400).json({ success: false, error: 'invalid postId' });

    const patch = {};
    let hasField = false;

    if (Object.prototype.hasOwnProperty.call(req.body, 'content')) {
      if (typeof req.body.content !== 'string') return res.status(400).json({ success: false, error: 'content must be string' });
      patch.content = req.body.content;
      hasField = true;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'tags')) {
      if (!Array.isArray(req.body.tags)) return res.status(400).json({ success: false, error: 'tags must be array' });
      patch.tags = req.body.tags;
      hasField = true;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'starred')) {
      if (typeof req.body.starred !== 'boolean') return res.status(400).json({ success: false, error: 'starred must be boolean' });
      patch.starred = req.body.starred;
      hasField = true;
    }

    if (!hasField) return res.status(400).json({ success: false, error: 'at least one field required' });
    const note = await upsertNote(userId, postId, patch);
    res.json({ success: true, data: note });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/:postId', async (req, res) => {
  try {
    const userId = getUserId(req);
    const postId = getPostId(req);
    if (!userId) return res.status(400).json({ success: false, error: 'invalid userId' });
    if (!postId) return res.status(400).json({ success: false, error: 'invalid postId' });
    const deleted = await deleteNote(userId, postId);
    res.json({ success: true, data: deleted });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
