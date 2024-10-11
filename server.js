const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('Uncaught Exception! Shutting down...');
  process.exit(1);
});

dotenv.config({ path: './config.env' }); // configure dotenv before app is imported so  that we can use the environment variables in app.js
const app = require('./app');

// connect to atlas database
mongoose
  .connect(
    process.env.DATABASE_ATLAS.replace(
      '<password>',
      process.env.DATABASE_PASSWORD,
    ),
  )
  .then(() => {
    // console.log(con.connections);
    console.log('Connected to the database');
  });
// .catch((err) => console.error('DB connection error:', err));

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('Unhandled Rejection! Shutting down...');
  server.close(() => {
    process.exit(1);
  });
});
