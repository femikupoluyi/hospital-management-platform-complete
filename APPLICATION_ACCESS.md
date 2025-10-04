# GrandPro HMSO Platform - Application Access Guide

## 🚀 Live Application URLs

### Frontend Application
**URL:** https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so
- **Status:** ✅ ONLINE
- **Description:** Main web interface for the Hospital Management Platform
- **Port:** 3000 (exposed)

### Backend API
**URL:** https://backend-morphvm-mkofwuzh.http.cloud.morph.so
- **Status:** ✅ ONLINE
- **Description:** RESTful API serving all platform modules
- **Port:** 5000 (exposed)

---

## 📊 Available Endpoints

### Core API Endpoints

#### Health & Status
- `GET /health` - Backend health check
- `GET /api` - API information and available modules

#### CRM Module
- `GET /api/crm/overview` - CRM dashboard statistics
- `GET /api/crm/owners` - List all hospital owners
- `GET /api/crm/owners/payouts` - View pending payouts
- `POST /api/crm/owners/satisfaction` - Submit satisfaction survey
- `GET /api/crm/patients` - List all patients
- `POST /api/crm/patients` - Register new patient
- `GET /api/crm/appointments` - List appointments
- `POST /api/crm/appointments` - Schedule new appointment
- `POST /api/crm/feedback` - Submit patient feedback
- `POST /api/crm/reminders` - Set appointment reminders
- `GET /api/crm/campaigns` - List communication campaigns
- `POST /api/crm/campaigns` - Create new campaign

#### Onboarding Module
- `GET /api/onboarding/hospitals` - List registered hospitals
- `GET /api/onboarding/applications` - View applications

#### Hospital Management System
- `GET /api/hms/overview` - HMS dashboard metrics

#### Operations Command Centre
- `GET /api/occ/metrics` - Real-time operational metrics

---

## 🔍 Testing the Application

### Quick Health Check
```bash
curl https://backend-morphvm-mkofwuzh.http.cloud.morph.so/health
```

### View CRM Statistics
```bash
curl https://backend-morphvm-mkofwuzh.http.cloud.morph.so/api/crm/overview
```

### Test Frontend Access
```bash
curl -I https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so
```

---

## 📈 Current System Metrics

### Platform Statistics
- **Active Owners:** 1
- **Total Patients:** 156
- **Today's Appointments:** 18
- **Pending Payouts:** GH₵25,000
- **Appointment Completion Rate:** 88.5%
- **Communication Open Rate:** 68.5%

### Hospital Operations
- **Total Beds:** 300
- **Occupancy Rate:** 75.5%
- **Active Doctors:** 45
- **Active Nurses:** 120
- **Monthly Revenue:** GH₵450,000

### Real-time Metrics
- **Current Occupancy:** 226 patients
- **Available Beds:** 74
- **Waiting Patients:** 8
- **Average Wait Time:** 35 minutes
- **Staff on Duty:** 165

---

## 🛠️ Process Management

### View Running Processes
```bash
pm2 list
```

### Restart Services
```bash
pm2 restart hospital-app     # Frontend
pm2 restart hospital-backend # Backend
```

### View Logs
```bash
pm2 logs hospital-app     # Frontend logs
pm2 logs hospital-backend # Backend logs
```

---

## 🔒 Database Connection

The platform uses a Neon PostgreSQL database:
- **Database:** hospital_management_platform
- **SSL:** Required
- **Tables:** 30+ across multiple schemas (onboarding, crm, hms, operations, communications, etc.)

---

## 🌐 Browser Access

1. Open your web browser
2. Navigate to: https://frontend-application-morphvm-mkofwuzh.http.cloud.morph.so
3. You'll see the GrandPro HMSO dashboard with:
   - Overview metrics
   - Owner management
   - Patient management
   - Appointment scheduling
   - Campaign management
   - Loyalty programs

---

## 📱 Module Status

| Module | Status | Features |
|--------|--------|----------|
| Digital Sourcing & Onboarding | ✅ Active | Hospital applications, scoring, contracts |
| Owner CRM | ✅ Active | Contract tracking, payouts, satisfaction |
| Patient CRM | ✅ Active | Registration, appointments, feedback, loyalty |
| Hospital Management SaaS | 🔄 In Progress | EMR, billing, inventory (Step 4) |
| Operations Command Centre | 📊 Basic | Real-time monitoring, alerts |
| Partner Integrations | 📅 Planned | Insurance, pharmacy, telemedicine |
| Data & Analytics | 📅 Planned | Predictive analytics, AI/ML |

---

## 🚨 Monitoring & Alerts

The platform includes:
- Real-time performance monitoring
- Low stock alerts
- Revenue tracking
- Patient flow analytics
- Staff KPI dashboards

---

## 📞 Support & Documentation

- **Technical Documentation:** Available in `/root/hospital-management-platform/`
- **API Testing:** Use the test script at `/root/test-endpoints.sh`
- **Architecture:** See ARCHITECTURE.md
- **Project Plan:** See PROJECT_PLAN.md

---

## ✅ Verification Status

All exposed endpoints have been tested and verified:
- Frontend application is accessible (HTTP 200)
- Backend API is responding correctly
- Database connections are active
- Process management via PM2 is configured
- Auto-restart on system reboot is enabled

---

**Last Updated:** September 30, 2025
**Platform Version:** 1.0.0 (MVP - Phase 1)
**Next Steps:** Continue with Step 4 - Hospital Management SaaS Module Implementation
