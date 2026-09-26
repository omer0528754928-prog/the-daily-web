process.loadEnvFile();

const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('node:path');
const connectDB = require('./config/db');
const CATEGORIES = require('./config/categories');
const devAuth = require('./middleware/devAuth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const reporterRoutes = require('./routes/reporterRoutes');
const articleRoutes = require('./routes/articleRoutes');
const apiRoutes = require('./routes/api');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
  },
}));
app.use(devAuth);

app.locals.categories = CATEGORIES;

// REST API (JSON)
app.use('/api', apiRoutes);

// Pages (HTML)
app.use('/reporter', reporterRoutes);
app.use('/articles', articleRoutes);

// Pages (for now they show the design's sample data)
app.get('/', (req, res) => res.render('home', { query: req.query }));
app.get('/login', (req, res) => res.render('login'));
app.get('/editor', (req, res) => res.render('editor', { query: req.query }));
app.get('/editor/articles/:id/review', (req, res) => res.render('review', { id: req.params.id }));
app.get('/stats', (req, res) => res.render('stats', { query: req.query }));

app.use(notFound);
app.use(errorHandler);

async function startServer() {
  await connectDB();

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();

module.exports = app;
