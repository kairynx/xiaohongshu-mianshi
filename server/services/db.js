const mysql = require('mysql2/promise');

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
    const conn = await dbPool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`  MySQL connected: ${DB_HOST}:${DB_PORT}/${DB_NAME}`);
    await ensureMetaColumn();
    await ensureNotesTable();
    await ensurePracticesTable();
  } catch (e) {
    console.log(`  MySQL connection failed: ${e.message}`);
    console.log('  Data will NOT be persisted. Please check MySQL config.');
    dbPool = null;
  }
}

async function ensureMetaColumn() {
  if (!dbPool) return;
  try {
    const [rows] = await dbPool.query("SHOW COLUMNS FROM posts LIKE 'meta'");
    if (rows.length > 0) {
      console.log('  meta column already exists');
    } else {
      await dbPool.query('ALTER TABLE posts ADD COLUMN meta JSON NULL');
      console.log('  meta column ready');
    }
    await ensureRelevanceColumn();
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('  meta column already exists');
      return;
    }
    console.warn(`  meta column migration skipped: ${e.message}`);
  }
}

async function ensureRelevanceColumn() {
  if (!dbPool) return;
  try {
    const [rows] = await dbPool.query("SHOW COLUMNS FROM posts LIKE 'relevance'");
    if (rows.length > 0) {
      console.log('  relevance column already exists');
      return;
    }
    await dbPool.query('ALTER TABLE posts ADD COLUMN relevance FLOAT NULL DEFAULT NULL');
    console.log('  relevance column ready');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('  relevance column already exists');
      return;
    }
    console.warn(`  relevance column migration skipped: ${e.message}`);
  }
}

async function ensureNotesTable() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        post_id VARCHAR(64) NOT NULL,
        content TEXT,
        tags JSON,
        starred BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_user_post_unique (user_id, post_id),
        INDEX idx_user_id (user_id),
        INDEX idx_post_id (post_id),
        CONSTRAINT fk_notes_post_id FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  notes table ready');
  } catch (e) {
    console.warn(`  notes table migration skipped: ${e.message}`);
  }
}

async function ensurePracticesTable() {
  if (!dbPool) return;
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS practices (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        question TEXT,
        user_answer TEXT,
        reference_answer TEXT,
        topic VARCHAR(64),
        difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
        scoring_criteria JSON,
        grade JSON,
        source_post_ids JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_practices_user (user_id),
        INDEX idx_practices_topic (topic),
        INDEX idx_practices_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('  practices table ready');
  } catch (e) {
    console.warn(`  practices table migration skipped: ${e.message}`);
  }
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function normalizePostRow(post) {
  return {
    id: post.id,
    title: post.title,
    author: post.author,
    avatar: post.avatar,
    coverUrl: post.coverUrl,
    category: post.category,
    categoryName: post.categoryName,
    date: post.date,
    source: post.source,
    likes: post.likes,
    collects: post.collects,
    tags: JSON.stringify(post.tags || []),
    content: post.content || '',
    noteId: post.noteId || '',
    xsecToken: post.xsecToken || '',
    status: post.status || 'unread',
    priority: post.priority || 'medium',
    meta: post.meta ? JSON.stringify(post.meta) : null,
  };
}

async function saveOrUpdatePost(conn, post) {
  const noteId = post.noteId;
  const [existing] = noteId
    ? await conn.query('SELECT id FROM posts WHERE note_id = ?', [noteId])
    : await conn.query('SELECT id FROM posts WHERE id = ?', [post.id]);

  const normalized = normalizePostRow(post);

  if (existing.length > 0) {
    await conn.query(
      `UPDATE posts SET title=?, author=?, avatar=?, cover_url=?, category=?, category_name=?,
       date=?, source=?, likes=?, collects=?, tags=?, content=?, status=?, priority=?, meta=? WHERE id=?`,
      [
        normalized.title, normalized.author, normalized.avatar, normalized.coverUrl,
        normalized.category, normalized.categoryName, normalized.date, normalized.source,
        normalized.likes, normalized.collects, normalized.tags, normalized.content,
        normalized.status, normalized.priority, normalized.meta, existing[0].id
      ]
    );
    return { id: existing[0].id, isNew: false };
  }

  await conn.query(
    `INSERT INTO posts (id, title, author, avatar, cover_url, category, category_name,
     date, source, likes, collects, tags, content, note_id, xsec_token, status, priority, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      normalized.id, normalized.title, normalized.author, normalized.avatar, normalized.coverUrl,
      normalized.category, normalized.categoryName, normalized.date, normalized.source,
      normalized.likes, normalized.collects, normalized.tags, normalized.content,
      normalized.noteId, normalized.xsecToken, normalized.status, normalized.priority, normalized.meta
    ]
  );
  return { id: normalized.id, isNew: true };
}

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
    tags: parseJsonField(row.tags, []),
    content: row.content || '',
    noteId: row.note_id,
    xsecToken: row.xsec_token,
    status: row.status,
    priority: row.priority,
    relevance: typeof row.relevance === 'number' ? row.relevance : null,
    meta: parseJsonField(row.meta, null),
  };
}

function parseTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapNoteRow(row) {
  if (!row) return null;
  const post = rowToPost(row);
  const noteContent = row.note_content || '';
  const noteTags = parseTags(row.note_tags);
  const starred = !!row.note_starred;
  const createdAt = row.note_created_at;
  const updatedAt = row.note_updated_at;

  return {
    id: row.note_id,
    postId: post.id,
    starred,
    noteContent,
    noteTags,
    content: noteContent,
    tags: noteTags,
    createdAt,
    updatedAt,
    post,
  };
}

async function updatePostMeta(postId, meta) {
  if (!dbPool) return false;
  const [result] = await dbPool.query(
    'UPDATE posts SET meta = ? WHERE id = ?',
    [JSON.stringify(meta), postId]
  );
  return result.affectedRows > 0;
}

async function getNote(userId, postId) {
  if (!dbPool) return null;
  const [rows] = await dbPool.query(
    `
      SELECT
        notes.id AS note_id,
        notes.content AS note_content,
        notes.tags AS note_tags,
        notes.starred AS note_starred,
        notes.created_at AS note_created_at,
        notes.updated_at AS note_updated_at,
        posts.id,
        posts.title,
        posts.author,
        posts.avatar,
        posts.cover_url,
        posts.category,
        posts.category_name,
        posts.date,
        posts.source,
        posts.likes,
        posts.collects,
        posts.tags,
        posts.content,
        posts.note_id,
        posts.xsec_token,
        posts.status,
        posts.priority,
        posts.relevance,
        posts.meta
      FROM notes
      JOIN posts ON notes.post_id = posts.id
      WHERE notes.user_id = ? AND notes.post_id = ?
      LIMIT 1
    `,
    [userId, postId]
  );
  return rows.length === 0 ? null : mapNoteRow(rows[0]);
}

async function listNotesByUser(userId, options = {}) {
  if (!dbPool) return [];
  const starredOnly = options.starredOnly === true;
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 100, 1), 500);
  const offset = Math.max(parseInt(options.offset, 10) || 0, 0);
  const params = [userId];
  let where = 'WHERE notes.user_id = ?';
  if (starredOnly) {
    where += ' AND notes.starred = 1';
  }
  params.push(limit, offset);
  const [rows] = await dbPool.query(
    `
      SELECT
        notes.id AS note_id,
        notes.content AS note_content,
        notes.tags AS note_tags,
        notes.starred AS note_starred,
        notes.created_at AS note_created_at,
        notes.updated_at AS note_updated_at,
        posts.id,
        posts.title,
        posts.author,
        posts.avatar,
        posts.cover_url,
        posts.category,
        posts.category_name,
        posts.date,
        posts.source,
        posts.likes,
        posts.collects,
        posts.tags,
        posts.content,
        posts.note_id,
        posts.xsec_token,
        posts.status,
        posts.priority,
        posts.relevance,
        posts.meta
      FROM notes
      JOIN posts ON notes.post_id = posts.id
      ${where}
      ORDER BY notes.updated_at DESC
      LIMIT ? OFFSET ?
    `,
    params
  );
  return rows.map(mapNoteRow);
}

async function upsertNote(userId, postId, patch) {
  if (!dbPool) return null;
  const existing = await getNote(userId, postId);
  const content = patch && Object.prototype.hasOwnProperty.call(patch, 'content')
    ? String(patch.content ?? '')
    : existing?.content || '';
  const tags = patch && Object.prototype.hasOwnProperty.call(patch, 'tags')
    ? (Array.isArray(patch.tags) ? patch.tags.map(tag => String(tag).trim()).filter(Boolean) : [])
    : existing?.tags || [];
  const starred = patch && Object.prototype.hasOwnProperty.call(patch, 'starred')
    ? !!patch.starred
    : existing?.starred || false;

  if (existing) {
    await dbPool.query(
      'UPDATE notes SET content = ?, tags = ?, starred = ? WHERE user_id = ? AND post_id = ?',
      [content, JSON.stringify(tags), starred, userId, postId]
    );
  } else {
    await dbPool.query(
      'INSERT INTO notes (id, user_id, post_id, content, tags, starred) VALUES (?, ?, ?, ?, ?, ?)',
      [require('crypto').randomUUID(), userId, postId, content, JSON.stringify(tags), starred]
    );
  }
  return getNote(userId, postId);
}

async function deleteNote(userId, postId) {
  if (!dbPool) return false;
  const [result] = await dbPool.query(
    'DELETE FROM notes WHERE user_id = ? AND post_id = ?',
    [userId, postId]
  );
  return result.affectedRows > 0;
}

async function updatePostClassification(postId, classification, goal) {
  if (!dbPool) return false;
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query('SELECT meta FROM posts WHERE id = ?', [postId]);
    if (rows.length === 0) {
      await conn.rollback();
      return false;
    }

    let metaObj = rows[0].meta;
    if (typeof metaObj === 'string') {
      try { metaObj = JSON.parse(metaObj); } catch { metaObj = {}; }
    }
    if (!metaObj || typeof metaObj !== 'object') metaObj = {};

    const classifiedAt = new Date().toISOString();
    metaObj.classification = {
      ...classification,
      target_goal: goal,
      classified_at: classifiedAt,
    };

    await conn.query(
      'UPDATE posts SET relevance = ?, meta = ? WHERE id = ?',
      [classification.relevance, JSON.stringify(metaObj), postId]
    );
    await conn.commit();
    return true;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function getPostsByUserNotes(userId, options = {}) {
  if (!dbPool) return [];
  const starredOnly = options.starredOnly === true;
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 500, 1), 500);
  const params = [userId];
  let where = 'WHERE notes.user_id = ?';
  if (starredOnly) {
    where += ' AND notes.starred = 1';
  }
  params.push(limit);
  const [rows] = await dbPool.query(
    `SELECT DISTINCT posts.* FROM notes
     JOIN posts ON notes.post_id = posts.id
     ${where}
     ORDER BY posts.relevance DESC, posts.likes DESC
     LIMIT ?`,
    params
  );
  return rows.map(rowToPost);
}

async function createPractice(userId, data) {
  if (!dbPool) return null;
  const id = require('crypto').randomUUID();
  const question = String(data.question || '').trim().slice(0, 5000);
  const reference_answer = String(data.reference_answer || '').trim().slice(0, 5000);
  const topic = String(data.topic || '').trim().slice(0, 64);
  const difficulty = ['easy', 'medium', 'hard'].includes(data.difficulty) ? data.difficulty : 'medium';
  const scoring_criteria = data.scoring_criteria ? JSON.stringify(data.scoring_criteria) : null;
  const user_answer = String(data.user_answer || '').trim().slice(0, 10000) || null;
  const grade = data.grade ? JSON.stringify(data.grade) : null;
  const source_post_ids = data.source_post_ids ? JSON.stringify(data.source_post_ids) : null;

  await dbPool.query(
    `INSERT INTO practices (id, user_id, question, user_answer, reference_answer, topic, difficulty, scoring_criteria, grade, source_post_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, question, user_answer, reference_answer, topic, difficulty, scoring_criteria, grade, source_post_ids]
  );

  return getPractice(id);
}

async function updatePracticeGrade(practiceId, gradeData) {
  if (!dbPool) return false;
  const grade = gradeData ? JSON.stringify(gradeData) : null;
  const [result] = await dbPool.query(
    'UPDATE practices SET grade = ? WHERE id = ?',
    [grade, practiceId]
  );
  return result.affectedRows > 0;
}

async function getPractice(practiceId) {
  if (!dbPool) return null;
  const [rows] = await dbPool.query('SELECT * FROM practices WHERE id = ?', [practiceId]);
  if (rows.length === 0) return null;
  return mapPracticeRow(rows[0]);
}

async function listPractices(userId, options = {}) {
  if (!dbPool) return [];
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(options.offset, 10) || 0, 0);
  const [rows] = await dbPool.query(
    'SELECT * FROM practices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  return rows.map(mapPracticeRow);
}

async function getRecentPractices(userId, limit = 5) {
  if (!dbPool) return [];
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 20);
  const [rows] = await dbPool.query(
    'SELECT question FROM practices WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, safeLimit]
  );
  return rows.map(r => r.question);
}

function mapPracticeRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    question: row.question || '',
    userAnswer: row.user_answer || '',
    referenceAnswer: row.reference_answer || '',
    topic: row.topic || '',
    difficulty: row.difficulty || 'medium',
    scoringCriteria: parseJsonField(row.scoring_criteria, null),
    grade: parseJsonField(row.grade, null),
    sourcePostIds: parseJsonField(row.source_post_ids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getPool() { return dbPool; }

module.exports = {
  initDB,
  rowToPost,
  getPool,
  updatePostMeta,
  updatePostClassification,
  getNote,
  listNotesByUser,
  upsertNote,
  deleteNote,
  getPostsByUserNotes,
  createPractice,
  updatePracticeGrade,
  getPractice,
  listPractices,
  getRecentPractices,
};
