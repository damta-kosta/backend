require('dotenv').config();
var express = require('express');
var router = express.Router();
const model = require('../models/uploadModel');

router.post('/', async (req, res, next) => {
    const body = req.body;
    const ret = await model.imgUploader(process.env.DB_MAIN_SCHEMA, body);

    res.json(ret);
});

module.exports = router;
