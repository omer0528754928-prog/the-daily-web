process.loadEnvFile();

const express = require('express');
const path = require('node:path');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

module.exports = app;
