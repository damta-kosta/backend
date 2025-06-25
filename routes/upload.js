require('dotenv').config();
var express = require('express');
var router = express.Router();
const model = require('../models/uploadModel');

/* upload */
router.put('/', async (req, res, next) => {
    const params = req.query;

    let table = "room_info";
    
    const ret = await model.imgUploader(process.env.DB_MAIN_SCHEMA, table, params);

    res.json(ret);
});

module.exports = router;
