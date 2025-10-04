#!/bin/bash

echo "======================================"
echo "Hospital Management Platform - Application Verification"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_code=$3
    
    echo -n "Testing $name: "
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response_code" = "$expected_code" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $response_code)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response_code, expected $expected_code)"
        return 1
    fi
}

# Function to test API endpoint with JSON response
test_api_endpoint() {
    local name=$1
    local url=$2
    
    echo -n "Testing $name: "
    response=$(curl -s "$url")
    
    if echo "$response" | jq empty 2>/dev/null; then
        echo -e "${GREEN}✓ OK${NC} (Valid JSON)"
        echo "  Sample response: $(echo "$response" | jq -c '.' | head -c 100)..."
        return 0
    else
        echo -e "${YELLOW}⚠ WARNING${NC} (Non-JSON response)"
        return 1
    fi
}

echo "1. FRONTEND APPLICATIONS"
echo "------------------------"
test_endpoint "Main Frontend (CRM Dashboard)" "https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so" "200"
test_endpoint "HMS Module Interface" "https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so" "200"
test_endpoint "OCC Command Centre" "https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so" "200"
test_endpoint "API Documentation" "https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so" "200"

echo ""
echo "2. BACKEND APIs"
echo "---------------"
test_api_endpoint "CRM Overview" "https://backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/overview"
test_api_endpoint "Patient List" "https://backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/patients"
test_api_endpoint "Appointments" "https://backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/appointments"

echo ""
echo "3. HMS MODULE APIs"
echo "------------------"
test_api_endpoint "EMR Records" "https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so/api/emr/records"
test_api_endpoint "Billing" "https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so/api/billing/invoices"
test_api_endpoint "Inventory" "https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so/api/inventory/drugs"

echo ""
echo "4. INTEGRATION APIs"
echo "-------------------"
test_api_endpoint "Partner Integration Status" "https://partner-integration-api-morphvm-mkofwuzh.http.cloud.morph.so/api/integrations/status"

echo ""
echo "5. DATABASE STATUS"
echo "------------------"
echo -n "PostgreSQL Connection: "
if PGPASSWORD=$PGPASSWORD psql -h ep-floral-fog-a5j14u93.us-east-2.aws.neon.tech -U neondb_owner -d hospital_platform -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connected${NC}"
    
    # Get database statistics
    echo "  Database Statistics:"
    PGPASSWORD=$PGPASSWORD psql -h ep-floral-fog-a5j14u93.us-east-2.aws.neon.tech -U neondb_owner -d hospital_platform -t -c "
    SELECT 
        'Schemas: ' || COUNT(DISTINCT schema_name) 
    FROM information_schema.schemata 
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public');" | xargs echo "   "
    
    PGPASSWORD=$PGPASSWORD psql -h ep-floral-fog-a5j14u93.us-east-2.aws.neon.tech -U neondb_owner -d hospital_platform -t -c "
    SELECT 
        'Tables: ' || COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema');" | xargs echo "   "
    
    PGPASSWORD=$PGPASSWORD psql -h ep-floral-fog-a5j14u93.us-east-2.aws.neon.tech -U neondb_owner -d hospital_platform -t -c "
    SELECT 
        'Total Records: ' || 
        SUM(n_live_tup)::int 
    FROM pg_stat_user_tables;" | xargs echo "   "
else
    echo -e "${RED}✗ Connection Failed${NC}"
fi

echo ""
echo "6. PROCESS MONITORING"
echo "--------------------"
pm2 list | grep -E "online|stopped|errored" | while read line; do
    if echo "$line" | grep -q "online"; then
        echo -e "  ${GREEN}✓${NC} $line"
    elif echo "$line" | grep -q "stopped"; then
        echo -e "  ${YELLOW}⚠${NC} $line"
    elif echo "$line" | grep -q "errored"; then
        echo -e "  ${RED}✗${NC} $line"
    fi
done

echo ""
echo "======================================"
echo "EXPOSED APPLICATION URLS"
echo "======================================"
echo ""
echo "🌐 Frontend Applications:"
echo "  • Main Dashboard: https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • HMS Module: https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • OCC Command Centre: https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so"
echo "  • API Documentation: https://api-documentation-morphvm-mkofwuzh.http.cloud.morph.so"
echo ""
echo "🔧 Backend APIs:"
echo "  • CRM API: https://backend-morphvm-mkofwuzh.http.cloud.morph.so/api/*"
echo "  • HMS API: https://hms-module-api-morphvm-mkofwuzh.http.cloud.morph.so/api/*"
echo "  • Partner Integration: https://partner-integration-api-morphvm-mkofwuzh.http.cloud.morph.so/api/*"
echo ""
echo "======================================"
