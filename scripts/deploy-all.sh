#!/bin/bash

echo "🚀 SomniaID Full Deployment Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

command -v node >/dev/null 2>&1 || { print_error "Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { print_error "npm is required but not installed."; exit 1; }
command -v git >/dev/null 2>&1 || { print_error "git is required but not installed."; exit 1; }

print_success "All prerequisites met!"

# Install dependencies
print_status "Installing dependencies..."
npm run setup || { print_error "Failed to install dependencies"; exit 1; }
print_success "Dependencies installed!"

# Deploy smart contract
print_status "Deploying smart contract to Somnia..."
cd contracts
npx hardhat compile || { print_error "Smart contract compilation failed"; exit 1; }
npx hardhat run scripts/deploy.js --network somnia || { print_error "Contract deployment failed"; exit 1; }
CONTRACT_ADDRESS=$(cat .deployed_address 2>/dev/null || echo "")
cd ..

if [ -n "$CONTRACT_ADDRESS" ]; then
    print_success "Smart contract deployed: $CONTRACT_ADDRESS"
    
    # Update frontend environment
    echo "NEXT_PUBLIC_CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> frontend/.env.local
    echo "CONTRACT_ADDRESS=$CONTRACT_ADDRESS" >> backend/.env
else
    print_warning "Contract address not found, using existing configuration"
fi

# Build applications
print_status "Building applications..."

# Build frontend
print_status "Building frontend..."
cd frontend
npm run build || { print_error "Frontend build failed"; exit 1; }
cd ..
print_success "Frontend built successfully!"

# Build backend
print_status "Building backend..."
cd backend
npm run build || { print_error "Backend build failed"; exit 1; }
cd ..
print_success "Backend built successfully!"

# Start services
print_status "Starting services..."

# Start backend in background
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 5

# Start frontend
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

# Display information
echo ""
echo "🎉 SomniaID Deployment Complete!"
echo "================================="
echo "📱 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:5000"
echo "⛓️  Smart Contract: $CONTRACT_ADDRESS"
echo "🏥 Health Check: http://localhost:5000/health"
echo ""
echo "Process IDs:"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop all services:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
print_success "All services are running!"

# Keep script running
wait