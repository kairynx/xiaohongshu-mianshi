const crypto = require('crypto');

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
    noteId: post.noteId || post.note_id || null,
    xsecToken: post.xsecToken || post.xsec_token || '',
    status: VALID_STATUSES.includes(post.status) ? post.status : 'unread',
    priority: VALID_PRIORITIES.includes(post.priority) ? post.priority : 'medium',
  };
}

module.exports = { VALID_CATEGORIES, VALID_STATUSES, VALID_PRIORITIES, VALID_CATEGORY_NAMES, sanitizeString, sanitizePost };
