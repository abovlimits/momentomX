# MomentumX - Railway Deployment Guide

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new)

## Setup Instructions

### 1. Deploy to Railway

1. Click the "Deploy on Railway" button above
2. Connect your GitHub repository
3. Railway will automatically detect your Node.js application

### 2. Configure Environment Variables

In your Railway dashboard, add these environment variables:

**Required:**

- `JWT_SECRET`: A secure random string for JWT token signing
- `NODE_ENV`: Set to `production`

**Database (if using external MySQL):**

- `DB_HOST`: Your MySQL host
- `DB_USER`: Your MySQL username
- `DB_PASSWORD`: Your MySQL password
- `DB_PORT`: Your MySQL port (default: 3306)
- `DB_NAME`: Your database name

**Optional:**

- `CORS_ORIGIN`: Set to your frontend URL or `*` for all origins
- `PORT`: Railway will set this automatically

### 3. Add MySQL Database

1. In Railway dashboard, go to your project
2. Click "Add Service" → "Database" → "MySQL"
3. Railway will automatically set the MySQL environment variables

### 4. Deploy

Railway will automatically deploy your application when you push to your connected repository.

## Health Check

Your application includes a health check endpoint at `/health` that Railway will use to monitor your service.

## Local Development

```bash
cd server
npm install
npm run dev
```

## Data Persistence

- The app now persists users, preferences, machines, and workouts to MySQL via the backend API.
- The previous auto-download of a `momentumx_users_database.json` file has been removed.
- You can still export your personal data manually using the Export Data button in the UI; this creates a JSON file for your own backup.

### API Overview

- POST `/api/auth/register` — create user; returns JWT
- POST `/api/auth/login` — authenticate; returns JWT
- GET `/api/user/profile` — profile + aggregated stats/preferences
- PUT `/api/user/preferences` — update split/difficulty/day override
- GET `/api/user/machines` — list machines
- POST `/api/user/machines` — add machine
- DELETE `/api/user/machines/:id` — remove machine
- POST `/api/workouts` — save generated workout and update stats
- GET `/api/workouts` — list workouts

Requests must include `Authorization: Bearer <token>` after logging in/registering.

## Project Structure

- `/server` - Backend Node.js application
- `/server/server.js` - Main server file
- `/server/database.js` - Database connection and management
- `railway.toml` - Railway configuration
- `Procfile` - Process file for deployment
