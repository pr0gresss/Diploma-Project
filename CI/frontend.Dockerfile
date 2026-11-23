# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global npm@12.1.0
COPY Frontend/package.json Frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY Frontend/ ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY CI/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/Frontend/browser /usr/share/nginx/html
EXPOSE 8080
