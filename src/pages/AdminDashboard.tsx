import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getAllAppointments, adminGetClinics, adminCreateClinic, adminUpdateClinic, adminDeleteClinic, adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminGetAuditLogs, adminClearAuditLogs, adminApproveUser, adminGetSettings, adminUpdateSettings, adminGetDoctorStats, adminGetQueueHistory, adminDeleteAppointment } from '../services/api';
import { Calendar, Search, BarChart2, PieChart, Users, CheckSquare, XCircle, Download, Filter, FileText as FileIcon, Globe, Trash2 } from 'lucide-react';
import Avatar from '../components/Avatar';
import { SiteSettingsEditor } from '../components/SiteSettingsEditor';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RePieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { format, isSameDay, isWithinInterval, subDays, startOfMonth, startOfYear, isAfter } from 'date-fns';

export const AdminDashboard: React.FC = () => {
    const [appointments, setAppointments] = useState<any[]>([]);
    const [filter, setFilter] = useState('');
    const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'month' | 'year'>('all');
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'analytics' | 'clinics' | 'users' | 'logs' | 'site_config'>(() => {
        return (localStorage.getItem('admin_dashboard_tab') as any) || 'analytics';
    });
    const [clinics, setClinics] = useState<any[]>([]);

    useEffect(() => {
        localStorage.setItem('admin_dashboard_tab', tab);
    }, [tab]);
    const [users, setUsers] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [settings, setSettings] = useState<{ auto_approve_signups: boolean; hospital_location?: { latitude: number; longitude: number }; geofence_radius_km?: number }>({ auto_approve_signups: false, hospital_location: undefined, geofence_radius_km: 0.5 });
    const [doctorStats, setDoctorStats] = useState<Array<{ doctor_id: string; doctor_name: string; daily: number; weekly: number; monthly: number }>>([]);
    const [clinicForm, setClinicForm] = useState({ name: '', location: '', active_hours: '', theme_color: '#10B981' });
    const [userForm, setUserForm] = useState({ username: '', email: '', full_name: '', role: 'staff', password: '', confirm: '', clinic_id: '' });
    const [showCreatePwd, setShowCreatePwd] = useState(false);
    const [showCreateConfirm, setShowCreateConfirm] = useState(false);
    const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null);
    const [clinicErrors, setClinicErrors] = useState<{ name?: string; location?: string; active_hours?: string }>({});
    const [userErrors, setUserErrors] = useState<{ username?: string; email?: string; full_name?: string; role?: string; password?: string; confirm?: string }>({});
    const [createUserError, setCreateUserError] = useState<string | null>(null);
    const [editingClinicId, setEditingClinicId] = useState<string | null>(null);
    const [clinicEdit, setClinicEdit] = useState<{ name: string; location: string; active_hours: string; theme_color: string }>({ name: '', location: '', active_hours: '', theme_color: '' });
    const [clinicEditErrors, setClinicEditErrors] = useState<{ name?: string; location?: string; active_hours?: string }>({});
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [userEdit, setUserEdit] = useState<{ username: string; full_name?: string; role: string; clinic_id?: string; email?: string; phone?: string }>({ username: '', role: 'staff' });
    const [userEditErrors, setUserEditErrors] = useState<{ username?: string; full_name?: string; role?: string; email?: string; phone?: string }>({});
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'staff' | 'doctor'>('all');
    const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'approved' | 'pending'>('all');
    
    const pendingCount = users.filter(u => !u.approved).length;

    const getUniqueRandomColor = useCallback(() => {
        const usedColors = new Set(clinics.map((c: any) => c.theme_color?.toUpperCase()));
        let color = '';
        let attempts = 0;
        
        do {
            const letters = '0123456789ABCDEF';
            color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            attempts++;
            if (attempts > 100) break; 
        } while (usedColors.has(color));
        
        return color;
    }, [clinics]);

    const loadData = useCallback(async () => {
        try {
            const [apptData, queueData] = await Promise.all([
                getAllAppointments(),
                adminGetQueueHistory()
            ]);

            let combined: any[] = [];
            
            if (Array.isArray(apptData)) {
                combined = [...apptData];
            } else {
                console.error('Invalid appointment data format received:', apptData);
            }

            if (Array.isArray(queueData)) {
                // Merge queue items that don't have an appointment_id (Walk-ins/Direct Queue)
                const walkIns = queueData.filter((q: any) => !q.appointment_id);
                
                const mappedWalkIns = walkIns.map((q: any) => ({
                    id: `queue-${q.id}`,
                    created_at: q.created_at,
                    scheduled_time: q.arrival_time,
                    // Map queue status to appointment status for consistency
                    status: q.status === 'serving' ? 'checked_in' : 
                            q.status === 'done' ? 'completed' : 
                            q.status === 'waiting' ? 'checked_in' : 
                            q.status,
                    visit_type: 'walk-in',
                    ticket_code: q.ticket_number,
                    patients: { full_name: q.patient_name || 'Walk-in Patient', phone: '-' },
                    clinics: q.clinics,
                    consultation_notes: q.consultation_notes,
                    is_queue_only: true
                }));
                
                combined = [...combined, ...mappedWalkIns];
            }

            // Sort by time (latest first)
            combined.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
            
            setAppointments(combined);
        } catch (err) {
            console.error('Failed to load appointments', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadAdminData = useCallback(async () => {
        try {
            const [c, u, l, s] = await Promise.all([
                adminGetClinics(),
                adminGetUsers(),
                adminGetAuditLogs(),
                adminGetSettings()
            ]);
            setClinics(c);
            setUsers(u);
            setLogs(l);
            setSettings(s);
            try { const ds = await adminGetDoctorStats(); setDoctorStats(ds); } catch {}
        } catch (err) {
            console.error('Failed to load admin data', err);
        }
    }, []);

    useEffect(() => {
        loadData();
        loadAdminData();

        // Subscribe to real-time changes
        const channel = supabase
            .channel('admin-dashboard-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'appointments' },
                () => {
                    console.log('Realtime: appointments updated');
                    loadData();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'queue' },
                () => {
                    console.log('Realtime: queue updated');
                    loadData();
                    loadAdminData();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'audit_logs' },
                () => {
                    console.log('Realtime: audit logs updated');
                    loadAdminData();
                }
            )
            .subscribe((status) => {
                console.log('Admin Realtime Status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [loadData, loadAdminData]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    const getFilteredAppointments = () => {
        let res = appointments;
        const now = new Date();
        
        // Date Filter
        if (dateFilter === 'today') {
            res = res.filter(a => isSameDay(new Date(a.scheduled_time), now));
        } else if (dateFilter === '7days') {
            res = res.filter(a => isWithinInterval(new Date(a.scheduled_time), { start: subDays(now, 7), end: now }));
        } else if (dateFilter === 'month') {
            res = res.filter(a => isAfter(new Date(a.scheduled_time), startOfMonth(now)));
        } else if (dateFilter === 'year') {
            res = res.filter(a => isAfter(new Date(a.scheduled_time), startOfYear(now)));
        }

        // Text Search
        const searchFiltered = res.filter(a => 
            a.patients?.full_name?.toLowerCase().includes(filter.toLowerCase()) ||
            a.ticket_code?.toLowerCase().includes(filter.toLowerCase())
        );

        // Sort by Latest (Descending)
        return searchFiltered.sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());
    };

    const filtered = getFilteredAppointments();

    // Analytics Data Processing
    const totalAppointments = filtered.length;
    const completed = filtered.filter(a => a.status === 'completed').length;
    const waiting = filtered.filter(a => a.status === 'booked' || a.status === 'checked_in').length;
    const cancelled = filtered.filter(a => a.status === 'cancelled').length;
    const noShow = filtered.filter(a => a.status === 'no_show').length;
    const walkInCount = filtered.filter(a => a.visit_type === 'walk-in').length;
    const scheduledCount = filtered.filter(a => !a.visit_type || a.visit_type === 'scheduled').length;

    // By Clinic
    const byClinic = filtered.reduce((acc: any, curr) => {
        const name = curr.clinics?.name || 'Unknown';
        acc[name] = (acc[name] || 0) + 1;
        return acc;
    }, {});
    const clinicData = Object.keys(byClinic).map(name => ({ name, count: byClinic[name] }));

    // By Status
    const statusData = [
        { name: 'Completed', value: completed, color: '#10B981' }, // green-500
        { name: 'Waiting/In-Progress', value: waiting, color: '#3B82F6' }, // blue-500
        { name: 'Cancelled', value: cancelled, color: '#EF4444' }, // red-500
        { name: 'No Show', value: noShow, color: '#6B7280' } // gray-500
    ];

    // By Type
    const typeData = [
        { name: 'Scheduled', value: scheduledCount, color: '#8B5CF6' }, // violet-500
        { name: 'Walk-in', value: walkInCount, color: '#F59E0B' } // amber-500
    ];

    // By Hour (Simple distribution based on scheduled_time)
    const byHour = filtered.reduce((acc: any, curr) => {
        const hour = new Date(curr.scheduled_time).getHours();
        const label = `${hour}:00`;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {});
    Object.keys(byHour).sort();

    const exportCSV = () => {
        const headers = ['Date', 'Ticket', 'Patient', 'Clinic', 'Status', 'Type', 'Notes'];
        const rows = filtered.map(a => [
            new Date(a.scheduled_time).toLocaleString(),
            a.ticket_code,
            a.patients?.full_name || 'N/A',
            a.clinics?.name || 'N/A',
            a.status,
            a.visit_type || 'scheduled',
            a.consultation_notes || ''
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `analytics_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = async () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(22, 163, 74); // green-600
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("OPD Queue Management System", 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Analytics Report - ${format(new Date(), 'PP')}`, 105, 30, { align: 'center' });
        
        // Summary
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.text("Summary Stats", 14, 50);
        
        doc.setFontSize(10);
        doc.text(`Total Appointments: ${totalAppointments}`, 14, 60);
        doc.text(`No. of Completed Appointments: ${completed}`, 14, 66);
        doc.text(`No. of Waiting/In-Progress: ${waiting}`, 14, 72);
        doc.text(`No. of Cancelled/No Show: ${cancelled + noShow}`, 14, 78);
        doc.text(`Walk-ins: ${walkInCount}`, 110, 60);
        doc.text(`Scheduled: ${scheduledCount}`, 110, 66);
        
        // Table
        const tableColumn = ["Date", "Ticket", "Patient", "Clinic", "Status", "Type"];
        const tableRows = filtered.map(a => [
            new Date(a.scheduled_time).toLocaleDateString(),
            a.ticket_code,
            a.patients?.full_name || 'N/A',
            a.clinics?.name || 'N/A',
            a.status,
            a.visit_type || 'scheduled'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 90,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }
        });

        // Charts Page
        const charts = [
            { id: 'chart-visit-type', title: 'Visit Type Distribution' },
            { id: 'chart-clinic-stats', title: 'Appointments by Clinic' },
            { id: 'chart-status-dist', title: 'Status Distribution' }
        ];

        let yOffset = 30;
        let hasCharts = false;

        for (const chart of charts) {
            const element = document.getElementById(chart.id);
            if (element) {
                try {
                    // Only add new page if we successfully find at least one chart
                    if (!hasCharts) {
                        doc.addPage();
                        doc.setFillColor(22, 163, 74); // green-600
                        doc.rect(0, 0, 210, 20, 'F');
                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(16);
                        doc.text("Analytics Charts", 105, 13, { align: 'center' });
                        hasCharts = true;
                    }

                    // Small delay to ensure rendering stability
                    await new Promise(resolve => setTimeout(resolve, 100));

                    const canvas = await html2canvas(element, { 
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false
                    });
                    
                    const imgData = canvas.toDataURL('image/png');
                    const pdfWidth = doc.internal.pageSize.getWidth() - 40;
                    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                    // Check if new page needed
                    if (yOffset + pdfHeight > 270) {
                        doc.addPage();
                        yOffset = 20;
                    }

                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(12);
                    doc.text(chart.title, 20, yOffset);
                    doc.addImage(imgData, 'PNG', 20, yOffset + 5, pdfWidth, pdfHeight);
                    yOffset += pdfHeight + 20;
                } catch (err) {
                    console.error('Error capturing chart:', err);
                }
            }
        }

        doc.save(`analytics_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = (
            (u.username || '').toLowerCase().includes(userSearch.toLowerCase()) ||
            (u.full_name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
            (u.phone || '').toLowerCase().includes(userSearch.toLowerCase())
        );
        const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
        const matchesStatus = userStatusFilter === 'all' || 
            (userStatusFilter === 'approved' ? u.approved : !u.approved);
        return matchesSearch && matchesRole && matchesStatus;
    });

    const exportUsersCSV = () => {
        const headers = ['Username', 'Full Name', 'Role', 'Clinic', 'Email', 'Phone', 'Status'];
        const rows = filteredUsers.map(u => [
            u.username,
            u.full_name || '',
            u.role,
            u.clinic_id ? (clinics.find(c => c.id === u.clinic_id)?.name || u.clinic_id) : 'N/A',
            u.email || '',
            u.phone || '',
            u.approved ? 'Approved' : 'Pending'
        ]);
        
        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
            
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `users_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportUsersPDF = () => {
        const doc = new jsPDF();
        
        // Header
        doc.setFillColor(22, 163, 74); // green-600
        doc.rect(0, 0, 210, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("OPD Queue Management System", 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Users Report - ${format(new Date(), 'PP')}`, 105, 30, { align: 'center' });
        
        // Table
        const tableColumn = ["Username", "Full Name", "Role", "Clinic", "Email", "Status"];
        const tableRows = filteredUsers.map(u => [
            u.username,
            u.full_name || '',
            u.role,
            u.clinic_id ? (clinics.find(c => c.id === u.clinic_id)?.name || u.clinic_id) : 'N/A',
            u.email || '',
            u.approved ? 'Approved' : 'Pending'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74] }
        });

        doc.save(`users_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-500">Overview of all appointments, consultations, and analytics</p>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                        <button onClick={() => setTab('analytics')} className={`flex-1 xl:flex-none px-4 py-2 rounded-md whitespace-nowrap ${tab==='analytics'?'bg-green-600 text-white':'bg-white border border-gray-300 text-gray-700'}`}>Analytics</button>
                        <button onClick={() => setTab('clinics')} className={`flex-1 xl:flex-none px-4 py-2 rounded-md whitespace-nowrap ${tab==='clinics'?'bg-green-600 text-white':'bg-white border border-gray-300 text-gray-700'}`}>Clinics</button>
                        <button onClick={() => setTab('users')} className={`relative flex-1 xl:flex-none px-4 py-2 rounded-md whitespace-nowrap ${tab==='users'?'bg-green-600 text-white':'bg-white border border-gray-300 text-gray-700'}`}>
                            Users
                            {pendingCount > 0 && (
                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setTab('logs')} className={`flex-1 xl:flex-none px-4 py-2 rounded-md whitespace-nowrap ${tab==='logs'?'bg-green-600 text-white':'bg-white border border-gray-300 text-gray-700'}`}>Audit Logs</button>
                        <button onClick={() => setTab('site_config')} className={`flex-1 xl:flex-none px-4 py-2 rounded-md flex items-center justify-center whitespace-nowrap ${tab==='site_config'?'bg-green-600 text-white':'bg-white border border-gray-300 text-gray-700'}`}>
                            <Globe className="h-4 w-4 mr-2" />
                            Site Settings
                        </button>
                        <button onClick={() => {loadData(); loadAdminData();}} className="flex-1 xl:flex-none px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 whitespace-nowrap">Refresh</button>
                    </div>
                </div>

                {tab === 'analytics' && (
                <>
                {/* Filters & Export */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="flex items-center space-x-4 w-full md:w-auto">
                        <div className="relative w-full md:w-auto">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <select 
                                className="pl-10 pr-8 py-2 w-full md:w-48 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 appearance-none bg-white"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value as any)}
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="7days">Last 7 Days</option>
                                <option value="month">This Month</option>
                                <option value="year">This Year</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex space-x-2 w-full md:w-auto">
                         <button onClick={exportCSV} className="flex-1 md:flex-none justify-center flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                            <FileIcon className="h-4 w-4 mr-2" />
                            CSV
                        </button>
                        <button onClick={exportPDF} className="flex-1 md:flex-none justify-center flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            <Download className="h-4 w-4 mr-2" />
                            PDF Report
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total Appointments</p>
                                <p className="text-3xl font-bold text-gray-900">{totalAppointments}</p>
                            </div>
                            <Calendar className="h-10 w-10 text-blue-100 text-blue-500" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
                         <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">No. of Completed Appointments</p>
                                <p className="text-3xl font-bold text-gray-900">{completed}</p>
                            </div>
                            <CheckSquare className="h-10 w-10 text-green-500" />
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
                         <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">No. of Waiting/In-Progress</p>
                                <p className="text-3xl font-bold text-gray-900">{waiting}</p>
                            </div>
                            <Users className="h-10 w-10 text-yellow-500" />
                        </div>
                    </div>
                     <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-500">
                         <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">No. of Cancelled/No Show</p>
                                <p className="text-3xl font-bold text-gray-900">{cancelled + noShow}</p>
                            </div>
                            <XCircle className="h-10 w-10 text-red-500" />
                        </div>
                    </div>
                </div>

                {/* Analytics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Walk-in vs Scheduled */}
                    <div id="chart-visit-type" className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Users className="h-5 w-5 mr-2 text-gray-500" />
                            Visit Type Distribution
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={typeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {typeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Appointments by Clinic */}
                    <div id="chart-clinic-stats" className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <BarChart2 className="h-5 w-5 mr-2 text-gray-500" />
                            Appointments by Clinic
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={clinicData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#4F46E5" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Status Distribution */}
                    <div id="chart-status-dist" className="bg-white p-6 rounded-lg shadow-sm">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <PieChart className="h-5 w-5 mr-2 text-gray-500" />
                            Status Distribution
                        </h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Doctor Productivity */}
                <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Doctor Productivity</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {doctorStats.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data</td></tr>
                                ) : (
                                    doctorStats.map((d) => (
                                        <tr key={d.doctor_id}>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.doctor_name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{d.daily}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{d.weekly}</td>
                                            <td className="px-6 py-4 text-sm text-gray-700">{d.monthly}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Filters & Table */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex items-center space-x-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search by Patient Name or Ticket Code..."
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clinic</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor's Notes</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr><td colSpan={7} className="px-6 py-8 text-center">Loading...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No appointments found.</td></tr>
                                ) : (
                                    filtered.map((apt) => (
                                        <tr key={apt.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(apt.scheduled_time).toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    {apt.ticket_code}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{apt.patients?.full_name || 'N/A'}</div>
                                                <div className="text-sm text-gray-500">{apt.patients?.phone || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {apt.clinics?.name || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                    ${apt.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                                      apt.status === 'booked' ? 'bg-blue-100 text-blue-800' : 
                                                      apt.status === 'checked_in' ? 'bg-yellow-100 text-yellow-800' : 
                                                      apt.status === 'no_show' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {apt.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={apt.consultation_notes}>
                                                {apt.consultation_notes || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button 
                                                    onClick={async () => {
                                                        if (window.confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
                                                            try {
                                                                await adminDeleteAppointment(apt.id);
                                                                loadData();
                                                            } catch (err) {
                                                                console.error('Failed to delete appointment', err);
                                                                alert('Failed to delete record');
                                                            }
                                                        }
                                                    }}
                                                    className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Delete Record"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                </>
                )}

                {tab === 'clinics' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Clinic</h3>
                            <div className="space-y-3">
                                <input className={`w-full border rounded p-2 ${clinicErrors.name?'border-red-500':''}`} placeholder="Name" value={clinicForm.name} onChange={e=>{setClinicForm({...clinicForm,name:e.target.value}); if (e.target.value) setClinicErrors(prev=>({...prev,name:undefined}));}} />
                                {clinicErrors.name && (<div className="text-red-600 text-sm">{clinicErrors.name}</div>)}
                                <input className={`w-full border rounded p-2 ${clinicErrors.location?'border-red-500':''}`} placeholder="Location" value={clinicForm.location} onChange={e=>{setClinicForm({...clinicForm,location:e.target.value}); if (e.target.value) setClinicErrors(prev=>({...prev,location:undefined}));}} />
                                {clinicErrors.location && (<div className="text-red-600 text-sm">{clinicErrors.location}</div>)}
                                <input className={`w-full border rounded p-2 ${clinicErrors.active_hours?'border-red-500':''}`} placeholder="Active Hours (e.g. 08:00 - 16:00)" value={clinicForm.active_hours} onChange={e=>{setClinicForm({...clinicForm,active_hours:e.target.value}); if (e.target.value) setClinicErrors(prev=>({...prev,active_hours:undefined}));}} />
                                {clinicErrors.active_hours && (<div className="text-red-600 text-sm">{clinicErrors.active_hours}</div>)}
                                <div className="flex items-center gap-2">
                                    <label className="text-sm text-gray-700">Theme Color:</label>
                                    <input 
                                        type="color" 
                                        className="h-10 w-20 p-1 border rounded" 
                                        value={clinicForm.theme_color} 
                                        onChange={e=>setClinicForm({...clinicForm, theme_color: e.target.value})} 
                                    />
                                    <button 
                                        className="text-sm text-blue-600 hover:underline"
                                        onClick={()=>setClinicForm(prev=>({...prev, theme_color: getUniqueRandomColor()}))}
                                    >
                                        Generate Random
                                    </button>
                                </div>
                                <button
                                  className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                                  onClick={async()=>{
                                    const errors: { name?: string; location?: string; active_hours?: string } = {};
                                    if (!clinicForm.name.trim()) errors.name = 'Clinic name is required';
                                    if (!clinicForm.location.trim()) errors.location = 'Location is required';
                                    const ah = clinicForm.active_hours.trim();
                                    const re = /^\d{2}:\d{2}\s-\s\d{2}:\d{2}$/;
                                    if (!ah) errors.active_hours = 'Active hours are required';
                                    else if (!re.test(ah)) errors.active_hours = 'Use format HH:MM - HH:MM';
                                    setClinicErrors(errors);
                                    if (Object.keys(errors).length > 0) return;
                                    await adminCreateClinic({
                                      name: clinicForm.name.trim(),
                                      location: clinicForm.location.trim(),
                                      active_hours: clinicForm.active_hours.trim(),
                                      theme_color: clinicForm.theme_color || getUniqueRandomColor()
                                    });
                                    setClinicForm({name:'',location:'',active_hours:'', theme_color: getUniqueRandomColor()});
                                    loadAdminData();
                                  }}
                                >Create</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Clinics</h3>
                            <ul className="divide-y">
                                {clinics.map((c:any)=> (
                                    <li key={c.id} className="py-3">
                                        {editingClinicId === c.id ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input className={`w-full border rounded p-2 ${clinicEditErrors.name?'border-red-500':''}`} value={clinicEdit.name} onChange={e=>{setClinicEdit({...clinicEdit,name:e.target.value}); if (e.target.value) setClinicEditErrors(prev=>({...prev,name:undefined}));}} placeholder="Name" />
                                                    <input className={`w-full border rounded p-2 ${clinicEditErrors.location?'border-red-500':''}`} value={clinicEdit.location} onChange={e=>{setClinicEdit({...clinicEdit,location:e.target.value}); if (e.target.value) setClinicEditErrors(prev=>({...prev,location:undefined}));}} placeholder="Location" />
                                                    <input className={`w-full border rounded p-2 ${clinicEditErrors.active_hours?'border-red-500':''}`} value={clinicEdit.active_hours} onChange={e=>{setClinicEdit({...clinicEdit,active_hours:e.target.value}); if (e.target.value) setClinicEditErrors(prev=>({...prev,active_hours:undefined}));}} placeholder="Active Hours" />
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="color" 
                                                            className="h-10 w-20 p-1 border rounded" 
                                                            value={clinicEdit.theme_color} 
                                                            onChange={e=>setClinicEdit({...clinicEdit, theme_color: e.target.value})} 
                                                        />
                                                        <span className="text-sm text-gray-500">Theme Color</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={async()=>{
                                                        const errors: { name?: string; location?: string; active_hours?: string } = {};
                                                        if (!clinicEdit.name.trim()) errors.name = 'Required';
                                                        if (!clinicEdit.location.trim()) errors.location = 'Required';
                                                        const re = /^\d{2}:\d{2}\s-\s\d{2}:\d{2}$/;
                                                        if (!clinicEdit.active_hours.trim()) errors.active_hours = 'Required';
                                                        else if (!re.test(clinicEdit.active_hours.trim())) errors.active_hours = 'Use HH:MM - HH:MM';
                                                        setClinicEditErrors(errors);
                                                        if (Object.keys(errors).length > 0) return;
                                                        await adminUpdateClinic(c.id, { 
                                                            name: clinicEdit.name.trim(), 
                                                            location: clinicEdit.location.trim(), 
                                                            active_hours: clinicEdit.active_hours.trim(),
                                                            theme_color: clinicEdit.theme_color
                                                        });
                                                        setEditingClinicId(null);
                                                        setClinicEdit({ name: '', location: '', active_hours: '', theme_color: '' });
                                                        loadAdminData();
                                                    }}>Save</button>
                                                    <button className="px-3 py-1 border rounded" onClick={()=>{setEditingClinicId(null); setClinicEditErrors({});}}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full shadow-sm border border-gray-200" style={{ backgroundColor: c.theme_color || '#10B981' }} title="Display Theme Color"></div>
                                                    <div>
                                                        <div className="font-semibold">{c.name}</div>
                                                        <div className="text-sm text-gray-500">{c.location} • {c.active_hours}</div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <a className="px-3 py-1 border rounded bg-green-50 text-green-700" href={`/display/${encodeURIComponent(c.name)}`} target="_blank" rel="noopener noreferrer">Screen Display</a>
                                                    <button className="px-3 py-1 border rounded" onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/display/${encodeURIComponent(c.name)}`); alert('Display link copied');}}>Copy Link</button>
                                                    <button className="px-3 py-1 border rounded" onClick={()=>{setEditingClinicId(c.id); setClinicEdit({ name: c.name || '', location: c.location || '', active_hours: c.active_hours || '', theme_color: c.theme_color || '#10B981' });}}>Edit</button>
                                                    <button className="px-3 py-1 border rounded text-red-600" onClick={async()=>{if(confirm('Delete clinic?')){await adminDeleteClinic(c.id); loadAdminData();}}}>Delete</button>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                ))}
                                {clinics.length===0 && <li className="py-6 text-center text-gray-500">No clinics</li>}
                            </ul>
                        </div>
                    </div>
                )}

                {tab === 'users' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium">Auto-approve new signups</div>
                                    <div className="text-sm text-gray-500">When enabled, new users can sign in immediately.</div>
                                </div>
                                <button
                                  className={`px-4 py-2 rounded ${settings.auto_approve_signups ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}
                                  onClick={async()=>{
                                    const next = !settings.auto_approve_signups;
                                    const updated = await adminUpdateSettings({ auto_approve_signups: next });
                                    setSettings(updated);
                                    loadAdminData();
                                  }}
                                >{settings.auto_approve_signups ? 'On' : 'Off'}</button>
                            </div>
                            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500">Total Users</div>
                                    <div className="text-2xl font-bold">{users.length}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500">Admins</div>
                                    <div className="text-2xl font-bold">{users.filter(u=>u.role==='admin').length}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500">Staff</div>
                                    <div className="text-2xl font-bold">{users.filter(u=>u.role==='staff').length}</div>
                                </div>
                                <div className="p-4 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500">Doctors</div>
                                    <div className="text-2xl font-bold">{users.filter(u=>u.role==='doctor').length}</div>
                                </div>
                            </div>
                            
                            <div className="mt-6">
                                <div className="font-medium mb-2">Hospital Location (Self Check-in)</div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <input className="border rounded p-2" type="number" step="0.000001" placeholder="Latitude" value={settings.hospital_location?.latitude ?? ''} onChange={e=>setSettings(prev=>({ ...prev, hospital_location: { latitude: Number(e.target.value), longitude: prev.hospital_location?.longitude ?? 0 } }))} />
                                    <input className="border rounded p-2" type="number" step="0.000001" placeholder="Longitude" value={settings.hospital_location?.longitude ?? ''} onChange={e=>setSettings(prev=>({ ...prev, hospital_location: { latitude: prev.hospital_location?.latitude ?? 0, longitude: Number(e.target.value) } }))} />
                                    <input className="border rounded p-2" type="number" step="0.01" placeholder="Radius (km)" value={settings.geofence_radius_km ?? 0.5} onChange={e=>setSettings(prev=>({ ...prev, geofence_radius_km: Number(e.target.value) }))} />
                                </div>
                                <button className="mt-3 px-4 py-2 bg-green-600 text-white rounded" onClick={async()=>{
                                    const updated = await adminUpdateSettings({ auto_approve_signups: settings.auto_approve_signups, hospital_location: settings.hospital_location, geofence_radius_km: settings.geofence_radius_km });
                                    setSettings(updated);
                                }}>Save Location</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Add User</h3>
                            {createUserError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{createUserError}</div>}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                    <input className={`w-full border rounded p-2 ${userErrors.username?'border-red-500':''}`} placeholder="Username" value={userForm.username} onChange={e=>{setUserForm({...userForm,username:e.target.value}); if (e.target.value) setUserErrors(prev=>({...prev,username:undefined}));}} />
                                    {userErrors.username && (<div className="text-red-600 text-sm">{userErrors.username}</div>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input className={`w-full border rounded p-2 ${userErrors.email?'border-red-500':''}`} placeholder="Email" value={userForm.email} onChange={e=>{setUserForm({...userForm,email:e.target.value}); if (e.target.value) setUserErrors(prev=>({...prev,email:undefined}));}} />
                                    {userErrors.email && (<div className="text-red-600 text-sm">{userErrors.email}</div>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input className={`w-full border rounded p-2 ${userErrors.full_name?'border-red-500':''}`} placeholder="Full name" value={userForm.full_name} onChange={e=>{setUserForm({...userForm,full_name:e.target.value}); if (e.target.value) setUserErrors(prev=>({...prev,full_name:undefined}));}} />
                                    {userErrors.full_name && (<div className="text-red-600 text-sm">{userErrors.full_name}</div>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                    <select className={`w-full border rounded p-2 ${userErrors.role?'border-red-500':''}`} value={userForm.role} onChange={e=>{setUserForm({...userForm,role:e.target.value}); setUserErrors(prev=>({...prev,role:undefined}));}}>
                                        <option value="admin">admin</option>
                                        <option value="staff">staff</option>
                                        <option value="doctor">doctor</option>
                                    </select>
                                    {userErrors.role && (<div className="text-red-600 text-sm">{userErrors.role}</div>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Clinic (Optional)</label>
                                    <select className="w-full border rounded p-2" value={userForm.clinic_id} onChange={e=>setUserForm({...userForm,clinic_id:e.target.value})}>
                                        <option value="">Assign Clinic (optional)</option>
                                        {clinics.map((c:any)=> (<option key={c.id} value={c.id}>{c.name}</option>))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <input type={showCreatePwd?'text':'password'} className={`flex-1 border rounded p-2 ${userErrors.password?'border-red-500':''}`} placeholder="Password (min 6 chars)" value={userForm.password} onChange={e=>{setUserForm({...userForm,password:e.target.value}); if (e.target.value) setUserErrors(prev=>({...prev,password:undefined}));}} />
                                        <div className="flex gap-2 shrink-0">
                                            <button type="button" className="flex-1 md:flex-none px-3 border rounded hover:bg-gray-50" onClick={()=>setShowCreatePwd(v=>!v)}>{showCreatePwd?'Hide':'Show'}</button>
                                            <button type="button" className="flex-1 md:flex-none px-3 border rounded hover:bg-gray-50" onClick={()=>{
                                                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
                                                const array = new Uint32Array(16);
                                                window.crypto.getRandomValues(array);
                                                let out = '';
                                                for (let i = 0; i < array.length; i++) out += chars[array[i] % chars.length];
                                                setUserForm({...userForm,password: out, confirm: out});
                                                setShowCreatePwd(true);
                                                setShowCreateConfirm(true);
                                            }}>Generate</button>
                                        </div>
                                    </div>
                                    {userErrors.password && (<div className="text-red-600 text-sm">{userErrors.password}</div>)}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <input type={showCreateConfirm?'text':'password'} className={`flex-1 border rounded p-2 ${userErrors.confirm?'border-red-500':''}`} placeholder="Confirm Password" value={userForm.confirm} onChange={e=>{setUserForm({...userForm,confirm:e.target.value}); if (e.target.value) setUserErrors(prev=>({...prev,confirm:undefined}));}} />
                                        <button type="button" className="px-3 border rounded hover:bg-gray-50 shrink-0 md:flex-none" onClick={()=>setShowCreateConfirm(v=>!v)}>{showCreateConfirm?'Hide':'Show'}</button>
                                    </div>
                                    {userErrors.confirm && (<div className="text-red-600 text-sm">{userErrors.confirm}</div>)}
                                </div>
                                <button
                                  className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                                  onClick={async()=>{
                                    setCreateUserError(null);
                                    const errors: { username?: string; email?: string; full_name?: string; role?: string; password?: string; confirm?: string } = {};
                                    if (!userForm.username.trim()) errors.username = 'Username is required';
                                    if (!userForm.email.trim()) errors.email = 'Email is required';
                                    if (!userForm.full_name.trim()) errors.full_name = 'Full name is required';
                                    const validRoles = ['admin','staff','doctor'];
                                    if (!validRoles.includes(userForm.role)) errors.role = 'Role must be admin, staff, or doctor';
                                    if (!userForm.password || userForm.password.length < 6) errors.password = 'Min 6 characters';
                                    if (userForm.password !== userForm.confirm) errors.confirm = 'Passwords do not match';
                                    setUserErrors(errors);
                                    if (Object.keys(errors).length > 0) return;
                                    
                                    try {
                                        const payload: any = { 
                                            username: userForm.username.trim(), 
                                            email: userForm.email.trim(),
                                            full_name: userForm.full_name.trim(), 
                                            role: userForm.role as any, 
                                            password: userForm.password 
                                        };
                                        if (userForm.clinic_id) payload.clinic_id = userForm.clinic_id;
                                        await adminCreateUser(payload);
                                        setUserForm({ username: '', email: '', full_name: '', role: 'staff', password: '', confirm: '', clinic_id: '' });
                                        loadAdminData();
                                        alert('User created successfully');
                                    } catch (err: any) {
                                        console.error(err);
                                        setCreateUserError(err.message || 'Failed to create user');
                                    }
                                  }}
                                >Create</button>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                                <h3 className="text-lg font-medium text-gray-900">Users</h3>
                                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <input 
                                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full md:w-64" 
                                            placeholder="Search users..." 
                                            value={userSearch}
                                            onChange={e => setUserSearch(e.target.value)}
                                        />
                                    </div>
                                    <select 
                                        className="border border-gray-300 rounded-md px-3 py-2"
                                        value={userStatusFilter}
                                        onChange={e => setUserStatusFilter(e.target.value as any)}
                                    >
                                        <option value="all">All Status</option>
                                        <option value="approved">Approved</option>
                                        <option value="pending">Pending ({pendingCount})</option>
                                    </select>
                                    <select 
                                        className="border border-gray-300 rounded-md px-3 py-2"
                                        value={userRoleFilter}
                                        onChange={e => setUserRoleFilter(e.target.value as any)}
                                    >
                                        <option value="all">All Roles</option>
                                        <option value="admin">Admin</option>
                                        <option value="staff">Staff</option>
                                        <option value="doctor">Doctor</option>
                                    </select>
                                    <button onClick={exportUsersCSV} className="px-3 py-2 border rounded-md hover:bg-gray-50 text-gray-700" title="Export CSV">
                                        <FileIcon className="h-4 w-4" />
                                    </button>
                                    <button onClick={exportUsersPDF} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700" title="Export PDF">
                                        <Download className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <ul className="divide-y">
                                {filteredUsers.map((u:any)=> (
                                    <li key={u.id} className="py-3">
                                        {editingUserId === u.id ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    <input className={`w-full border rounded p-2 ${userEditErrors.username?'border-red-500':''}`} value={userEdit.username} onChange={e=>{setUserEdit({...userEdit,username:e.target.value}); if (e.target.value) setUserEditErrors(prev=>({...prev,username:undefined}));}} placeholder="Username" />
                                                    <input className={`w-full border rounded p-2 ${userEditErrors.full_name?'border-red-500':''}`} value={userEdit.full_name || ''} onChange={e=>{setUserEdit({...userEdit,full_name:e.target.value}); if (e.target.value) setUserEditErrors(prev=>({...prev,full_name:undefined}));}} placeholder="Full name" />
                                                    <select className={`w-full border rounded p-2 ${userEditErrors.role?'border-red-500':''}`} value={userEdit.role} onChange={e=>{setUserEdit({...userEdit,role:e.target.value}); setUserEditErrors(prev=>({...prev,role:undefined}));}}>
                                                        <option value="admin">admin</option>
                                                        <option value="staff">staff</option>
                                                        <option value="doctor">doctor</option>
                                                    </select>
                                                    <select className="w-full border rounded p-2" value={userEdit.clinic_id || ''} onChange={e=>{setUserEdit({...userEdit, clinic_id: e.target.value});}}>
                                                        <option value="">Assign Clinic</option>
                                                        {clinics.map((c:any)=> (<option key={c.id} value={c.id}>{c.name}</option>))}
                                                    </select>
                                                    <input type="password" className="w-full border rounded p-2" placeholder="New Password (optional)" onChange={e=>{const v=e.target.value; if (v) setUserEditErrors(prev=>({...prev,password:undefined})); (userEdit as any).password=v; }} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <input className={`w-full border rounded p-2 ${userEditErrors.email?'border-red-500':''}`} placeholder="Email" value={userEdit.email || ''} onChange={e=>{setUserEdit({...userEdit, email: e.target.value}); if (e.target.value) setUserEditErrors(prev=>({...prev,email:undefined}));}} />
                                                    <input className={`w-full border rounded p-2 ${userEditErrors.phone?'border-red-500':''}`} placeholder="Phone" value={userEdit.phone || ''} onChange={e=>{setUserEdit({...userEdit, phone: e.target.value}); if (e.target.value) setUserEditErrors(prev=>({...prev,phone:undefined}));}} />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={async()=>{
                                                        const errors: { username?: string; role?: string; password?: string } = {};
                                                        if (!userEdit.username.trim()) errors.username = 'Required';
                                                        const validRoles = ['admin','staff','doctor'];
                                                        if (!validRoles.includes(userEdit.role)) errors.role = 'Invalid role';
                                                        if ((userEdit as any).password && String((userEdit as any).password).length < 6) errors.password = 'Min 6 characters';
                                                        setUserEditErrors(errors);
                                                        if (Object.keys(errors).length > 0) return;
                                                        const payload: any = { username: userEdit.username.trim(), role: userEdit.role };
                                                        if (userEdit.full_name !== undefined) payload.full_name = userEdit.full_name || '';
                                                        if (userEdit.clinic_id !== undefined) payload.clinic_id = userEdit.clinic_id || '';
                                                        if (userEdit.email !== undefined) payload.email = userEdit.email || '';
                                                        if (userEdit.phone !== undefined) payload.phone = userEdit.phone || '';
                                                        if ((userEdit as any).password) payload.password = (userEdit as any).password;
                                                        await adminUpdateUser(u.id, payload);
                                                        setEditingUserId(null);
                                                        setUserEdit({ username: '', role: 'staff' });
                                                        loadAdminData();
                                                    }}>Save</button>
                                                    <button className="px-3 py-1 border rounded" onClick={()=>{setEditingUserId(null); setUserEditErrors({});}}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Avatar srcPath={(u as any).profile_image} username={(u as any).full_name || u.username} size={40} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold truncate">{(u as any).full_name || u.username}</div>
                                                        <div className="text-sm text-gray-500 truncate">{u.role} • {u.clinic_id ? (clinics.find((c:any)=>c.id===u.clinic_id)?.name || u.clinic_id) : 'No clinic'}</div>
                                                        {(u as any).email && <div className="text-xs text-gray-500 truncate">{(u as any).email}</div>}
                                                        {(u as any).phone && <div className="text-xs text-gray-500 truncate">{(u as any).phone}</div>}
                                                        <div className="mt-1">
                                                                {u.approved ? (
                                                                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Approved</span>
                                                                ) : (
                                                                  <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-700">Pending approval</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {!u.approved && (
                                                          <button className="px-3 py-1 bg-yellow-500 text-white rounded" onClick={async()=>{await adminApproveUser(u.id); loadAdminData();}}>Approve</button>
                                                        )}
                                                        <button className="px-3 py-1 border rounded" onClick={()=>{setEditingUserId(u.id); setUserEdit({ username: u.username || '', full_name: (u as any).full_name || '', role: u.role || 'staff', clinic_id: (u as any).clinic_id || '', email: (u as any).email || '', phone: (u as any).phone || '' });}}>Edit</button>
                                                        <button className="px-3 py-1 border rounded text-red-600" onClick={async()=>{if(confirm('Delete user?')){await adminDeleteUser(u.id); loadAdminData();}}}>Delete</button>
                                                    </div>
                                                </div>
                                        )}
                                    </li>
                                ))}
                                {users.length===0 && <li className="py-6 text-center text-gray-500">No users</li>}
                            </ul>
                        </div>
                    </div>
                )}

                {tab === 'logs' && (
                    <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-gray-900">Audit Logs</h3>
                            <button 
                                onClick={async () => {
                                    if (confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
                                        try {
                                            await adminClearAuditLogs();
                                            loadAdminData();
                                            alert('Audit logs cleared successfully');
                                        } catch (e: any) {
                                            console.error(e);
                                            if (e.message?.includes('function') && e.message?.includes('not found')) {
                                                alert('Failed: The "clear_audit_logs" function is missing. Please run the migration "supabase/migrations/20250207220000_add_clear_audit_logs_rpc.sql".');
                                            } else {
                                                alert('Failed to clear logs: ' + e.message);
                                            }
                                        }
                                    }
                                }}
                                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Logs
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actor</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Details</th></tr></thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {logs.map((l:any)=>(
                                        <tr key={l.id}><td className="px-4 py-2 text-sm text-gray-500">{new Date(l.timestamp).toLocaleString()}</td><td className="px-4 py-2 text-sm text-gray-900">{l.profiles?.full_name || l.profiles?.username || '-'}</td><td className="px-4 py-2 text-sm">{l.action}</td><td className="px-4 py-2 text-sm text-gray-500">{typeof l.details==='object'?JSON.stringify(l.details):String(l.details)}</td></tr>
                                    ))}
                                    {logs.length===0 && (<tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No logs</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'site_config' && (
                    <SiteSettingsEditor />
                )}
            </div>
        </div>
    );
};
