process.loadEnvFile();

const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const path = require('node:path');
const connectDB = require('./config/db');

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

async function startServer() {
  await connectDB();

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();

module.exports = app;
