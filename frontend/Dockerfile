FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_BACKEND_URL
ARG VITE_DAILY_LIMIT=10
ARG VITE_RATE_LIMIT_ENABLED=false

ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_DAILY_LIMIT=${VITE_DAILY_LIMIT}
ENV VITE_RATE_LIMIT_ENABLED=${VITE_RATE_LIMIT_ENABLED}

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
