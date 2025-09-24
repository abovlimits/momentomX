const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const DatabaseManager = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const db = new DatabaseManager();

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:8000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
});

// JWT Authentication middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: 'connected' 
    });
});

// User Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Username, email, and password are required' });
        }

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Create user
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );

        const userId = result.insertId;

        // Create default preferences
        await db.query(
            'INSERT INTO user_preferences (user_id) VALUES (?)',
            [userId]
        );

        // Create user stats
        await db.query(
            'INSERT INTO user_stats (user_id) VALUES (?)',
            [userId]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId, username, email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: userId, username, email }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const users = await db.query(
            'SELECT id, username, email, password_hash FROM users WHERE username = ? AND is_active = TRUE',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const passwordValid = await bcrypt.compare(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, username: user.username, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const profile = await db.query(`
            SELECT 
                u.id, u.username, u.email, u.join_date, u.last_login,
                up.split_type, up.difficulty_level, up.day_override,
                us.total_workouts, us.current_streak_days, us.longest_streak_days,
                us.total_workout_time_minutes, us.total_calories_burned,
                us.last_workout_date, us.weight_kg, us.height_cm, us.fitness_level
            FROM users u
            LEFT JOIN user_preferences up ON u.id = up.user_id
            LEFT JOIN user_stats us ON u.id = us.user_id
            WHERE u.id = ?
        `, [userId]);

        if (profile.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(profile[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update User Preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { split_type, difficulty_level, day_override, gemini_api_key } = req.body;

        await db.query(`
            UPDATE user_preferences 
            SET split_type = ?, difficulty_level = ?, day_override = ?, gemini_api_key = ?
            WHERE user_id = ?
        `, [split_type, difficulty_level, day_override, gemini_api_key, userId]);

        res.json({ message: 'Preferences updated successfully' });
    } catch (error) {
        console.error('Preferences update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Machines
app.get('/api/user/machines', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;

        const machines = await db.query(
            'SELECT id, machine_name, added_date FROM user_machines WHERE user_id = ? AND is_active = TRUE ORDER BY machine_name',
            [userId]
        );

        res.json(machines);
    } catch (error) {
        console.error('Machines fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add Machine
app.post('/api/user/machines', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { machine_name } = req.body;

        if (!machine_name) {
            return res.status(400).json({ error: 'Machine name is required' });
        }

        await db.query(
            'INSERT IGNORE INTO user_machines (user_id, machine_name) VALUES (?, ?)',
            [userId, machine_name.trim()]
        );

        res.status(201).json({ message: 'Machine added successfully' });
    } catch (error) {
        console.error('Add machine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove Machine
app.delete('/api/user/machines/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const machineId = req.params.id;

        await db.query(
            'UPDATE user_machines SET is_active = FALSE WHERE id = ? AND user_id = ?',
            [machineId, userId]
        );

        res.json({ message: 'Machine removed successfully' });
    } catch (error) {
        console.error('Remove machine error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save Workout
app.post('/api/workouts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { 
            workout_type, 
            workout_date, 
            difficulty_level, 
            split_type, 
            workout_content,
            duration_minutes,
            calories_burned
        } = req.body;

        const result = await db.query(`
            INSERT INTO workouts 
            (user_id, workout_type, workout_date, difficulty_level, split_type, workout_content, duration_minutes, calories_burned)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, workout_type, workout_date, difficulty_level, split_type, workout_content, duration_minutes, calories_burned]);

        // Update user stats
        await db.query(`
            UPDATE user_stats 
            SET total_workouts = total_workouts + 1,
                total_workout_time_minutes = total_workout_time_minutes + COALESCE(?, 0),
                total_calories_burned = total_calories_burned + COALESCE(?, 0),
                last_workout_date = ?
            WHERE user_id = ?
        `, [duration_minutes, calories_burned, workout_date, userId]);

        res.status(201).json({ 
            message: 'Workout saved successfully',
            workoutId: result.insertId 
        });
    } catch (error) {
        console.error('Save workout error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get User Workouts
app.get('/api/workouts', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 10, offset = 0 } = req.query;

        const workouts = await db.query(`
            SELECT id, workout_type, workout_date, difficulty_level, split_type, 
                   workout_content, duration_minutes, calories_burned, completion_status,
                   created_at
            FROM workouts 
            WHERE user_id = ? 
            ORDER BY workout_date DESC, created_at DESC
            LIMIT ? OFFSET ?
        `, [userId, parseInt(limit), parseInt(offset)]);

        res.json(workouts);
    } catch (error) {
        console.error('Workouts fetch error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update User Stats (for streak calculation)
app.put('/api/user/stats', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { current_streak_days, longest_streak_days, weight_kg, height_cm, fitness_level } = req.body;

        await db.query(`
            UPDATE user_stats 
            SET current_streak_days = COALESCE(?, current_streak_days),
                longest_streak_days = COALESCE(?, longest_streak_days),
                weight_kg = COALESCE(?, weight_kg),
                height_cm = COALESCE(?, height_cm),
                fitness_level = COALESCE(?, fitness_level)
            WHERE user_id = ?
        `, [current_streak_days, longest_streak_days, weight_kg, height_cm, fitness_level, userId]);

        res.json({ message: 'Stats updated successfully' });
    } catch (error) {
        console.error('Stats update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize database and start server
async function startServer() {
    try {
        await db.initialize();
        
        app.listen(PORT, () => {
            console.log(`🚀 MomentumX Server running on port ${PORT}`);
            console.log(`📊 Database: ${process.env.DB_NAME || 'momentumx_db'}`);
            console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:8000'}`);
            console.log(`💡 Environment: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    await db.close();
    process.exit(0);
});

// Start the server
startServer();
