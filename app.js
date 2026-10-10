process.loadEnvFile();

const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('node:path');
const connectDB = require('./config/db');
const CATEGORIES = require('./config/categories');
const loadSessionUser = require('./middleware/loadSessionUser');
const authRoutes = require('./routes/authRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const reporterRoutes = require('./routes/reporterRoutes');
const articleRoutes = require('./routes/articleRoutes');
const editorRoutes = require('./routes/editorRoutes');
const statsRoutes = require('./routes/statsRoutes');
const apiRoutes = require('./routes/api');
const homePageRoutes = require('./routes/homePageRoutes');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
  }),
  cookie: {
    maxAge: 10 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
  },
}));
app.use(loadSessionUser);

app.locals.categories = CATEGORIES;

app.use(authRoutes);

// REST API (JSON)
app.use('/api', apiRoutes);

// Pages (HTML)
app.use('/reporter', reporterRoutes);
app.use('/articles', articleRoutes);

app.use('/editor', editorRoutes);
// Impact Analytics (editor only) — real view data from the monitoring collection
app.use('/stats', statsRoutes);

app.use('/', homePageRoutes);

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
