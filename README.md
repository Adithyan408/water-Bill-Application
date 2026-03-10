# 💧 WaterBill: Smart Water Management System

A comprehensive, full-stack water billing and management solution designed for local utility providers and housing societies. This system streamlines the process from meter reading to bill settlement with a professional, mobile-first interface.

---

## 🚀 Overview

**WaterBill** automates the complexities of water utility management. It provides a robust backend to handle consumption logic and a cross-platform mobile application (built with React Native) that caters to Administrators, Meter Readers, and Consumers.

### 🌟 Key Features

#### 👑 Administration (Admin Hub)
*   **Real-time Analytics**: High-level dashboard showing monthly revenue, total outstanding dues, and critical debtor alerts.
*   **Tiered Tariff Engine**: Configurable 3-tier billing rules (Under Usage, Normal, and Surcharge) to encourage water conservation.
*   **Consumer Management**: Create, update, and manage consumer profiles, meter numbers, and opening balances.
*   **Support Configuration**: Centralized management of office and meter reader contact information.
*   **Secure Credentialing**: Multi-layer identity verification for sensitive profile updates.

#### 👤 Consumer Dashboard
*   **Interactive Billing History**: View current and past bills through a clean, accordion-style interface.
*   **Consumption Insights**: Track water usage in litres with detailed breakdowns of previous and current readings.
*   **Smart Notifications**: Immediate visibility of "Paid" vs "Unpaid" status with automated balance calculations.
*   **Account Self-Service**: Ability for consumers to update their own credentials and toggle password visibility for security.

#### 📏 Meter Reading (Built-in Logic)
*   Standardized flow for capturing readings.
*   Automatic tier calculation based on usage thresholds.
*   Debt aggregation logic for accurate "Total Payable" amounts.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React Native, Expo, Axios, React Navigation |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Mongoose) |
| **Security** | JWT (JSON Web Tokens), Bcryptjs (Password Hashing) |
| **UI/UX** | Custom Glassmorphic Elements, HSL Color Systems |

---

## 🔒 Security Features
*   **JWT Authentication**: Secure, token-based sessions for all user roles.
*   **Encrypted Storage**: Sensitive data and passwords are never stored in plain text.
*   **Strict Monthly Billing**: Prevents duplicate billings or reading modifications within the same calendar month to ensure data integrity.
*   **Visibility Control**: Toggle-able password fields (👁️/🙈) across login and profile screens.
*   **Authorization Guard**: Secondary identity verification for administrative changes.

---

## ⚙️ Installation & Setup

### 1. Prerequisites
*   Node.js (v16+)
*   MongoDB Instance
*   Expo Go (for mobile testing)

### 2. Backend Setup
```bash
cd server
npm install
# Create a .env file with your mongoURI and JWT_SECRET
npm start
```

### 3. Frontend Setup
```bash
cd app
npm install
npx expo start
```

---

## 📈 Billing Logic (Example)
The system uses a sophisticated tiered model:
1.  **Tier 1 (Under Usage)**: Flat rate for consumption below a certain threshold.
2.  **Tier 2 (Normal)**: Standard base rate for typical usage.
3.  **Tier 3 (Surcharge)**: Incremental rate per 1000L for consumption exceeding the normal limit.

---

## 📄 License
This project is proprietary and built for [USER NAME/COMPANY NAME].

---
*Built with ❤️ for efficient water management.*
