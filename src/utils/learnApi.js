import { getUserId } from '../hooks/useUserId';

const API_BASE = '/api/agent';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    'X-User-Id': getUserId(),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data;
  try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status}`); }
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.data;
}

export function aggregateLearn(goal, source = 'starred', postIds) {
  const body = { goal, source };
  if (source === 'all' && Array.isArray(postIds)) {
    body.postIds = postIds;
  }
  return request('/aggregate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
