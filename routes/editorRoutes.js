const express = require('express');
const loadArticle = require('../middleware/loadArticle');
const parseForm = require('../middleware/parseForm');
const articleFilters = require('../middleware/articleFilters');
const { ROLES } = require('../models/User');
const editorController = require('../controllers/editorController');

const router = express.Router();
const PAGE_SIZE = 10;

// Editor-only. A logged-in non-editor who reaches the editor area (via the nav
// button or by typing the /editor URL) gets a designed "no permission" page
// with the site header, instead of a blank 403. Checked on the server.
function requireEditorPage(req, res, next) {
  const user = req.session.user;
  if (!user) return res.redirect('/login');
  if (user.role !== ROLES.EDITOR) {
    return res.status(403).render('403', { currentUser: user, query: req.query });
  }
  next();
}

// Reads ?page= defensively: a duplicated/array/invalid value (e.g. from
// back/forward navigation) falls back to page 1 instead of a 400 white page.
function editorPagination(req, res, next) {
  let raw = req.query.page;
  if (Array.isArray(raw)) raw = raw[raw.length - 1];
  if (typeof raw === 'string' && raw.includes(',')) raw = raw.split(',').pop();
  let page = Number.parseInt(raw, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  req.pagination = { page, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
  next();
}

router.use(requireEditorPage);

router.get('/', articleFilters, editorPagination, editorController.showQueue);

router.get('/articles/:id/review', loadArticle, editorController.showReview);
router.post('/articles/:id/edit', loadArticle, parseForm, editorController.editContent);
router.post('/articles/:id/approve', loadArticle, editorController.approve);
router.post('/articles/:id/return', loadArticle, editorController.returnToReporter);
router.post('/articles/:id/delete', loadArticle, editorController.remove);

module.exports = router;
