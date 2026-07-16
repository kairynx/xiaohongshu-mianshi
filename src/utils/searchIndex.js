// 中文字符逐字拆分，英文/数字连续字符保持为一个 token
export function tokenize(text) {
  if (!text) return [];
  const tokens = [];
  let buf = '';
  for (const ch of String(text)) {
    if (/[一-鿿]/.test(ch)) {
      if (buf) { tokens.push(buf.toLowerCase()); buf = ''; }
      tokens.push(ch);
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      buf += ch;
    } else {
      if (buf) { tokens.push(buf.toLowerCase()); buf = ''; }
    }
  }
  if (buf) tokens.push(buf.toLowerCase());
  return tokens;
}

// 建倒排索引
export function buildIndex(posts) {
  const start = performance.now();
  const index = new Map();
  for (const post of posts) {
    const text = [post.title, post.content, post.author, ...(post.tags || [])].join(' ');
    const tokens = tokenize(text);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      if (!index.has(token)) index.set(token, new Set());
      index.get(token).add(post.id);
    }
  }
  const elapsed = (performance.now() - start).toFixed(1);
  return { index, elapsed, count: posts.length };
}

// 搜索：AND 语义
export function search(index, query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  let result = index.get(tokens[0]) || new Set();
  for (let i = 1; i < tokens.length; i++) {
    const right = index.get(tokens[i]);
    if (!right) return [];
    // 手动取交集，避免 Set.intersection 的兼容性问题
    result = new Set([...result].filter(x => right.has(x)));
  }
  return [...result];
}
