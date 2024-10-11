const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/userModel');

const factory = require('./handlerFactory');

// configure multer

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'public/img/users');
//   },

//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split('/')[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

// store image in memory and not in the file system like we did above
const multerStorage = multer.memoryStorage();

// filter image files
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

// middleware to resize user photo to 500x500 and convert it to jpeg
exports.resizeUserPhoto = catchAsync(async (req, resp, next) => {
  if (!req.file) return next();

  // set the filename of the image to use it in the updateMe middleware
  // because in memory storage the filename is not set not like disk storage

  // console.log(req.file);

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer) // req.file.buffer is the image file in memory
    .resize(500, 500) // resize the image to 500x500
    .toFormat('jpeg') // convert the image to jpeg
    .jpeg({ quality: 90 }) // set the quality of the jpeg to 90%
    .toFile(`public/img/users/${req.file.filename}`); // save the image to the file system

  next();
});
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

// middleware to upload user photo from a form with field name 'photo'
exports.uploadUserPhoto = upload.single('photo');

const filterObj = (obj, ...allowedFields) =>
  Object.fromEntries(
    Object.entries(obj).filter(([key]) => allowedFields.includes(key)),
  );

exports.updateMe = catchAsync(async (req, resp, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400,
      ),
    );
  }

  if (req.file) {
    req.body.photo = req.file.filename;
  }

  const filteredBody = filterObj(req.body, 'name', 'email', 'photo');
  const user = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  resp.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.getMe = (req, resp, next) => {
  req.params.id = req.user.id;
  next();
};

exports.deleteMe = catchAsync(async (req, resp, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });
  resp.status(204).json({
    status: 'success',
    data: null,
  });
});

exports.getAllUsers = factory.getAll(User);

exports.getUser = factory.getOne(User);

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);

exports.createUser = (req, resp) => {
  resp.status(500).json({
    status: 'error',
    message: 'use signup instead',
  });
};

exports.deleteUser = factory.deleteOne(User);
