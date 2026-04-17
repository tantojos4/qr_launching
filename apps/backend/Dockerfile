FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY src/ ./src/

# Expose port
EXPOSE 3001

# Start server
CMD ["bun", "src/index.ts"]
