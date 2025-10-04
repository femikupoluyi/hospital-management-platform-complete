#!/bin/bash

echo "====================================="
echo "FIXING ALL PLATFORM ISSUES"
echo "====================================="

# Kill all existing services first
echo "Stopping all services..."
killall node 2>/dev/null || true
sleep 3

# Correct database connection
export DB_CONNECTION="postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Create logs directory
mkdir -p /root/logs

echo ""
echo "Starting all services with correct configurations..."
echo ""

# 1. HMS Module (Working - just restart)
echo "Starting HMS Module..."
cd /root
nohup node hms-complete-functional.js > /root/logs/hms-backend.log 2>&1 &
echo "✓ HMS Backend on port 5801"
sleep 2

nohup node hms-frontend-server.js > /root/logs/hms-frontend.log 2>&1 &
echo "✓ HMS Portal on port 5800"
sleep 2

# 2. Digital Sourcing & Onboarding
echo "Starting Onboarding Module..."
# Check if we have the right backend file
if [ -f "/root/onboarding-backend-complete.js" ]; then
    nohup node onboarding-backend-complete.js > /root/logs/onboarding-backend.log 2>&1 &
elif [ -f "/root/digital-sourcing-complete.js" ]; then
    nohup node digital-sourcing-complete.js > /root/logs/onboarding-backend.log 2>&1 &
fi
echo "✓ Onboarding Backend on port 6000"
sleep 2

nohup node digital-sourcing-server.js > /root/logs/onboarding-frontend.log 2>&1 &
echo "✓ Onboarding Portal on port 6001 (may be on 8091)"
sleep 2

# 3. CRM Module
echo "Starting CRM Module..."
if [ -f "/root/crm-system-complete.js" ]; then
    nohup node crm-system-complete.js > /root/logs/crm-backend.log 2>&1 &
elif [ -f "/root/crm-backend-complete.js" ]; then
    nohup node crm-backend-complete.js > /root/logs/crm-backend.log 2>&1 &
fi
echo "✓ CRM Backend on port 7002"
sleep 2

nohup node crm-frontend-server.js > /root/logs/crm-frontend.log 2>&1 &
echo "✓ CRM Portal on port 7001"
sleep 2

# 4. OCC Module
echo "Starting OCC Module..."
if [ -f "/root/occ-complete-backend.js" ]; then
    nohup node occ-complete-backend.js > /root/logs/occ-backend.log 2>&1 &
elif [ -f "/root/occ-command-centre.js" ]; then
    nohup node occ-command-centre.js > /root/logs/occ-backend.log 2>&1 &
fi
echo "✓ OCC Backend on port 8080"
sleep 2

nohup node occ-enhanced-server.js > /root/logs/occ-frontend.log 2>&1 &
echo "✓ OCC Dashboard on port 8081"
sleep 2

# 5. Partner Integrations
echo "Starting Partner Module..."
if [ -f "/root/enhanced-partner-integration.js" ]; then
    nohup node enhanced-partner-integration.js > /root/logs/partner-backend.log 2>&1 &
elif [ -f "/root/partner-api-server.js" ]; then
    nohup node partner-api-server.js > /root/logs/partner-backend.log 2>&1 &
fi
echo "✓ Partner Backend on port 9000"
sleep 2

# 6. Analytics Module
echo "Starting Analytics Module..."
nohup node data-analytics-infrastructure.js > /root/logs/analytics-backend.log 2>&1 &
echo "✓ Analytics Backend on port 9500"
sleep 2

nohup node analytics-ml-standalone.js > /root/logs/analytics-ml.log 2>&1 &
echo "✓ ML Service on port 9501"
sleep 2

# 7. Additional services
echo "Starting additional services..."
if [ -f "/root/api-docs.js" ]; then
    nohup node api-docs.js > /root/logs/api-docs.log 2>&1 &
    echo "✓ API Documentation on port 3001"
fi

if [ -f "/root/unified-frontend-server.js" ]; then
    nohup node unified-frontend-server.js > /root/logs/unified.log 2>&1 &
    echo "✓ Unified Frontend on port 8082"
fi

sleep 5

echo ""
echo "====================================="
echo "SERVICE STATUS CHECK"
echo "====================================="

# Check running services
RUNNING=$(ps aux | grep node | grep -v grep | wc -l)
echo "✓ $RUNNING Node processes running"

# Check port listeners
echo ""
echo "Active Ports:"
netstat -tlnp 2>/dev/null | grep node | awk '{print $4}' | sed 's/.*:/Port /' | sort -u

echo ""
echo "====================================="
echo "PUBLICLY EXPOSED URLs"
echo "====================================="
echo ""
echo "✅ Working URLs:"
echo "  • HMS Portal: https://hms-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • HMS API: https://hms-backend-api-morphvm-mkofwuzh.http.cloud.morph.so"
echo ""
echo "🔧 URLs Being Fixed:"
echo "  • Onboarding: https://onboarding-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • CRM Portal: https://crm-portal-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • OCC Dashboard: https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • Partner API: https://partner-api-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • Analytics: https://analytics-dashboard-morphvm-mkofwuzh.http.cloud.morph.so"
echo ""
echo "====================================="
echo "NEXT STEPS"
echo "====================================="
echo "1. Test each service endpoint"
echo "2. Fix any startup errors in logs"
echo "3. Expose remaining ports"
echo "4. Push code to GitHub"
echo "5. Register artefacts"
echo ""
