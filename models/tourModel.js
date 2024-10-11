const mongoose = require('mongoose');
// eslint-disable-next-line import/no-extraneous-dependencies
const slugify = require('slugify');
// const fs = require('fs');

// creating a schema

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A tour name must have less than or equal to 40 characters',
      ],
      minlength: [
        10,
        'A tour name must have more than or equal to 10 characters',
      ],
    },
    slug: String,
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    secretTour: {
      type: Boolean,
      default: false,
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          // this only points to the current document on NEW document creation in case of document validation
          // in case of updating the document, this points to the current query and we should use this.get('price') to get the price
          return val < (this.price || this.get('price'));
        },
        message:
          'Discount price ({VALUE}) should be less than the regular price',
      },
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      max: [5, 'Rating must be less than or equal to 5'],
      min: [1, 'Rating must be greater than or equal to 1'],
      set: (val) => Math.round(val * 10) / 10,
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium or difficult',
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a summary'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    startDates: [Date],

    startLocation: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],
      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

// virtual properties
// virtual properties are properties that are not stored in the database but are calculated using some other values
// so they are not persisted in the database
// they are only shown when the data is outputted
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// virtual populate
// used to implement reviews filed in the tour document without actually storing the reviews in the tour document
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// document middleware: runs before .save() and .create() (these are mongoose methods)
tourSchema.pre('save', function (next) {
  // console.log('Will save document...');
  this.slug = slugify(this.name, { lower: true });
  // console.log(this);
  next();
});
/*
// document middleware: runs after .save() and .create() (these are mongoose methods)
// tourSchema.post('save', function (doc, next) {
//   console.log('Document saved...');
//   console.log(doc);
//   next();
// });
*/

// query middleware
tourSchema.pre(/^find/, function (next) {
  // inside this middleware we are filtering out the secret tours
  // so that they are not shown to the user
  // this is used for any find query that starts with find
  this.find({ secretTour: { $ne: true } });
  // this reprsents the current query and we can add to it a new property (start) which is the current time
  this.start = Date.now();
  next();
});

// populate the guides field in the tour model
// this is called a reference to the user model
// this is called a child referencing
// populate is used to populate the guides field with the actual data from the user model
// this mean that the guides field will contain the actual data of the user model every time we use find  query
tourSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

tourSchema.post(/^find/, function (docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds`);
  next();
});

// aggregation middleware
tourSchema.pre('aggregate', function (next) {
  // this.pipeline() returns an array of all the stages in the aggregation pipeline
  // we can add a new stage to the beginning of the pipeline

  // we did this check to make sure that the first stage in the pipeline is not a geoNear stage
  // because if geoNear is not the first stage in the pipeline, it will not work
  const firstStage = this.pipeline()[0];
  if (firstStage.$geoNear) {
    console.log(this.pipeline());

    return next();
  }
  this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  console.log(this.pipeline());
  next();
});
// creating a model
const Tour = mongoose.model('Tour', tourSchema);

/*
// script for importing data into the database
// const dataObj = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`, 'utf-8'),
// );
// console.log(dataObj);

// Tour.create(dataObj);
*/

module.exports = Tour;
