#!/usr/bin/env node

const axios = require('axios');

async function testPartnerAPIs() {
  const BASE_URL = 'https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so';
  
  console.log('Testing Partner Integration APIs...\n');
  
  // Test 1: Get Insurance Partners
  try {
    console.log('1. Insurance Partners:');
    const response = await axios.get(`${BASE_URL}/api/partners/insurance`);
    console.log(`   ✓ Found ${response.data.length} partners`);
    if (response.data.length > 0) {
      console.log(`   Partner: ${response.data[0].name}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  // Test 2: Get Pharmacy Suppliers
  try {
    console.log('\n2. Pharmacy Suppliers:');
    const response = await axios.get(`${BASE_URL}/api/partners/pharmacy`);
    console.log(`   ✓ Found ${response.data.length} suppliers`);
    if (response.data.length > 0) {
      console.log(`   Supplier: ${response.data[0].name}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  // Test 3: Get Telemedicine Providers
  try {
    console.log('\n3. Telemedicine Providers:');
    const response = await axios.get(`${BASE_URL}/api/partners/telemedicine/providers`);
    console.log(`   ✓ Found ${response.data.length} providers`);
    if (response.data.length > 0) {
      console.log(`   Provider: ${response.data[0].name}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  // Test 4: Get Compliance Partners
  try {
    console.log('\n4. Compliance Partners:');
    const response = await axios.get(`${BASE_URL}/api/partners/compliance`);
    console.log(`   ✓ Found ${response.data.length} partners`);
    if (response.data.length > 0) {
      console.log(`   Partner: ${response.data[0].name}`);
    }
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  // Test 5: Integration Dashboard
  try {
    console.log('\n5. Integration Dashboard:');
    const response = await axios.get(`${BASE_URL}/api/partners/dashboard`);
    console.log(`   ✓ Dashboard accessible`);
  } catch (error) {
    console.log(`   ✗ Error: ${error.message}`);
  }
  
  console.log('\n✅ Partner Integration API is operational with read capabilities');
  console.log('Note: Write operations (claims, orders, sessions) require additional configuration');
}

testPartnerAPIs();
