var express = require('express');
var router = express.Router();
require('dotenv').config();

// import db module
const db = require("../db/index");

// exam db connection
router.get('/', async (req, res, next) => {
    const ss = process.env.DB_MAIN_SCHEMA;

    try{
        const ret = await db.query(`select * from ${ss}.emblems;`);
        res.json(ret.rows);
    }catch (err) {
        res.status(500).send("err");
    }
});

module.exports = router;