require('dotenv').config();
const express = require('express');
const router = express.Router();
const model = require('../models/uploadModel');

// POST /upload
router.post('/', async (req, res) => {
  const body = req.body;

  try {
    const result = await model.imgUploader(process.env.DB_MAIN_SCHEMA, body);

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "서버 오류 발생" });
  }
});

module.exports = router;
