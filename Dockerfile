FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app

# Baked into the bundle at build time — provide via: docker build --build-arg VITE_BAILORAMA_API_URL=https://api.example.com/api .
ARG VITE_BAILORAMA_API_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV VITE_BAILORAMA_API_URL=${VITE_BAILORAMA_API_URL}

RUN echo "VITE_BAILORAMA_API_URL (build-time) = '${VITE_BAILORAMA_API_URL}'"
RUN npm run build

FROM nginx:alpine AS runner

RUN apk add --no-cache wget
RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf '%s\n' \
    'server {' \
    '    listen 80;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
