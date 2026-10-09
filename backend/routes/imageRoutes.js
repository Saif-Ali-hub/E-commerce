const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { getGridFSBucket } = require('../config/db');

const router = express.Router();

// Helper to determine Content-Type from filename
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
};

// Stream image from MongoDB GridFS or fallback to persistent directory
const streamImageHandler = async (req, res) => {
  try {
    const rawFilename = req.params.filename;
    const filename = path.basename(rawFilename); // Prevent path traversal

    const bucket = getGridFSBucket();

    if (bucket && mongoose.connection.readyState === 1) {
      const files = await bucket.find({ filename }).toArray();

      if (files && files.length > 0) {
        const file = files[0];
        const contentType = file.metadata?.contentType || getContentType(filename);
        res.set({
          'Content-Type': contentType,
          'Content-Length': file.length,
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'MongoDB-GridFS'
        });

        const downloadStream = bucket.openDownloadStreamByName(filename);
        downloadStream.on('error', (err) => {
          console.error(`GridFS streaming error for ${filename}:`, err.message);
          fallbackToDisk(filename, res);
        });
        return downloadStream.pipe(res);
      }
    }

    // Fallback to disk if not found in GridFS
    fallbackToDisk(filename, res);
  } catch (error) {
    console.error('Image route error:', error.message);
    fallbackToDisk(req.params.filename, res);
  }
};

const fallbackToDisk = (filename, res) => {
  const cleanName = path.basename(filename);
  const possiblePaths = [
    path.join(__dirname, '..', 'public', 'images', cleanName),
    path.join(__dirname, '..', '..', 'frontend', 'images', cleanName),
    path.join(__dirname, '..', '..', 'images', cleanName)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      res.set({
        'Content-Type': getContentType(cleanName),
        'Cache-Control': 'public, max-age=86400',
        'X-Source': 'Local-Disk-Fallback'
      });
      return fs.createReadStream(p).pipe(res);
    }
  }

  res.status(404).json({
    success: false,
    message: `Image "${cleanName}" not found in MongoDB GridFS or local storage.`
  });
};

// GET /api/images/:filename
router.get('/:filename', streamImageHandler);

// GET /api/images/id/:id - Stream by GridFS ObjectId
router.get('/id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid GridFS ID format' });
    }

    const bucket = getGridFSBucket();
    if (!bucket) {
      return res.status(503).json({ success: false, message: 'GridFS bucket not initialized' });
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const files = await bucket.find({ _id: objectId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ success: false, message: 'Image not found in GridFS' });
    }

    const file = files[0];
    res.set({
      'Content-Type': file.metadata?.contentType || 'image/jpeg',
      'Content-Length': file.length,
      'Cache-Control': 'public, max-age=86400',
      'X-Source': 'MongoDB-GridFS'
    });

    bucket.openDownloadStream(objectId).pipe(res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = {
  imageRouter: router,
  streamImageHandler
};
