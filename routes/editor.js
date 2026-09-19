'use strict';

/**
 * Editor routes (Phase 6) — Member 5.
 * Public sub-routes: the login page + the DEV login shim + logout.
 * Everything else requires a logged-in EDITOR, enforced on the server.
 */

const express = require('express');
const router = express.Router();

const { requireLogin, requireRole } = require('../middleware/auth');
const ec = require('../controllers/editorController');

// ---------------------------------------------------------------------------
// DEV-ONLY provisional login shim.
// ⚠️  Placeholder for Member 1's real login. Active only when NODE_ENV is not
//     'production'. It just puts an "editor" user into the session so we can
//     open and demo the editor screen today.
// ---------------------------------------------------------------------------
const DEV = process.env.NODE_ENV !== 'production';

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/editor');
  res.render('editor/login', { dev: DEV });
});

router.get('/dev-login', (req, res) => {
  if (!DEV) return res.status(404).send('Not found');
  req.session.user = { _id: 'dev-editor', name: 'עורך הדגמה', role: 'editor' };
  res.redirect('/editor');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/editor/login'));
});

// Impact Analytics (Phase 7) — self-guarded (its /ping is public).
router.use('/analytics', require('./analytics'));

// ---------------------------------------------------------------------------
// From here down: EDITOR-ONLY, checked on the server (never trust the browser).
// ---------------------------------------------------------------------------
router.use(requireLogin, requireRole('editor'));

router.get('/', ec.renderEditorPage);

router.get('/api/articles', ec.apiList);
router.get('/api/articles/:id', ec.apiGetOne);
router.patch('/api/articles/:id', ec.apiUpdate);
router.post('/api/articles/:id/approve', ec.apiApprove);
router.post('/api/articles/:id/return', ec.apiReturn);
router.delete('/api/articles/:id', ec.apiDelete);

module.exports = router;
