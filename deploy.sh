#!/bin/bash

# List Manager App - Deployment Script
# Usage: ./deploy.sh [production|development]

set -e

ENV=${1:-development}

echo "🚀 Deploying List Manager App in $ENV mode..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

if [ "$ENV" == "production" ]; then
    # Production deployment
    echo "📦 Setting up production environment..."

    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        echo "⚠️  .env.production not found. Creating from .env.example..."
        cp .env.example .env.production
        echo "📝 Please edit .env.production with your production values before continuing."
        echo "   Especially set:"
        echo "   - DB_PASSWORD (strong password)"
        echo "   - JWT_SECRET (long random string)"
        echo "   - GOOGLE_CLIENT_ID (from Google Console)"
        echo ""
        read -p "Press Enter after editing .env.production to continue..."
    fi

    # Load environment variables
    source .env.production

    # Stop existing containers
    echo "🛑 Stopping existing containers..."
    docker-compose -f docker-compose.production.yml down

    # Build and start containers
    echo "🔨 Building and starting containers..."
    docker-compose -f docker-compose.production.yml up -d --build

    # Wait for services to be healthy
    echo "⏳ Waiting for services to be healthy..."
    sleep 10

    # Check health
    echo "🏥 Checking service health..."
    curl -f http://localhost:3001/api/health || echo "⚠️  Backend might still be starting..."

    echo "✅ Production deployment complete!"
    echo "   Frontend: http://localhost (port 80)"
    echo "   Backend: http://localhost:3001"
    echo ""
    echo "📌 Next steps:"
    echo "   1. Configure your domain's DNS to point to this server"
    echo "   2. Set up NGINX with SSL (see README.md)"
    echo "   3. Configure Google OAuth in Google Cloud Console"

else
    # Development deployment
    echo "🔧 Setting up development environment..."

    # Stop existing containers
    echo "🛑 Stopping existing containers..."
    docker-compose down

    # Build and start containers
    echo "🔨 Building and starting containers..."
    docker-compose up -d --build

    # Wait for services to be healthy
    echo "⏳ Waiting for services to be healthy..."
    sleep 10

    # Check health
    echo "🏥 Checking service health..."
    curl -f http://localhost:3001/api/health || echo "⚠️  Backend might still be starting..."

    echo "✅ Development deployment complete!"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend: http://localhost:3001"
    echo "   "
    echo "   Test credentials:"
    echo "   Email: test@example.com"
    echo "   Password: test123"
fi

echo ""
echo "📋 Useful commands:"
echo "   View logs:        docker-compose logs -f"
echo "   Stop services:    docker-compose down"
echo "   Reset database:   docker-compose down -v"
echo "   Enter container:  docker exec -it listapp-backend sh"