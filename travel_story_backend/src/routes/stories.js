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
  
  // Log incoming payload for debugging
  console.log('Incoming payload:', JSON.stringify(body, null, 2));
  
  // Map 'story' to 'content' if content is not provided
  if (body.story && !body.content) {
    body.content = body.story;
  }
  
  // Map 'imageUrl' (single string) to 'images' (array) if images is not provided
  if (body.imageUrl && !body.images) {
    body.images = body.imageUrl ? [body.imageUrl] : [];
  } else if (body.images && !Array.isArray(body.images)) {
    // Ensure images is always an array
    body.images = [body.images];
  }
  
  // Map 'visitedLocation' (array) to both 'tags' and 'location' (first element)
  if (body.visitedLocation && Array.isArray(body.visitedLocation)) {
    if (!body.tags) {
      body.tags = body.visitedLocation;
    }
    // Set location to first visited location if not explicitly provided
    if (!body.location && body.visitedLocation.length > 0) {
      body.location = body.visitedLocation[0];
    }
  }
  
  // Ensure tags is an array
  if (body.tags && !Array.isArray(body.tags)) {
    body.tags = [body.tags];
  }
  
  // Remove fields that aren't in the Story model to avoid validation issues
  delete body.story;
  delete body.imageUrl;
  delete body.visitedLocation;
  delete body.visitedDate;
  
  console.log('Normalized payload:', JSON.stringify(body, null, 2));
  
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
    body('title').notEmpty().withMessage('Title is required'),
    body('content').optional(),
    body('story').optional(),
], async (req, res) => {
    // Normalize payload after validation but before checking results
    normalizeStoryPayload(req, res, () => {
        const errors = validationResult(req);
        
        // Check if either content or story was provided after normalization
        if (!req.body.content) {
            return res.status(400).json({ 
                errors: [{ msg: 'Content or story field is required', param: 'content' }] 
            });
        }
        
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        (async () => {
            try {
                const { title, content, location, tags, images, pinned } = req.body;
                const story = new Story({
                    title, 
                    content, 
                    location: location || '', 
                    tags: tags || [], 
                    images: images || [], 
                    pinned: pinned || false,
                    author: req.user.id
                });
                await story.save();
                res.status(201).json({ story, message: 'Story added successfully' });
            } catch (error) {
                console.error('Error creating story:', error);
                res.status(500).json({ message: error.message });
            }
        })();
    });
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
router.put('/:id', [auth], async (req, res) => {
    normalizeStoryPayload(req, res, async () => {
        try {
            const { title, content, location, tags, images, pinned } = req.body;
            const story = await Story.findOne({ _id: req.params.id, author: req.user.id });
            if (!story) return res.status(404).json({ message: 'Story not found' });

            if (title !== undefined) story.title = title;
            if (content !== undefined) story.content = content;
            if (location !== undefined) story.location = location;
            if (tags !== undefined) story.tags = tags;
            if (images !== undefined) story.images = images;
            if (pinned !== undefined) story.pinned = pinned;

            await story.save();
            res.json({ story, message: 'Story updated successfully' });
        } catch (error) {
            console.error('Error updating story:', error);
            res.status(500).json({ message: error.message });
        }
    });
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
