FROM node:18-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    exiftool \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

COPY backend/ ./backend/

WORKDIR /app/backend

RUN mkdir -p data temp_processing && chmod -R 777 data temp_processing

EXPOSE 8000

CMD ["node", "index.js"]
