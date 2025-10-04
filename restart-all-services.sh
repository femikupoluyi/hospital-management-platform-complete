#!/bin/bash

echo "====================================="
echo "RESTARTING ALL PLATFORM SERVICES"
echo "====================================="

# Kill all existing Node processes
echo "Stopping all existing services..."
pkill -f node
sleep 3

# Start services in background with proper ports

echo "Starting Module 1: Digital Sourcing & Partner Onboarding..."
cd /root
nohup node onboarding-backend-fixed.js > /root/logs/onboarding-backend.log 2>&1 &
echo "✓ Onboarding backend started on port 6000"
sleep 2

echo "Starting Module 2: CRM & Relationship Management..."
nohup node crm-backend-complete.js > /root/logs/crm-backend.log 2>&1 &
echo "✓ CRM backend started on port 7002"
sleep 2

echo "Starting Module 3: Hospital Management System..."
if [ -f "/root/hospital-management-system/hms-backend-fully-functional-fixed.js" ]; then
  cd /root/hospital-management-system
  nohup node hms-backend-fully-functional-fixed.js > /root/logs/hms-backend.log 2>&1 &
else
  cd /root
  nohup node hms-backend-complete.js > /root/logs/hms-backend.log 2>&1 &
fi
echo "✓ HMS backend started on port 5801"
sleep 2

echo "Starting Module 4: Operations Command Centre..."
cd /root
nohup node occ-command-centre.js > /root/logs/occ-backend.log 2>&1 &
echo "✓ OCC backend started on port 8080"
sleep 2

echo "Starting Module 5: Partner Integrations..."
nohup node enhanced-partner-integration.js > /root/logs/partner-backend.log 2>&1 &
echo "✓ Partner backend started on port 9000"
sleep 2

echo "Starting Module 6: Data & Analytics..."
nohup node data-analytics-infrastructure.js > /root/logs/analytics-backend.log 2>&1 &
echo "✓ Analytics backend started on port 9500"
nohup node analytics-ml-standalone.js > /root/logs/analytics-ml.log 2>&1 &
echo "✓ ML services started on port 9501"
sleep 2

# Start frontend servers
echo "Starting frontend services..."
nohup node digital-sourcing-server.js > /root/logs/onboarding-frontend.log 2>&1 &
echo "✓ Onboarding portal on port 6001"

nohup node crm-frontend-server.js > /root/logs/crm-frontend.log 2>&1 &
echo "✓ CRM portal on port 7001"

nohup node hospital-frontend/server.js > /root/logs/hms-frontend.log 2>&1 &
echo "✓ HMS portal on port 5800"

nohup node occ-enhanced-server.js > /root/logs/occ-frontend.log 2>&1 &
echo "✓ OCC dashboard on port 8081"

nohup node unified-frontend-server.js > /root/logs/unified-frontend.log 2>&1 &
echo "✓ Unified portal on port 8082"

nohup node api-docs.js > /root/logs/api-docs.log 2>&1 &
echo "✓ API documentation on port 3001"

sleep 5

echo ""
echo "====================================="
echo "ALL SERVICES STARTED"
echo "====================================="
echo ""
echo "Verifying services..."
ps aux | grep node | grep -v grep | wc -l
echo " Node processes running"
echo ""
echo "Service URLs:"
echo "- Onboarding: http://morphvm:6001"
echo "- CRM: http://morphvm:7001"
echo "- HMS: http://morphvm:5800"
echo "- OCC: http://morphvm:8081"
echo "- Partner API: http://morphvm:9000"
echo "- Analytics: http://morphvm:9500"
echo "- Unified Portal: http://morphvm:8082"
echo "- API Docs: http://morphvm:3001"
echo ""
