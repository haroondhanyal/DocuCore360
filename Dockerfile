FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY scripts ./scripts
COPY src/workers/security.worker.mjs ./src/workers/security.worker.mjs
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p storage/uploads storage/temp storage/processed && chown -R node:node storage .next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm","run","start","--","--hostname","0.0.0.0"]
