#!/bin/bash

echo "================================================"
echo "Testing GrandPro HMSO Platform Endpoints"
echo "================================================"

BACKEND_URL="https://backend-morphvm-mkofwuzh.http.cloud.morph.so"
FRONTEND_URL="https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so"

echo ""
echo "1. Testing Backend Health Check..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/health" | jq

echo ""
echo "2. Testing API Info..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api" | jq

echo ""
echo "3. Testing CRM Overview..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/crm/overview" | jq

echo ""
echo "4. Testing Owners Endpoint..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/crm/owners" | jq '.[] | {owner_name, hospital_name, status}' 2>/dev/null || echo "No owners data"

echo ""
echo "5. Testing Patients Endpoint..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/crm/patients" | jq 'length' 2>/dev/null || echo "0"
echo "Total patients in system"

echo ""
echo "6. Testing Appointments Endpoint..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/crm/appointments" | jq 'length' 2>/dev/null || echo "0"
echo "Total appointments in system"

echo ""
echo "7. Testing Campaigns Endpoint..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/crm/campaigns" | jq '.[] | .campaign_name' 2>/dev/null || echo "No campaigns"

echo ""
echo "8. Testing Hospital Management Overview..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/hms/overview" | jq

echo ""
echo "9. Testing Operations Command Centre..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/occ/metrics" | jq '.realTimeMetrics'

echo ""
echo "10. Testing Frontend Accessibility..."
echo "-----------------------------------"
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
if [ "$STATUS_CODE" = "200" ]; then
    echo "✅ Frontend is accessible (Status: $STATUS_CODE)"
else
    echo "❌ Frontend returned status: $STATUS_CODE"
fi

echo ""
echo "11. Testing Onboarding Hospitals..."
echo "-----------------------------------"
curl -s "$BACKEND_URL/api/onboarding/hospitals" | jq 'length' 2>/dev/null || echo "0"
echo "Total hospitals in system"

echo ""
echo "================================================"
echo "All endpoint tests completed!"
echo "================================================"
echo ""
echo "Access URLs:"
echo "Frontend: $FRONTEND_URL"
echo "Backend API: $BACKEND_URL"
echo "API Health: $BACKEND_URL/health"
echo "API Docs: $BACKEND_URL/api"
echo "================================================"
