#!/bin/bash

echo "🚀 Setting up SomniaID Project..."

# Create directory structure
echo "📁 Creating project structure..."
mkdir -p somniaID/{frontend,backend,contracts,docs}
cd somniaID

# Install dependencies
echo "📦 Installing dependencies..."

# Backend
cd backend
npm init -y
npm install express cors helmet morgan dotenv socket.io mongoose bcryptjs jsonwebtoken ethers
npm install --save-dev @types/node typescript ts-node
cd ..

# Frontend  
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app
npm install ethers wagmi viem @rainbow-me/rainbowkit lucide-react framer-motion socket.io-client @headlessui/react @heroicons/react recharts react-hot-toast
cd ..

# Contracts
cd contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npx hardhat init
cd ..

# Create environment files
echo "⚙️  Creating environment files..."
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env  
cp frontend/.env.example frontend/.env.local

# Setup database (if Docker available)
if command -v docker &> /dev/null; then
    echo "🐳 Starting MongoDB with Docker..."
    docker-compose up -d mongodb
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit environment files with your settings"
echo "2. Deploy contracts: cd contracts && npx hardhat run scripts/deploy.js --network somnia"
echo "3. Start development: npm run dev"
echo ""
echo "🌟 Ready to win the hackathon! 🏆"