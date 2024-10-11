const crypto = require('crypto');
const { promisify } = require('util');
// eslint-disable-next-line import/no-extraneous-dependencies
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statuscode, req, resp) => {
  // creating a token
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    // secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    // sameSite: 'None',
  };
  // if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  // req.header is used because of the heroku proxy
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    cookieOptions.secure = true;
  }

  resp.cookie('jwt', token, cookieOptions);
  // Remove the password from the output
  user.password = undefined;

  resp.status(statuscode).json({
    status: 'success',
    token,
    data: {
      user: user,
    },
  });
};

exports.signup = catchAsync(async (req, resp, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: 'user',
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();
  createSendToken(newUser, 201, req, resp);
});

exports.login = catchAsync(async (req, resp, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select('+password');

  // console.log(user);

  // the user is and instance of the User model , so we can use the instance method correctPassword
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everything is ok, send token to client
  createSendToken(user, 200, req, resp);
});

exports.logout = (req, resp) => {
  // we are setting the cookie to be expired
  // resp.cookie('jwt', 'loggedout', {
  //   expires: new Date(Date.now() + 10 * 1000),
  //   httpOnly: true,
  // });
  resp.clearCookie('jwt');
  resp.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, resp, next) => {
  console.log('protect1');
  // 1) Getting token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  //   console.log(token);

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access', 401),
    );
  }
  // 2) Verification token
  const jwtVerify = promisify(jwt.verify);
  // there is 2 errors that can happen here is the token is invalid or the token has expired
  // all that is handled in global error handling middleware
  const decoded = await jwtVerify(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist',
        401,
      ),
    );
  }

  // 4) Check if user changed password after the token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401),
    );
  }
  // Grant access to protected route
  req.user = user;
  resp.locals.user = user;
  next();
});

exports.isLoggedIn = async (req, resp, next) => {
  console.log('protect2');
  // console.log('Headers:', req.headers);
  // console.log('Cookies:', req.cookies);
  // 1) Getting token and check if it exists

  if (req.cookies.jwt) {
    try {
      // 2) Verification token
      const jwtVerify = promisify(jwt.verify);
      // there is 2 errors that can happen here is the token is invalid or the token has expired
      // all that is handled in global error handling middleware
      const decoded = await jwtVerify(req.cookies.jwt, process.env.JWT_SECRET);

      // 3) Check if user still exists
      const user = await User.findById(decoded.id);
      if (!user) {
        return next();
      }

      // 4) Check if user changed password after the token was issued
      if (user.changedPasswordAfter(decoded.iat)) {
        return next();
      }
      // this mean that on every pug template that is rendered will have access to the user object
      resp.locals.user = user;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo =
  (...roles) =>
  (req, resp, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, resp, next) => {
  // 1) Get user based on POSTed email
  if (!req.body.email) {
    return next(new AppError('Please provide an email address', 400));
  }
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetUrl}.\nIf you didn't forget your password, please ignore this email!`;

  // const options = {
  //   email: user.email,
  //   subject: 'Your password reset token (valid for 10 min)',
  //   message,
  // };

  try {
    // 3) Send it to user's email
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetUrl).sendPasswordReset();
    resp.status(200).json({
      status: 'success',
      message: 'Token sent to email!',
      // token: resetToken,
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500,
    );
  }
});

exports.resetPassword = catchAsync(async (req, resp, next) => {
  // 1) Get the token and hash it
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // 2) Get the user based on the token
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  // 3) If token has not expired, and there is a user, set the new password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save(); // we are not using save({ validateBeforeSave: false }) because we want to validate the password and passwordConfirm fields

  // 4) Update changedPasswordAt property for the user
  // This is done in the userModel.js file in the pre save middleware

  // 5) generation the JWT token and send it to the user
  createSendToken(user, 200, req, resp);
});

exports.updatePassword = catchAsync(async (req, resp, next) => {
  // 1) Get user from collection

  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, resp);
});
