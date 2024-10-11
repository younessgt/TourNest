const catchAsync = require('../utils/catchAsync');
// const factory = require('./handlerFactory');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');

exports.getOverview = catchAsync(async (req, resp, next) => {
  const tours = await Tour.find();

  if (!tours) {
    // return next(new AppError('No tours found', 404));
    resp.status(404).render('tour', {
      title: 'Tours Not Found',
      message: 'Please try again later.',
    });
  }

  resp.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, resp, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });

  if (!tour) {
    return next(new AppError('No tour found with that name', 404));
    // resp.status(404).render('tour', {
    //   title: 'Tour Not Found',
    //   message: 'No tour found with that name. Please try a different tour.',
    // });
  }
  resp.status(200).render('tour', {
    title: `${tour.name} Tour`,
    tour,
  });
});

exports.getLoginForm = (req, resp) => {
  resp.status(200).render('login', {
    title: 'Log into your account',
  });
};

exports.getSignupForm = (req, resp) => {
  resp.status(200).render('signup', {
    title: 'Create an account',
  });
};

exports.getAccount = (res, resp) => {
  resp.status(200).render('account', {
    title: 'Your account',
  });
};

exports.getMyTours = catchAsync(async (req, resp, next) => {
  // 1) Find all bookings
  const bookings = await Booking.find({ user: req.user.id });

  // 2) Find tours with the returned IDs

  const tourIds = bookings.map((el) => el.tour);

  const tours = await Tour.find({ _id: { $in: tourIds } });

  resp.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

exports.updateUserData = catchAsync(async (req, resp, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  resp.status(200).render('account', {
    title: 'Your account updated',
    user: updatedUser,
  });
});
