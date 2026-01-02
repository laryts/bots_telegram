#!/bin/bash
set -e

echo "🚀 Starting build process..."
echo "📁 Changing to diindiin directory..."
cd diindiin

echo "📦 Installing dependencies..."
npm ci

echo "🔨 Building TypeScript..."
npm run build

echo "✅ Build completed successfully!"

