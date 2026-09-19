'use strict';

/**
 * Minimal action logger — writes important editor actions to
 * logs/editor-actions.log AND echoes them to the console.
 * No external libraries. The logs/ folder is already git-ignored.
 */

const fs = require('node:fs');
const path = require('node:path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'editor-actions.log');

function ensureDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* ignore — logging must never break a request */
  }
}

function logEditorAction(action, details = {}) {
  ensureDir();
  const entry = { ts: new Date().toISOString(), action, ...details };
  console.log(`[EDITOR] ${action}`, details);
  fs.appendFile(LOG_FILE, JSON.stringify(entry) + '\n', (err) => {
    if (err) console.error('logger: failed to write log line:', err.message);
  });
}

module.exports = { logEditorAction };
