var express = require('express');
var router = express.Router();
const model = require('../models/userExam')

/* GET users listing. */
router.get('/', function(req, res, next) {
  const ret = {
    msg: "/users success"
  }
  res.json(ret);
});

router.get('/me', async (req, res, next) => {

  const ret = await model.test1();

  res.json(ret);
});

router.get('/me/nickname', async (req, res, next) => {
  const ret = await model.test2();
  res.json(ret)
});

module.exports = router;
