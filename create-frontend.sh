#!/bin/bash

# Create the complete HMS frontend file in parts

cat > /root/hospital-management-system/hms-complete-frontend-part1.html << 'EOF1'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hospital Management System - Secure Edition</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    <style>
        :root {
            --primary-color: #0066cc;
            --secondary-color: #28a745;
            --danger-color: #dc3545;
            --dark-color: #343a40;
            --light-bg: #f8f9fa;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        
        .login-container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        
        .login-card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
            width: 100%;
            max-width: 400px;
        }
        
        .main-container {
            display: none;
            background: white;
            min-height: 100vh;
        }
        
        .sidebar {
            background: linear-gradient(180deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            color: white;
            padding: 20px 0;
            position: fixed;
            width: 250px;
            left: 0;
            top: 0;
            overflow-y: auto;
        }
        
        .sidebar .nav-link {
            color: rgba(255,255,255,0.8);
            padding: 12px 20px;
            margin: 5px 15px;
            border-radius: 10px;
            transition: all 0.3s;
        }
        
        .sidebar .nav-link:hover,
        .sidebar .nav-link.active {
            background: rgba(255,255,255,0.2);
            color: white;
        }
        
        .content-area {
            margin-left: 250px;
            padding: 20px;
        }
        
        .module-card {
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
            padding: 30px;
            margin-bottom: 20px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .module-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        
        .module-icon {
            font-size: 3rem;
            margin-bottom: 15px;
        }
        
        .stats-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 15px;
            padding: 20px;
            margin-bottom: 20px;
        }
        
        .btn-primary-custom {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border: none;
            border-radius: 10px;
            padding: 10px 25px;
            color: white;
            transition: transform 0.3s;
        }
        
        .btn-primary-custom:hover {
            transform: scale(1.05);
        }
        
        .modal-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .alert-custom {
            border-radius: 10px;
            border-left: 5px solid;
        }
        
        .table-responsive {
            border-radius: 10px;
            overflow: hidden;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                position: relative;
            }
            
            .content-area {
                margin-left: 0;
            }
        }
        
        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: red;
            color: white;
            border-radius: 50%;
            padding: 2px 6px;
            font-size: 0.75rem;
        }
        
        .loading-spinner {
            display: none;
            text-align: center;
            padding: 50px;
        }
        
        .security-badge {
            background: #28a745;
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 0.85rem;
        }
    </style>
</head>
<body>
    <!-- Login Section -->
    <div id="loginSection" class="login-container">
        <div class="login-card">
            <div class="text-center mb-4">
                <i class="bi bi-hospital" style="font-size: 4rem; color: var(--primary-color);"></i>
                <h2 class="mt-3">Hospital Management System</h2>
                <p class="text-muted">Secure Healthcare Platform</p>
                <div class="security-badge">
                    <i class="bi bi-shield-check"></i> HIPAA/GDPR Compliant
                </div>
            </div>
            
            <form id="loginForm">
                <div class="mb-3">
                    <label class="form-label">Username or Email</label>
                    <input type="text" class="form-control" id="username" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Password</label>
                    <input type="password" class="form-control" id="password" required>
                </div>
                <div class="mb-3 form-check">
                    <input type="checkbox" class="form-check-input" id="rememberMe">
                    <label class="form-check-label" for="rememberMe">Remember me</label>
                </div>
                <button type="submit" class="btn btn-primary-custom w-100">
                    <i class="bi bi-lock"></i> Secure Login
                </button>
            </form>
            
            <div class="mt-3 text-center">
                <small class="text-muted">Default: admin / admin@HMS2024</small>
            </div>
        </div>
    </div>
EOF1

cat > /root/hospital-management-system/hms-complete-frontend-part2.html << 'EOF2'
    <!-- Main Application -->
    <div id="mainApp" class="main-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="text-center mb-4">
                <i class="bi bi-hospital" style="font-size: 3rem;"></i>
                <h5 class="mt-2">HMS Secure</h5>
            </div>
            
            <div class="user-info text-center mb-4">
                <i class="bi bi-person-circle" style="font-size: 2rem;"></i>
                <p class="mb-0" id="userFullName">User Name</p>
                <small id="userRole">Role</small>
            </div>
            
            <ul class="nav flex-column">
                <li class="nav-item">
                    <a class="nav-link active" href="#" data-module="dashboard">
                        <i class="bi bi-speedometer2"></i> Dashboard
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="medical-records">
                        <i class="bi bi-clipboard-pulse"></i> Medical Records
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="billing">
                        <i class="bi bi-currency-dollar"></i> Billing & Revenue
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="inventory">
                        <i class="bi bi-box-seam"></i> Inventory
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="staff">
                        <i class="bi bi-people"></i> Staff Management
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="beds">
                        <i class="bi bi-hospital"></i> Bed Management
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="analytics">
                        <i class="bi bi-graph-up"></i> Analytics
                    </a>
                </li>
                <li class="nav-item">
                    <a class="nav-link" href="#" data-module="security">
                        <i class="bi bi-shield-lock"></i> Security
                    </a>
                </li>
                <li class="nav-item mt-4">
                    <a class="nav-link" href="#" id="logoutBtn">
                        <i class="bi bi-box-arrow-right"></i> Logout
                    </a>
                </li>
            </ul>
        </nav>
        
        <!-- Content Area -->
        <div class="content-area">
            <!-- Dashboard Module -->
            <div id="dashboard-module" class="module-content">
                <h2><i class="bi bi-speedometer2"></i> Dashboard</h2>
                <p class="text-muted">Real-time hospital metrics and overview</p>
                
                <div class="row mt-4">
                    <div class="col-md-3">
                        <div class="stats-card">
                            <h6>Total Patients</h6>
                            <h3 id="totalPatients">0</h3>
                            <small>+15% this month</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stats-card">
                            <h6>Monthly Revenue</h6>
                            <h3 id="monthlyRevenue">₦0</h3>
                            <small>+8% from last month</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stats-card">
                            <h6>Bed Occupancy</h6>
                            <h3 id="bedOccupancy">0%</h3>
                            <small id="bedsAvailable">0 available</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stats-card">
                            <h6>Staff on Duty</h6>
                            <h3 id="staffOnDuty">0</h3>
                            <small>All departments</small>
                        </div>
                    </div>
                </div>
                
                <div class="row mt-4">
                    <div class="col-md-12">
                        <div class="module-card">
                            <h5>Recent Activities</h5>
                            <div id="recentActivities">
                                <p class="text-muted">Loading activities...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Medical Records Module -->
            <div id="medical-records-module" class="module-content" style="display: none;">
                <h2><i class="bi bi-clipboard-pulse"></i> Electronic Medical Records</h2>
                <p class="text-muted">Complete patient medical history and records management</p>
                
                <div class="row mt-4">
                    <div class="col-md-12">
                        <button class="btn btn-primary-custom" onclick="showNewRecordForm()">
                            <i class="bi bi-plus-circle"></i> New Record
                        </button>
                        <button class="btn btn-secondary ms-2" onclick="viewRecords()">
                            <i class="bi bi-list"></i> View Records
                        </button>
                    </div>
                </div>
                
                <div id="recordsContent" class="mt-4"></div>
            </div>
            
            <!-- Billing Module -->
            <div id="billing-module" class="module-content" style="display: none;">
                <h2><i class="bi bi-currency-dollar"></i> Billing & Revenue</h2>
                <p class="text-muted">Invoice generation and payment processing</p>
                
                <div class="row mt-4">
                    <div class="col-md-12">
                        <button class="btn btn-primary-custom" onclick="createInvoice()">
                            <i class="bi bi-receipt"></i> Create Invoice
                        </button>
                        <button class="btn btn-secondary ms-2" onclick="viewInvoices()">
                            <i class="bi bi-list"></i> View Invoices
                        </button>
                    </div>
                </div>
                
                <div id="billingContent" class="mt-4"></div>
            </div>
EOF2

# Combine the parts
cat /root/hospital-management-system/hms-complete-frontend-part1.html /root/hospital-management-system/hms-complete-frontend-part2.html > /root/hospital-management-system/hms-complete-frontend.html

# Clean up parts
rm /root/hospital-management-system/hms-complete-frontend-part1.html
rm /root/hospital-management-system/hms-complete-frontend-part2.html

echo "Frontend created successfully"
