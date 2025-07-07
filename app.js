var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
// import router
var dbConnRouter = require('./routes/db_conn');
var uploadRouter = require('./routes/upload');
var authRouter = require("./routes/auth");
var roomRouter = require("./routes/rooms");
var communityRouter = require("./routes/community");
var commentsRouter = require("./routes/comments");
var emblemsRouter = require("./routes/emblems");
var roomListRouter = require("./routes/roomList");
var chatRouter = require("./routes/chat");
// import router

const jwtMiddleware = require("./middlewares/jwtMiddleware");
const cors = require("cors");
require("dotenv").config();

var app = express();
const PORT = process.env.PORT;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors({ 
  origin: true, // CORS 활성화
  credentials: true // 쿠키 주고받기 허용
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);

//custom router
app.use('/db-conn-test', dbConnRouter);
app.use('/upload', jwtMiddleware, uploadRouter);
app.use("/auth", authRouter);
app.use('/users', jwtMiddleware, usersRouter);
app.use('/rooms', jwtMiddleware, roomRouter);
app.use("/community", communityRouter);
app.use("/comments", jwtMiddleware, commentsRouter);
app.use("/emblems", emblemsRouter);
app.use("/roomList", roomListRouter);
app.use("/chat", jwtMiddleware, chatRouter);
//custom router

app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {

  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
