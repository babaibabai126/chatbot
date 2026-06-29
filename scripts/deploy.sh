#!/bin/bash
# ============================================
# 🚀 AAROHAN BUSINESS HUB - Deployment Setup
# ============================================
# 
# এই স্ক্রিপ্টটি আপনার অ্যাপকে Supabase + Vercel এ ডেপ্লয় করতে সাহায্য করবে
# This script helps you deploy to Supabase + Vercel
#
# Prerequisites:
#   1. Node.js 18+ installed
#   2. Vercel CLI: npm i -g vercel
#   3. Supabase account (free): https://supabase.com
#   4. Vercel account (free): https://vercel.com
#
# ============================================

set -e

echo ""
echo "🚀 AAROHAN BUSINESS HUB - Deployment Setup"
echo "============================================"
echo ""

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."

if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi
echo "✅ Vercel CLI found"

if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js 18+"
    exit 1
fi
echo "✅ npx found"

echo ""

# Step 2: Supabase Setup
echo "📋 Step 2: Supabase Database Setup"
echo "------------------------------------"
echo ""
echo "👉 Follow these steps in Supabase Dashboard:"
echo ""
echo "   1. Go to https://supabase.com and sign up / log in"
echo "   2. Click 'New Project'"
echo "   3. Project Name: aarohan-business-hub"
echo "   4. Database Password: (set a strong password, SAVE IT!)"
echo "   5. Region: Southeast Asia (Singapore) - closest to Bangladesh"
echo "   6. Click 'Create new project' (takes ~2 minutes)"
echo ""
echo "   7. After project is ready, go to Settings → Database"
echo "   8. Under 'Connection string', click 'URI' tab"
echo "   9. Copy the URL — this is your DATABASE_URL"
echo "  10. Copy the URL from 'JDBC' tab and replace 'jdbc:postgresql://' with 'postgresql://' — this is DIRECT_URL"
echo ""

read -p "👉 Enter your Supabase DATABASE_URL: " DB_URL
read -p "👉 Enter your Supabase DIRECT_URL: " DIRECT_URL

if [ -z "$DB_URL" ] || [ -z "$DIRECT_URL" ]; then
    echo "❌ Both URLs are required!"
    exit 1
fi

echo ""
echo "✅ Database URLs saved"

# Step 3: Switch to PostgreSQL schema
echo ""
echo "📋 Step 3: Switching to PostgreSQL schema..."
cp prisma/schema.supabase.prisma prisma/schema.prisma
echo "✅ Schema switched to PostgreSQL"

# Step 4: Generate Prisma client and push schema
echo ""
echo "📋 Step 4: Pushing database schema to Supabase..."

# Set env vars temporarily
export DATABASE_URL="$DB_URL"
export DIRECT_URL="$DIRECT_URL"

npx prisma generate
npx prisma db push

echo "✅ Database schema pushed to Supabase"

# Step 5: Seed data
echo ""
echo "📋 Step 5: Seeding initial data (3 businesses)..."

# The /api/business endpoint will auto-seed on first GET

echo "✅ Data will be auto-seeded on first app load"

# Step 6: Deploy to Vercel
echo ""
echo "📋 Step 6: Deploying to Vercel"
echo "------------------------------"
echo ""
echo "👉 Vercel CLI will now open a browser for login"
echo "   Then it will ask some questions — answer like this:"
echo ""
echo "   ? Set up and deploy? → Y"
echo "   ? Which scope? → (select your account)"
echo "   ? Link to existing project? → N"
echo "   ? Project name? → aarohan-business-hub"
echo "   ? Which directory is your code in? → ./"
echo "   ? Want to override the settings? → N"
echo ""

# Set environment variables for Vercel
vercel env add DATABASE_URL production <<< "$DB_URL"
vercel env add DIRECT_URL production <<< "$DIRECT_URL"

echo "✅ Environment variables added to Vercel"

# Deploy
vercel --prod

echo ""
echo "🎉 ============================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "🎉 ============================================"
echo ""
echo "📱 Your app is now live! Check the URL above."
echo ""
echo "📱 To install as an app on your phone:"
echo "   → Open the URL in Chrome (Android) or Safari (iOS)"
echo "   → Tap 'Add to Home Screen' or 'Install App'"
echo "   → The app icon will appear on your home screen!"
echo ""
echo "🔄 To make changes and redeploy:"
echo "   → Make your code changes"
echo "   → Run: vercel --prod"
echo ""
echo "📊 Supabase Dashboard: https://supabase.com/dashboard"
echo "📊 Vercel Dashboard: https://vercel.com/dashboard"
echo ""
