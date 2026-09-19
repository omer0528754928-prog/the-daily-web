'use strict';

/**
 * Analytics routes (Phase 7) — Member 5.
 * Mounted under /editor/analytics (see routes/editor.js).
 * The /ping heartbeat is public (any visitor may report presence); everything
 * else is editor-only, enforced on the server.
 */

const express = require('express');
const router = express.Router();

const { requireLogin, requireRole } = require('../middleware/auth');
const ac = require('../controllers/analyticsController');

// public heartbeat for the live-users counter
router.get('/ping', ac.ping);

// everything below is EDITOR-ONLY (checked on the server)
router.use(requireLogin, requireRole('editor'));

router.get('/', ac.renderPage);
router.get('/api/overview', ac.overview);
router.get('/api/articles', ac.articleList);
router.get('/api/article-series', ac.articleSeries);

module.exports = router;
