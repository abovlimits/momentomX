# MomentumX Server

Backend server for MomentumX workout generator with MySQL database integration.

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- MySQL Server (v8.0 or higher)
- npm or yarn

### Installation

1. **Install Dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Database Setup**
   - Install MySQL Server on your system
   - Create a MySQL user (or use root)
   - The server will automatically create the database and tables

3. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Update the database credentials in `.env`:
   ```
   DB_HOST=localhost
   DB_USER=your_mysql_username
   DB_PASSWORD=your_mysql_password
   DB_NAME=momentumx_db
   DB_PORT=3306
   JWT_SECRET=your_secure_jwt_secret
   PORT=3001
   CORS_ORIGIN=http://localhost:8000
   ```

4. **Start the Server**
   ```bash
   # Development mode (with auto-restart)
   npm run dev
   
   # Production mode
   npm start
   ```

## Features

### Automatic Database Management
- ✅ Auto-creates database if it doesn't exist
- ✅ Auto-creates all required tables on startup
- ✅ Handles database migrations and updates
- ✅ Comprehensive error handling

### Database Tables

1. **users** - User accounts and authentication
2. **user_machines** - User's available gym machines
3. **user_preferences** - Workout preferences and settings
4. **workouts** - Generated and saved workouts
5. **workout_exercises** - Individual exercises within workouts
6. **user_stats** - User statistics and progress tracking
7. **api_usage_logs** - API request logging and monitoring

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

#### User Management
- `GET /api/user/profile` - Get user profile and stats
- `PUT /api/user/preferences` - Update user preferences
- `PUT /api/user/stats` - Update user statistics

#### Machines
- `GET /api/user/machines` - Get user's machines
- `POST /api/user/machines` - Add new machine
- `DELETE /api/user/machines/:id` - Remove machine

#### Workouts
- `POST /api/workouts` - Save generated workout
- `GET /api/workouts` - Get user's workout history

#### System
- `GET /health` - Health check endpoint

## Security Features

- 🔐 JWT token-based authentication
- 🔒 Password hashing with bcrypt
- 🛡️ SQL injection prevention
- 🚫 CORS configuration
- 📝 Request logging and monitoring

## Development

### Database Schema
The server automatically creates the following schema:

- **Referential integrity** with foreign key constraints
- **Indexing** for optimal query performance  
- **Soft deletes** for data retention
- **Timestamps** for audit trails
- **Data validation** at database level

### Error Handling
- Comprehensive error logging
- Graceful error responses
- Database connection recovery
- Validation middleware

## Usage with Frontend

Update your frontend JavaScript to use the API endpoints:

```javascript
// Example: Login request
const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password })
});

const data = await response.json();
// Store the JWT token for subsequent requests
localStorage.setItem('token', data.token);
```

## Production Deployment

1. **Environment Variables**
   - Use strong JWT secrets
   - Configure production database
   - Set appropriate CORS origins
   - Enable SSL/HTTPS

2. **Database Security**
   - Create dedicated database user
   - Limit database permissions
   - Enable SSL connections
   - Regular backups

3. **Server Security**
   - Use process manager (PM2)
   - Configure reverse proxy (nginx)
   - Enable rate limiting
   - Monitor logs and metrics

## License
MIT License
