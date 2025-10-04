# 📚 Hospital Management Platform - Complete Artifact Registry

## 🌐 External Accessible Services (5 URLs)

1. **CRM Backend API**
   - URL: https://crm-backend-morphvm-mkofwuzh.http.cloud.morph.so
   - Type: REST API
   - Features: Patient/Owner management, appointments, communications

2. **CRM Frontend Interface**
   - URL: https://crm-frontend-morphvm-mkofwuzh.http.cloud.morph.so
   - Type: Web Application
   - Features: Dashboard for CRM operations

3. **HMS Module**
   - URL: https://hms-module-morphvm-mkofwuzh.http.cloud.morph.so
   - Type: Web Application
   - Features: Electronic Medical Records, billing, inventory

4. **Partner Integration Portal**
   - URL: https://partner-integration-morphvm-mkofwuzh.http.cloud.morph.so
   - Type: API/Portal
   - Features: Insurance, pharmacy, telemedicine integrations

5. **Unified Frontend Portal**
   - URL: https://unified-frontend-morphvm-mkofwuzh.http.cloud.morph.so
   - Type: Web Application
   - Features: Central dashboard for all modules

## 🔧 Local Services (SSH Tunnel Required)

6. **Operations Command Centre**
   - Port: 10001
   - Access: SSH tunnel required
   - Features: Real-time monitoring dashboards

7. **Analytics & ML Service**
   - Port: 13000
   - Access: SSH tunnel required
   - Features: Predictive analytics, ML models

8. **API Documentation**
   - Port: 8080
   - Access: SSH tunnel required
   - Features: Interactive API documentation

9. **Hospital Backend**
   - Port: 5000
   - Access: SSH tunnel required
   - Features: Core backend services

10. **Hospital App**
    - Port: 3001
    - Access: SSH tunnel required
    - Features: Hospital application interface

## 🗄️ Database

11. **Neon PostgreSQL Database**
    - Project: snowy-bird-64526166
    - Connection: postgresql://neondb_owner:npg_lIeD35dukpfC@ep-steep-river-ad25brti-pooler.c-2.us-east-1.aws.neon.tech/neondb
    - Features: 88 tables across 15 schemas
    - SSL: Required

## 📁 Code Repository

12. **GitHub Repository**
    - URL: https://github.com/femikupoluyi/hospital-management-platform
    - Features: Complete source code for all modules
    - Status: All code pushed and versioned

## 📄 Documentation

13. **Platform Summary**
    - File: /root/PLATFORM_SUMMARY.md
    - Features: Complete platform overview and status

14. **Test Suite**
    - File: /root/comprehensive_platform_test.js
    - Features: End-to-end testing for all modules

## 🏢 Business Website

15. **HealthFlow Alliance Business Site**
    - URL: https://preview--healthflow-alliance.lovable.app/
    - Features: Business description and services

## 🔑 Access Information

### SSH Access
```bash
ssh morphvm_mkofwuzh@ssh.cloud.morph.so
```

### SSH Tunnels for Local Services
```bash
# OCC Dashboard
ssh -L 10001:localhost:10001 morphvm_mkofwuzh@ssh.cloud.morph.so

# Analytics Service
ssh -L 13000:localhost:13000 morphvm_mkofwuzh@ssh.cloud.morph.so

# API Documentation
ssh -L 8080:localhost:8080 morphvm_mkofwuzh@ssh.cloud.morph.so
```

### PM2 Process Management
```bash
pm2 list              # View all running services
pm2 logs <service>    # View specific service logs
pm2 restart <service> # Restart a service
pm2 status            # Check service status
```

## ✅ All Artifacts Registered

Total Artifacts: 15
- External URLs: 5
- Local Services: 5
- Database: 1
- Repository: 1
- Documentation: 2
- Business Website: 1

All components of the Hospital Management Platform have been successfully registered and documented.
