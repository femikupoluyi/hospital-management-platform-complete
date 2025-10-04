#!/bin/bash

echo "====================================="
echo "FIXING ALL SERVICES WITH CORRECT DB"
echo "====================================="

# Correct connection string
export DB_CONNECTION="postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Kill all existing services
echo "Stopping all existing services..."
killall node 2>/dev/null || true
sleep 3

# Update connection string in all files
echo "Updating database connection strings..."
find /root -name "*.js" -type f -exec grep -l "postgresql://neondb_owner" {} \; | while read file; do
    sed -i "s|postgresql://neondb_owner:[^@]*@[^/]*/neondb[^'\"]*|$DB_CONNECTION|g" "$file"
done

# Start services
echo "Starting services..."

# HMS Backend and Frontend
cd /root
node hms-complete-functional.js > /root/logs/hms-backend.log 2>&1 &
echo "✓ HMS Backend started on port 5801"
sleep 2

node hms-frontend-server.js > /root/logs/hms-frontend.log 2>&1 &
echo "✓ HMS Frontend started on port 5800"
sleep 2

# Onboarding Module
node onboarding-backend-fixed.js > /root/logs/onboarding-backend.log 2>&1 &
echo "✓ Onboarding Backend started on port 6000"
sleep 2

node digital-sourcing-server.js > /root/logs/onboarding-frontend.log 2>&1 &
echo "✓ Onboarding Portal started on port 6001"
sleep 2

# CRM Module
node crm-backend-complete.js > /root/logs/crm-backend.log 2>&1 &
echo "✓ CRM Backend started on port 7002"
sleep 2

node crm-frontend-server.js > /root/logs/crm-frontend.log 2>&1 &
echo "✓ CRM Portal started on port 7001"
sleep 2

# OCC Module  
node occ-command-centre.js > /root/logs/occ-backend.log 2>&1 &
echo "✓ OCC Backend started on port 8080"
sleep 2

node occ-enhanced-server.js > /root/logs/occ-frontend.log 2>&1 &
echo "✓ OCC Dashboard started on port 8081"
sleep 2

# Partner Integrations
node enhanced-partner-integration.js > /root/logs/partner-backend.log 2>&1 &
echo "✓ Partner Backend started on port 9000"
sleep 2

# Analytics Module
node data-analytics-infrastructure.js > /root/logs/analytics-backend.log 2>&1 &
echo "✓ Analytics Backend started on port 9500"
sleep 2

node analytics-ml-standalone.js > /root/logs/analytics-ml.log 2>&1 &
echo "✓ ML Services started on port 9501"
sleep 2

# API Documentation
node api-docs.js > /root/logs/api-docs.log 2>&1 &
echo "✓ API Documentation started on port 3001"
sleep 2

# Unified Frontend
node unified-frontend-server.js > /root/logs/unified-frontend.log 2>&1 &
echo "✓ Unified Portal started on port 8082"
sleep 2

echo ""
echo "====================================="
echo "ALL SERVICES STARTED"
echo "====================================="
echo ""
ps aux | grep node | grep -v grep | wc -l
echo " Node processes running"
echo ""
echo "Publicly Exposed URLs:"
echo "- Onboarding Portal: https://onboarding-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "- CRM Portal: https://crm-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "- HMS Portal: https://hms-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "- OCC Dashboard: https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so"
echo "- Partner API: https://partner-api-morphvm-mkofwuzh.http.cloud.morph.so"
echo "- Analytics Dashboard: https://analytics-dashboard-morphvm-mkofwuzh.http.cloud.morph.so"
echo ""
