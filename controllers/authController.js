const authService = require('../services/authService');
const { ROLES } = require('../models/User');

function showLogin(req, res) {
  res.render('login');
}

async function login(req, res) {
  let user;
  try {
    user = await authService.authenticate(req.body);
  } catch (error) {
    if (error.status === 400 || error.status === 401) {
      return res.status(error.status).render('login', { error: 'Invalid username or password' });
    }
    throw error;
  }

  await new Promise((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.user = user;
  await new Promise((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
  res.redirect(user.role === ROLES.EDITOR ? '/editor' : '/reporter');
}

async function logout(req, res) {
  await new Promise((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
  res.clearCookie('connect.sid', { path: '/' });
  res.redirect('/login');
}

module.exports = { showLogin, login, logout };
