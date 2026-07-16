const DAILY_LIMIT = 20;

let today = new Date().toDateString();
let count = 0;

function resetIfNewDay() {
  const now = new Date().toDateString();
  if (now !== today) {
    today = now;
    count = 0;
  }
}

function getQuota() {
  resetIfNewDay();
  return { used: count, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - count) };
}

function isOverLimit() {
  resetIfNewDay();
  return count >= DAILY_LIMIT;
}

function addFetched(n = 1) {
  resetIfNewDay();
  count += n;
  return getQuota();
}

module.exports = { getQuota, isOverLimit, addFetched, DAILY_LIMIT };
