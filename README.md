# Travel Story Backend

A RESTful API for the Travel Story platform built with Express, MongoDB, and Node.js.

## Features
- Authentication (Register, Login, Me) using JWT
- Story Management (Create, Read, Update, Delete, Search, Filter, Pin)
- Image Upload (Local storage with Multer)

## Environment Variables
Create a `.env` file in `travel_story_backend` root:

```
PORT=3001
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/travel_story_db
ACCESS_TOKEN_SECRET=your_super_secret_key_here
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile (Requires Token)

### Stories
- `GET /api/stories` - Get all stories (Supports `q` for search, `tag`, `pinned`, `sort`, `page`, `limit`)
- `POST /api/stories` - Create a new story
- `GET /api/stories/:id` - Get a story by ID
- `PUT /api/stories/:id` - Update a story
- `DELETE /api/stories/:id` - Delete a story
- `PATCH /api/stories/:id/pin` - Toggle story pin status

### Upload
- `POST /api/upload` - Upload an image (Form-data: `image`)

## Running the server
```bash
npm start
```
