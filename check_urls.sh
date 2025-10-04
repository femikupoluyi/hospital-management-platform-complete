#!/bin/bash

echo "Checking all external URLs..."
echo "================================="

urls=(
    "https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://occ-command-centre-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://hospital-app-morphvm-mkofwuzh.http.cloud.morph.so/"
    "https://main-frontend-morphvm-mkofwuzh.http.cloud.morph.so/"
)

for url in "${urls[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$status" = "200" ]; then
        echo "✓ $url - Status: $status"
    else
        echo "✗ $url - Status: $status"
    fi
done
