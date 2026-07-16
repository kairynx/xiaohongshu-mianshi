import { getUserId } from '../hooks/useUserId';

const API_BASE = '/api/notes';

async function request(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
    'X-User-Id': getUserId(),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`HTTP ${res.status}`);
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.data;
}

export function fetchNote(postId) {
  return request(`/${encodeURIComponent(postId)}`);
}

export function saveNote(postId, patch) {
  return request(`/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function deleteNote(postId) {
  return request(`/${encodeURIComponent(postId)}`, { method: 'DELETE' });
}

export function listNotes(options = {}) {
  const params = new URLSearchParams();
  if (options.starred !== undefined) params.set('starred', String(options.starred));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));
  return request(`?${params.toString()}`);
}
