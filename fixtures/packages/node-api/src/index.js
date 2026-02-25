const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { DB_CONFIG } = require('./config');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// TODO: add helmet for security headers
// TODO: configure cors to restrict origins in production
app.use(cors());
app.use(express.json());

const usersRouter = require('./routes/users');
const productsRouter = require('./routes/products');

app.use('/api/users', usersRouter);
app.use('/api/products', productsRouter);

// Connecting with hardcoded credentials from config
mongoose
  .connect(
    `mongodb://${DB_CONFIG.username}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`
  )
  .catch((err) => console.error('DB connection failed:', err));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
