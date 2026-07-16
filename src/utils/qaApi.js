import { getUserId } from '../hooks/useUserId';

export async function askQuestion(question) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': getUserId(),
  };
  const res = await fetch('/api/qa', {
    method: 'POST',
    headers,
    body: JSON.stringify({ question }),
  });
  let data;
  try { data = await res.json(); } catch { throw new Error(`HTTP ${res.status}`); }
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data.data;
}
