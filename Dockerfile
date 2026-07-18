# Stage 1: Build the React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node.js Express Backend & Package App
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Install backend production dependencies
COPY enterprise-pos/backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY enterprise-pos/backend/ ./

# Copy compiled frontend build to backend's public directory
COPY --from=frontend-builder /app/dist ./public

# Expose port 8000 (Express port)
EXPOSE 8000

# Start unified server
CMD ["node", "server.js"]
