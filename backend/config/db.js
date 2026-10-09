const mongoose = require('mongoose');

let gridFSBucket = null;

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/E-commerce';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    const dbName = conn.connection.name;
    console.log(`========================================`);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Active Database  : ${dbName}`);
    console.log(`Connection State : ${conn.connection.readyState === 1 ? 'Ready (Connected)' : 'Degraded'}`);
    console.log(`========================================`);

    if (dbName !== 'E-commerce') {
      console.warn(`[WARNING] Expected database "E-commerce" but connected to "${dbName}".`);
    }

    // Initialize GridFS bucket for persistent image storage
    gridFSBucket = new mongoose.mongo.GridFSBucket(conn.connection.db, {
      bucketName: 'product_images'
    });

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB runtime connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

const getGridFSBucket = () => {
  if (!gridFSBucket && mongoose.connection.readyState === 1) {
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'product_images'
    });
  }
  return gridFSBucket;
};

module.exports = {
  connectDB,
  getGridFSBucket,
  mongoose
};
