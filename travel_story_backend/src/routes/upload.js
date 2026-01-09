const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Story = require('../models/Story');
const { uploadLocalFileToCloudinary } = require('../config/cloudinary');

/**
 * @swagger
 * tags:
 *   name: Uploads
 *   description: Image upload management
 */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/**
 * Best-effort local file cleanup (we store images in Cloudinary; local disk is only transient).
 */
async function safeUnlink(filePath) {
  try {
    await fs.promises.unlink(filePath);
  } catch (_) {
    // ignore
  }
}

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload an image (Cloudinary)
 *     description: >
 *       Uploads an image file to Cloudinary and returns its secure URL. Optionally, if `storyId`
 *       is provided (as a form field), the uploaded image URL is appended to that Story's `images` array.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               storyId:
 *                 type: string
 *                 description: Optional Story ID to attach this uploaded image to.
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imageUrl:
 *                   type: string
 *                   description: Cloudinary secure URL
 *                 publicId:
 *                   type: string
 *                   description: Cloudinary public_id
 *                 story:
 *                   type: object
 *                   description: Updated story (only if storyId provided)
 *       400:
 *         description: Validation error or no file
 *       404:
 *         description: Story not found (when storyId provided)
 *       500:
 *         description: Upload failed
 */
router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { storyId } = req.body || {};
    const localPath = req.file.path;

    try {
      // Upload to Cloudinary
      const uploadResult = await uploadLocalFileToCloudinary(localPath, {
        folder: process.env.CLOUDINARY_FOLDER || 'travel_stories',
      });

      const secureUrl = uploadResult.secure_url;
      const publicId = uploadResult.public_id;

      // Clean up local file after successful upload
      await safeUnlink(localPath);

      // Optionally store to Story.images
      if (storyId) {
        const story = await Story.findOne({ _id: storyId, author: req.user.id });
        if (!story) {
          return res.status(404).json({ message: 'Story not found' });
        }

        story.images = Array.isArray(story.images) ? story.images : [];
        story.images.push(secureUrl);
        await story.save();

        return res.json({ imageUrl: secureUrl, publicId, story });
      }

      return res.json({ imageUrl: secureUrl, publicId });
    } catch (uploadError) {
      // Try to clean up local file on failure as well
      await safeUnlink(localPath);

      // Cloudinary config/credential issues should be obvious to the caller
      return res.status(500).json({
        message: uploadError.message || 'Image upload failed',
      });
    }
  });
});

module.exports = router;

