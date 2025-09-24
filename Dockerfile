FROM node:18-bullseye-slim

WORKDIR /app

# Install dependencies (avoid npm ci)
COPY package.json ./
RUN npm install --omit=dev

# Copy rest of the app
COPY . .

ENV NODE_ENV=production

# Healthcheck endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=5 \\
	CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3001)+'/health',res=>{process.exit(res.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Start the server
CMD ["node", "server/server.js"]
