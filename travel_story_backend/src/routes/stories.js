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

/**
 * @swagger
 * components:
 *   schemas:
 *     Story:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         location:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         pinned:
 *           type: boolean
 *         author:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     StoryInput:
 *       type: object
 *       required:
 *         - title
 *         - content
 *       properties:
 *         title:
 *           type: string
 *         content:
 *           type: string
 *         story:
 *           type: string
 *           description: Alias for content (frontend compatibility)
 *         location:
 *           type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         visitedLocation:
 *           type: array
 *           items:
 *             type: string
 *           description: Alias for tags (frontend compatibility)
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         imageUrl:
 *           type: string
 *           description: Single image URL (frontend compatibility)
 *         visitedDate:
 *           type: number
 *           description: Timestamp of visit date (frontend compatibility, stored in metadata)
 *         pinned:
 *           type: boolean
 */

/**
 * Middleware to normalize frontend payload to backend schema.
 * Maps frontend field names to backend expected names for backward compatibility.
 */
const normalizeStoryPayload = (req, res, next) => {
  const body = req.body;
  
  // Map 'story' to 'content' if content is not provided
  if (body.story && !body.content) {
    body.content = body.story;
  }
  
  // Map 'imageUrl' (single string) to 'images' (array) if images is not provided
  if (body.imageUrl && !body.images) {
    body.images = body.imageUrl ? [body.imageUrl] : [];
  }
  
  // Map 'visitedLocation' (array) to 'tags' if tags is not provided
  if (body.visitedLocation && !body.tags) {
    body.tags = Array.isArray(body.visitedLocation) ? body.visitedLocation : [];
  }
  
  // visitedDate is stored but not in the Story model, we can ignore it or add to a metadata field
  // For now, we'll just let it pass through harmlessly
  
  next();
};

/**
 * @swagger
 * /api/stories:
 *   get:
 *     summary: Get all stories with search, filter, and pagination
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search term for title, content, or tags
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filter by specific tag
 *       - in: query
 *         name: pinned
 *         schema:
 *           type: boolean
 *         description: Filter by pinned status (true/false)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [newest, oldest]
 *           default: newest
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of stories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Story'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
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

/**
 * @swagger
 * /api/stories:
 *   post:
 *     summary: Create a new story
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StoryInput'
 *     responses:
 *       201:
 *         description: Story created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 story:
 *                   $ref: '#/components/schemas/Story'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 */
router.post('/', [
    auth,
    normalizeStoryPayload,
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { title, content, location, tags, images, pinned } = req.body;
        const story = new Story({
            title, 
            content, 
            location, 
            tags, 
            images, 
            pinned,
            author: req.user.id
        });
        await story.save();
        res.status(201).json({ story, message: 'Story added successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/stories/{id}:
 *   get:
 *     summary: Get a story by ID
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Story ID
 *     responses:
 *       200:
 *         description: Story details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 story:
 *                   $ref: '#/components/schemas/Story'
 *       404:
 *         description: Story not found
 */
router.get('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findOne({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.json({ story });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/stories/{id}:
 *   put:
 *     summary: Update a story
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Story ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StoryInput'
 *     responses:
 *       200:
 *         description: Story updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 story:
 *                   $ref: '#/components/schemas/Story'
 *                 message:
 *                   type: string
 *       404:
 *         description: Story not found
 */
router.put('/:id', [auth, normalizeStoryPayload], async (req, res) => {
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

/**
 * @swagger
 * /api/stories/{id}:
 *   delete:
 *     summary: Delete a story
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Story ID
 *     responses:
 *       200:
 *         description: Story deleted successfully
 *       404:
 *         description: Story not found
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findOneAndDelete({ _id: req.params.id, author: req.user.id });
        if (!story) return res.status(404).json({ message: 'Story not found' });
        res.json({ message: 'Story deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/**
 * @swagger
 * /api/stories/{id}/pin:
 *   patch:
 *     summary: Toggle story pin status
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Story ID
 *     responses:
 *       200:
 *         description: Story pin status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 story:
 *                   $ref: '#/components/schemas/Story'
 *                 message:
 *                   type: string
 *       404:
 *         description: Story not found
 */
router.patch('/:id/pin', auth, async (req, res) => {
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
