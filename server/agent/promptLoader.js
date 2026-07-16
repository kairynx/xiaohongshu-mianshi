const fs = require('fs');
const path = require('path');

const cache = new Map();
const PROMPTS_DIR = path.join(__dirname, '../prompts');

function stringifyValue(value) {
  if (typeof value === 'string') return value;
  const json = JSON.stringify(value);
  return json === undefined ? String(value) : json;
}

function loadPrompt(name, variables = {}) {
  let template;

  if (process.env.PROMPT_NO_CACHE === '1' || !cache.has(name)) {
    const filePath = path.join(PROMPTS_DIR, `${name}.md`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt not found: ${filePath}`);
    }
    template = fs.readFileSync(filePath, 'utf8');
    if (process.env.PROMPT_NO_CACHE !== '1') {
      cache.set(name, template);
    }
  } else {
    template = cache.get(name);
  }

  return template.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      console.warn(`[promptLoader] missing variable: ${key}`);
      return match;
    }
    return stringifyValue(variables[key]);
  });
}

module.exports = { loadPrompt };
