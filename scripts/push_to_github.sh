#!/bin/bash
# UroLog GitHub Push Automation Script
# Author: Antigravity AI

# Configuration
BRANCH="main"

echo "==================================================="
echo "🚀 UroLog GitHub Sync: Local -> Remote"
echo "==================================================="

# 1. Check for changes
CHANGES=$(git status --porcelain)
if [ -z "$CHANGES" ]; then
    echo "ℹ️ No changes to push."
    exit 0
fi

echo "Detected changes:"
git status -s

# 2. Get commit message
COMMIT_MSG=$1
if [ -z "$COMMIT_MSG" ]; then
    echo ""
    read -p "Enter commit message: " COMMIT_MSG
fi

if [ -z "$COMMIT_MSG" ]; then
    echo "❌ ERROR: Commit message cannot be empty."
    exit 1
fi

# 3. Step-by-step Execution
echo ""
echo "Step 1: Staging changes..."
git add .

echo "Step 2: Committing changes..."
git commit -m "$COMMIT_MSG"

echo "Step 3: Pushing to $BRANCH..."
git push origin $BRANCH

# 4. Success Check
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS: Changes pushed to GitHub!"
else
    echo ""
    echo "❌ ERROR: Push failed."
    exit 1
fi
