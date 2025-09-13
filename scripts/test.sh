#!/bin/bash

echo "🧪 Running SomniaID Test Suite..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Run contract tests
echo "⚖️ Testing Smart Contracts..."
cd contracts
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run test
cd ..

# Run backend tests
echo "⚙️ Testing Backend API..."
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run test
cd ..

# Run frontend tests
echo "🎨 Testing Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
npm run test
npm run type-check
cd ..

# Run integration tests
echo "🔗 Running Integration Tests..."
cd contracts
npm run test:integration
cd ..

# Run E2E tests (if available)
if [ -f "frontend/playwright.config.ts" ]; then
    echo "🎭 Running E2E Tests..."
    cd frontend
    npx playwright test
    cd ..
fi

echo "✅ All tests completed successfully!"