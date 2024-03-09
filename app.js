var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const bodyParser = require("body-parser");
const { Pool } = require("pg");
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const cors = require('cors'); // Import the CORS middleware
var app = express();
const port = 3001;



// Database connection details (replace with your actual settings)
const pool = new Pool({
  user: "postgres", // Replace with your username
  host: "localhost",
  database: "introviz", // Replace with your database name
  password: "1234", // Replace with your password
  port: 5432,
});

app.use(cors()); // Enable CORS for all routes
app.use(bodyParser.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.use(bodyParser.json());

 


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

module.exports = app;
