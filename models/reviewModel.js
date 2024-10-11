const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty'],
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Preventing duplicate reviews
// here we are creating a compound index so a B-tree will be created with the combination of tour and user.
// when we create a review MongoDB will check first this index before actually writing the document to the collection.
// if it finds that the combination already exists in the index, MongoDB knows that
// the uniqueness constraint would be violated if the new document were to be inserted
// and it will reject the operation.
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function (next) {
  //   this.populate({
  //     path: 'tour',
  //     select: 'name',
  //   })
  this.populate({
    path: 'user',
    select: 'name photo',
  });
  next();
});

// Static method to calculate average rating and quantity of ratings
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  // this points to the current model which is Review
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nunberRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  // console.log(stats);
  await Tour.findByIdAndUpdate(tourId, {
    ratingsQuantity: stats.length > 0 ? stats[0].nunberRating : 0,
    ratingsAverage: stats.length > 0 ? stats[0].avgRating : 4.5,
  });
};

// Middleware to calculate average rating and quantity of ratings
reviewSchema.post('save', function () {
  // this points to current review (document) this.constructor points to Review model
  this.constructor.calcAverageRatings(this.tour);
});

// reviewSchema.pre(/^findOneAnd/, async function (next) {
//   // // this points to the current query
//   // const r = await this.findOne();
//   // console.log(r);
//   // next();

//   const query = this.getQuery();
//   console.log(query);

//   // Retrieve the document using the query conditions
//   this.r = await this.model.findOne(query);

//   // Log the retrieved document
//   console.log('Document before update:', this.r);

//   // Proceed to the main operation
//   next();
// });

// reviewSchema.pre(/^findOneAnd/, async function (next) {
//   this.r = await this.clone().findOne();

//   next();
// });

// updation the ratingAverage and ratingQuantity after updating or deleting a review
reviewSchema.post(/^findOneAnd/, async (reviewDoc) => {
  // await this.clone().findOne(); does not work here because the query has already executed
  if (reviewDoc) {
    await reviewDoc.constructor.calcAverageRatings(reviewDoc.tour);
  }
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
