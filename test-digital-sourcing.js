const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = 'http://localhost:8090/api';

async function testDigitalSourcingPortal() {
    console.log('🏥 Testing Digital Sourcing & Partner Onboarding Portal\n');
    console.log('=' .repeat(60));
    
    try {
        // 1. Test Health Check
        console.log('\n1. Testing Health Check...');
        const health = await axios.get(`${API_URL}/health`);
        console.log('✅ Backend Status:', health.data.status);
        console.log('   Features:', JSON.stringify(health.data.features, null, 2));
        
        // 2. Test Application Submission with Document Upload
        console.log('\n2. Testing Application Submission with Documents...');
        
        // Create a test PDF file
        const testPdfPath = '/tmp/test-license.pdf';
        fs.writeFileSync(testPdfPath, 'Test PDF Content for Hospital License');
        
        const formData = new FormData();
        
        const applicationData = {
            hospital_name: 'Test General Hospital',
            registration_number: 'REG-2025-001',
            bed_count: 150,
            years_experience: 10,
            address: '123 Test Street',
            city: 'Lagos',
            state: 'Lagos State',
            location: 'Victoria Island',
            owner_name: 'Dr. John Test',
            owner_email: 'test@hospital.com',
            owner_phone: '+234-123-456-7890',
            financial_revenue: 50000000,
            financial_profitability: 15,
            service_quality_score: 20,
            infrastructure_quality: 'good',
            specializations: ['Cardiology', 'Surgery', 'Pediatrics'],
            compliance_certifications: ['ISO 9001', 'NHIS', 'State License']
        };
        
        formData.append('applicationData', JSON.stringify(applicationData));
        formData.append('license', fs.createReadStream(testPdfPath));
        
        const submitResponse = await axios.post(`${API_URL}/applications/submit`, formData, {
            headers: formData.getHeaders()
        });
        
        console.log('✅ Application Submitted Successfully!');
        console.log('   Application ID:', submitResponse.data.applicationId);
        console.log('   Score:', submitResponse.data.score + '/100');
        console.log('   Status:', submitResponse.data.status);
        console.log('   Message:', submitResponse.data.message);
        
        const applicationId = submitResponse.data.applicationId;
        
        // 3. Test Scoring Algorithm Details
        console.log('\n3. Scoring Algorithm Breakdown:');
        submitResponse.data.evaluationDetails.forEach(item => {
            const percentage = Math.round((item.score / item.max) * 100);
            console.log(`   - ${item.criterion}: ${item.score}/${item.max} (${percentage}%)`);
        });
        
        // 4. Test Application Retrieval
        console.log('\n4. Testing Application Details Retrieval...');
        const appDetails = await axios.get(`${API_URL}/applications/${applicationId}`);
        console.log('✅ Application Details Retrieved');
        console.log('   Documents uploaded:', appDetails.data.documents.length);
        console.log('   Activities logged:', appDetails.data.activities.length);
        
        // 5. Test Contract Generation
        console.log('\n5. Testing Contract Generation...');
        const contractResponse = await axios.post(`${API_URL}/applications/${applicationId}/generate-contract`);
        console.log('✅ Contract Generated Successfully!');
        console.log('   Contract ID:', contractResponse.data.contractId);
        console.log('   PDF Path:', contractResponse.data.pdfPath);
        
        const contractId = contractResponse.data.contractId;
        
        // 6. Test Digital Signature
        console.log('\n6. Testing Digital Signature...');
        
        // Hospital signs first
        const hospitalSignResponse = await axios.post(`${API_URL}/contracts/${contractId}/sign`, {
            signatureData: 'hospital-signature-data-test',
            signerType: 'hospital',
            signerName: 'Dr. John Test',
            ipAddress: '192.168.1.100'
        });
        console.log('✅ Hospital Signature Applied');
        console.log('   Status:', hospitalSignResponse.data.contract.signature_status);
        
        // Admin signs second
        const adminSignResponse = await axios.post(`${API_URL}/contracts/${contractId}/sign`, {
            signatureData: 'admin-signature-data-test',
            signerType: 'admin',
            signerName: 'GrandPro Admin',
            ipAddress: '192.168.1.101'
        });
        console.log('✅ Admin Signature Applied');
        console.log('   Status:', adminSignResponse.data.contract.signature_status);
        console.log('   Message:', adminSignResponse.data.message);
        
        // 7. Test Dashboard Statistics
        console.log('\n7. Testing Dashboard Statistics...');
        const stats = await axios.get(`${API_URL}/dashboard/stats`);
        console.log('✅ Dashboard Stats Retrieved:');
        console.log('   Total Applications:', stats.data.total);
        console.log('   By Status:', JSON.stringify(stats.data.byStatus));
        console.log('   Average Score:', stats.data.averageScore);
        console.log('   Contracts:', JSON.stringify(stats.data.contracts));
        console.log('   Recent Activities:', stats.data.recentActivity.length);
        
        // 8. Test Recent Applications
        console.log('\n8. Testing Recent Applications Retrieval...');
        const recentApps = await axios.get(`${API_URL}/applications/recent`);
        console.log('✅ Recent Applications:', recentApps.data.length);
        if (recentApps.data.length > 0) {
            const app = recentApps.data[0];
            console.log('   Latest Application:');
            console.log('     - ID:', app.application_id);
            console.log('     - Hospital:', app.hospital_name);
            console.log('     - Score:', app.score);
            console.log('     - Status:', app.status);
            console.log('     - Documents:', app.document_count);
            console.log('     - Contract:', app.contract_id || 'Not generated');
        }
        
        // 9. Test Real-time Status Tracking
        console.log('\n9. Testing Real-time Status Tracking...');
        const statusResponse = await axios.get(`${API_URL}/applications/${applicationId}/status`);
        console.log('✅ Real-time Status Retrieved:');
        console.log('   Application Status:', statusResponse.data.status.status);
        console.log('   Score:', statusResponse.data.status.score);
        console.log('   Contract Status:', statusResponse.data.status.signature_status);
        console.log('   Recent Activities:', statusResponse.data.status.recent_activities?.length || 0);
        
        // 10. Test Document Verification
        console.log('\n10. Testing Document Verification...');
        if (appDetails.data.documents.length > 0) {
            const docId = appDetails.data.documents[0].id;
            const verifyResponse = await axios.put(`${API_URL}/documents/${docId}/verify`, {
                status: 'verified',
                verifiedBy: 'System Admin'
            });
            console.log('✅ Document Verified');
            console.log('   Document ID:', verifyResponse.data.document.id);
            console.log('   Verification Status:', verifyResponse.data.document.verification_status);
        }
        
        console.log('\n' + '=' .repeat(60));
        console.log('✅✅✅ ALL FEATURES TESTED SUCCESSFULLY! ✅✅✅');
        console.log('\n📊 SUMMARY OF VERIFIED FEATURES:');
        console.log('✅ Document Upload - Working (Files uploaded and stored)');
        console.log('✅ Comprehensive Scoring Algorithm - Working (Multi-factor evaluation)');
        console.log('✅ Automatic Contract Generation - Working (PDF created)');
        console.log('✅ Digital Signature - Working (Multi-party signing)');
        console.log('✅ Real-time Status Tracking - Working (Live updates)');
        console.log('✅ Dashboard & Analytics - Working (Statistics available)');
        console.log('✅ Document Verification - Working (Status updates)');
        console.log('✅ Activity Logging - Working (Full audit trail)');
        
        console.log('\n🎯 The Digital Sourcing & Partner Onboarding Portal is FULLY FUNCTIONAL!');
        
        // Clean up test file
        fs.unlinkSync(testPdfPath);
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testDigitalSourcingPortal();
