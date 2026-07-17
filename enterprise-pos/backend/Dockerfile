# Use lightweight official Node image
FROM node:20-alpine

# Set environment
ENV NODE_ENV=production

# Set work directory
WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Expose backend API port
EXPOSE 8000

# Start server
CMD ["node", "server.js"]
