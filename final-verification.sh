#!/bin/bash

echo "=========================================="
echo "FINAL PLATFORM VERIFICATION"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test function
test_url() {
    local url=$1
    local name=$2
    echo -n "Testing $name: "
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$status" = "200" ]; then
        echo -e "${GREEN}✅ PASSED${NC} (HTTP $status)"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $status)"
        return 1
    fi
}

echo "1. FRONTEND APPLICATIONS"
echo "------------------------"
test_url "https://main-hospital-frontend-morphvm-mkofwuzh.http.cloud.morph.so" "Main Hospital Portal"
test_url "https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so" "Operations Command Centre"
test_url "https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so" "API Documentation"
echo ""

echo "2. BACKEND SERVICES"
echo "-------------------"
test_url "https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health" "Backend API Health"
test_url "https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/health" "HMS Module Health"
test_url "https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/integrations/status" "Partner Integration"
echo ""

echo "3. DATA ENDPOINTS"
echo "-----------------"
test_url "https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/patients" "Patient Data"
test_url "https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/emr/records" "Medical Records"
test_url "https://occ-dashboard-morphvm-mkofwuzh.http.cloud.morph.so/api/occ/metrics/realtime" "Real-time Metrics"
echo ""

echo "=========================================="
echo "VERIFICATION COMPLETE"
echo "=========================================="
