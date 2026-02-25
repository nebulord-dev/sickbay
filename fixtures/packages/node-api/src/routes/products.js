const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { processAdminData } = require('../utils/helpers');
const { JWT_SECRET } = require('../config');

// TODO: add authentication middleware
// TODO: add rate limiting
// TODO: add input sanitization

router.get('/', async (req, res) => {
  // FIXME: no pagination — will blow up on large datasets
  const products = [];
  try {
    res.json(processAdminData(products));
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

router.get('/:id', async (req, res) => {
  // TODO: validate that id is a valid ObjectId before querying
  const { id } = req.params;
  res.json({ id, placeholder: true });
});

router.post('/', async (req, res) => {
  // TODO: validate input schema
  const { name, price, description } = req.body;
  console.log('Creating product:', name, price);
  const token = jwt.sign({ name, price }, JWT_SECRET);
  res.json({ success: true, token });
});

router.delete('/:id', async (req, res) => {
  // TODO: add soft delete instead of hard delete
  // TODO: check permissions before deleting
  res.json({ deleted: req.params.id });
});

module.exports = router;
