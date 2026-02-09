# LASUTH Queue Management System (QMS)

A modern, high-fidelity queue management and appointment booking solution designed specifically for Lagos State University Teaching Hospital (LASUTH). This comprehensive web application streamlines patient flow, reduces waiting times, and enhances the overall healthcare service delivery experience through real-time automation, AI assistance, and analytics.

## 🚀 Key Features

### 🤖 Intelligent AI Assistant
- **Live Chat Widget:** Context-aware AI assistant on the homepage.
- **Automated Assistance:** Helps users with **Login**, **Sign Up**, **Booking Appointments**, and **Tracking Queue Status**.
- **Smart Navigation:** Directs logged-in users to their specific dashboards (Admin, Doctor, Staff).
- **Hospital Knowledge Base:** Answers FAQs about location, visiting hours, and services.

### 🏥 Clinic & Patient Management
- **Online Appointment Booking:** Seamless interface for patients to book appointments with specific clinics using strict future-date validation.
- **My Appointments:** **Patients can easily find their booked appointments by searching with either their Ticket Code or Phone Number.**
- **Smart Check-in System:** Staff-assisted check-in process to validate appointments and assign queue numbers.
- **Multi-Clinic Support:** Scalable architecture supporting multiple specialized clinics (e.g., Paediatrics, General Practice) with custom color themes.

### 👥 Role-Based Dashboards & Security
- **Strict Access Control:** Unapproved users are automatically redirected to an "Awaiting Approval" page and cannot access dashboards.
- **Admin Dashboard:** Centralized control for managing clinics, users, system settings, and analytics.
- **Doctor Dashboard:** Clinicians can view their queue, call patients, and manage consultation status.
- **Staff Dashboard:** Front-desk tools for checking in patients (including Walk-ins), managing the queue, and handling inquiries.

### 📺 Real-Time Visualization & Audio
- **Queue Display Board:** Public-facing display showing current token numbers and counters.
- **Localized Voice Announcements:** Native Nigerian voice integration for calling numbers (e.g., "Ticket A-001, please proceed to Room 3").
- **Live Status Tracking:** Real-time updates powered by Supabase.

### 🛠 System Administration
- **User Management:** Role-based access control (RBAC) for Admins, Doctors, and Staff.
- **Site Settings:** Customizable branding, including logo uploads and clinic information.
- **Audit Logs:** Detailed tracking of system activities for security and accountability.

## 💻 Tech Stack

Built with the latest modern web technologies for performance, scalability, and maintainability:

- **Frontend:** [React](https://reactjs.org/) (v18) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/) for lightning-fast development
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) for a responsive, high-fidelity user interface
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL) for authentication, database, and real-time subscriptions
- **State Management:** React Context API
- **Charts & Reporting:** Recharts and jsPDF for data visualization and reporting

## ⚙️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lasuthqms
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Build for Production**
   ```bash
   npm run build
   ```

## 🔒 Security

- **Authentication:** Secure user authentication via Supabase Auth.
- **Row Level Security (RLS):** Strict database policies ensuring users only access data relevant to their role and clinic.
- **Approval Flow:** New signups require admin approval before accessing sensitive data.

## 📄 License

Internal proprietary software for Lagos State University Teaching Hospital with full ownership Olaitan Emmanuel.

This project is done by Coach Manuel. Contact me via +2348168882014 if you need my web development services
