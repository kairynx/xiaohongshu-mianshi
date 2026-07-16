import { getUserId } from '../hooks/useUserId';

const API_BASE = '/api/agent/mock';

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    'X-User-Id': getUserId(),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data;
  try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status}`); }
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.data;
}

export function newMockQuestion(goal, topics) {
  return request('/new', {
    method: 'POST',
    body: JSON.stringify({ goal, topics }),
  });
}

export function gradeMockAnswer(practiceId, user_answer) {
  return request(`/${encodeURIComponent(practiceId)}/grade`, {
    method: 'POST',
    body: JSON.stringify({ user_answer }),
  });
}

export function getMockHistory(limit = 50, offset = 0) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return request(`/history?${params.toString()}`);
}
