const express = require('express');
const { ROLES } = require('../models/User');
const statsController = require('../controllers/statsController');

const router = express.Router();

// Editor-only, checked on the server (hiding the link in the client is not a permission).
// A logged-in non-editor gets the designed 403 page; a guest is sent to log in.
function requireEditorPage(req, res, next) {
  const user = req.session.user;
  if (!user) return res.redirect('/login');
  if (user.role !== ROLES.EDITOR) {
    return res.status(403).render('403', { currentUser: user, query: req.query });
  }
  next();
}

router.use(requireEditorPage);
router.get('/', statsController.showStats);

module.exports = router;
