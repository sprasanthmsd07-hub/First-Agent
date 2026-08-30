# Frontend Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --production=false

# Copy source code
COPY . .

# Same-origin /api so the browser uses the public frontend hostname.
ENV REACT_APP_API_URL=/api

# Build the app
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# EKS Service targets 3000. Compose mounts nginx.conf and maps 3000:80, so leave the repo file on 80.
RUN sed -i 's/listen 80;/listen 3000;/' /etc/nginx/conf.d/default.conf

COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
