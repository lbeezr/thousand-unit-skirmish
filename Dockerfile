FROM node:24-alpine

ENV NODE_ENV=production \
    RTS_HOST=0.0.0.0 \
    PORT=4173

WORKDIR /app
COPY --chown=node:node server.mjs room-supervisor.mjs index.html style.css ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node maps/ ./maps/
COPY --chown=node:node assets/environment/frontier-v1/ ./assets/environment/frontier-v1/
RUN mkdir -p /app/custom-maps /app/room-data && chown node:node /app/custom-maps /app/room-data

USER node
EXPOSE 4173
CMD ["node", "room-supervisor.mjs"]
