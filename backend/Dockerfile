FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code, scripts, and seeds (for running seed inside container)
COPY src ./src
COPY scripts ./scripts
COPY seeds ./seeds

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
