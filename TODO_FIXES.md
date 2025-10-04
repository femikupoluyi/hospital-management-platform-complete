# TODO List - Platform Fixes

## Critical Issues to Fix

### ✅ COMPLETED
- [x] HMS Backend is running on port 5801
- [x] HMS Frontend is running on port 5800
- [x] HMS Portal is publicly accessible at https://hms-portal-morphvm-mkofwuzh.http.cloud.morph.so
- [x] Database connection updated to correct Neon database

### 🔧 IN PROGRESS

#### Module 1: Digital Sourcing & Partner Onboarding
- [ ] Fix API endpoints returning 404
- [ ] Ensure onboarding backend is running on port 6000
- [ ] Make portal accessible at exposed URL

#### Module 2: CRM & Relationship Management  
- [ ] Fix API endpoints returning 500 errors
- [ ] Ensure CRM backend is running on port 7002
- [ ] Make CRM portal accessible at exposed URL

#### Module 3: Hospital Management SaaS
- [ ] Fix database schema mismatch (patients table has different structure)
- [ ] Fix all API endpoints returning 500 errors
- [ ] Test all forms in the HMS portal
- [ ] Ensure real-time WebSocket updates work

#### Module 4: Operations Command Centre
- [ ] Fix API endpoints returning 404
- [ ] Ensure OCC backend is running on port 8080
- [ ] Make OCC dashboard accessible at exposed URL

#### Module 5: Partner Integrations
- [ ] Service not running on port 9000 (ECONNREFUSED)
- [ ] Start partner integration service
- [ ] Expose partner API URL

#### Module 6: Data & Analytics
- [ ] Service not running on port 9500 (ECONNREFUSED)
- [ ] ML service not running on port 9501
- [ ] Start analytics services
- [ ] Expose analytics dashboard URL

### 📝 Testing Requirements
- [ ] All API endpoints must return proper responses
- [ ] All forms must be functional with validation
- [ ] All modules must integrate properly
- [ ] Real-time updates via WebSocket must work
- [ ] All exposed URLs must be accessible publicly

### 🚀 Deployment Tasks
- [ ] Create GitHub repository
- [ ] Push all code to GitHub
- [ ] Register all artefacts
- [ ] Document all exposed URLs
- [ ] Create comprehensive documentation

## Current Status
- **Total Modules**: 7
- **Working Modules**: 1 (HMS partially)
- **Failed Tests**: 25/25
- **Exposed URLs Working**: 1/6

## Next Steps
1. Fix service startup issues
2. Correct API endpoint mappings
3. Fix database schema issues
4. Test all forms end-to-end
5. Expose all URLs properly
6. Push to GitHub
7. Register artefacts
