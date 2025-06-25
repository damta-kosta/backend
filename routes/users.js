const express = require("express");
const router = express.Router();
const userModel = require("../models/authModel");
const jwt = require("jsonwebtoken");

/* GET users listing. */
router.get('/', function(req, res, next) {
  const ret = {
    msg: "/users success"
  }
  res.json(ret);
});




module.exports = router;
