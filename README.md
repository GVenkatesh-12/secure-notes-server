# Notes API 📝

A secure REST API for managing personal notes with user authentication. Built with Node.js, Express, MongoDB, and JWT-based authentication.

## Features ✨

- **User Authentication**: Secure registration and login with JWT tokens
- **Password Security**: Passwords hashed using bcryptjs
- **Note Management**: Create, read, update, and delete personal notes
- **Ownership Protection**: Each note is tied to a user; users can only access their own notes
- **Token Blacklisting**: Logout functionality with token invalidation
- **CORS Enabled**: Allows frontend applications to connect
- **Automatic Timestamps**: Each note tracks creation and update times
- **Environment Configuration**: Secure configuration with .env file
- **Health Check Route**: Public endpoint for uptime checks
- **Input Validation**: Request payload validation for auth, notes, and password change
- **Rate Limiting**: Basic brute-force protection on auth routes

## Tech Stack 🛠️

- **Backend**: Node.js + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **CORS**: Cross-Origin Resource Sharing support

## Installation 🚀

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB instance
- npm or yarn

### Setup Steps

1. **Clone or navigate to the project**
   ```bash
   cd project-3-notes
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a .env file**
   ```
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_long_random_secret
   PORT=3000
   ```

4. **Start the server**
   ```bash
   npm start
   ```

The server will run on `http://localhost:3000`

## API Endpoints 📡

### Authentication Routes

#### Health Check
```
GET /health
```
Response: `200 OK`
```json
{
  "status": "ok"
}
```

#### Register a New User
```
POST /register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```
Response: `201 Created` - "User Registered!"
Validation: `email` must be valid format, `password` length must be 6-128 characters.

#### Login
```
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "yourpassword"
}
```
Response: `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com"
}
```
Validation: `email` must be valid format, `password` length must be 6-128 characters.

#### Logout
```
POST /logout
Authorization: Bearer <token>
```
Response: `200 OK` - "Logged out successfully"

#### Change Password
```
POST /change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPassword": "currentpassword",
  "newPassword": "newpassword"
}
```
Response: `200 OK`
```json
{
  "message": "Password updated successfully!"
}
```
Validation: `oldPassword` and `newPassword` are required; `newPassword` length must be 6-128 characters.

### Note Routes (Require Authentication)

All note routes require an `Authorization` header with your JWT token:
```
Authorization: Bearer <your_token>
```

#### Create a Note
```
POST /notes
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "My First Note",
  "content": "This is my note content"
}
```
Response: `201 Created`
Validation: `title` is required and must be a non-empty string. `content` must be a string if provided.

#### Get All Notes
```
GET /notes
Authorization: Bearer <token>
```
Response: Returns all notes for the authenticated user

#### Update a Note
```
PATCH /notes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content"
}
```
Response: `200 OK` - Updated note object
Validation: at least one valid field must be sent (`title` and/or `content`).

#### Delete a Note
```
DELETE /notes/:id
Authorization: Bearer <token>
```
Response: `200 OK` - Confirmation message

## Security Features 🔒

- **JWT Tokens**: Stateless authentication with expiring tokens (30 days)
- **Password Hashing**: Bcryptjs with salt rounds (10)
- **Token Blacklisting**: Invalid tokens after logout
- **Ownership Verification**: Users cannot access other users' notes
- **Email Validation**: Unique email addresses with case-insensitive matching
- **Authorization Header**: Standard Bearer token format
- **Rate Limiting**: Limits repeated auth attempts (register/login/change-password)
- **Startup Safety**: Server starts only after MongoDB connection succeeds

## Data Models 📊

### User Schema
```javascript
{
  email: String (unique, lowercase),
  password: String (hashed)
}
```

### Note Schema
```javascript
{
  title: String (required),
  content: String,
  owner: ObjectId (reference to User),
  createdAt: Date (auto),
  updatedAt: Date (auto)
}
```

## Error Handling ⚠️

The API returns appropriate HTTP status codes:
- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input or request format
- `401 Unauthorized` - Missing or invalid authentication token
- `403 Forbidden` - User not authorized to access this resource
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Server Error` - Internal server error

## Environment Variables 🔑

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/notesdb
JWT_SECRET=your_long_random_secret
PORT=3000
```

Required variables: `MONGO_URI` and `JWT_SECRET`. The API exits on startup if either is missing.

## Usage Example 💡

```bash
# Register
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Login
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass123"}'

# Create a note (use the token from login response)
curl -X POST http://localhost:3000/notes \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Note","content":"Note content here"}'
```

## Project Structure 📁

```
project-3-notes/
├── server.js           # Main server file with all routes
├── package.json        # Project dependencies
├── .env               # Environment variables (not tracked in git)
└── README.md          # This file
```

## Future Enhancements 🎯

- Add note categories/tags
- Implement note sharing between users
- Add search functionality
- Email verification on registration
- Password reset functionality
- Note versioning (history)

## License 📄

ISC

## Author
G Venkatesh 
> (X username: gvenkatesh_x)
