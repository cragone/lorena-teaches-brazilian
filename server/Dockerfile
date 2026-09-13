FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

COPY --from=build /app /app
RUN mkdir -p /app/data

EXPOSE 4000
CMD ["node", "src/server.js"]
