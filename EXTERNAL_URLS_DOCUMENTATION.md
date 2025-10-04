# Hospital Management Platform - External URLs Documentation

## Live Application URLs

### Core Applications

#### 1. CRM Backend API
- **URL**: https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so
- **Health Check**: https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so/api/health
- **Status**: ✅ WORKING
- **Key Endpoints**:
  - `/api/owners` - Owner management
  - `/api/patients` - Patient management  
  - `/api/appointments` - Appointment scheduling
  - `/api/communications/whatsapp` - WhatsApp messaging
  - `/api/communications/sms` - SMS messaging
  - `/api/communications/email` - Email messaging
  - `/api/campaigns` - Campaign management
  - `/api/loyalty` - Loyalty program

#### 2. CRM Frontend Interface
- **URL**: https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so
- **Status**: ✅ WORKING
- **Description**: Web interface for CRM operations with dashboards for Owners, Patients, Appointments, Campaigns, and Loyalty

#### 3. Unified Frontend Portal
- **URL**: https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so
- **Status**: ✅ WORKING
- **Description**: Unified dashboard aggregating all platform modules

#### 4. HMS Module (Hospital Management System)
- **URL**: https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so
- **Health Check**: https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so/api/health
- **Status**: ✅ WORKING
- **Key Features**:
  - Electronic Medical Records
  - Billing & Revenue Management
  - Inventory Management
  - Staff Scheduling
  - Real-time Analytics

#### 5. Partner Integration Portal
- **URL**: https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so
- **Health Check**: https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so/api/health
- **Status**: ✅ WORKING
- **Integrations**:
  - Insurance/HMO APIs
  - Pharmacy Suppliers
  - Telemedicine Providers
  - Government Reporting

### Internal Services (Currently Local Only)

These services are running and accessible locally but need additional configuration for external access:

1. **Hospital Onboarding App** (Port 3000)
   - Local: http://localhost:3000
   - PM2 Process: hospital-app

2. **Hospital Backend API** (Port 5000)
   - Local: http://localhost:5000
   - Health: http://localhost:5000/api/health
   - PM2 Process: hospital-backend

3. **Main Frontend** (Port 3001)
   - Local: http://localhost:3001
   - PM2 Process: main-frontend

4. **API Documentation** (Port 8080)
   - Local: http://localhost:8080
   - PM2 Process: api-docs

5. **OCC Dashboard** (Port 10001)
   - Local: http://localhost:10001
   - PM2 Process: occ-enhanced

6. **Analytics ML Service** (Port 13000)
   - Local: http://localhost:13000
   - Health: http://localhost:13000/api/health
   - PM2 Process: analytics-ml

## Database Information

- **Provider**: Neon PostgreSQL
- **Project**: snowy-bird-64526166
- **Region**: AWS US-East-1
- **Schemas**: 15 (onboarding, crm, hms, billing, inventory, hr, analytics, security, etc.)
- **Total Tables**: 88

## GitHub Repository

- **URL**: https://github.com/femikupoluyi/hospital-management-platform
- **Branch**: master
- **Last Updated**: October 1, 2025

## Process Management

All services are managed via PM2:
```bash
pm2 list  # View all running services
pm2 logs [service-name]  # View logs
pm2 restart [service-name]  # Restart a service
```

## Testing

Run comprehensive tests:
```bash
node /root/test-all-services.js  # Test all services
node /root/test-external-urls.js  # Test external URLs
node /root/comprehensive-platform-test.js  # Full platform test
```

## Summary

- **Total Services**: 11
- **Externally Accessible**: 5
- **Database Tables**: 88
- **Platform Status**: OPERATIONAL

All core modules are functioning with:
- ✅ Database connectivity
- ✅ API endpoints working
- ✅ Frontend interfaces accessible
- ✅ Health monitoring active
- ✅ Code repository synchronized
