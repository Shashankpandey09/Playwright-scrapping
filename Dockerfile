FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Install Google Chrome (not just chromium) to support channel: 'chrome'
RUN npx playwright install --with-deps chrome 

COPY . .


CMD ["npm", "run", "dev"]

