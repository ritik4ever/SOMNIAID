#!/bin/bash

echo "🚀 Starting SomniaID Production Deployment..."

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
else
    echo "❌ .env.production file not found"
    exit 1
fi

echo "📋 Environment: $NODE_ENV"
echo "🌐 Frontend URL: $FRONTEND_URL"
echo "🔗 Database: $MONGODB_URI"

# Build and deploy contracts
echo "🔨 Deploying Smart Contracts..."
cd contracts
npm run deploy:testnet
CONTRACT_ADDRESS=$(cat .deployed_address)
echo "✅ Contract deployed: $CONTRACT_ADDRESS"
cd ..

# Update environment with contract address
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> frontend/.env.production
echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> backend/.env.production

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# Deploy to production
echo "🚀 Deploying to production..."
docker-compose -f docker-compose.prod.yml up -d

# Run health checks
echo "🏥 Running health checks..."
sleep 30
curl -f http://localhost/health || exit 1
echo "✅ Backend health check passed"

curl -f http://localhost/ || exit 1
echo "✅ Frontend health check passed"

echo "🎉 Deployment completed successfully!"
echo "📱 Frontend: $FRONTEND_URL"
echo "🔗 API: $FRONTEND_URL/api"
echo "📊 Contract: https://shannon-explorer.somnia.network/address/$CONTRACT_ADDRESS"