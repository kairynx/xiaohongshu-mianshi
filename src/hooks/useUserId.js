import { useEffect, useState } from 'react';

const KEY = 'xhs_user_id';

function createUserId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `user_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getUserId() {
  if (typeof window === 'undefined') return '';
  let userId = localStorage.getItem(KEY);
  if (!userId) {
    userId = createUserId();
    localStorage.setItem(KEY, userId);
  }
  return userId;
}

export default function useUserId() {
  const [userId, setUserId] = useState('');

  useEffect(() => {
    setUserId(getUserId());
  }, []);

  return userId;
}
