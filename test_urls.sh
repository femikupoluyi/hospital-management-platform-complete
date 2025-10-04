#!/bin/bash

echo "Testing External URLs..."
echo "========================"

urls=(
    "https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health"
    "https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/health"
    "https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://occ-enhanced-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://analytics-ml-morphvm-mkofwuzh.http.cloud.morph.so/api/health"
    "https://api-docs-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://main-frontend-morphvm-mkofwuzh.http.cloud.morph.so"
    "https://hospital-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health"
    "https://hospital-app-morphvm-mkofwuzh.http.cloud.morph.so"
)

for url in "${urls[@]}"; do
    response_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$response_code" = "200" ]; then
        echo "✅ $url - Status: $response_code"
    else
        echo "❌ $url - Status: $response_code"
    fi
done
