# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Accept build arguments
ARG GOOGLE_CLIENT_ID

# Set environment variable for Vite build
ENV VITE_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]