const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

// 带超时的 fetch
async function fetchWithTimeout(url, options, timeout = 300000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 下载图片并保存到临时文件
 */
async function downloadImage(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept': 'image/avif,image/webp,image/*,*/*'
    }
  }, 30000);
  if (!response.ok) throw new Error('图片下载失败: ' + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  const tmpFile = path.join(os.tmpdir(), 'ocr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
  fs.writeFileSync(tmpFile, buffer);
  console.log(`    Downloaded ${(buffer.length / 1024).toFixed(0)}KB image`);
  return tmpFile;
}

/**
 * 图片预处理：WebP/任意格式 → PNG + 灰度 + 放大 + 增强对比度 + 锐化
 * 使用 sharp（纯 Node.js，无系统依赖）
 * @param {string} inputPath - 原始图片路径
 * @returns {string} 预处理后的 PNG 图片路径
 */
async function preprocessImage(inputPath) {
  const outputPath = inputPath + '_processed.png';
  try {
    await sharp(inputPath)
      .grayscale()
      .normalize()
      .resize(2000, null, { withoutEnlargement: false })
      .sharpen({ sigma: 1.5, m1: 0.7, m2: 0.02 })
      .png()
      .toFile(outputPath);
    try { fs.unlinkSync(inputPath); } catch {}
    return outputPath;
  } catch (e) {
    console.log('    Sharp 预处理失败: ' + e.message);
    // 兜底：尝试直接传原图给 Tesseract（仅当原图是 PNG/JPEG 时有效）
    return inputPath;
  }
}

/**
 * 使用 Tesseract OCR 识别图片中的文字（优化参数）
 * @param {string} imagePath - 图片文件路径
 * @returns {string} 识别出的文字
 */
function ocrImage(imagePath) {
  return new Promise((resolve) => {
    const tesseractBin = process.env.TESSERACT_PATH || 'tesseract';
    const runOcr = (psm) => new Promise((res) => {
      execFile(tesseractBin, [
        imagePath, 'stdout',
        '-l', 'chi_sim+eng',
        '--psm', String(psm),
        '--oem', '1',
        '-c', 'preserve_interword_spaces=1'
      ], { timeout: 45000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
        if (error) {
          if (error.code === 'ENOENT') {
            console.log('    ⚠️ tesseract 命令不存在！请在 Windows 上安装 Tesseract OCR');
          } else {
            console.log('    Tesseract error (' + error.code + '): ' + error.message);
          }
          res('');
          return;
        }
        const out = (stdout || '').trim();
        res(out);
      });
    });

    // 判断 OCR 结果是否有效（有足够的中文内容，不是乱码）
    const isValid = (text) => {
      if (!text || text.length < 10) return false;
      const chinese = (text.match(/[一-鿿]/g) || []).length;
      const garbage = (text.match(/[^a-zA-Z0-9一-鿿　-〿＀-￯\s,.;:!?，。；：！？、（）【】《》""''\-—…·\n]/g) || []).length;
      return chinese >= 2 && garbage / text.length < 0.5;
    };

    (async () => {
      let text = await runOcr(6);  // PSM 6: 块文本，适合截图
      if (!isValid(text)) {
        console.log('    PSM 6 结果不佳，尝试 PSM 3（全自动）...');
        const text3 = await runOcr(3);  // PSM 3: 全自动页面分割
        if (isValid(text3)) text = text3;
        else if (text3.length > text.length) text = text3;  // 退而求其次，用更长的那个
      }
      try { fs.unlinkSync(imagePath); } catch {}
      resolve(isValid(text) ? text : (text.length > 10 ? text : ''));
    })();
  });
}

/**
 * OCR 后处理：清理乱码碎片
 * @param {string} text - OCR 原始输出
 * @returns {string} 清理后的文字
 */
function cleanOcrText(text) {
  if (!text) return '';
  return text
    // 去除纯乱码行（连续特殊字符占比超过 60%）
    .split('\n')
    .filter(line => {
      if (line.trim().length === 0) return false;
      const special = (line.match(/[^a-zA-Z0-9\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\s,.;:!?，。；：！？、（）【】《》""''\-—…·]/g) || []).length;
      return special / line.length < 0.6;
    })
    // 合并连续空行为单个空行
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * OCR 识别单张图片 URL（完整流程：下载 → 预处理 → 识别 → 后处理）
 */
async function ocrImageUrl(url) {
  if (!url) return '';
  let tmpFile = null;
  try {
    tmpFile = await downloadImage(url);
    console.log(`    Downloaded to ${tmpFile}`);
    // 图片预处理
    tmpFile = await preprocessImage(tmpFile);
    console.log(`    Preprocessed to ${tmpFile}`);
    // OCR 识别
    const rawText = await ocrImage(tmpFile);
    console.log(`    OCR result: ${rawText ? rawText.length + ' chars' : 'empty'}`);
    // 后处理
    const cleaned = cleanOcrText(rawText);
    console.log(`    After cleaning: ${cleaned ? cleaned.length + ' chars' : 'empty'}`);
    return cleaned;
  } catch (e) {
    console.log('    OCR failed for image:', e.message);
    return '';
  } finally {
    // 确保清理临时文件
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch {}
      try { fs.unlinkSync(tmpFile + '_processed.png'); } catch {}
    }
  }
}

/**
 * OCR 识别帖子详情中的所有图片
 * @param {object} detail - 帖子详情
 * @returns {string} 所有图片的 OCR 文本合并
 */
async function ocrFeedDetail(detail) {
  const texts = [];

  // MCP 返回结构可能是 { data: { note: { imageList } } } 或 { note: { imageList } }
  const note = detail?.data?.note || detail?.note || detail;
  const images = [];
  if (note?.imageList) {
    images.push(...note.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (note?.image_list) {
    images.push(...note.image_list.map(img => img.url_default || img.url));
  }
  if (detail?.data?.imageList) {
    images.push(...detail.data.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (detail?.imageList) {
    images.push(...detail.imageList.map(img => img.urlDefault || img.urlPre || img.url));
  }
  if (detail?.images) {
    images.push(...(Array.isArray(detail.images) ? detail.images : []));
  }

  console.log(`    Found ${images.length} images for OCR`);
  // 最多处理前 3 张图片（避免太慢）
  const limit = Math.min(images.length, 3);
  for (let i = 0; i < limit; i++) {
    const url = images[i];
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) continue;
    console.log(`    OCR image ${i + 1}/${limit}: ${url.slice(0, 60)}...`);
    const text = await ocrImageUrl(url);
    if (text) texts.push(text);
  }

  return texts.join('\n\n');
}

module.exports = { ocrFeedDetail };
