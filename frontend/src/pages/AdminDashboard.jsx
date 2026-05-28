import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import {
    Plus, List, Users, LayoutDashboard, Database, FileText,
    Search, ChevronRight, Clock, ShieldCheck, Award, Rocket,
    Edit, Trash2, Power, Settings, UserMinus, ShieldAlert, BarChart3,
    CheckCircle, UserX, UserPlus, Book, Calendar, Trash, BookOpen, X, Activity, Monitor, Zap, ArrowUpDown, FileDown, Bell, MessageSquare, MessageSquarePlus, Upload, FileSpreadsheet, Info, Eye, EyeOff, Mail
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import EvaluationTab from '../components/admin/EvaluationTab';
import ConfirmModal from '../components/ConfirmModal';

import logo from '../assets/logo_transparent.png';
import logoUniv from '../assets/LogoL.png';
import logoMUSE from '../assets/muse_logo.png';
import TestResults from './TestResults';
import ResourcesTab from './ResourcesTab';
import QuizzesTab from '../components/admin/QuizzesTab';
import QuizMonitoringTab from '../components/admin/QuizMonitoringTab';

const StatsCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex items-center gap-6 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
        <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white relative shadow-lg`}>
            <Icon size={24} />
        </div>
        <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-slate-900">{value}</p>
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const colors = {
        Draft: 'bg-slate-100 text-slate-500',
        Published: 'bg-blue-100 text-blue-600',
        Ongoing: 'bg-emerald-100 text-emerald-600 animate-pulse',
        Stopped: 'bg-red-100 text-red-600',
        Completed: 'bg-indigo-100 text-indigo-600'
    };
    return (
        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${colors[status] || 'bg-slate-100'}`}>
            {status}
        </span>
    );
};

const SidebarLink = ({ id, icon: Icon, label, activeTab, sidebarRef, navigate }) => (
    <button
        onClick={() => {
            if (sidebarRef.current) {
                sessionStorage.setItem('sidebar_scroll', sidebarRef.current.scrollTop);
            }
            navigate(`/admin?tab=${id}`, { replace: true });
            window.scrollTo(0, 0);
        }}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors duration-200 ${
            activeTab === id ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
        }`}
        style={{ height: '48px' }}
    >
        <Icon size={20} className="shrink-0" />
        <span className="hidden md:inline truncate">{label}</span>
    </button>
);

const MobileTabButton = ({ id, icon: Icon, label, onClick, activeTab, navigate, setIsMoreMenuOpen }) => (
    <button
        onClick={onClick || (() => {
            navigate(`/admin?tab=${id}`, { replace: true });
            window.scrollTo(0, 0);
            setIsMoreMenuOpen(false);
        })}
        className={`flex flex-col items-center gap-1 p-2 flex-1 transition-colors duration-200 ${
            activeTab === id ? 'text-blue-600' : 'text-slate-400'
        }`}
    >
        <div className={`p-1.5 rounded-xl transition-colors duration-200 ${activeTab === id ? 'bg-blue-50' : ''}`}>
            <Icon size={20} className="shrink-0" />
        </div>
        <span className="text-[9px] font-black uppercase tracking-tighter truncate">{label}</span>
    </button>
);

const AdminDashboard = () => {
    const navigate = useNavigate();
    const socketRef = useRef(null);
    const sidebarRef = useRef(null);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'Confirm',
        type: 'danger'
    });

    const triggerConfirm = ({ title, message, onConfirm, confirmText = 'Confirm', type = 'danger' }) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
            confirmText,
            type
        });
    };

    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
        ? `http://${window.location.hostname}:5000`
        : 'https://apex-s1q2.onrender.com';

    // Read initial tab from URL or default to overview
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'overview';

    // Restore sidebar scroll position on tab change
    useEffect(() => {
        const savedScroll = sessionStorage.getItem('sidebar_scroll');
        if (savedScroll && sidebarRef.current) {
            const timer = setTimeout(() => {
                if (sidebarRef.current) {
                    sidebarRef.current.scrollTop = parseInt(savedScroll, 10);
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [activeTab]);
    const [exams, setExams] = useState([]);
    const [results, setResults] = useState([]);
    const [activeSessions, setActiveSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [suspensionReason, setSuspensionReason] = useState('');
    const [showMessageModal, setShowMessageModal] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null); // Full detail object
    const [isDetailLoading, setIsDetailLoading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', usn: '', department: '', mobileNumber: '', role: 'student', password: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [notices, setNotices] = useState([]);
    const [expandedNotice, setExpandedNotice] = useState(null);
    const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
    const [newNotice, setNewNotice] = useState({ title: '', subject: '', content: '', type: 'general', targetDepartment: 'All', image: '', imageScale: 100 });
    const [noticeImageFile, setNoticeImageFile] = useState(null);
    const [noticeImagePreview, setNoticeImagePreview] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [bulkFile, setBulkFile] = useState(null);
    const [isBulkUploading, setIsBulkUploading] = useState(false);
    const [isSuspiciousOnly, setIsSuspiciousOnly] = useState(false);
    const [feedbacks, setFeedbacks] = useState([]);
    const [feedbackSearch, setFeedbackSearch] = useState('');
    const [feedbackFilter, setFeedbackFilter] = useState('');
    const [selectedFeedback, setSelectedFeedback] = useState(null);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleExportRegistryPDF = async () => {
        try {
            const studentList = users.filter(u => u.role === 'student');
            if (studentList.length === 0) {
                toast.error('No students found in registry');
                return;
            }

            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

                        // Helper to load image as a Promise
            const loadImg = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.width;
                            canvas.height = img.height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            resolve(canvas.toDataURL('image/png'));
                        } catch (e) {
                            resolve(img);
                        }
                    };
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            };

            // Preload all logos
            const [logoMUSEImg, logoUnivImg, logoApexImg] = await Promise.all([
                loadImg(logoMUSE),
                loadImg(logoUniv),
                loadImg(logo)
            ]);

            // --- 1. Institutional Header ---
            if (logoUnivImg) {
                try {
                    doc.addImage(logoUnivImg, 'PNG', 15, 10, 20, 20);
                } catch (e) {
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(15, 10, 20, 20);
                }
            } else {
                doc.setDrawColor(200, 200, 200);
                doc.rect(15, 10, 20, 20);
            }

            doc.setTextColor(0, 51, 102);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("MYSORE UNIVERSITY SCHOOL OF ENGINEERING", pageWidth / 2, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("Manasagangotri Campus, Mysuru (Approved by AICTE, New Delhi)", pageWidth / 2, 21, { align: 'center' });

                        if (logoMUSEImg) {
                try {
                    doc.addImage(logoMUSEImg, 'PNG', pageWidth - 35, 10, 20, 20);
                } catch (e) {
                    doc.rect(pageWidth - 35, 10, 20, 20);
                }
            } else {
                doc.rect(pageWidth - 35, 10, 20, 20);
            }

            // --- 2. APEX CLUB Branding ---
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');

            const apexWidth = doc.getTextWidth("APEX");
            const clubWidth = doc.getTextWidth("CLUB");
            const logoW = 25;
            const logoH = 20;
            const spacing = 2;
            const totalWidth = apexWidth + clubWidth + logoW + (spacing * 2);
            const startX = (pageWidth - totalWidth) / 2;

            doc.text("APEX", startX, 48);
                        if (logoApexImg) {
                try {
                    doc.addImage(logoApexImg, 'PNG', startX + apexWidth + spacing, 30, logoW, logoH);
                } catch (e) { }
            }
            doc.text("CLUB", startX + apexWidth + logoW + (spacing * 2), 48);

            doc.setFontSize(16);
            doc.text("Official Student Registry Ledger", pageWidth / 2, 58, { align: 'center' });
            doc.setLineWidth(0.5);
            doc.line(20, 62, pageWidth - 20, 62);

            // Metadata
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Registry Generated: ${new Date().toLocaleString()}`, 20, 75);
            doc.text(`Total Candidates: ${studentList.length}`, pageWidth - 20, 75, { align: 'right' });

            doc.line(20, 80, pageWidth - 20, 80);

            // --- 3. Table Generation ---
            const tableColumn = ["Name", "USN ID", "Phone", "Email", "Department"];
            const tableRows = getSortedUsers(studentList).map(u => [
                u.name || 'N/A',
                u.usn || 'N/A',
                u.mobileNumber || 'N/A',
                u.email || 'N/A',
                u.department || 'N/A'
            ]);

            autoTable(doc, {
                startY: 85,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0],
                    halign: 'center',
                    fontStyle: 'bold'
                },
                styles: {
                    textColor: [0, 0, 0],
                    fontSize: 8,
                    halign: 'center',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { halign: 'left', cellWidth: 40 },
                    3: { halign: 'left', cellWidth: 50 }
                },
                margin: { left: 20, right: 20 }
            });

            // --- 4. Footer ---
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
                doc.text("© APEX Club Student Management System - Official Document", pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            doc.save(`Student_Registry_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
            toast.success('Student Registry PDF Generated');
        } catch (error) {
            console.error('PDF Export Error:', error);
            toast.error('Failed to export registry PDF');
        }
    };

    const getSortedUsers = (userList) => {
        if (!sortConfig.key) return userList;
        return [...userList].sort((a, b) => {
            const valA = a[sortConfig.key]?.toString().toLowerCase() || '';
            const valB = b[sortConfig.key]?.toString().toLowerCase() || '';
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const [userRanks, setUserRanks] = useState({});

    // Add User Modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [addUserForm, setAddUserForm] = useState({
        name: '', email: '', password: '', role: 'student',
        department: '', usn: '', mobileNumber: '+91'
    });
    const [showAddPassword, setShowAddPassword] = useState(false);
    const [showEditPassword, setShowEditPassword] = useState(false);

    // Exam Launch Modal
    // Exam Launch Modal
    const [showLaunchModal, setShowLaunchModal] = useState(false);
    const [launchForm, setLaunchForm] = useState({
        title: '',
        duration: 30,
        scheduledDate: '',
        startTime: '',
        passingMarks: '',
        proctoring: { camera: true, microphone: false }
    }); // duration in minutes

    // Events State
    const [events, setEvents] = useState([]);
    const [showAddEventModal, setShowAddEventModal] = useState(false);
    const [addEventForm, setAddEventForm] = useState({ title: '', type: 'class', startTime: '', endTime: '', description: '', instructor: '', totalQuestions: 50 });
    const [editingEvent, setEditingEvent] = useState(null);
    const [showEditEventModal, setShowEditEventModal] = useState(false);
    const [editEventForm, setEditEventForm] = useState({ title: '', type: 'class', startTime: '', endTime: '', description: '', instructor: '', totalQuestions: 50 });

    // Blocked Users State
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [blockedSearchTerm, setBlockedSearchTerm] = useState('');
    const [isBlockedLoading, setIsBlockedLoading] = useState(false);

    const { user: currentUser, settings, fetchSettings } = useAuth();

    const getLocalISO = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString();
    };

    const minDate = getLocalISO(new Date()).split('T')[0];
    const minDateTime = getLocalISO(new Date()).slice(0, 16);

    useEffect(() => {
        fetchData();
    }, []);

    // Auto-generate password for Add User
    useEffect(() => {
        if (addUserForm.name && addUserForm.usn && addUserForm.usn.length >= 5) {
            const firstName = addUserForm.name.trim().split(' ')[0];
            const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
            const usnLast5 = addUserForm.usn.slice(-5);
            setAddUserForm(prev => ({ ...prev, password: `${formattedName}${usnLast5}@apex` }));
        }
    }, [addUserForm.name, addUserForm.usn]);

    // Auto-generate password for Edit User (only if name/usn changes and password was empty or previously auto-generated)
    useEffect(() => {
        if (editMode && editForm.name && editForm.usn && editForm.usn.length >= 5) {
            // For edit mode, we only auto-suggest if the admin hasn't manually typed a custom password
            // but usually for edit we might want to keep it blank unless requested.
            // User asked for "after entering password will automatically generate below" which usually implies the ADD form.
            // I'll keep it primarily for ADD form but if they change USN/Name in EDIT and password is blank, I'll suggest it.
            if (!editForm.password) {
                const firstName = editForm.name.trim().split(' ')[0];
                const formattedName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
                const usnLast5 = editForm.usn.slice(-5);
                setEditForm(prev => ({ ...prev, password: `${formattedName}${usnLast5}@apex` }));
            }
        }
    }, [editForm.name, editForm.usn, editMode]);

    const fetchNotices = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/notices`);
            setNotices(res.data.data);
        } catch (err) {
            console.error('Notice fetch failed:', err);
        }
    };

    const handleAddNotice = async (e) => {
        e.preventDefault();
        setIsDetailLoading(true);
        try {
            let imageUrl = '';
            if (noticeImageFile) {
                const formData = new FormData();
                formData.append('image', noticeImageFile);
                const uploadRes = await axios.post(`${API_BASE}/api/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                imageUrl = uploadRes.data.url;
            }

            const res = await axios.post(`${API_BASE}/api/notices`, { ...newNotice, image: imageUrl });
            if (res.data.success) {
                toast.success('Broadcast dispatched to all terminals');
                setShowAddNoticeModal(false);
                setNewNotice({ title: '', subject: '', content: '', type: 'general', targetDepartment: 'All', image: '', imageScale: 100 });
                setNoticeImageFile(null);
                setNoticeImagePreview(null);
                fetchNotices();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Notice broadcast failed');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleNoticeImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5MB');
            setNoticeImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setNoticeImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteNotice = async (id, noticeTitle = 'this broadcast') => {
        triggerConfirm({
            title: 'Terminate Broadcast',
            message: `Are you sure you want to permanently erase "${noticeTitle}"? This action cannot be undone.`,
            confirmText: 'Erase Broadcast',
            onConfirm: async () => {
                try {
                    const res = await axios.delete(`${API_BASE}/api/notices/${id}`);
                    if (res.data.success) {
                        toast.success('Broadcast terminated');
                        fetchNotices();
                    }
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Deletion failed');
                }
            }
        });
    };

    const calculateRanks = (allResults, allUsers) => {
        const userMets = {};
        const studentUsers = allUsers.filter(u => u.role === 'student');
        studentUsers.forEach(u => {
            userMets[u._id] = { id: u._id, score: 0, coding: 0, time: 0 };
        });

        allResults.forEach(r => {
            const uid = r.userId?._id || r.userId;
            if (userMets[uid]) {
                userMets[uid].score += r.score || 0;
                userMets[uid].coding += r.totalCodingScore || 0;
                userMets[uid].time += r.timeTaken || 0;
            }
        });

        const sorted = Object.values(userMets).sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.coding !== a.coding) return b.coding - a.coding;
            return a.time - b.time;
        });

        const ranks = {};
        sorted.forEach((u, i) => {
            ranks[u.id] = i + 1;
        });
        setUserRanks(ranks);
    };

    const handleBulkUpload = async () => {
        if (!bulkFile) return toast.error('No registry file selected');
        setIsBulkUploading(true);
        const formData = new FormData();
        formData.append('file', bulkFile);

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post(`${API_BASE}/api/auth/bulk-register`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.data.success) {
                toast.success(res.data.message);
                setShowBulkUpload(false);
                setBulkFile(null);
                fetchData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Bulk synchronization failed');
        } finally {
            setIsBulkUploading(false);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [examsRes, resultsRes, usersRes, noticesRes, eventsRes, activeRes] = await Promise.all([
                axios.get(`${API_BASE}/api/exams`),
                axios.get(`${API_BASE}/api/results/all`),
                axios.get(`${API_BASE}/api/auth/users`),
                axios.get(`${API_BASE}/api/notices`),
                axios.get(`${API_BASE}/api/events`),
                axios.get(`${API_BASE}/api/results/active`),
            ]);
            setExams(examsRes.data.data);
            setResults(resultsRes.data.data);
            setUsers(usersRes.data.data);
            setNotices(noticesRes.data.data);
            setEvents(eventsRes.data.data || []);
            setActiveSessions(activeRes.data.data || []);
            calculateRanks(resultsRes.data.data, usersRes.data.data);
        } catch (err) {
            toast.error('Data synchronization failure');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        const socketUrl = API_BASE;
        const socket = io(socketUrl, {
            reconnectionAttempts: 10,
            reconnectionDelay: 2000
        });
        socketRef.current = socket;

        // Map to throttle state updates per user
        const lastStateUpdates = new Map();

        socket.on('live-update', (data) => {
            // High-frequency direct DOM manipulation to bypass React state bottlenecks
            const imgEl = document.getElementById('live-stream-img');
            if (imgEl && imgEl.dataset.userid === data.userId) {
                imgEl.src = data.snapshot;
                imgEl.style.display = 'block';
                const placeholder = document.getElementById('live-stream-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            }
            
            const micEl = document.getElementById('live-stream-mic');
            if (micEl && micEl.dataset.userid === data.userId) {
                micEl.style.width = `${Math.min(100, data.micActivity)}%`;
                micEl.className = `h-full transition-all duration-300 ${data.micActivity > 60 ? 'bg-rose-500' : 'bg-green-500'}`;
            }

            // Throttle React state updates to once every 5 seconds per student to prevent CPU lockup
            const last = lastStateUpdates.get(data.userId) || 0;
            if (Date.now() - last > 5000) {
                lastStateUpdates.set(data.userId, Date.now());
                setActiveSessions(prev => {
                    const index = prev.findIndex(s => (s.userId?._id || s.userId) === data.userId);
                    if (index !== -1) {
                        const newSessions = [...prev];
                        newSessions[index] = {
                            ...newSessions[index],
                            liveSnapshot: data.snapshot,
                            micActivity: data.micActivity,
                            lastActive: data.timestamp
                        };
                        return newSessions;
                    }
                    return prev;
                });
            }
        });

        socket.on('data-updated', (data) => {
            console.log("Remote data change detected:", data.type);
            fetchData();
        });

        return () => socket.disconnect();
    }, []); // Only connect once on mount

    // Separate effect to join rooms when exams change
    useEffect(() => {
        if (socketRef.current && socketRef.current.connected && exams.length > 0) {
            exams.forEach(e => {
                socketRef.current.emit('join-exam', { examId: e._id, role: 'admin' });
            });
        }
    }, [exams]);

    // Update selectedSession from activeSessions
    useEffect(() => {
        if (selectedSession) {
            const updated = activeSessions.find(s => s._id === selectedSession._id);
            if (updated) setSelectedSession(updated);
        }
    }, [activeSessions, selectedSession?._id]);

    useEffect(() => {
        if (activeTab === 'blocked-users') {
            fetchBlockedUsers();
        }
    }, [activeTab]);

    const fetchBlockedUsers = async () => {
        setIsBlockedLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/auth/blocked-users`);
            setBlockedUsers(res.data.data);
        } catch (err) {
            // Suppress error
        } finally {
            setIsBlockedLoading(false);
        }
    };

    const fetchFeedbacks = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/feedback`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setFeedbacks(res.data.data);
        } catch (err) {
            console.error('Feedback fetch failed:', err);
        }
    };

    const handleDeleteFeedback = async (id) => {
        triggerConfirm({
            title: 'Delete Feedback',
            message: 'Are you sure you want to permanently erase this student feedback? This action cannot be undone.',
            confirmText: 'Erase Feedback',
            onConfirm: async () => {
                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.delete(`${API_BASE}/api/feedback/${id}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    if (res.data.success) {
                        toast.success('Feedback entry deleted successfully');
                        fetchFeedbacks();
                    }
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Deletion failed');
                }
            }
        });
    };

    const handleSendMessage = () => {
        if (!messageText.trim()) return;
        if (!socketRef.current || !socketRef.current.connected) {
            return toast.error('Socket not connected');
        }
        socketRef.current.emit('admin-message', {
            targetId: selectedSession.userId?._id?.toString() || selectedSession.userId?.toString(),
            examId: selectedSession.examId?._id?.toString() || selectedSession.examId?.toString(),
            message: messageText
        });
        toast.success('Message Dispatched');
        setShowMessageModal(false);
        setMessageText('');
    };

    useEffect(() => {
        if (activeTab === 'feedbacks') {
            fetchFeedbacks();
        }
    }, [activeTab]);
    const fetchUserDetail = async (userId) => {
        setIsDetailLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/auth/users/${userId}`);
            setSelectedUser(res.data.data);
            setEditForm({
                name: res.data.data.user.name,
                email: res.data.data.user.email,
                usn: res.data.data.user.usn,
                department: res.data.data.user.department,
                mobileNumber: res.data.data.user.mobileNumber,
                role: res.data.data.user.role,
                password: ''
            });
        } catch (err) {
            toast.error('Failed to probe user data');
        } finally {
            setIsDetailLoading(false);
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        if (editForm.mobileNumber.length !== 13) {
            return toast.error('Mobile number must be exactly 10 digits with +91');
        }
        try {
            await axios.put(`${API_BASE}/api/auth/users/${selectedUser.user._id}`, editForm);
            toast.success('User Protocol Updated');
            setEditMode(false);
            fetchUserDetail(selectedUser.user._id);
            fetchData(); // Refresh list
        } catch (err) {
            toast.error('Update operation failed');
        }
    };

    const handleToggleStatus = async () => {
        try {
            await axios.patch(`${API_BASE}/api/auth/users/${selectedUser.user._id}/status`);
            toast.success('Account Status Toggled');
            fetchUserDetail(selectedUser.user._id);
            fetchData();
        } catch (err) {
            toast.error('Status modification failed');
        }
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (addUserForm.mobileNumber.length !== 13) {
            return toast.error('Mobile number must be exactly 10 digits with +91');
        }
        try {
            await axios.post(`${API_BASE}/api/auth/register`, addUserForm);
            toast.success('New Member Catalogued');
            setShowAddModal(false);
            setAddUserForm({ name: '', email: '', password: '', role: 'student', department: '', usn: '', mobileNumber: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Protocol addition failed');
        }
    };

    const handleDeleteUser = async () => {
        const userName = selectedUser?.user?.name || 'this member';
        triggerConfirm({
            title: 'Permanent Elimination',
            message: `Are you sure you want to completely erase "${userName}" from the active registry? This action is irreversible.`,
            confirmText: 'Erase Member',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/auth/users/${selectedUser.user._id}`);
                    toast.success('User eliminated from registry');
                    setSelectedUser(null);
                    fetchData();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Deletion protocol failed');
                }
            }
        });
    };

    const handleRestoreUser = async (userId) => {
        try {
            await axios.patch(`${API_BASE}/api/auth/users/${userId}/restore`);
            toast.success('Member authorization restored');
            setBlockedUsers(prev => prev.filter(u => u._id !== userId));
            fetchData();
        } catch (err) {
            toast.error('Restoration protocol failed');
        }
    };

    const handleHardDeleteUser = async (userId) => {
        const blockedUserObj = blockedUsers.find(u => u._id === userId);
        const userName = blockedUserObj?.name || 'this user';
        triggerConfirm({
            title: 'Critical Database Purge',
            message: `CRITICAL WARNING: This will completely purge the account "${userName}" from the database. They will be able to register again, but all past data will be lost. Proceed?`,
            confirmText: 'Purge Account',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/auth/users/${userId}/hard`);
                    toast.success('Account deleted from database');
                    setBlockedUsers(prev => prev.filter(u => u._id !== userId));
                    if (selectedUser?.user?._id === userId) {
                        setSelectedUser(null);
                        fetchData();
                    }
                } catch (err) {
                    toast.error('Purge operation failed');
                }
            }
        });
    };
    const handleSuspendStudent = async () => {
        if (!suspensionReason) return toast.error('Please specify a reason');
        try {
            await axios.patch(`${API_BASE}/api/results/${selectedSession._id}/suspend`, { reason: suspensionReason });
            toast.success('Protocol breach handled. Session suspended.');
            setShowSuspendModal(false);
            setSelectedSession(null);
            setSuspensionReason('');
            fetchData();
        } catch (err) {
            toast.error('Suspension protocol failed');
        }
    };
    const handleLaunchExam = async (e) => {
        e.preventDefault();
        try {
            const selectedDateTime = new Date(`${launchForm.scheduledDate}T${launchForm.startTime}`);
            if (selectedDateTime < new Date()) {
                return toast.error('Past date and time is not allowed for assessment');
            }

            const payload = {
                title: launchForm.title,
                duration: launchForm.duration * 60,
                scheduledDate: launchForm.scheduledDate,
                startTime: launchForm.startTime,
                status: 'Draft',
                passingMarks: launchForm.passingMarks ? Number(launchForm.passingMarks) : 0,
                proctoring: launchForm.proctoring
            };
            const res = await axios.post(`${API_BASE}/api/exams`, payload);
            toast.success('Exam Instance Created. Redirecting to Builder...');
            navigate(`/admin/exam/${res.data.data._id}`);
        } catch (err) {
            toast.error('Launch sequence failed');
        }
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        if (!addEventForm.title || !addEventForm.startTime || !addEventForm.endTime) {
            toast.error('Please fill all required fields');
            return;
        }

        if (new Date(addEventForm.startTime) < new Date()) {
            return toast.error('Past date and time is not allowed for events');
        }

        if (new Date(addEventForm.endTime) <= new Date(addEventForm.startTime)) {
            return toast.error('End time must be after start time');
        }
        try {
            const res = await axios.post(`${API_BASE}/api/events`, {
                ...addEventForm,
                startTime: new Date(addEventForm.startTime),
                endTime: new Date(addEventForm.endTime),
            });
            setEvents(prev => [...prev, res.data.data]);
            toast.success('Event created successfully');
            setShowAddEventModal(false);
            setAddEventForm({ title: '', type: 'class', startTime: '', endTime: '', description: '', instructor: '', totalQuestions: 50 });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create event');
        }
    };

    const handleDeleteEvent = async (eventId, eventTitle = 'this event') => {
        triggerConfirm({
            title: 'Delete Event Protocol',
            message: `Are you sure you want to delete "${eventTitle}"? This will remove the event from the calendar.`,
            confirmText: 'Delete Event',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/events/${eventId}`);
                    setEvents(prev => prev.filter(e => e._id !== eventId));
                    toast.success('Event deleted');
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to delete event');
                }
            }
        });
    };

    const handleUpdateEventStatus = async (eventId, status) => {
        try {
            const res = await axios.patch(`${API_BASE}/api/events/${eventId}/status`, { status });
            setEvents(prev => prev.map(e => e._id === eventId ? res.data.data : e));
            toast.success(`Event marked as ${status}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update status');
        }
    };

    const handleOpenEditEvent = (event) => {
        setEditingEvent(event);
        setEditEventForm({
            title: event.title,
            type: event.type,
            startTime: new Date(event.startTime).toISOString().slice(0, 16),
            endTime: new Date(event.endTime).toISOString().slice(0, 16),
            description: event.description || '',
            instructor: event.instructor || '',
            totalQuestions: event.totalQuestions || 50
        });
        setShowEditEventModal(true);
    };

    const handleUpdateEvent = async (e) => {
        e.preventDefault();

        if (new Date(editEventForm.startTime) < new Date()) {
            return toast.error('Past date and time is not allowed');
        }

        if (new Date(editEventForm.endTime) <= new Date(editEventForm.startTime)) {
            return toast.error('End time must be after start time');
        }

        try {
            const res = await axios.put(`${API_BASE}/api/events/${editingEvent._id}`, {
                ...editEventForm,
                startTime: new Date(editEventForm.startTime),
                endTime: new Date(editEventForm.endTime)
            });
            setEvents(prev => prev.map(e => e._id === editingEvent._id ? res.data.data : e));
            toast.success('Event Updated Successfully');
            setShowEditEventModal(false);
            setEditingEvent(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed');
        }
    };

    const getUpcomingTests = () => {
        const now = new Date();
        return events.filter(e => e.type === 'test' && new Date(e.startTime) > now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    };

    const getUpcomingClasses = () => {
        const now = new Date();
        return events.filter(e => e.type === 'class' && new Date(e.startTime) > now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    };



    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Navbar />

            <div className="flex-1 flex flex-col md:flex-row relative">
                <aside 
                    ref={sidebarRef}
                    className="hidden md:block md:w-64 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 md:fixed md:top-[140px] md:bottom-8 md:left-8 z-20 overflow-y-auto overflow-x-hidden custom-scrollbar sidebar-stable"
                >
                    <nav className="space-y-1">
                        <SidebarLink id="overview" icon={LayoutDashboard} label="Dashboard" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="exams" icon={List} label="Exams Section" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="test-results" icon={Award} label="Test Results" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="events" icon={Calendar} label="Events" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="users" icon={Users} label="Manage Users" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="blocked-users" icon={UserX} label="Blocked" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="notices" icon={Bell} label="Notices" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="resources" icon={Book} label="Resources" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="quizzes" icon={Rocket} label="Quizzes Section" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="monitoring" icon={Activity} label="Test Monitoring" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="quiz-monitoring" icon={Activity} label="Quiz Monitoring" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />

                        <SidebarLink id="evaluate" icon={CheckCircle} label="Evaluation Matrix" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="feedbacks" icon={MessageSquare} label="Feedback Hub" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                        <SidebarLink id="settings" icon={Settings} label="Global Settings" activeTab={activeTab} sidebarRef={sidebarRef} navigate={navigate} />
                    </nav>
                </aside>

                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-100 pt-1 pb-1 px-2 shadow-[0_-10px_30_rgba(0,0,0,0.05)] safe-pb">
                    <div className="h-16 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm flex items-center justify-around px-2">
                        <MobileTabButton id="overview" icon={LayoutDashboard} label="Home" activeTab={activeTab} navigate={navigate} setIsMoreMenuOpen={setIsMoreMenuOpen} />
                        <MobileTabButton id="exams" icon={List} label="Exams" activeTab={activeTab} navigate={navigate} setIsMoreMenuOpen={setIsMoreMenuOpen} />
                        <MobileTabButton id="resources" icon={Book} label="Library" activeTab={activeTab} navigate={navigate} setIsMoreMenuOpen={setIsMoreMenuOpen} />
                        <MobileTabButton id="evaluate" icon={CheckCircle} label="Matrix" activeTab={activeTab} navigate={navigate} setIsMoreMenuOpen={setIsMoreMenuOpen} />
                        <MobileTabButton id="more" icon={Plus} label="More" onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} activeTab={activeTab} navigate={navigate} setIsMoreMenuOpen={setIsMoreMenuOpen} />
                    </div>
                </div>

                {/* More Menu Overlay */}
                <AnimatePresence>
                    {isMoreMenuOpen && (
                        <div className="md:hidden fixed inset-0 z-[90]">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsMoreMenuOpen(false)}
                                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                className="absolute bottom-24 left-4 right-4 bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100 flex flex-col gap-2 max-h-[70vh] overflow-y-auto custom-scrollbar"
                            >
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-4">Extended Protocols</div>
                                <button onClick={() => { navigate('/admin?tab=test-results', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Award size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Test Results</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=events', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Calendar size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Events Management</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=monitoring', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Activity size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Test Monitoring</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=quizzes', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Rocket size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Quizzes Section</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=quiz-monitoring', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Activity size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Quiz Monitoring</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=users', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Users size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Manage Users</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=blocked-users', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <UserX size={20} className="text-rose-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Blocked Registry</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=notices', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Bell size={20} className="text-amber-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Notice Board</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=feedbacks', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <MessageSquare size={20} className="text-emerald-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">User Feedbacks</span>
                                </button>
                                <button onClick={() => { navigate('/admin?tab=settings', { replace: true }); setIsMoreMenuOpen(false); }} className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all text-left">
                                    <Settings size={20} className="text-blue-500 shrink-0" />
                                    <span className="font-bold text-slate-700 flex-1">Global Settings</span>
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <main className="flex-1 p-4 md:p-8 ml-0 md:ml-[320px] md:pr-8 md:pt-4 mb-24 md:mb-0">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                            <div className="empty-header-placeholder" />
                            {activeTab === 'exams' && (
                                <button onClick={() => setShowLaunchModal(true)} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 flex items-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                                    <Plus size={20} /> Create Exam
                                </button>
                            )}
                        </div>

                        <AnimatePresence>
                            <motion.div key={activeTab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                                {activeTab === 'overview' && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <StatsCard label="Active Exams" value={exams.filter(e => e.status === 'Ongoing').length} icon={ShieldCheck} color="bg-emerald-500" />
                                            <StatsCard label="Total Exams" value={exams.length} icon={List} color="bg-blue-500" />
                                            <StatsCard label="Participants" value={results.length} icon={Users} color="bg-amber-500" />
                                        </div>

                                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                                            <h3 className="text-lg font-black text-slate-800 mb-6 tracking-tight">Recent Assessments</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {exams.slice(0, 4).map(e => (
                                                    <Link key={e._id} to={`/admin/exam/${e._id}`} className="flex items-center justify-between p-5 bg-slate-50 hover:bg-blue-50 rounded-2xl border border-slate-100 transition-all group tracking-tight">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="font-bold text-slate-800 tracking-tight">{e.title}</span>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                                                <StatusBadge status={e.status} />
                                                                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 whitespace-nowrap"><Clock size={10} /> {Math.round(e.duration / 60)}M</span>
                                                                <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 whitespace-nowrap"><Award size={10} /> {e.questions?.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0)} Marks</span>
                                                                {(e.scheduledDate || e.startTime) && (
                                                                    <span className="text-[10px] text-blue-600 font-bold flex items-center gap-1 whitespace-nowrap">
                                                                        <Calendar size={10} /> {e.scheduledDate} <Clock size={10} className="ml-1" /> {e.startTime}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600 transition-all" />
                                                    </Link>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'test-results' && (
                                    <TestResults />
                                )}



                                {activeTab === 'exams' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {exams.map(exam => (
                                            <Link key={exam._id} to={`/admin/exam/${exam._id}`} className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
                                                <div className="mb-4 w-10 h-10">
                                                    <img src={logo} alt="APEX" className="w-full h-full object-contain" />
                                                </div>
                                                <div className="absolute top-0 right-0 p-6">
                                                    <StatusBadge status={exam.status} />
                                                </div>
                                                <h3 className="text-xl font-black text-slate-800 mb-2 truncate max-w-[80%]">{exam.title}</h3>
                                                <div className="space-y-3 mb-8">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Clock size={14} /> Duration: <span className="text-slate-700">{Math.round(exam.duration / 60)} Minutes</span></div>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Database size={14} /> Capacity: <span className="text-slate-700">{exam.questions?.length} Items</span></div>
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400"><Award size={14} /> Total Marks: <span className="text-slate-700">{exam.questions?.reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0)} Marks</span></div>
                                                    {(exam.scheduledDate || exam.startTime) && (
                                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-500">
                                                            <Calendar size={14} /> Schedule: <span className="text-blue-700 font-black">{exam.scheduledDate} @ {exam.startTime}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="pt-6 border-t border-slate-50 flex justify-between items-center text-blue-600 font-black text-xs uppercase tracking-widest transition-all">
                                                    Enter Builder <ChevronRight size={16} />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {activeTab === 'quizzes' && (
                                    <QuizzesTab />
                                )}

                                {activeTab === 'quiz-monitoring' && (
                                    <QuizMonitoringTab />
                                )}

                                {activeTab === 'evaluate' && (
                                    <EvaluationTab />
                                )}
                                {activeTab === 'users' && (
                                    <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100">
                                        <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-10 gap-6">
                                            <div>
                                                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Identity Matrix</h2>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <Users size={12} className="text-blue-500" /> {users.filter(u => u.role === 'student').length} Students
                                                    </p>
                                                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                        <ShieldCheck size={12} className="text-purple-500" /> {users.filter(u => u.role === 'admin').length} Admins
                                                    </p>
                                                    {currentUser?.role === 'superadmin' && (
                                                        <>
                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                                <Zap size={12} className="text-amber-500" /> {users.filter(u => u.role === 'superadmin').length} Super Admins
                                                            </p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                                                <button
                                                    onClick={() => setShowAddModal(true)}
                                                    className="w-full sm:w-auto px-6 py-4 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                                                >
                                                    <Plus size={16} /> Add Member
                                                </button>
                                                <button
                                                    onClick={() => navigate('/admin?tab=blocked-users', { replace: true })}
                                                    className="w-full sm:w-auto px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
                                                >
                                                    <UserX size={16} /> Blocked Registry
                                                </button>
                                                <select
                                                    value={deptFilter}
                                                    onChange={(e) => setDeptFilter(e.target.value)}
                                                    className="w-full sm:w-auto px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none transition-all cursor-pointer"
                                                >
                                                    <option value="">All Departments</option>
                                                    <option value="CSD">CSD</option>
                                                    <option value="CSE">CSE</option>
                                                    <option value="AIML">AIML</option>
                                                    <option value="AIDS">AIDS</option>
                                                    <option value="CEE">CEE</option>
                                                    <option value="BMRE">BMRE</option>
                                                </select>
                                                <div className="flex-1 sm:w-64 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 group focus-within:border-blue-500/50 transition-all">
                                                    <Search size={16} className="text-slate-400 group-focus-within:text-blue-500" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search Name / USN..."
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        className="bg-transparent border-none text-sm font-bold focus:ring-0 w-full outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-12">
                                            {/* Super Admin Section - ONLY VISIBLE TO SUPER ADMINS */}
                                            {currentUser?.role === 'superadmin' && users.filter(u => u.role === 'superadmin').length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3 px-4">
                                                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600"><Zap size={16} /></div>
                                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">System Overlords (Super Admins)</h3>
                                                    </div>
                                                    <div className="overflow-x-auto bg-amber-50/20 rounded-[2rem] border border-amber-100/50 p-2">
                                                        <table className="w-full text-left border-collapse">
                                                            <tbody className="divide-y divide-amber-100/20">
                                                                {users.filter(u => u.role === 'superadmin' && (
                                                                    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    u.usn?.toLowerCase().includes(searchTerm.toLowerCase())
                                                                ) && (deptFilter === '' || u.department === deptFilter)).map(u => (
                                                                    <tr key={u._id} onClick={() => fetchUserDetail(u._id)} className="group hover:bg-amber-100/30 transition-all cursor-pointer rounded-2xl">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-amber-500/20">
                                                                                    {u.name?.[0]}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-800 text-sm tracking-tight">{u.name}</p>
                                                                                    <p className="text-[10px] text-amber-600 font-bold">{u.email}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-amber-500 text-white border-amber-400 shadow-sm flex items-center gap-2 float-right w-fit whitespace-nowrap">
                                                                                <ShieldAlert size={10} /> Core Hierarchy
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Admin Section */}
                                            {users.filter(u => u.role === 'admin').length > 0 && (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-3 px-4">
                                                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><ShieldCheck size={16} /></div>
                                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">System Administrators</h3>
                                                    </div>
                                                    <div className="overflow-x-auto bg-purple-50/30 rounded-[2rem] border border-purple-100/50 p-2">
                                                        <table className="w-full text-left border-collapse">
                                                            <tbody className="divide-y divide-purple-100/30">
                                                                {users.filter(u => u.role === 'admin' && (
                                                                    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                                    u.usn?.toLowerCase().includes(searchTerm.toLowerCase())
                                                                ) && (deptFilter === '' || u.department === deptFilter)).map(u => (
                                                                    <tr key={u._id} onClick={() => fetchUserDetail(u._id)} className="group hover:bg-purple-100/50 transition-all cursor-pointer rounded-2xl">
                                                                        <td className="px-6 py-4">
                                                                            <div className="flex items-center gap-4">
                                                                                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-purple-600/20">
                                                                                    {u.name?.[0]}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-slate-800 text-sm tracking-tight">{u.name}</p>
                                                                                    <p className="text-[10px] text-purple-600 font-bold">{u.email}</p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className="px-3 py-1 bg-purple-100 rounded-lg text-[9px] font-black text-purple-600 uppercase tracking-tighter">{u.department || 'ADMIN-CORE'}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right">
                                                                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border bg-purple-600 text-white border-purple-500 shadow-sm whitespace-nowrap">Administrator</span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Students Section */}
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><Users size={16} /></div>
                                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Student Registry</h3>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => setShowBulkUpload(true)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10 active:scale-95"
                                                        >
                                                            <UserPlus size={14} />
                                                            Bulk Register
                                                        </button>
                                                        <button
                                                            onClick={handleExportRegistryPDF}
                                                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-900/10 active:scale-95"
                                                        >
                                                            <FileDown size={14} />
                                                            Export Registry
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-1/3">Candidate Identity</th>
                                                                <th
                                                                    className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] cursor-pointer hover:text-blue-600 transition-colors"
                                                                    onClick={() => handleSort('department')}
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        Dept
                                                                        <ArrowUpDown size={12} className={sortConfig.key === 'department' ? 'text-blue-600' : 'text-slate-300'} />
                                                                    </div>
                                                                </th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden md:table-cell">USN ID</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hidden lg:table-cell">Communication</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Role</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {getSortedUsers(users.filter(u => u.role === 'student' &&
                                                                (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.usn?.toLowerCase().includes(searchTerm.toLowerCase())) &&
                                                                (deptFilter === '' || u.department === deptFilter)
                                                            )).map(u => (
                                                                <tr
                                                                    key={u._id}
                                                                    onClick={() => fetchUserDetail(u._id)}
                                                                    className="group hover:bg-blue-50/50 transition-all cursor-pointer"
                                                                >
                                                                    <td className="px-6 py-6 border-transparent">
                                                                        <div className="flex items-center gap-4">
                                                                            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 font-black text-sm shadow-sm">
                                                                                {u.name?.split(' ').map(n => n[0]).join('')}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-slate-800 text-base tracking-tight">{u.name}</p>
                                                                                <p className="text-[11px] text-slate-400 font-bold">{u.email}</p>
                                                                                <p className="text-[10px] text-blue-600 font-black tracking-tighter md:hidden mt-0.5">{u.usn || 'NO USN'}</p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-6 border-transparent">
                                                                        <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase tracking-tighter text-center">{u.department || 'N/A'}</span>
                                                                    </td>
                                                                    <td className="px-6 py-6 border-transparent hidden md:table-cell">
                                                                        <span className="font-mono text-xs font-black text-slate-700 tracking-tighter">{u.usn || 'UNASSIGNED'}</span>
                                                                    </td>
                                                                    <td className="px-6 py-6 border-transparent hidden lg:table-cell">
                                                                        <p className="text-sm font-bold text-slate-800 mb-0.5">{u.mobileNumber || 'No Contact'}</p>
                                                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck size={10} className="text-emerald-500" /> Verified</p>
                                                                    </td>
                                                                    <td className="px-6 py-6 border-transparent text-right">
                                                                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border bg-blue-100 border-blue-200 text-blue-600 whitespace-nowrap`}>
                                                                            {u.role}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'blocked-users' && (
                                    <div className="space-y-8">
                                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-5 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm gap-6">
                                            <div className="flex items-center gap-4 flex-1">
                                                <button
                                                    onClick={() => navigate('/admin?tab=users', { replace: true })}
                                                    className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                                                >
                                                    <ChevronRight size={24} className="rotate-180" />
                                                </button>
                                                <div>
                                                    <h2 className="text-2xl font-black text-rose-600 tracking-tight flex items-center gap-3">
                                                        <ShieldAlert size={28} /> Blocked Registry
                                                    </h2>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Management of Deactivated & Eliminated Accounts</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                                                <select
                                                    value={deptFilter}
                                                    onChange={(e) => setDeptFilter(e.target.value)}
                                                    className="w-full sm:w-auto px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest outline-none focus:ring-4 focus:ring-rose-500/10 appearance-none transition-all cursor-pointer"
                                                >
                                                    <option value="">All Departments</option>
                                                    <option value="CSD">CSD</option>
                                                    <option value="CSE">CSE</option>
                                                    <option value="AIML">AIML</option>
                                                    <option value="AIDS">AIDS</option>
                                                    <option value="CEE">CEE</option>
                                                    <option value="BMRE">BMRE</option>
                                                </select>
                                                <div className="flex-1 sm:w-64 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3 group focus-within:border-rose-500/50 transition-all">
                                                    <Search size={16} className="text-slate-400 group-focus-within:text-rose-500" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search Blocked ID..."
                                                        value={blockedSearchTerm}
                                                        onChange={(e) => setBlockedSearchTerm(e.target.value)}
                                                        className="bg-transparent border-none text-sm font-bold focus:ring-0 w-full outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="p-5 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                                    <div className="p-2 bg-rose-100 rounded-lg text-rose-600"><ShieldAlert size={18} /></div>
                                                    Restricted Identities
                                                </h3>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{blockedUsers.length} Blocked</span>
                                            </div>

                                            <div className="p-8">
                                                {blockedUsers.length > 0 ? (
                                                    <div className="space-y-4">
                                                        {blockedUsers.filter(u =>
                                                            (u.name?.toLowerCase().includes(blockedSearchTerm.toLowerCase()) || u.usn?.toLowerCase().includes(blockedSearchTerm.toLowerCase())) &&
                                                            (deptFilter === '' || u.department === deptFilter)
                                                        ).map(u => (
                                                            <div key={u._id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-rose-200 transition-all gap-6">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-black">
                                                                        {u.name?.[0]}
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-slate-800">{u.name}</h4>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{u.usn}</span>
                                                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${u.isEliminated ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`}>
                                                                                {u.isEliminated ? 'Permanently Eliminated' : 'Deactivated'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                                                    <button
                                                                        onClick={() => handleRestoreUser(u._id)}
                                                                        className="flex-1 sm:flex-none px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                                                                    >
                                                                        <CheckCircle size={14} /> Restore
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleHardDeleteUser(u._id)}
                                                                        className="flex-1 sm:flex-none px-6 py-3 bg-white text-rose-600 border border-rose-100 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2"
                                                                    >
                                                                        <Trash2 size={14} /> Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-20 text-center flex flex-col items-center">
                                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                                                            <ShieldCheck size={40} />
                                                        </div>
                                                        <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No students currently restricted</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'resources' && (
                                    <ResourcesTab />
                                )}

                                {activeTab === 'command-center' && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-900 p-6 md:p-8 rounded-[2rem] border border-slate-800 shadow-2xl gap-6">
                                            <div>
                                                <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                                                    <Monitor size={28} className="text-blue-500" /> Proctoring Command Center
                                                </h2>
                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Multi-stream surveillance matrix</p>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <button
                                                    onClick={() => setIsSuspiciousOnly(!isSuspiciousOnly)}
                                                    className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${isSuspiciousOnly ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                                                >
                                                    <ShieldAlert size={16} />
                                                    {isSuspiciousOnly ? 'Suspicious Only' : 'Show All'}
                                                </button>
                                                <div className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20">
                                                    <Activity size={18} className="animate-pulse" />
                                                    <span className="font-black text-[10px] uppercase tracking-widest">{activeSessions.length} Active Nodes</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {activeSessions
                                                .filter(s => !isSuspiciousOnly || (s.violations && (s.violations.tabSwitches > 0 || s.violations.fullscreenExits > 0)))
                                                .map(session => (
                                                    <motion.div
                                                        key={session._id}
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden group hover:border-blue-500/50 transition-all shadow-xl"
                                                    >
                                                        <div className="aspect-video bg-black relative overflow-hidden">
                                                            {session.liveSnapshot ? (
                                                                <img src={session.liveSnapshot} alt="Stream" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="absolute inset-0 flex items-center justify-center text-slate-700 bg-slate-900">
                                                                    <Monitor size={32} />
                                                                </div>
                                                            )}
                                                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[9px] font-black text-white uppercase truncate">{session.userId?.name || 'Anonymous'}</span>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${Date.now() - new Date(session.lastActive) < 10000 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                                                </div>
                                                            </div>
                                                            {session.violations && (session.violations.tabSwitches > 0 || session.violations.fullscreenExits > 0) && (
                                                                <div className="absolute top-2 left-2 px-2 py-1 bg-rose-600 text-white rounded-md text-[8px] font-black uppercase tracking-tighter flex items-center gap-1 animate-bounce">
                                                                    <ShieldAlert size={10} /> SUSPICIOUS
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-3 border-t border-slate-800 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${session.micActivity > 50 ? 'bg-rose-500' : 'bg-slate-700'}`} />
                                                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Mic: {session.micActivity || 0}</span>
                                                            </div>
                                                            <button onClick={() => setSelectedSession(session)} className="text-[8px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest">Details</button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                        </div>

                                        {activeSessions.length === 0 && (
                                            <div className="py-40 text-center bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                                                <Monitor size={64} className="mx-auto mb-6 text-slate-200" />
                                                <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">No active exam streams detected</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'monitoring' && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm gap-6">
                                            <div>
                                                <h2 className="text-2xl font-black tracking-tight">Active Surveillance</h2>
                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Real-time examination monitoring</p>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <button
                                                    onClick={() => fetchData()}
                                                    className="flex-1 sm:flex-none p-4 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all flex items-center justify-center"
                                                >
                                                    <Rocket size={20} className={loading ? 'animate-spin' : ''} />
                                                </button>
                                                <div className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 animate-pulse">
                                                    <Activity size={18} />
                                                    <span className="font-black text-[10px] uppercase tracking-widest">{activeSessions.length} Live</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {activeSessions.map(session => (
                                                <motion.div
                                                    key={session._id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/20 hover:shadow-2xl transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-6">
                                                        <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                                                    </div>

                                                    <div className="flex items-center gap-4 mb-6">
                                                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-xl overflow-hidden uppercase">
                                                            {session.userId?.name ? session.userId.name[0] : (session.userId?.email ? session.userId.email[0] : '?')}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-slate-900 leading-tight">{session.userId?.name || session.userId?.email || 'Anonymous Protocol'}</h3>
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{session.userId?.usn || 'SID-PENDING'}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4 mb-8">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-bold text-slate-400 uppercase tracking-widest">Protocol</span>
                                                            <span className="font-black text-slate-900">{session.examId?.title}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="font-bold text-slate-400 uppercase tracking-widest">Department</span>
                                                            <span className="font-black text-slate-900">{session.userId?.department || 'N/A'}</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => setSelectedSession(session)}
                                                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/10"
                                                    >
                                                        Access Stream
                                                    </button>
                                                </motion.div>
                                            ))}
                                        </div>

                                        {activeSessions.length === 0 && (
                                            <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                                                <Monitor size={48} className="mx-auto text-slate-200 mb-4" />
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No active examination protocols detected</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'events' && (
                                    <div className="space-y-8">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                            <div>
                                                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-2">
                                                    <Calendar size={24} className="text-blue-600" /> Events Management
                                                </h2>
                                                <p className="text-slate-500 text-xs font-medium max-w-md">Create events, update their status — changes are visible to all students.</p>
                                            </div>
                                            <button
                                                onClick={() => setShowAddEventModal(true)}
                                                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
                                            >
                                                <Plus size={20} /> Add Event
                                            </button>
                                        </div>

                                        {/* Full Schedule Table with Status Controls */}
                                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Calendar size={18} /></div>
                                                    Full Event Schedule
                                                </h3>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{events.length} Events</span>
                                            </div>
                                            {events.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-slate-100">
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Start</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {[...events].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).map(event => {
                                                                const statusStyles = {
                                                                    Upcoming: 'bg-blue-50 text-blue-600 border-blue-200',
                                                                    Completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                                                                    Postponed: 'bg-amber-50 text-amber-600 border-amber-200',
                                                                    Cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
                                                                };
                                                                return (
                                                                    <tr key={event._id} className="hover:bg-slate-50/50 transition-all">
                                                                        <td className="px-6 py-4">
                                                                            <p className="font-black text-slate-800">{event.title}</p>
                                                                            {event.description && <p className="text-xs text-slate-400 font-bold mt-0.5 truncate max-w-[200px]">{event.description}</p>}
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${event.type === 'test' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                                                event.type === 'other' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                                                    'bg-blue-50 text-blue-600 border-blue-200'
                                                                                }`}>
                                                                                {event.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">
                                                                            {Number(((new Date(event.endTime) - new Date(event.startTime)) / 3600000).toFixed(1))} Hours
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                                                            {new Date(event.startTime).toLocaleDateString()} <span className="text-slate-400">{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            {/* Status dropdown */}
                                                                            <select
                                                                                value={event.status || 'Upcoming'}
                                                                                onChange={e => handleUpdateEventStatus(event._id, e.target.value)}
                                                                                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border cursor-pointer outline-none ${statusStyles[event.status || 'Upcoming']}`}
                                                                            >
                                                                                <option value="Upcoming">Upcoming</option>
                                                                                <option value="Completed">Completed</option>
                                                                                <option value="Postponed">Postponed</option>
                                                                                <option value="Cancelled">Cancelled</option>
                                                                            </select>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                                                            <button
                                                                                onClick={() => handleOpenEditEvent(event)}
                                                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                                            >
                                                                                <Edit size={16} />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleDeleteEvent(event._id, event.title)}
                                                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                                            >
                                                                                <Trash size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="py-16 text-center">
                                                    <Calendar size={40} className="mx-auto text-slate-200 mb-3" />
                                                    <p className="text-slate-400 font-bold text-sm">No events yet. Click "Add Event" to create one.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'notices' && (
                                    <div className="space-y-8">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 gap-6">
                                            <div>
                                                <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                                    <Bell className="text-blue-600" size={28} /> Broadcast Center
                                                </h2>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage and dispatch official platform announcements</p>
                                            </div>
                                            <button
                                                onClick={() => setShowAddNoticeModal(true)}
                                                className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                                            >
                                                <Plus size={20} /> Add Notification
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {notices.length > 0 ? notices.map((notice) => {
                                                const isExpanded = expandedNotice === notice._id;
                                                return (
                                                    <motion.div
                                                        key={notice._id}
                                                        className={`bg-white rounded-[2rem] border transition-all overflow-hidden ${isExpanded ? 'shadow-xl border-blue-200' : 'border-slate-100 shadow-sm hover:border-blue-100'
                                                            }`}
                                                    >
                                                        <div
                                                            className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center cursor-pointer group gap-4"
                                                            onClick={() => setExpandedNotice(isExpanded ? null : notice._id)}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${notice.type === 'urgent' ? 'bg-rose-50 text-rose-500' :
                                                                    notice.type === 'exam' ? 'bg-blue-50 text-blue-500' :
                                                                        'bg-slate-50 text-slate-500'
                                                                    }`}>
                                                                    <Bell size={24} />
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="font-black text-slate-800">{notice.title}</h3>
                                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${notice.type === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                                                                            }`}>
                                                                            {notice.type}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mt-0.5">{notice.subject}</p>
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                                                                        <Clock size={10} /> {new Date(notice.createdAt).toLocaleDateString()} • Target: {notice.targetDepartment}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 w-full md:w-auto self-end md:self-center">
                                                                <motion.div
                                                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                                                    className="p-2 text-slate-300"
                                                                >
                                                                    <ChevronRight size={20} />
                                                                </motion.div>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteNotice(notice._id, notice.title); }}
                                                                    className="flex-1 md:flex-none h-12 px-6 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-all font-black text-[10px] uppercase tracking-widest"
                                                                >
                                                                    <Trash2 size={18} className="mr-2" /> Delete
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="px-6 pb-8 pt-2 ml-18 border-t border-slate-50">
                                                                        {notice.image && (
                                                                            <div className="mb-6 flex">
                                                                                <div style={{ width: notice.imageScale ? `${notice.imageScale}%` : '100%' }}>
                                                                                    <img
                                                                                        src={notice.image.startsWith('http') ? notice.image : `${API_BASE}${notice.image}`}
                                                                                        alt="Notice Attachment"
                                                                                        className="w-full rounded-2xl max-h-[400px] object-contain border border-slate-100 shadow-sm"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        <div className="text-slate-600 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                                                                            {notice.content}
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                );
                                            }) : (
                                                <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center flex flex-col items-center">
                                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                                                        <Bell size={40} />
                                                    </div>
                                                    <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No active broadcasts found in protocol</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'settings' && (
                                    <div className="space-y-8">
                                        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                                            <h2 className="text-2xl font-black tracking-tight flex items-center gap-3 mb-6">
                                                <Settings className="text-blue-600" size={28} /> Global Application Settings
                                            </h2>

                                            <div className="space-y-6">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group gap-6">
                                                    <div className="flex gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center ${settings?.isRegistrationOpen ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                            <UserPlus size={24} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-slate-800">Public Registration Protocol</h3>
                                                            <p className="text-xs font-bold text-slate-400 tracking-tight">Toggle whether new students can create accounts on the platform.</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const res = await axios.put(`${API_BASE}/api/settings`, { isRegistrationOpen: !settings?.isRegistrationOpen });
                                                                if (res.data.success) {
                                                                    toast.success(`Registration Protocol: ${!settings?.isRegistrationOpen ? 'ONLINE' : 'OFFLINE'}`);
                                                                    fetchSettings();
                                                                }
                                                            } catch (err) {
                                                                toast.error('Failed to update protocol status');
                                                            }
                                                        }}
                                                        className={`relative w-16 h-8 rounded-full transition-all duration-300 flex-shrink-0 ${settings?.isRegistrationOpen ? 'bg-blue-600' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm ${settings?.isRegistrationOpen ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>

                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-slate-50 rounded-[2rem] border border-slate-100 group gap-6">
                                                    <div className="flex gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center ${settings?.isEmailEnabled !== false ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                            <Mail size={24} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-black text-slate-800">Email Services (Credentials)</h3>
                                                            <p className="text-xs font-bold text-slate-400 tracking-tight">Toggle global email dispatch for registration codes, recovery OTPs, broadcasts, and member onboarding.</p>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                const newStatus = settings?.isEmailEnabled === false ? true : false;
                                                                const res = await axios.put(`${API_BASE}/api/settings`, { isEmailEnabled: newStatus });
                                                                if (res.data.success) {
                                                                    toast.success(`Email Services: ${newStatus ? 'ONLINE' : 'OFFLINE'}`);
                                                                    fetchSettings();
                                                                }
                                                            } catch (err) {
                                                                toast.error('Failed to update email service status');
                                                            }
                                                        }}
                                                        className={`relative w-16 h-8 rounded-full transition-all duration-300 flex-shrink-0 ${settings?.isEmailEnabled !== false ? 'bg-blue-600' : 'bg-slate-300'}`}
                                                    >
                                                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm ${settings?.isEmailEnabled !== false ? 'right-1' : 'left-1'}`} />
                                                    </button>
                                                </div>

                                                <div className="p-6 bg-blue-50/50 rounded-[2rem] border border-blue-100">
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start gap-3">
                                                            <ShieldCheck className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                                                            <p className="text-xs font-bold text-blue-600 leading-relaxed">
                                                                When Registration is <b>OFFLINE</b>, the "Register" button will be hidden from the login terminal and all direct registration endpoints will return a 403 Access Denied error.
                                                            </p>
                                                        </div>
                                                        <div className="w-full h-px bg-blue-100/50 my-1" />
                                                        <div className="flex items-start gap-3">
                                                            <ShieldCheck className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                                                            <p className="text-xs font-bold text-blue-600 leading-relaxed">
                                                                When Email Services are <b>OFFLINE</b>, all automated email dispatches—including OTP verifications, password resets, onboarding emails, and system notices—will be bypassed or rejected to protect system credentials.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'feedbacks' && (
                                    <div className="space-y-6">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div>
                                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Feedback Hub</h2>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Review student & guest submissions</p>
                                            </div>
                                            
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                                                {/* Search Bar */}
                                                <div className="relative w-full sm:w-auto">
                                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <input
                                                        type="text"
                                                        value={feedbackSearch}
                                                        onChange={(e) => setFeedbackSearch(e.target.value)}
                                                        placeholder="Search feedback..."
                                                        className="w-full sm:w-64 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all shadow-sm"
                                                    />
                                                </div>

                                                {/* Category Filter */}
                                                <select
                                                    value={feedbackFilter}
                                                    onChange={(e) => setFeedbackFilter(e.target.value)}
                                                    className="w-full sm:w-auto px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-blue-500 transition-all shadow-sm"
                                                >
                                                    <option value="">All Categories</option>
                                                    <option value="Exams">Exams</option>
                                                    <option value="Website">Website</option>
                                                    <option value="Apex Club">Apex Club</option>
                                                    <option value="General">General</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Feedback list */}
                                        {feedbacks.length === 0 ? (
                                            <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-100 shadow-sm">
                                                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                    <MessageSquarePlus size={28} />
                                                </div>
                                                <h3 className="text-lg font-black text-slate-700 tracking-tight">No Submissions Found</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Feedback shared by students will be logged here</p>
                                            </div>
                                        ) : (() => {
                                            const filtered = feedbacks.filter(fb => {
                                                const matchesSearch = 
                                                    fb.name?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
                                                    fb.email?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
                                                    fb.message?.toLowerCase().includes(feedbackSearch.toLowerCase()) ||
                                                    fb.usn?.toLowerCase().includes(feedbackSearch.toLowerCase());
                                                const matchesCategory = !feedbackFilter || fb.category === feedbackFilter;
                                                return matchesSearch && matchesCategory;
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-100 shadow-sm">
                                                        <p className="text-sm font-bold text-slate-500">No feedbacks match your active filters.</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                    {filtered.map((fb) => {
                                                        const isStudent = fb.userId;
                                                        const userUsn = fb.usn || isStudent?.usn || 'N/A';
                                                        return (
                                                            <motion.div
                                                                key={fb._id}
                                                                layout
                                                                whileHover={{ y: -4, scale: 1.02 }}
                                                                onClick={() => setSelectedFeedback(fb)}
                                                                className="bg-white rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all flex flex-col justify-between cursor-pointer group relative overflow-hidden"
                                                            >
                                                                <div>
                                                                    <div className="flex justify-between items-start gap-4 mb-5">
                                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                                                                            fb.category === 'Exams' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                                                            fb.category === 'Website' ? 'bg-violet-50 text-violet-600 border border-violet-100' :
                                                                            fb.category === 'Apex Club' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                            'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                                        }`}>
                                                                            {fb.category === 'Exams' && '📝 '}
                                                                            {fb.category === 'Website' && '🌐 '}
                                                                            {fb.category === 'Apex Club' && '⚡ '}
                                                                            {fb.category === 'General' && '💬 '}
                                                                            {fb.category}
                                                                        </span>
                                                                        
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteFeedback(fb._id);
                                                                            }}
                                                                            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-all border border-slate-100 hover:border-rose-100 active:scale-90"
                                                                            title="Delete Submission"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="flex items-start sm:items-center gap-3 mb-4">
                                                                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 text-slate-700 rounded-xl sm:rounded-2xl flex items-center justify-center font-black group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors uppercase text-xs sm:text-sm border border-slate-100 group-hover:border-blue-100 shrink-0">
                                                                            {fb.name ? fb.name[0] : '?'}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                                <h3 className="font-black text-slate-800 text-base leading-snug group-hover:text-blue-600 transition-colors truncate">{fb.name}</h3>
                                                                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                                                                                    isStudent ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                                                }`}>
                                                                                    {isStudent ? 'Student' : 'Guest'}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-[11px] font-bold text-slate-400 leading-normal break-all mt-1">{fb.email}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                                                                    <div>
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">USN / ID</span>
                                                                        <span className="text-xs font-black text-slate-700 uppercase">{userUsn}</span>
                                                                    </div>
                                                                    
                                                                    <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-all">
                                                                        <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Feedback Detail Modal */}
            <AnimatePresence>
                {selectedFeedback && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-6 sm:p-8 md:p-10 shadow-2xl relative border border-slate-100 custom-scrollbar"
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setSelectedFeedback(null)}
                                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 sm:p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl sm:rounded-2xl transition-all"
                            >
                                <X size={20} />
                            </button>

                            {/* Header / Category */}
                            <div className="mb-6 sm:mb-8">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                                    selectedFeedback.category === 'Exams' ? 'bg-sky-50 text-sky-600 border border-sky-100' :
                                    selectedFeedback.category === 'Website' ? 'bg-violet-50 text-violet-600 border border-violet-100' :
                                    selectedFeedback.category === 'Apex Club' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                    'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                }`}>
                                    {selectedFeedback.category === 'Exams' && '📝 '}
                                    {selectedFeedback.category === 'Website' && '🌐 '}
                                    {selectedFeedback.category === 'Apex Club' && '⚡ '}
                                    {selectedFeedback.category === 'General' && '💬 '}
                                    {selectedFeedback.category} Category
                                </span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-4">Feedback Detail</h2>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Submitted on {new Date(selectedFeedback.createdAt).toLocaleString()}</p>
                            </div>

                            {/* User details section */}
                            <div className="bg-slate-50 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 mb-6 sm:mb-8 border border-slate-100 flex items-start sm:items-center gap-4">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 text-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl uppercase shrink-0 animate-pulse-slow">
                                    {selectedFeedback.name ? selectedFeedback.name[0] : '?'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <h3 className="font-black text-slate-800 text-base sm:text-lg leading-tight truncate">{selectedFeedback.name}</h3>
                                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${
                                            selectedFeedback.userId ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {selectedFeedback.userId ? 'Student' : 'Guest'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] sm:text-xs font-bold text-slate-500 mt-1 break-all">{selectedFeedback.email}</p>
                                    {(selectedFeedback.userId || selectedFeedback.usn) && (
                                        <p className="text-[9px] sm:text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1.5 leading-normal">
                                            USN: {selectedFeedback.usn || selectedFeedback.userId?.usn || 'N/A'} {selectedFeedback.userId?.department ? `• ${selectedFeedback.userId.department} Dept` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Detailed Feedback content */}
                            <div className="mb-6 sm:mb-8">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Feedback Message</h4>
                                <div className="bg-slate-50/50 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 border border-slate-100 text-slate-700 text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap">
                                    "{selectedFeedback.message}"
                                </div>
                            </div>

                            {/* Actions / Close & Delete */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <button
                                    onClick={() => {
                                        setSelectedFeedback(null);
                                    }}
                                    className="w-full sm:flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all"
                                >
                                    Dismiss
                                </button>
                                <button
                                    onClick={() => {
                                        const id = selectedFeedback._id;
                                        setSelectedFeedback(null);
                                        handleDeleteFeedback(id);
                                    }}
                                    className="w-full sm:flex-1 py-3.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest border border-rose-100 transition-all flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={16} /> Delete Feedback
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Launch Exam Modal */}
            <AnimatePresence>
                {showLaunchModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto p-8 md:p-10 shadow-2xl relative custom-scrollbar">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">Initiate New Instance</h2>
                                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Phase 1: Assessment Identity</p>
                                </div>
                                <button onClick={() => setShowLaunchModal(false)} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleLaunchExam} className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Exam Designation</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Internal Title"
                                        value={launchForm.title}
                                        onChange={e => setLaunchForm({ ...launchForm, title: e.target.value })}
                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Allocated Time (Minutes)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="Duration"
                                        value={launchForm.duration}
                                        onChange={e => setLaunchForm({ ...launchForm, duration: e.target.value })}
                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Minimum Marks (To Pass)</label>
                                    <input
                                        type="number"
                                        required
                                        placeholder="e.g. 35"
                                        value={launchForm.passingMarks}
                                        onChange={e => setLaunchForm({ ...launchForm, passingMarks: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Exam Date</label>
                                        <input
                                            type="date"
                                            required
                                            min={minDate}
                                            value={launchForm.scheduledDate}
                                            onChange={e => setLaunchForm({ ...launchForm, scheduledDate: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Start Time</label>
                                        <input
                                            type="time"
                                            required
                                            value={launchForm.startTime}
                                            onChange={e => setLaunchForm({ ...launchForm, startTime: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase">Webcamera Monitoring</p>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-tight">Access student camera during exam</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLaunchForm({ ...launchForm, proctoring: { ...launchForm.proctoring, camera: !launchForm.proctoring.camera } })}
                                            className={`w-12 h-6 rounded-full transition-all relative ${launchForm.proctoring.camera ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${launchForm.proctoring.camera ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div>
                                            <p className="text-xs font-black text-slate-800 uppercase">Microphone Access</p>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-tight">Enable audio monitoring</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLaunchForm({ ...launchForm, proctoring: { ...launchForm.proctoring, microphone: !launchForm.proctoring.microphone } })}
                                            className={`w-12 h-6 rounded-full transition-all relative ${launchForm.proctoring.microphone ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${launchForm.proctoring.microphone ? 'right-1' : 'left-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95">
                                    <Rocket size={20} /> Launch Exam Instance
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Event Modal */}
            <AnimatePresence>
                {showAddEventModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-10 pb-4 flex justify-between items-start border-b border-slate-50">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">Create New Event</h2>
                                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Add upcoming tests or classes</p>
                                </div>
                                <button onClick={() => setShowAddEventModal(false)} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-10 pt-6 overflow-y-auto custom-scrollbar">
                                <form onSubmit={handleAddEvent} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Title *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., Java Advanced Topics"
                                            value={addEventForm.title}
                                            onChange={e => setAddEventForm({ ...addEventForm, title: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Type *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., Class, Test, Workshop"
                                            value={addEventForm.type}
                                            onChange={e => setAddEventForm({ ...addEventForm, type: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Description</label>
                                        <textarea
                                            placeholder="Event details..."
                                            value={addEventForm.description}
                                            onChange={e => setAddEventForm({ ...addEventForm, description: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    {addEventForm.type?.toLowerCase() === 'class' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Instructor Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g., Dr. Smith"
                                                value={addEventForm.instructor}
                                                onChange={e => setAddEventForm({ ...addEventForm, instructor: e.target.value })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    )}

                                    {addEventForm.type?.toLowerCase() === 'test' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Marks</label>
                                            <input
                                                type="number"
                                                placeholder="50"
                                                value={addEventForm.totalQuestions}
                                                onChange={e => setAddEventForm({ ...addEventForm, totalQuestions: parseInt(e.target.value) })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Start Date & Time *</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            min={minDateTime}
                                            value={addEventForm.startTime}
                                            onChange={e => setAddEventForm({ ...addEventForm, startTime: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">End Date & Time *</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            min={addEventForm.startTime || minDateTime}
                                            value={addEventForm.endTime}
                                            onChange={e => setAddEventForm({ ...addEventForm, endTime: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95">
                                        <Plus size={20} /> Create Event
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Event Modal */}
            <AnimatePresence>
                {showEditEventModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col">
                            <div className="p-10 pb-4 flex justify-between items-start border-b border-slate-50">
                                <div>
                                    <h2 className="text-2xl font-black tracking-tight">Modify Event Protocol</h2>
                                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Update existing schedule parameters</p>
                                </div>
                                <button onClick={() => { setShowEditEventModal(false); setEditingEvent(null); }} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-10 pt-6 overflow-y-auto custom-scrollbar">
                                <form onSubmit={handleUpdateEvent} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Designation *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., Final Assessment Phase 1"
                                            value={editEventForm.title}
                                            onChange={e => setEditEventForm({ ...editEventForm, title: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Event Category *</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="e.g., Standard Class, Examination"
                                            value={editEventForm.type}
                                            onChange={e => setEditEventForm({ ...editEventForm, type: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Description Registry</label>
                                        <textarea
                                            placeholder="Event overview details..."
                                            value={editEventForm.description}
                                            onChange={e => setEditEventForm({ ...editEventForm, description: e.target.value })}
                                            className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 resize-none"
                                            rows="3"
                                        />
                                    </div>

                                    {editEventForm.type?.toLowerCase() === 'class' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Primary Instructor</label>
                                            <input
                                                type="text"
                                                placeholder="Assign Instructor"
                                                value={editEventForm.instructor}
                                                onChange={e => setEditEventForm({ ...editEventForm, instructor: e.target.value })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    )}

                                    {editEventForm.type?.toLowerCase() === 'test' && (
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Total Marks</label>
                                            <input
                                                type="number"
                                                value={editEventForm.totalQuestions}
                                                onChange={e => setEditEventForm({ ...editEventForm, totalQuestions: parseInt(e.target.value) })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Start Timeline *</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                min={minDateTime}
                                                value={editEventForm.startTime}
                                                onChange={e => setEditEventForm({ ...editEventForm, startTime: e.target.value })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">End Timeline *</label>
                                            <input
                                                type="datetime-local"
                                                required
                                                min={editEventForm.startTime || minDateTime}
                                                value={editEventForm.endTime}
                                                onChange={e => setEditEventForm({ ...editEventForm, endTime: e.target.value })}
                                                className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all active:scale-95 shadow-blue-600/20">
                                        <Settings size={20} /> Overwrite Event Protocol
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* User Detail & Management Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white rounded-[3rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-blue-600/20">
                                        {selectedUser?.user?.name?.split(' ').map(n => n[0]).join('')}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{selectedUser?.user?.name}</h2>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedUser?.user?.usn}</span>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${selectedUser?.user?.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {selectedUser?.user?.isActive ? 'Protocol Active' : 'Account Suspended'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedUser(null); setEditMode(false); }} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all"><X size={24} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                {!editMode ? (
                                    <div className="space-y-10">
                                        {selectedUser.user.role === 'student' ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-blue-600 rounded-lg text-white"><Rocket size={16} /></div>
                                                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Attendance</span>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <span className="text-3xl font-black text-blue-900">{selectedUser.stats?.attended || 0}</span>
                                                            <span className="text-xs font-bold text-blue-400 uppercase mb-1">Exams Attended</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-rose-600 rounded-lg text-white"><UserX size={16} /></div>
                                                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Absentee</span>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <span className="text-3xl font-black text-rose-900">{selectedUser.stats?.absent || 0}</span>
                                                            <span className="text-xs font-bold text-rose-400 uppercase mb-1">Exams Missed</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 bg-emerald-600 rounded-lg text-white"><Award size={16} /></div>
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Rank</span>
                                                        </div>
                                                        <div className="flex items-end justify-between">
                                                            <span className="text-3xl font-black text-emerald-900">#{userRanks[selectedUser.user._id] || '--'}</span>
                                                            <span className="text-xs font-bold text-emerald-400 uppercase mb-1">Merit Tier</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-2 mb-6">
                                                        <Award size={18} className="text-slate-400" />
                                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Result Registry</h3>
                                                    </div>
                                                    <div className="space-y-4">
                                                        {selectedUser.results?.length > 0 ? selectedUser.results.map(r => (
                                                            <div key={r._id} className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                                                <div>
                                                                    <p className="font-bold text-slate-800">{r.examId?.title}</p>
                                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Submitted on {new Date(r.createdAt).toLocaleDateString()}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-lg font-black text-blue-600">{r.score} <span className="text-slate-300">/ {r.totalMarks || r.totalQuestions}</span></p>
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Verified Mark</span>
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            <div className="py-12 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 uppercase font-black text-[10px] tracking-widest">
                                                                <ShieldAlert size={32} className="mb-4 opacity-20" />
                                                                No Session records found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="space-y-10">
                                                <div className="flex items-center gap-3 p-6 bg-slate-900 rounded-[2rem] text-white shadow-2xl shadow-slate-900/20">
                                                    <div className="p-3 bg-white/10 rounded-2xl"><Settings size={24} /></div>
                                                    <div>
                                                        <h3 className="text-lg font-black tracking-tight">Administrative Console</h3>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Access & Audit Logs</p>
                                                    </div>
                                                </div>

                                                {currentUser?.role === 'superadmin' ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-2">
                                                                <Monitor size={18} className="text-blue-500" />
                                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Login Activity (Last 10)</h4>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {selectedUser.user.loginHistory?.length > 0 ? selectedUser.user.loginHistory.map((login, idx) => (
                                                                    <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center group hover:bg-blue-50 transition-all">
                                                                        <div>
                                                                            <p className="text-xs font-black text-slate-800 tracking-tight">{login.ip}</p>
                                                                            <p className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">{login.userAgent}</p>
                                                                        </div>
                                                                        <div className="text-right">
                                                                            <p className="text-[10px] font-black text-blue-600 uppercase">{new Date(login.timestamp).toLocaleDateString()}</p>
                                                                            <p className="text-[9px] font-bold text-slate-300">{new Date(login.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                                                        </div>
                                                                    </div>
                                                                )) : (
                                                                    <div className="py-8 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                                                        No login history recorded
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="space-y-6">
                                                            <div className="flex items-center gap-2">
                                                                <Activity size={18} className="text-purple-500" />
                                                                <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.2em]">Administrative Actions</h4>
                                                            </div>
                                                            <div className="space-y-3">
                                                                {selectedUser.user.webActivity?.length > 0 ? selectedUser.user.webActivity.map((act, idx) => (
                                                                    <div key={idx} className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex gap-4">
                                                                        <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 animate-pulse" />
                                                                        <div>
                                                                            <p className="text-xs font-black text-purple-900 uppercase tracking-tight">{act.action}</p>
                                                                            <p className="text-[10px] text-slate-500 font-bold mt-0.5">{act.details}</p>
                                                                            <p className="text-[9px] text-slate-300 font-bold mt-1">{new Date(act.timestamp).toLocaleString()}</p>
                                                                        </div>
                                                                    </div>
                                                                )) : (
                                                                    <div className="py-8 text-center text-slate-300 font-black text-[10px] uppercase tracking-widest bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                                                        No activity records found
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="py-16 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center px-8">
                                                        <ShieldAlert size={48} className="text-slate-200 mb-4" />
                                                        <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Access Restricted</h4>
                                                        <p className="text-xs font-bold text-slate-400 max-w-xs">Detailed audit logs and system activity are only accessible by Super Administrators.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="pt-8 border-t border-slate-100 flex flex-wrap gap-4">
                                            <button onClick={() => setEditMode(true)} className="flex-1 flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"><Edit size={16} /> Edit Profile Protocol</button>
                                            <button onClick={handleToggleStatus} className={`flex-1 flex items-center justify-center gap-3 py-4 ${selectedUser?.user?.isActive ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500 shadow-emerald-500/20'} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl`}>
                                                {selectedUser?.user?.isActive ? <UserMinus size={16} /> : <CheckCircle size={16} />}
                                                {selectedUser?.user?.isActive ? 'Deactivate Access' : 'Restore Authorization'}
                                            </button>
                                            {(currentUser?.role === 'superadmin' || (currentUser?.role === 'admin' && selectedUser?.user?.role === 'student')) && selectedUser?.user?.role !== 'superadmin' && (
                                                <>
                                                    <button onClick={handleDeleteUser} className="flex-1 flex items-center justify-center gap-3 py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/20"><Trash2 size={16} /> Permanent Elimination</button>
                                                    <button onClick={() => handleHardDeleteUser(selectedUser.user._id)} className="flex-1 flex items-center justify-center gap-3 py-4 bg-red-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-900 transition-all shadow-xl shadow-red-800/20"><UserX size={16} /> Delete Account</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleUpdateUser} className="space-y-6 max-w-2xl mx-auto py-4">
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 text-center flex items-center justify-center gap-3"><Settings size={18} className="text-blue-500" /> Overwrite User Configuration</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Member Name</label>
                                                <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Terminal</label>
                                                <input type="email" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">USN Protocol ID</label>
                                                <input type="text" required maxLength={9} value={editForm.usn} onChange={e => setEditForm({ ...editForm, usn: e.target.value.toUpperCase().slice(0, 9) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold uppercase focus:ring-4 focus:ring-blue-500/10 outline-none" />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                                <select
                                                    required
                                                    value={editForm.department}
                                                    onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none appearance-none"
                                                >
                                                    <option value="">Select Dept</option>
                                                    <option value="CSD">Computer Science And Design</option>
                                                    <option value="CSE">Computer Science And Engineering</option>
                                                    <option value="AIML">Artificial Intelligence And Machine Learning</option>
                                                    <option value="AIDS">Artificial Intelligence And Data Science</option>
                                                    <option value="CEE">Civil Environmental Engineering</option>
                                                    <option value="BMRE">Biomedical and Robotic Engineering</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Secure Passkey (Optional)</label>
                                                <div className="relative">
                                                    <input
                                                        type={showEditPassword ? "text" : "password"}
                                                        placeholder="Keep blank to maintain current"
                                                        value={editForm.password}
                                                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none pr-12"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowEditPassword(!showEditPassword)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                                                    >
                                                        {showEditPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Mesh</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={editForm.mobileNumber}
                                                    onChange={e => {
                                                        let val = e.target.value;
                                                        if (!val.startsWith('+91')) {
                                                            val = '+91' + val.replace(/\D/g, '');
                                                        } else {
                                                            val = '+91' + val.slice(3).replace(/\D/g, '');
                                                        }
                                                        setEditForm({ ...editForm, mobileNumber: val.slice(0, 13) });
                                                    }}
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none"
                                                />
                                            </div>
                                            {currentUser?.role === 'superadmin' && (
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Hierarchy (Role)</label>
                                                    <select
                                                        value={editForm.role}
                                                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                                        className="w-full p-4 bg-amber-50 border border-amber-200 rounded-2xl font-bold focus:ring-4 focus:ring-amber-500/10 outline-none text-amber-900"
                                                    >
                                                        <option value="student">Student Member</option>
                                                        <option value="admin">System Admin</option>
                                                        <option value="superadmin">Super Administrator</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-4 pt-6">
                                            <button type="button" onClick={() => setEditMode(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Abort Changes</button>
                                            <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20">Commit Protocol Overwrite</button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add User Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-4 sm:p-6 overflow-y-auto">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-2xl rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 my-8 sm:my-0">
                            <div className="p-6 sm:p-10 max-h-[85vh] sm:max-h-none overflow-y-auto custom-scrollbar">
                                <div className="flex justify-between items-start mb-6 sm:mb-10">
                                    <div>
                                        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Manual Registry</h2>
                                        <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Onboarding new protocol member</p>
                                    </div>
                                    <button onClick={() => setShowAddModal(false)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><X size={24} /></button>
                                </div>

                                <form onSubmit={handleAddUser} className="space-y-6 sm:space-y-8">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                            <input required type="text" value={addUserForm.name} onChange={e => setAddUserForm({ ...addUserForm, name: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="Harshith" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1"> Register Number</label>
                                            <input required type="text" maxLength={9} value={addUserForm.usn} onChange={e => setAddUserForm({ ...addUserForm, usn: e.target.value.toUpperCase().slice(0, 9) })} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="23SECD001" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Terminal</label>
                                            <input required type="email" value={addUserForm.email} onChange={e => setAddUserForm({ ...addUserForm, email: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none" placeholder="harshith@apex.com" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Mesh</label>
                                            <input
                                                required
                                                type="text"
                                                value={addUserForm.mobileNumber}
                                                onChange={e => {
                                                    let val = e.target.value;
                                                    if (!val.startsWith('+91')) {
                                                        val = '+91' + val.replace(/\D/g, '');
                                                    } else {
                                                        val = '+91' + val.slice(3).replace(/\D/g, '');
                                                    }
                                                    setAddUserForm({ ...addUserForm, mobileNumber: val.slice(0, 13) });
                                                }}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                placeholder="+91 00000 00000"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Department</label>
                                            <select required value={addUserForm.department} onChange={e => setAddUserForm({ ...addUserForm, department: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none">
                                                <option value="">Select Dept</option>
                                                <option value="CSD">Computer Science And Design</option>
                                                <option value="CSE">Computer Science And Engineering</option>
                                                <option value="AIML">Artificial Intelligence And Machine Learning</option>
                                                <option value="AIDS">Artificial Intelligence And Data Science</option>
                                                <option value="CEE">Civil Environmental Engineering</option>
                                                <option value="BMRE">Biomedical and Robotic Engineering</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Tier</label>
                                            <select required value={addUserForm.role} onChange={e => setAddUserForm({ ...addUserForm, role: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none appearance-none">
                                                <option value="student">Student Member</option>
                                                <option value="admin">System Admin</option>
                                                {currentUser?.role === 'superadmin' && (
                                                    <option value="superadmin">Super Administrator</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Key (Password)</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type={showAddPassword ? "text" : "password"}
                                                value={addUserForm.password}
                                                onChange={e => setAddUserForm({ ...addUserForm, password: e.target.value })}
                                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none pr-14"
                                                placeholder="Minimum 6 characters"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowAddPassword(!showAddPassword)}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                                            >
                                                {showAddPassword ? <Eye size={20} /> : <EyeOff size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]">
                                            ADD New Member
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Live Monitoring Modal */}
            <AnimatePresence>
                {selectedSession && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black">
                                        {selectedSession.userId?.name?.[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black">{selectedSession.userId?.name}</h2>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol: {selectedSession.examId?.title}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedSession(null)} className="p-3 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto">
                                <div className="aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                                    <img
                                        id="live-stream-img"
                                        data-userid={selectedSession.userId?._id || selectedSession.userId}
                                        src={selectedSession.liveSnapshot || ''}
                                        alt="Live Feed"
                                        className="w-full h-full object-cover"
                                        style={{ display: selectedSession.liveSnapshot ? 'block' : 'none' }}
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            const ph = document.getElementById('live-stream-placeholder');
                                            if (ph) ph.style.display = 'flex';
                                        }}
                                    />
                                    <div id="live-stream-placeholder" className="flex flex-col items-center justify-center absolute inset-0 bg-slate-900" style={{ display: selectedSession.liveSnapshot ? 'none' : 'flex' }}>
                                        <Monitor size={48} className="text-slate-700 mb-4" />
                                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest animate-pulse">
                                            Establishing Secure Uplink...
                                        </p>
                                    </div>
                                    <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-tighter animate-pulse z-10">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                        LIVE
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audio Level</p>
                                        </div>
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                id="live-stream-mic"
                                                data-userid={selectedSession.userId?._id || selectedSession.userId}
                                                style={{ width: `${selectedSession.micActivity || 0}%` }}
                                                className={`h-full transition-all duration-300 ${(selectedSession.micActivity || 0) > 60 ? 'bg-rose-500' : 'bg-green-500'}`}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tab Transitions</p>
                                        <p className="text-xl font-black text-rose-600">{selectedSession.violations?.tabSwitches || 0} Events</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1 col-span-2 sm:col-span-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Focus Lost</p>
                                        <p className="text-xl font-black text-amber-600">{selectedSession.violations?.fullscreenExits || 0} Events</p>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-4">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Status</p>
                                        <p className="text-lg font-black text-green-600 uppercase">Authenticated</p>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Update</p>
                                        <p className="text-lg font-black text-slate-900">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                                    </div>
                                </div>

                                <div className="mt-6 flex gap-4">
                                    <button
                                        onClick={() => setShowSuspendModal(true)}
                                        className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-600 transition-all shadow-xl shadow-rose-500/20"
                                    >
                                        Suspend Student
                                    </button>
                                    <button
                                        onClick={() => setShowMessageModal(true)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                                    >
                                        Send Message
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Send Message Modal */}
            <AnimatePresence>
                {showMessageModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl">
                            <h2 className="text-2xl font-black tracking-tight mb-2">Send Direct Message</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Dispatches message to student's screen</p>

                            <textarea
                                value={messageText}
                                onChange={e => setMessageText(e.target.value)}
                                placeholder="e.g., Please fix your camera angle immediately."
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 mb-8 resize-none"
                                rows="4"
                            />

                            <div className="flex gap-4">
                                <button onClick={() => setShowMessageModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                                <button onClick={handleSendMessage} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20">Send Protocol</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Suspension Reason Modal */}
            <AnimatePresence>
                {showSuspendModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl">
                            <h2 className="text-2xl font-black tracking-tight mb-2">Protocol Termination</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Specify reason for suspension</p>

                            <textarea
                                value={suspensionReason}
                                onChange={e => setSuspensionReason(e.target.value)}
                                placeholder="e.g., Continuous unauthorized tab switching detected."
                                className="w-full p-6 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-4 focus:ring-rose-500/10 mb-8 resize-none"
                                rows="4"
                            />

                            <div className="flex gap-4">
                                <button onClick={() => setShowSuspendModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest">Cancel</button>
                                <button onClick={handleSuspendStudent} className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-600/20">Confirm Suspend</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Bulk Upload Modal */}
            <AnimatePresence>
                {showBulkUpload && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3rem] w-full max-w-xl p-10 shadow-2xl border border-slate-100">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-3xl font-black tracking-tight text-slate-900">Bulk Registration</h2>
                                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Import hundreds of student identities</p>
                                </div>
                                <button onClick={() => setShowBulkUpload(false)} className="p-3 bg-slate-100 text-slate-400 hover:text-rose-600 rounded-2xl transition-all"><X size={24} /></button>
                            </div>

                            <div
                                className={`p-16 border-2 border-dashed rounded-[3rem] text-center transition-all cursor-pointer relative group ${bulkFile ? 'bg-blue-50 border-blue-400' : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-white'}`}
                                onClick={() => document.getElementById('bulk-file-input').click()}
                            >
                                <input
                                    id="bulk-file-input"
                                    type="file"
                                    className="hidden"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={(e) => setBulkFile(e.target.files[0])}
                                />
                                <div className="flex flex-col items-center">
                                    {bulkFile ? (
                                        <>
                                            <div className="p-6 bg-blue-600 text-white rounded-3xl mb-6 shadow-xl shadow-blue-600/20"><FileSpreadsheet size={48} /></div>
                                            <p className="font-black text-blue-600 text-lg mb-1">{bulkFile.name}</p>
                                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{(bulkFile.size / 1024).toFixed(2)} KB • Ready for processing</p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="p-6 bg-slate-200 text-slate-400 rounded-3xl mb-6 group-hover:scale-110 transition-transform"><Upload size={48} /></div>
                                            <p className="font-black text-slate-700 text-lg mb-1">Click to Upload Spreadsheet</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supports .XLSX, .XLS and .CSV formats</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="mt-10 space-y-4">
                                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                                    <div className="p-2 bg-amber-200 text-amber-700 rounded-lg h-fit"><Info size={16} /></div>
                                    <div>
                                        <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Spreadsheet Requirements</p>
                                        <p className="text-xs font-bold text-amber-700/80 leading-relaxed">Ensure your file contains the following headers: <b>name, email, usn, department, mobileNumber</b>. Default passwords will follow the pattern: <b>NameUsnLast5@apex</b> (e.g., Gopalcd043@apex).</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleBulkUpload}
                                    disabled={!bulkFile || isBulkUploading}
                                    className={`w-full py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl transition-all ${!bulkFile || isBulkUploading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20 active:scale-95'}`}
                                >
                                    {isBulkUploading ? 'PROVISIONING ACCOUNTS...' : 'EXECUTE BULK REGISTRATION'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Notice Modal (Gmail Style) */}
            <AnimatePresence>
                {showAddNoticeModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pb-24 sm:pb-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddNoticeModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: 100, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 100, opacity: 0 }}
                            className="relative bg-white w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 flex flex-col"
                        >
                            <div className="bg-slate-900 p-6 flex justify-between items-center shrink-0">
                                <h3 className="text-white font-bold flex items-center gap-2">
                                    <MessageSquarePlus size={18} /> New Announcement
                                </h3>
                                <button onClick={() => setShowAddNoticeModal(false)} className="text-slate-400 hover:text-white transition-all"><X size={20} /></button>
                            </div>

                            <form onSubmit={handleAddNotice} className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex-1 overflow-y-auto">
                                    <div className="divide-y divide-slate-100">
                                    <div className="flex items-center px-6 py-4 gap-4">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-16">To:</span>
                                        <select value={newNotice.targetDepartment} onChange={e => setNewNotice({ ...newNotice, targetDepartment: e.target.value })} className="flex-1 bg-transparent font-bold text-slate-700 outline-none">
                                            <option value="All">All Protocol Members (Universal)</option>
                                            <option value="CSD">CSD Dept</option>
                                            <option value="CSE">CSE Dept</option>
                                            <option value="AIML">AIML Dept</option>
                                            <option value="AIDS">AIDS Dept</option>
                                            <option value="CEE">CEE Dept</option>
                                            <option value="BMRE">BMRE Dept</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center px-6 py-4 gap-4">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-16">Priority:</span>
                                        <select value={newNotice.type} onChange={e => setNewNotice({ ...newNotice, type: e.target.value })} className="flex-1 bg-transparent font-bold text-slate-700 outline-none">
                                            <option value="general">General Broadcast</option>
                                            <option value="urgent">Urgent Security Alert</option>
                                            <option value="exam">Academic/Exam Update</option>
                                            <option value="holiday">Holiday Notice</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center px-6 py-4 gap-4">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-16">Title:</span>
                                        <input required type="text" value={newNotice.title} onChange={e => setNewNotice({ ...newNotice, title: e.target.value })} className="flex-1 bg-transparent font-bold text-slate-700 outline-none" placeholder="Notice Heading" />
                                    </div>

                                    <div className="flex items-center px-6 py-4 gap-4">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-16">Subject:</span>
                                        <input required type="text" value={newNotice.subject} onChange={e => setNewNotice({ ...newNotice, subject: e.target.value })} className="flex-1 bg-transparent font-bold text-slate-700 outline-none" placeholder="Email Subject Line" />
                                    </div>
                                </div>

                                <div className="p-6">
                                    <textarea
                                        required
                                        value={newNotice.content}
                                        onChange={e => setNewNotice({ ...newNotice, content: e.target.value })}
                                        className="w-full h-48 bg-transparent text-slate-600 font-medium outline-none resize-none"
                                        placeholder="Compose your message here..."
                                    />

                                    {noticeImagePreview && (
                                        <div className="mt-6 border-t border-slate-100 pt-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                                <div className="space-y-4">
                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Visual Scale: {newNotice.imageScale || 100}%</label>
                                                    <input
                                                        type="range"
                                                        min="10"
                                                        max="100"
                                                        value={newNotice.imageScale || 100}
                                                        onChange={(e) => setNewNotice({ ...newNotice, imageScale: parseInt(e.target.value) })}
                                                        className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg appearance-none"
                                                    />
                                                    <p className="text-[10px] text-slate-500 font-bold">Slide to adjust the image size displayed to students.</p>
                                                </div>
                                                <div className="relative group mx-auto flex justify-center" style={{ width: `${newNotice.imageScale || 100}%` }}>
                                                    <img src={noticeImagePreview} alt="Preview" className="w-full h-auto rounded-xl border-2 border-slate-100" />
                                                    <button
                                                        type="button"
                                                        onClick={() => { setNoticeImageFile(null); setNoticeImagePreview(null); setNewNotice({ ...newNotice, imageScale: 100 }); }}
                                                        className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </div>

                                <div className="px-6 py-4 bg-slate-50 flex items-center justify-between shrink-0 border-t border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <button
                                            type="submit"
                                            disabled={isDetailLoading}
                                            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                                        >
                                            {isDetailLoading ? 'Dispatching...' : 'Dispatch'}
                                        </button>
                                        <label className="p-2 text-slate-400 hover:text-blue-600 cursor-pointer transition-all">
                                            <Activity size={20} />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleNoticeImageChange} />
                                        </label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddNoticeModal(false)}
                                        className="p-2 text-slate-400 hover:text-rose-500 transition-all"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Premium Custom Confirmation Overlay */}
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                confirmText={confirmModal.confirmText}
                type={confirmModal.type}
            />
        </div>
    );
};

export default AdminDashboard;
