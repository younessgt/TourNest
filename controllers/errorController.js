const AppError = require('../utils/appError');

const sendErrorDev = (err, req, resp) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return resp.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      hello: 'from dev',
      // mes: err.errmsg,
      // stack: err.stack,
    });
  }
  // B) RENDERED WEBSITE
  console.error('ERROR 💥', err);
  return resp.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const sendErrorProd = (err, req, resp) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    if (err.isOperational) {
      return resp.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    console.error('ERROR 💥', err);
    return resp.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
  // B) RENDERED WEBSITE
  if (err.isOperational) {
    return resp.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
  }
  console.error('ERROR 💥', err);
  return resp.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Please try again later.',
  });
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  // now we should make the error operational for that we will use the AppError class

  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const { message } = err;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
  const message = `Duplicate field value: ${value}. Please use another value!`;
  // console.log(err.errmsg);
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again', 401);

module.exports = (err, req, resp, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // if we do object distructuring some properties of the object can  not be copied such as name is this case
  // let error = { ...err };
  // so for that will use JSON.parse(JSON.stringify(err)); to copy the object
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, resp);
  } else if (process.env.NODE_ENV === 'production') {
    // let error = JSON.parse(JSON.stringify(err));
    let error = {};
    Object.defineProperties(error, Object.getOwnPropertyDescriptors(err));
    // console.log(error.message);
    // console.log(err.message);
    if (err.name === 'CastError') error = handleCastErrorDB(err);
    if (err.name === 'ValidationError') {
      error = handleValidationErrorDB(err);
    }
    if (err.code === 11000) {
      error = handleDuplicateFieldsDB(err);
    }
    if (err.name === 'JsonWebTokenError') error = handleJWTError();
    if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

    // console.log(errors);
    sendErrorProd(error, req, resp);
  }
};
