FROM --platform=linux/amd64 node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci


RUN npx playwright install --with-deps chromium chrome

COPY . .


CMD ["npm", "run", "dev"]