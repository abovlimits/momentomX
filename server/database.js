const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
    constructor() {
        this.connection = null;
        this.dbConfig = {
            host: process.env.DB_HOST || process.env.MYSQLHOST || 'switchback.proxy.rlwy.net',
            user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
            password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || 'UkYijJCKeMSStzybmiwmBzUDoGJWxDOs',
            port: process.env.DB_PORT || process.env.MYSQLPORT || 13816,
            database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
            multipleStatements: true,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };
    }

    async initialize() {
        try {
            console.log('🔌 Connecting to MySQL...');
            
            // Try connecting directly with database first
            try {
                this.connection = await mysql.createConnection(this.dbConfig);
                console.log('✅ Connected to MySQL database');
                await this.checkAndCreateTables();
                return this.connection;
            } catch (error) {
                console.log('Database might not exist, trying to create...');
                
                // Connect without database to create it
                const { database, ...configWithoutDb } = this.dbConfig;
                this.connection = await mysql.createConnection(configWithoutDb);
                
                // Create database if it doesn't exist
                await this.createDatabase();
                
                // Close connection and reconnect with database
                await this.connection.end();
                
                // Reconnect with database
                this.connection = await mysql.createConnection(this.dbConfig);
                
                console.log('✅ Connected to MySQL database');
                
                // Check and create tables
                await this.checkAndCreateTables();
                
                return this.connection;
            }
        } catch (error) {
            console.error('❌ Database initialization failed:', error.message);
            throw error;
        }
    }

    async createDatabase() {
        const dbName = this.dbConfig.database || process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway';
        try {
            await this.connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
            console.log(`✅ Database '${dbName}' ready`);
        } catch (error) {
            console.error('❌ Failed to create database:', error.message);
            throw error;
        }
    }

    async checkAndCreateTables() {
        console.log('🔍 Checking database tables...');
        
        const tables = [
            {
                name: 'users',
                schema: `
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        username VARCHAR(50) UNIQUE NOT NULL,
                        email VARCHAR(100) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        last_login TIMESTAMP NULL,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                `
            },
            {
                name: 'user_machines',
                schema: `
                    CREATE TABLE IF NOT EXISTS user_machines (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        machine_name VARCHAR(100) NOT NULL,
                        added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_machine (user_id, machine_name)
                    )
                `
            },
            {
                name: 'user_preferences',
                schema: `
                    CREATE TABLE IF NOT EXISTS user_preferences (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        split_type VARCHAR(50) DEFAULT 'upper-lower',
                        difficulty_level VARCHAR(20) DEFAULT 'intermediate',
                        day_override VARCHAR(50) DEFAULT 'auto',
                        preferred_workout_duration INT DEFAULT 60,
                        gemini_api_key VARCHAR(255) NULL,
                        reps_style VARCHAR(20) DEFAULT 'auto',
                        reps_min INT DEFAULT 8,
                        reps_max INT DEFAULT 12,
                        exercises_per_muscle VARCHAR(10) DEFAULT 'auto',
                        sets_per_exercise VARCHAR(10) DEFAULT 'auto',
                        rest_seconds VARCHAR(10) DEFAULT 'auto',
                        include_bodyweight BOOLEAN DEFAULT TRUE,
                        focused_muscle VARCHAR(50) DEFAULT 'none',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_preferences (user_id)
                    )
                `
            },
            {
                name: 'workouts',
                schema: `
                    CREATE TABLE IF NOT EXISTS workouts (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        workout_type VARCHAR(100) NOT NULL,
                        workout_date DATE NOT NULL,
                        difficulty_level VARCHAR(20) NOT NULL,
                        split_type VARCHAR(50) NOT NULL,
                        workout_content TEXT NOT NULL,
                        duration_minutes INT NULL,
                        calories_burned INT NULL,
                        completion_status ENUM('planned', 'in_progress', 'completed', 'skipped') DEFAULT 'planned',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        INDEX idx_user_date (user_id, workout_date),
                        INDEX idx_workout_type (workout_type),
                        INDEX idx_completion_status (completion_status)
                    )
                `
            },
            {
                name: 'workout_exercises',
                schema: `
                    CREATE TABLE IF NOT EXISTS workout_exercises (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        workout_id INT NOT NULL,
                        exercise_name VARCHAR(100) NOT NULL,
                        sets INT NOT NULL,
                        reps_min INT NOT NULL,
                        reps_max INT NULL,
                        weight_kg DECIMAL(5,2) NULL,
                        rest_seconds INT NULL,
                        notes TEXT NULL,
                        order_index INT NOT NULL DEFAULT 0,
                        completed BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE,
                        INDEX idx_workout_order (workout_id, order_index)
                    )
                `
            },
            {
                name: 'user_stats',
                schema: `
                    CREATE TABLE IF NOT EXISTS user_stats (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        total_workouts INT DEFAULT 0,
                        current_streak_days INT DEFAULT 0,
                        longest_streak_days INT DEFAULT 0,
                        total_workout_time_minutes INT DEFAULT 0,
                        total_calories_burned INT DEFAULT 0,
                        last_workout_date DATE NULL,
                        weight_kg DECIMAL(5,2) NULL,
                        height_cm INT NULL,
                        fitness_level VARCHAR(20) DEFAULT 'beginner',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        UNIQUE KEY unique_user_stats (user_id)
                    )
                `
            },
            {
                name: 'api_usage_logs',
                schema: `
                    CREATE TABLE IF NOT EXISTS api_usage_logs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NULL,
                        endpoint VARCHAR(100) NOT NULL,
                        method VARCHAR(10) NOT NULL,
                        status_code INT NOT NULL,
                        response_time_ms INT NULL,
                        ip_address VARCHAR(45) NULL,
                        user_agent TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                        INDEX idx_endpoint (endpoint),
                        INDEX idx_created_at (created_at),
                        INDEX idx_user_id (user_id)
                    )
                `
            }
        ];

        for (const table of tables) {
            try {
                await this.connection.execute(table.schema);
                console.log(`✅ Table '${table.name}' ready`);
            } catch (error) {
                console.error(`❌ Failed to create table '${table.name}':`, error.message);
                throw error;
            }
        }

        console.log('🎉 All database tables are ready!');

        // Ensure columns exist (robust across MySQL versions)
        await this.ensureRequiredColumns();
    }

    async getCurrentSchema() {
        const [rows] = await this.connection.execute('SELECT DATABASE() AS db');
        return rows[0]?.db;
    }

    async ensureColumn(table, column, definition) {
        const schema = await this.getCurrentSchema();
        if (!schema) return;
        const [rows] = await this.connection.execute(
            'SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
            [schema, table, column]
        );
        const exists = rows[0]?.cnt > 0;
        if (!exists) {
            console.log(`➕ Adding missing column ${table}.${column}`);
            await this.connection.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        }
    }

    async ensureRequiredColumns() {
        try {
            // user_preferences
            await this.ensureColumn('user_preferences', 'reps_style', "VARCHAR(20) DEFAULT 'auto'");
            await this.ensureColumn('user_preferences', 'reps_min', 'INT DEFAULT 8');
            await this.ensureColumn('user_preferences', 'reps_max', 'INT DEFAULT 12');
            await this.ensureColumn('user_preferences', 'exercises_per_muscle', "VARCHAR(10) DEFAULT 'auto'");
            await this.ensureColumn('user_preferences', 'sets_per_exercise', "VARCHAR(10) DEFAULT 'auto'");
            await this.ensureColumn('user_preferences', 'rest_seconds', "VARCHAR(10) DEFAULT 'auto'");
            await this.ensureColumn('user_preferences', 'include_bodyweight', 'BOOLEAN DEFAULT TRUE');
            await this.ensureColumn('user_preferences', 'focused_muscle', "VARCHAR(50) DEFAULT 'none'");

            // user_stats
            await this.ensureColumn('user_stats', 'total_workout_time_minutes', 'INT DEFAULT 0');
            await this.ensureColumn('user_stats', 'total_calories_burned', 'INT DEFAULT 0');
            await this.ensureColumn('user_stats', 'last_workout_date', 'DATE NULL');
            await this.ensureColumn('user_stats', 'weight_kg', 'DECIMAL(5,2) NULL');
            await this.ensureColumn('user_stats', 'height_cm', 'INT NULL');
            await this.ensureColumn('user_stats', 'fitness_level', "VARCHAR(20) DEFAULT 'beginner'");

            console.log('✅ Verified/added required columns for preferences and stats');
        } catch (error) {
            console.warn('⚠️ Column verification failed:', error.message);
        }
    }

    async query(sql, params = []) {
        try {
            const [results] = await this.connection.execute(sql, params);
            return results;
        } catch (error) {
            console.error('Database query error:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

module.exports = DatabaseManager;
