const express = require('express');
const router = express.Router();
const Story = require('../models/Story');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: Stories
 *   description: Story management
 */

// Get all stories (Search, Filter, Pagination, Sort)
router.get('/', auth, async (req, res) => {
  try {
    const { q, tag, pinned, page = 1, limit = 10, sort } = req.query;
    const query = { author: req.user.id };

    if (q) {
      query.$or = [
          { title: { $regex: q, $options: 'i' } },
          { content: { $regex: q, $options: 'i' } },
          { tags: { $regex: q, $options: 'i' } }
      ];
    }

    if (tag) {
      query.tags = { $regex: tag, $options: 'i' }; // Case insensitive tag match
    }

    if (pinned) {
      query.pinned = pinned === 'true';
    }

    const sortOptions = {};
    if (sort === 'oldest') {
      sortOptions.createdAt = 1;
    } else {
        // Default newest
        sortOptions.createdAt = -1;
    }

    const stories = await Story.find(query)
      .sort(sortOptions)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Story.countDocuments(query);

    res.json({
      stories,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Story
router.post('/', [auth, 
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { title, content, location, tags, images, pinned } = req.body;
        const story = new Story({
            title, content, location, tags, images, pinned,
            author: req.user.id
        });
        await story.save();
        res.status(201).json({ story, message: 'Story added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Story by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findOne({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.json({ story });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Story
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, content, location, tags, images, pinned } = req.body;
        const story = await Story.findOne({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });

        story.title = title || story.title;
        story.content = content || story.content;
        story.location = location || story.location;
        story.tags = tags || story.tags;
        story.images = images || story.images;
        if (pinned !== undefined) story.pinned = pinned;

        await story.save();
        res.json({ story, message: 'Story updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Story
router.delete('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findOneAndDelete({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.json({ message: 'Story deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Toggle Pin
router.post('/:id/pin', auth, async (req, res) => {
    try {
        const story = await Story.findOne({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });

        story.pinned = !story.pinned;
        await story.save();
        res.json({ story, message: 'Story pin status updated' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
