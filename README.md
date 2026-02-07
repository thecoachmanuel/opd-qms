# LASUTH Queue Management System (QMS)

A modern, high-fidelity queue management and appointment booking solution designed specifically for Lagos State University Teaching Hospital (LASUTH). This comprehensive web application streamlines patient flow, reduces waiting times, and enhances the overall healthcare service delivery experience through real-time automation and analytics.

## 🚀 Key Features

### 🏥 Clinic & Patient Management
- **Online Appointment Booking:** Seamless interface for patients to book appointments with specific clinics.
- **Smart Check-in System:** Staff-assisted check-in process to validate appointments and assign queue numbers.
- **Multi-Clinic Support:** Scalable architecture supporting multiple specialized clinics and departments.

### 👥 Role-Based Dashboards
- **Admin Dashboard:** Centralized control center for managing clinics, users, system settings, and viewing comprehensive analytics (PDF exports supported).
- **Doctor Dashboard:** Dedicated interface for clinicians to view their queue, call patients, and manage consultation status.
- **Staff Dashboard:** Front-desk tools for checking in patients, managing the queue, and handling inquiries.

### 📺 Real-Time Visualization
- **Queue Display Board:** Public-facing display mode for waiting areas, showing current token numbers and serving counters in real-time.
- **Live Status Tracking:** Real-time updates powered by Supabase, ensuring instant synchronization across all devices.

### 🛠 System Administration
- **User Management:** Role-based access control (RBAC) for Admins, Doctors, and Staff.
- **Site Settings:** Customizable branding, including logo uploads and clinic information.
- **Audit Logs:** Detailed tracking of system activities for security and accountability.

## 💻 Tech Stack

Built with the latest modern web technologies for performance, scalability, and maintainability:

- **Frontend:** [React](https://reactjs.org/) (v18) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [Vite](https://vitejs.dev/) for lightning-fast development and build capability
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

## 📄 License

Internal proprietary software for Lagos State University Teaching Hospital.

This project is done by Coach Manuel. Contact me via +2348168882014 if you need my web development services
