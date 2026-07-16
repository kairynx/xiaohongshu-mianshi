require('dotenv').config();

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const LLM_MODEL = process.env.LLM_MODEL || 'deepseek-chat';
const LLM_TIMEOUT = parseInt(process.env.LLM_TIMEOUT || '60000', 10);

let warnedMissingKey = false;

function isEnabled() {
  return Boolean(LLM_API_KEY);
}

function warnMissingKeyOnce() {
  if (warnedMissingKey) return;
  warnedMissingKey = true;
  console.warn('[llm] LLM_API_KEY is not configured; LLM calls are disabled.');
}

async function chat(messages, options = {}) {
  if (!isEnabled()) {
    warnMissingKeyOnce();
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT);

  try {
    const response = await fetch(`${LLM_BASE_URL.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: options.model || LLM_MODEL,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn(`[llm] request failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (e) {
    const cause = e.cause || {};
    const extra = [];
    if (cause.code) extra.push(`cause=${cause.code}`);
    if (cause.errno !== undefined) extra.push(`errno=${cause.errno}`);
    if (cause.address) extra.push(`addr=${cause.address}`);
    const timeoutHint = e.name === 'AbortError' ? `timed out after ${LLM_TIMEOUT}ms` : '';
    console.warn(`[llm] request error: ${e.message}${timeoutHint ? ` (${timeoutHint})` : ''}${extra.length ? ` (${extra.join(' ')})` : ''}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function chatJSON(messages, options = {}) {
  const raw = await chat(messages, { ...options, json: true });
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[llm] JSON parse failed: ${e.message}; raw=${raw.slice(0, 200)}`);
    return null;
  }
}

module.exports = { chat, chatJSON, isEnabled };
