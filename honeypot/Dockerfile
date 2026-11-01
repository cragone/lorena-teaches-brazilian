FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4100 HITS_FILE=/data/hits.jsonl
COPY package.json server.js ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4100
CMD ["node", "server.js"]
