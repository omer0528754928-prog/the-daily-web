const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// Files live in public/, so express.static serves them at /uploads/articles/<name>
const PUBLIC_DIR = path.join(__dirname, '../public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads/articles');
const URL_PREFIX = '/uploads/articles/';

// image: { buffer, ext } as returned by validateImage
async function saveArticleImage(image) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${crypto.randomUUID()}${image.ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, fileName), image.buffer);
  return URL_PREFIX + fileName;
}

// Used to clean up when saving the article fails after the image was written
async function deleteArticleImage(url) {
  if (!url || !url.startsWith(URL_PREFIX)) return;
  const fileName = path.basename(url);
  await fs.rm(path.join(UPLOAD_DIR, fileName), { force: true });
}

module.exports = { saveArticleImage, deleteArticleImage };
