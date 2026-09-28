const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/session/keep-alive', (req, res) => {
  if (!req.session.user) return res.sendStatus(401);
  return res.status(204).end();
});

module.exports = router;
