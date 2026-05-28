import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, CheckCircle, Clock, Play, BarChart2,
    LayoutDashboard, List, Award, Book, Database,
    ShieldAlert, ChevronRight,
    Video, Image, FileText, X, ExternalLink, Eye, Calendar, Users, UserMinus, Bell, Info, Rocket,
    Activity, CheckSquare, Monitor, Terminal, Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo_transparent.png';
import { io } from 'socket.io-client';

import { toast } from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';

const SidebarLink = ({ id, icon: Icon, label, activeTab, setActiveTab, navigate }) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => {
                setActiveTab(id);
                navigate(`/student?tab=${id}`, { replace: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors duration-200 relative overflow-hidden group"
            style={{ outline: 'none', height: '48px' }}
        >
            {/* Background sliding capsule using Framer Motion */}
            {isActive && (
                <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-blue-50 text-blue-600 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: 0 }}
                />
            )}

            {/* Content wrapper to stay above the layout indicator */}
            <div className={`flex items-center gap-3 relative z-10 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'}`}>
                <Icon size={20} className="shrink-0" />
                <span className="hidden md:inline truncate">{label}</span>
            </div>
        </button>
    );
};

const MobileTabButton = ({ id, icon: Icon, label, activeTab, setActiveTab, navigate }) => {
    const isActive = activeTab === id;
    return (
        <button
            onClick={() => {
                setActiveTab(id);
                navigate(`/student?tab=${id}`, { replace: true });
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex flex-col items-center gap-1 p-2 flex-1 transition-colors duration-200 relative"
            style={{ outline: 'none' }}
        >
            {isActive && (
                <motion.div
                    layoutId="activeMobileTabIndicator"
                    className="absolute inset-x-2 inset-y-1 bg-blue-50 text-blue-600 rounded-xl"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    style={{ zIndex: 0 }}
                />
            )}
            <div className={`flex flex-col items-center gap-1 relative z-10 transition-colors duration-200 ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                <Icon size={20} className="shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-tighter truncate">{label}</span>
            </div>
        </button>
    );
};

const StudentDashboard = () => {
    const navigate = useNavigate();
    const getInitialTab = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('tab') || 'dashboard';
    };

    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [results, setResults] = useState([]);
    const [resources, setResources] = useState([]);
    const [events, setEvents] = useState([]);
    const [notices, setNotices] = useState([]);
    const [quizzes, setQuizzes] = useState([]);
    const [quizResults, setQuizResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(getInitialTab());
    const [viewingResource, setViewingResource] = useState(null);
    const [expandedNotice, setExpandedNotice] = useState(null);
    const [viewingQuizResult, setViewingQuizResult] = useState(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent || navigator.vendor || window.opera;
            const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
            setIsMobile(mobileRegex.test(userAgent) || window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
        ? `http://${window.location.hostname}:5000`
        : 'https://apex-s1q2.onrender.com';

    const fetchData = async () => {
        try {
            const [examsRes, resultsRes, resourcesRes, eventsRes, noticesRes, quizzesRes, quizResultsRes] = await Promise.all([
                axios.get(`${API_BASE}/api/exams`),
                axios.get(`${API_BASE}/api/results/my-results`),
                axios.get(`${API_BASE}/api/resources`),
                axios.get(`${API_BASE}/api/events`),
                axios.get(`${API_BASE}/api/notices`),
                axios.get(`${API_BASE}/api/quiz`),
                axios.get(`${API_BASE}/api/quiz/results`)
            ]);

            setExams(examsRes.data.data);
            setResults(resultsRes.data.data);
            setResources(resourcesRes.data.data);
            setEvents(eventsRes.data.data || []);
            setNotices(noticesRes.data.data || []);
            setQuizzes(quizzesRes.data.data || []);
            setQuizResults(quizResultsRes.data.data || []);
        } catch (err) {
            console.error('Fetch error:', err);
        }
    };

    useEffect(() => {
        const initFetch = async () => {
            setLoading(true);
            await fetchData();
            setLoading(false);
        };
        initFetch();
    }, []);

    useEffect(() => {
        const socket = io(API_BASE);

        socket.on('data-updated', (data) => {
            console.log("Remote update detected:", data.type);
            fetchData();
        });

        return () => socket.disconnect();
    }, []);

    const stats = [
        { label: 'Total Exams', value: exams.length, icon: <BookOpen className="text-blue-500" /> },
        { label: 'Completed', value: results.length, icon: <CheckCircle className="text-emerald-500" /> },
        { label: 'Avg. Score', value: results.filter(r => r.isPublished).length > 0 ? (results.filter(r => r.isPublished).reduce((acc, r) => acc + (r.score / (r.totalMarks || r.totalQuestions)) * 100, 0) / results.filter(r => r.isPublished).length).toFixed(1) + '%' : 'N/A', icon: <BarChart2 className="text-purple-500" /> }
    ];

    const getEmbedLink = (url) => {
        if (!url) return '';

        // Handle Google Drive
        if (url.includes('drive.google.com')) {
            return url.replace(/\/view.*$/, '/preview').replace(/\/edit.*$/, '/preview');
        }

        // Handle YouTube
        if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }
        if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            return `https://www.youtube.com/embed/${videoId}`;
        }

        // Return original URL for other direct links (PDF, Image, etc.)
        return url;
    };

    const ResourceIcon = ({ type }) => {
        switch (type) {
            case 'PDF': return <FileText size={20} className="text-rose-500" />;
            case 'Video': return <Video size={20} className="text-blue-500" />;
            case 'Image': return <Image size={20} className="text-emerald-500" />;
            default: return <Book size={20} className="text-amber-500" />;
        }
    };



    useEffect(() => {
        const handleSecurity = (e) => {
            e.preventDefault();
        };

        const handleKeyDown = (e) => {
            if (e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
                (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
                (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
                (e.ctrlKey && e.keyCode === 85)) {               // Ctrl+U
                e.preventDefault();
            }
        };

        const blockDevTools = setInterval(() => {
            Function("debugger")();
        }, 50);

        document.addEventListener('copy', handleSecurity);
        document.addEventListener('paste', handleSecurity);
        document.addEventListener('cut', handleSecurity);
        document.addEventListener('contextmenu', handleSecurity);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearInterval(blockDevTools);
            document.removeEventListener('copy', handleSecurity);
            document.removeEventListener('paste', handleSecurity);
            document.removeEventListener('cut', handleSecurity);
            document.removeEventListener('contextmenu', handleSecurity);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    if (loading) return <LoadingScreen message="Synchronizing Portal..." dark={false} fullScreen={true} />;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans select-none">
            <Navbar />

            <div className="flex-1 flex flex-col md:flex-row relative">
                {/* Desktop Sidebar */}
                <aside className="hidden md:block md:w-64 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 md:fixed md:top-[160px] md:bottom-8 md:left-8 z-20 overflow-y-auto overflow-x-hidden custom-scrollbar sidebar-stable">
                    <nav className="space-y-1">
                        <SidebarLink id="dashboard" icon={LayoutDashboard} label="Dashboard" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="exams" icon={BookOpen} label="Exams" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="quizzes" icon={Rocket} label="Quizzes" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="quiz-results" icon={Award} label="Quiz Results" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="results" icon={Award} label="Results" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />

                        <SidebarLink id="events" icon={Calendar} label="Events" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="notices" icon={Bell} label="Notice Board" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <SidebarLink id="resources" icon={Book} label="Resources" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                    </nav>
                </aside>

                {/* Mobile Bottom Navigation - Styled to match top Navbar */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-100 pt-1 pb-1 px-2 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] safe-pb">
                    <div className="h-16 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm flex items-center justify-around px-2">
                        <MobileTabButton id="dashboard" icon={LayoutDashboard} label="Home" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="exams" icon={BookOpen} label="Exams" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="quizzes" icon={Rocket} label="Quizzes" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="quiz-results" icon={Award} label="Quiz" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="results" icon={FileText} label="Results" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="events" icon={Calendar} label="Events" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="notices" icon={Bell} label="Notice" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                        <MobileTabButton id="resources" icon={Book} label="Library" activeTab={activeTab} setActiveTab={setActiveTab} navigate={navigate} />
                    </div>
                </div>

                {/* Main Content */}
                <main className="flex-1 p-4 md:p-8 ml-0 md:ml-[320px] md:pr-8 md:pt-8 mb-24 md:mb-0">
                    <div className="max-w-6xl mx-auto">
                        <header className="mb-12">
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Hello, {user?.name.split(' ')[0]}! 👋</h1>
                            <p className="text-slate-500 font-medium">Welcome to your secure assessment portal. Stay focused and excel.</p>
                        </header>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -15, scale: 0.98 }}
                                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            >
                                {activeTab === 'dashboard' && (
                                    <div className="space-y-12">
                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {stats.map((stat, idx) => (
                                                <div key={idx} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex items-center gap-6">
                                                    <div className="p-4 bg-slate-50 rounded-2xl">
                                                        {stat.icon}
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                                                        <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Recent Activity / Welcome Card */}
                                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-[2.5rem] p-10 md:p-14 text-white shadow-2xl relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl" />
                                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                                <div className="flex-1">
                                                    <h2 className="text-3xl font-black mb-4">Assessment Protocol Active</h2>
                                                    <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-xl">
                                                        Ensure you have a stable connection and are in a quiet environment before commencing any assessment. Multi-window tracking is currently enabled.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        setActiveTab('exams');
                                                        navigate(`/student?tab=exams`, { replace: true });
                                                    }}
                                                    className="px-10 py-5 bg-white text-blue-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all shadow-xl active:scale-95"
                                                >
                                                    Browse Assessments
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'exams' && (
                                    <div className="space-y-6">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Play size={24} className="text-blue-600" /> Available Assessments
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {exams.length > 0 ? exams.map((exam) => {
                                                const userResult = results.find(r => r.examId?._id === exam._id);
                                                const isFinished = userResult && (userResult.status === 'Submitted' || userResult.status === 'Completed' || userResult.status === 'Suspended');
                                                const isOngoing = userResult && userResult.status === 'Ongoing';

                                                return (
                                                    <div key={exam._id} className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:border-blue-100 transition-all group relative overflow-hidden flex flex-col h-full">
                                                        {/* Card Branding */}
                                                        <div className="mb-6 w-12 h-12">
                                                            <img src={logo} alt="APEX" className="w-full h-full object-contain" />
                                                        </div>

                                                        {/* Card Header: Title & Status */}
                                                        <div className="flex justify-between items-start mb-4">
                                                            <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors leading-tight pr-2">{exam.title}</h3>
                                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                                {exam.status === 'Stopped' && !isFinished && !isOngoing && (
                                                                    <span className="px-2 py-1 bg-rose-50 text-rose-500 border border-rose-100 text-[8px] font-black uppercase tracking-widest rounded-lg">Stopped</span>
                                                                )}
                                                                {(isFinished || isOngoing) && (
                                                                    <span className={`px-2 py-1 ${isFinished ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'} text-[8px] font-black uppercase tracking-widest rounded-lg border`}>
                                                                        {isFinished ? 'Attended' : 'Ongoing'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Card Content: Stats List */}
                                                        <div className="flex-1 space-y-2 mb-6">
                                                            <div className="flex items-center gap-2.5 text-slate-400">
                                                                <Clock size={14} className="text-slate-300" />
                                                                <span className="text-[11px] font-bold">Duration: <span className="text-slate-700">{Math.floor(exam.duration / 60)} Minutes</span></span>
                                                            </div>
                                                            <div className="flex items-center gap-2.5 text-slate-400">
                                                                <List size={14} className="text-slate-300" />
                                                                <span className="text-[11px] font-bold">Capacity: <span className="text-slate-700">{exam.questions?.length || 0} Items</span></span>
                                                            </div>
                                                            <div className="flex items-center gap-2.5 text-slate-400">
                                                                <Award size={14} className="text-slate-300" />
                                                                <span className="text-[11px] font-bold">Total Marks: <span className="text-slate-700">{(exam.questions || []).reduce((acc, q) => acc + (q.marks !== undefined ? q.marks : 1), 0)} Marks</span></span>
                                                            </div>
                                                            {(exam.scheduledDate || exam.startTime) && (
                                                                <div className="flex items-center gap-2.5 text-blue-500 pt-1">
                                                                    <Calendar size={14} className="opacity-70" />
                                                                    <span className="text-[10px] font-black uppercase tracking-tight">Schedule: {exam.scheduledDate} @ {exam.startTime}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Card Footer: Action */}
                                                        <div className="pt-4 border-t border-slate-50">
                                                            {isFinished ? (
                                                                userResult.isPublished ? (
                                                                    userResult.attendance === 'Absent' ? (
                                                                        <div className="w-full py-2 bg-rose-50 text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest text-center border border-rose-100">Protocol Absent</div>
                                                                    ) : (
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                                                                                <p className="text-lg font-black text-blue-600">{userResult.score} <span className="text-slate-300 text-[10px]">/ {userResult.totalMarks || userResult.totalQuestions}</span></p>
                                                                            </div>
                                                                            <Link to={`/result/${userResult._id}`} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all shadow-lg active:scale-95"><ChevronRight size={18} /></Link>
                                                                        </div>
                                                                    )
                                                                ) : (
                                                                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                                                                        <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest">Grading in Progress</span>
                                                                    </div>
                                                                )
                                                            ) : exam.status === 'Stopped' ? (
                                                                <div className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest text-center border border-slate-100">Protocol Closed</div>
                                                            ) : isMobile ? (
                                                                <div className="w-full py-3 bg-rose-50 text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest text-center border border-rose-100 flex items-center justify-center gap-2">
                                                                    <Monitor size={14} /> Desktop Only
                                                                </div>
                                                            ) : isOngoing ? (
                                                                <Link to={`/exam/${exam._id}`} className="block w-full text-center py-3 bg-amber-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all">Resume Assessment</Link>
                                                            ) : (
                                                                <Link to={`/exam/${exam._id}`} className="block group/btn relative">
                                                                    <div className="flex items-center justify-between text-blue-600 font-black text-[10px] uppercase tracking-[0.1em] py-2">
                                                                        <span>Start Assessment</span>
                                                                        <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                                                    </div>
                                                                    <div className="h-0.5 w-0 group-hover/btn:w-full bg-blue-600 transition-all duration-300" />
                                                                </Link>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="col-span-full py-20 text-center">
                                                    <Database size={48} className="mx-auto text-slate-200 mb-4" />
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No assessments currently assigned</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'quizzes' && (
                                    <div className="space-y-6">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Rocket size={24} className="text-blue-600" /> Dynamic Quizzes
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {quizzes.length > 0 ? quizzes.map((quiz) => (
                                                <div key={quiz._id} className="bg-white rounded-[3rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:border-blue-100 transition-all group relative overflow-hidden flex flex-col h-full">
                                                    <div className="mb-6 w-12 h-12">
                                                        <img src={logo} alt="APEX" className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="flex justify-between items-start mb-4">
                                                        <h3 className="text-xl font-black text-slate-800 group-hover:text-blue-600 transition-colors leading-tight pr-2">{quiz.title}</h3>
                                                        <span className={`px-2 py-1 ${quiz.status === 'Published' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-rose-50 text-rose-500 border-rose-100'} text-[8px] font-black uppercase tracking-widest rounded-lg border`}>
                                                            {quiz.status}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 space-y-2 mb-6">
                                                        <div className="flex items-center gap-2.5 text-slate-400">
                                                            <Clock size={14} className="text-slate-300" />
                                                            <span className="text-[11px] font-bold">Duration: <span className="text-slate-700">{Math.floor(quiz.duration / 60)} Minutes</span></span>
                                                        </div>
                                                        <div className="flex items-center gap-2.5 text-slate-400">
                                                            <List size={14} className="text-slate-300" />
                                                            <span className="text-[11px] font-bold">Capacity: <span className="text-slate-700">{quiz.questions?.length || 0} Items</span></span>
                                                        </div>
                                                        {quiz.scheduledDate && (
                                                            <div className="flex items-center gap-2.5 text-blue-500 pt-1">
                                                                <Calendar size={14} className="opacity-70" />
                                                                <span className="text-[10px] font-black uppercase tracking-tight">Schedule: {quiz.scheduledDate}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="pt-4 border-t border-slate-50">
                                                        {quiz.status === 'Stopped' ? (
                                                            <div className="w-full py-3 bg-slate-50 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest text-center border border-slate-100">Protocol Closed</div>
                                                        ) : quizResults.some(r => r.quizId?._id === quiz._id) ? (
                                                            <div className="w-full py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[10px] uppercase tracking-widest text-center border border-emerald-100 flex items-center justify-center gap-2">
                                                                <CheckCircle size={14} /> Submitted
                                                            </div>
                                                        ) : isMobile ? (
                                                            <div className="w-full py-3 bg-rose-50 text-rose-500 rounded-xl font-black text-[9px] uppercase tracking-widest text-center border border-rose-100 flex items-center justify-center gap-2">
                                                                <Monitor size={14} /> Desktop Only
                                                            </div>
                                                        ) : (
                                                            <Link to={`/quiz/${quiz._id}`} className="block group/btn relative">
                                                                <div className="flex items-center justify-between text-blue-600 font-black text-[10px] uppercase tracking-[0.1em] py-2">
                                                                    <span>Start Quiz</span>
                                                                    <ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
                                                                </div>
                                                                <div className="h-0.5 w-0 group-hover/btn:w-full bg-blue-600 transition-all duration-300" />
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="col-span-full py-20 text-center">
                                                    <Rocket size={48} className="mx-auto text-slate-200 mb-4 opacity-20" />
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No active quizzes found</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'quiz-results' && (
                                    <div className="space-y-8">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Award size={24} className="text-blue-600" /> Quiz Performance
                                        </h2>
                                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-100">
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quiz Protocol</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Index</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submission</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {quizResults.length > 0 ? quizResults.map(r => (
                                                            <tr key={r._id} className="hover:bg-slate-50/50 transition-all">
                                                                <td className="px-8 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-800 flex items-center gap-2">
                                                                            {r.quizId?.title}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-lg font-black text-blue-600">{r.score} / {r.totalMarks}</span>
                                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                                            <div className="h-full bg-blue-500" style={{ width: `${(r.score / r.totalMarks) * 100}%` }} />
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase">
                                                                    {new Date(r.createdAt).toLocaleDateString()} <br />
                                                                    {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </td>
                                                                <td className="px-8 py-6 text-right">
                                                                    <button
                                                                        onClick={async () => {
                                                                            try {
                                                                                const quizRes = await axios.get(`${API_BASE}/api/quiz/${r.quizId?._id}`);
                                                                                setViewingQuizResult({ ...r, fullQuiz: quizRes.data.data });
                                                                            } catch (err) {
                                                                                setViewingQuizResult(r);
                                                                            }
                                                                        }}
                                                                        className="p-3 text-blue-600 hover:bg-blue-50 rounded-full transition-all border border-blue-100"
                                                                    >
                                                                        <Eye size={18} />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )) : (
                                                            <tr>
                                                                <td colSpan="4" className="px-8 py-20 text-center">
                                                                    <Award size={48} className="mx-auto text-slate-100 mb-4" />
                                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No quiz data available</p>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'results' && (
                                    <div className="space-y-8">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Award size={24} className="text-blue-600" /> Academic Transcript
                                        </h2>
                                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="border-b border-slate-100">
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessment</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Score Index</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-50">
                                                        {results.filter(r => r.isPublished).map(r => (
                                                            <tr key={r._id} className="hover:bg-slate-50/50 transition-all">
                                                                <td className="px-8 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-800 flex items-center gap-2">
                                                                            {r.examId?.title}
                                                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${r.score >= (r.examId?.passingMarks || 0) ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                                {r.score >= (r.examId?.passingMarks || 0) ? 'PASS' : 'FAIL'}
                                                                            </span>
                                                                        </span>
                                                                        <span className="md:hidden text-[10px] font-black text-blue-600 mt-1">{Math.round((r.score / (r.totalMarks || r.totalQuestions)) * 100)}% SCORE</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-6 hidden md:table-cell">
                                                                    {r.attendance === 'Absent' ? (
                                                                        <span className="text-sm font-black text-rose-500 uppercase tracking-widest">N/A</span>
                                                                    ) : (
                                                                        <div className="flex flex-col">
                                                                            <span className="text-lg font-black text-blue-600">{Math.round((r.score / (r.totalMarks || r.totalQuestions)) * 100)}%</span>
                                                                            <span className="text-[10px] font-bold text-slate-400">{r.score} / {r.totalMarks || r.totalQuestions} Marks</span>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    {r.attendance === 'Absent' ? (
                                                                        <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-rose-100">Absent</span>
                                                                    ) : (
                                                                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">Validated</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-8 py-6 text-right">
                                                                    <div className="flex items-center justify-end gap-3">

                                                                        {r.attendance !== 'Absent' && (
                                                                            <Link to={`/result/${r._id}`} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 inline-flex items-center gap-2">
                                                                                <Eye size={14} /> <span className="hidden sm:inline">View Result</span>
                                                                            </Link>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {results.filter(r => r.isPublished).length === 0 && (
                                                <div className="py-20 text-center text-slate-300">
                                                    <ShieldAlert size={48} className="mx-auto mb-4 opacity-20" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">No published records found</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}



                                {activeTab === 'notices' && (
                                    <div className="space-y-8">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                                <Bell size={24} className="text-blue-600" /> Notice Board
                                            </h2>
                                            <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                                    <Bell size={12} /> {notices.length} active announcements
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-6">
                                            {notices.length > 0 ? notices.map((notice, idx) => {
                                                const isExpanded = expandedNotice === notice._id;
                                                return (
                                                    <motion.div
                                                        key={notice._id}
                                                        initial={{ opacity: 0, x: -20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: idx * 0.1 }}
                                                        className={`rounded-[2rem] border transition-all cursor-pointer overflow-hidden ${isExpanded ? 'bg-white shadow-xl border-blue-200' : 'bg-white hover:bg-slate-50 border-slate-100 shadow-sm'
                                                            }`}
                                                        onClick={() => setExpandedNotice(isExpanded ? null : notice._id)}
                                                    >
                                                        <div className="p-5 flex justify-between items-center">
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${notice.type === 'urgent' ? 'bg-rose-50 text-rose-500' :
                                                                        notice.type === 'exam' ? 'bg-blue-50 text-blue-500' :
                                                                            'bg-slate-50 text-slate-500'
                                                                    }`}>
                                                                    {notice.type === 'urgent' ? <ShieldAlert size={24} /> : <Bell size={24} />}
                                                                </div>
                                                                <div>
                                                                    <h3 className="font-black text-slate-800 text-base flex items-center gap-2">
                                                                        {notice.title}
                                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${notice.type === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600'
                                                                            }`}>
                                                                            {notice.type}
                                                                        </span>
                                                                    </h3>
                                                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none mt-1">{notice.subject}</p>
                                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                                                        {new Date(notice.createdAt).toLocaleDateString()} • {new Date(notice.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <motion.div
                                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                                className="text-slate-300"
                                                            >
                                                                <ChevronRight size={20} />
                                                            </motion.div>
                                                        </div>

                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }}
                                                                    animate={{ height: 'auto', opacity: 1 }}
                                                                    exit={{ height: 0, opacity: 0 }}
                                                                    className="overflow-hidden"
                                                                >
                                                                    <div className="px-5 pb-8 pt-2 ml-16 border-t border-slate-50">
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
                                                                        <div className="mt-8 flex items-center justify-between">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400">
                                                                                    {notice.createdBy?.name?.[0] || 'A'}
                                                                                </div>
                                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                                    Authored by: <span className="text-slate-600">{notice.createdBy?.name || 'Administrator'}</span>
                                                                                </p>
                                                                            </div>
                                                                            <div className="flex items-center gap-2 text-blue-600 opacity-60">
                                                                                <CheckCircle size={14} />
                                                                                <span className="text-[10px] font-black uppercase tracking-widest">Official Protocol</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                );
                                            }) : (
                                                <div className="bg-white p-20 rounded-[3rem] border border-slate-100 text-center">
                                                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                                        <Bell className="text-slate-200" size={40} />
                                                    </div>
                                                    <h3 className="text-xl font-black text-slate-800">No New Broadcasts</h3>
                                                    <p className="text-slate-400 mt-2 font-bold">The notice board is currently empty. Stay tuned for updates.</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'resources' && (
                                    <div className="space-y-8">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Book size={24} className="text-blue-600" /> Academic Library
                                        </h2>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {resources.map(r => (
                                                <div key={r._id} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                                                            <ResourceIcon type={r.type} />
                                                        </div>
                                                        <button onClick={() => setViewingResource(r)} className="p-3 border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-600 rounded-xl transition-all shadow-sm">
                                                            <Eye size={18} />
                                                        </button>
                                                    </div>
                                                    <h4 className="text-lg font-black text-slate-800 mb-1 truncate">{r.title}</h4>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.category}</p>
                                                    <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                                                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-3 py-1 bg-blue-50 rounded-full">{r.type}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {resources.length === 0 && (
                                                <div className="col-span-full py-20 text-center">
                                                    <Book size={48} className="mx-auto text-slate-200 mb-4 opacity-20" />
                                                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">No resources catalogued by admin</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'events' && (
                                    <div className="space-y-8">
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 mb-8">
                                            <Calendar size={24} className="text-blue-600" /> Upcoming Events
                                        </h2>


                                        {/* Full Schedule Table */}
                                        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
                                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3">
                                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Calendar size={20} /></div>
                                                Full Schedule
                                            </h3>
                                            {events.length > 0 ? (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="border-b border-slate-100">
                                                                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event</th>
                                                                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                                                                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date & Time</th>
                                                                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                                                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {[...events].sort((a, b) => {
                                                                const statusOrder = { 'Upcoming': 1, 'Postponed': 2, 'Completed': 3, 'Cancelled': 4 };
                                                                const aStatus = a.status || 'Upcoming';
                                                                const bStatus = b.status || 'Upcoming';
                                                                if (statusOrder[aStatus] !== statusOrder[bStatus]) return statusOrder[aStatus] - statusOrder[bStatus];
                                                                return new Date(a.startTime) - new Date(b.startTime);
                                                            }).map(event => {
                                                                const statusStyle = {
                                                                    Upcoming: 'bg-blue-50 text-blue-600 border-blue-200',
                                                                    Completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                                                                    Postponed: 'bg-amber-50 text-amber-600 border-amber-200',
                                                                    Cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
                                                                }[event.status || 'Upcoming'];
                                                                const isPast = event.status === 'Completed' || event.status === 'Cancelled';
                                                                return (
                                                                    <tr key={event._id} className={`hover:bg-slate-50/50 transition-all ${isPast ? 'opacity-60' : ''}`}>
                                                                        <td className="px-6 py-4 font-bold text-slate-800">{event.title}</td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${event.type === 'test' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                                                                event.type === 'other' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                                                    'bg-blue-50 text-blue-600 border-blue-200'
                                                                                }`}>
                                                                                {event.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                                                            {new Date(event.startTime).toLocaleDateString()} {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </td>
                                                                        <td className="px-6 py-4 text-sm font-bold text-slate-600">
                                                                            {Number(((new Date(event.endTime) - new Date(event.startTime)) / 3600000).toFixed(1))} Hours
                                                                        </td>
                                                                        <td className="px-6 py-4">
                                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${statusStyle}`}>
                                                                                {event.status || 'Upcoming'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="py-12 text-center">
                                                    <Calendar size={32} className="mx-auto text-slate-200 mb-3" />
                                                    <p className="text-slate-400 font-bold text-sm">No events scheduled</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Viewer Modal */}
            <AnimatePresence>
                {viewingResource && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingResource(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className={`relative bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ${viewingResource.type === 'Video'
                                    ? 'w-full h-auto aspect-video md:h-[85vh] md:aspect-auto md:w-[90vw] md:max-w-6xl rounded-none md:rounded-[3.5rem]'
                                    : 'w-full h-full rounded-[3.5rem]'
                                }`}
                        >
                            <div className="px-6 md:px-10 py-4 md:py-6 border-b border-slate-100 flex justify-between items-center bg-white shadow-sm z-10">
                                <div className="flex items-center gap-3 md:gap-4">
                                    <div className="p-2 md:p-3 bg-blue-50 rounded-xl text-blue-600"><ResourceIcon type={viewingResource.type} /></div>
                                    <div className="flex flex-col">
                                        <h4 className="text-sm md:text-base font-black text-slate-900 tracking-tight leading-none mb-1">{viewingResource.title}</h4>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{viewingResource.category}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 md:gap-4">
                                    <a href={viewingResource.link} target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-2 p-3 text-slate-400 hover:text-blue-600 transition-all font-black text-[10px] uppercase tracking-widest"><ExternalLink size={18} /> Open Direct</a>
                                    <button onClick={() => setViewingResource(null)} className="p-2 md:p-3 text-slate-400 hover:text-rose-600 transition-all"><X size={24} /></button>
                                </div>
                            </div>
                            <div className="flex-1 bg-black flex items-center justify-center overflow-hidden">
                                <iframe
                                    src={getEmbedLink(viewingResource.link)}
                                    className="w-full h-full border-none shadow-2xl"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    allowFullScreen
                                    title={viewingResource.title}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Detailed Quiz Result Modal */}
            <AnimatePresence>
                {viewingQuizResult && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingQuizResult(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 30 }}
                            className="relative bg-white w-full max-w-5xl md:max-w-6xl max-h-[95vh] rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Gradient Header */}
                            <div className="relative h-40 sm:h-48 shrink-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 sm:p-8 flex flex-col items-center justify-center text-center overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:40px_40px] rotate-12" />
                                </div>
                                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-2xl">
                                    <Award size={28} className="text-white" />
                                </div>
                                <h3 className="text-xl sm:text-3xl font-black text-white mb-1 tracking-tight leading-tight">Performance Deciphered!</h3>
                                <p className="text-white/60 font-bold text-[9px] sm:text-[10px] tracking-wide uppercase px-4 truncate w-full">Assessment: {viewingQuizResult.quizId?.title}</p>
                                <button onClick={() => setViewingQuizResult(null)} className="absolute right-4 top-4 sm:right-6 sm:top-6 w-10 h-10 flex items-center justify-center text-white/40 hover:text-white transition-all"><X size={24} /></button>
                            </div>

                            {/* Analytics Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-slate-50/30">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
                                    <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2"><Activity size={12} className="text-blue-500" /> Success</p>
                                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{Math.round((viewingQuizResult.score / viewingQuizResult.totalMarks) * 100)}%</p>
                                    </div>
                                    <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2"><CheckSquare size={12} className="text-emerald-500" /> Score</p>
                                        <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{viewingQuizResult.score}/{viewingQuizResult.totalMarks}</p>
                                    </div>
                                    <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2"><Monitor size={12} className="text-indigo-500" /> USN</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase truncate">{user?.usn || 'N/A'}</p>
                                    </div>
                                    <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                        <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2"><Clock size={12} className="text-rose-500" /> Time</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                                            {Math.floor(viewingQuizResult.timeTaken / 60)}m {viewingQuizResult.timeTaken % 60}s
                                        </p>
                                    </div>
                                </div>

                                {/* Script Execution Review */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-4 mb-8">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                            <Terminal size={16} className="text-blue-500" /> Script Execution Review
                                        </h4>
                                        <div className="h-0.5 flex-1 bg-slate-200/50 rounded-full" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(viewingQuizResult.fullQuiz?.questions || []).map((question, idx) => {
                                            const ans = viewingQuizResult.answers.find(a => a.questionId?._id === question._id);
                                            // Fallback validation for legacy results
                                            const isCorrect = ans ? (ans.isCorrect !== undefined ? ans.isCorrect : (ans.selectedOption === question.correctAnswer)) : false;

                                            return (
                                                <div key={idx} className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-sm transition-all group overflow-hidden relative">
                                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${ans ? (isCorrect ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-slate-300'}`} />
                                                    <div className="flex justify-between items-start gap-4 mb-4">
                                                        <p className="font-bold text-slate-800 text-base leading-snug tracking-tight">{question.questionText}</p>
                                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${ans ? (isCorrect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100')
                                                                : 'bg-slate-50 text-slate-400 border-slate-200'
                                                            }`}>
                                                            {ans ? (isCorrect ? 'SUCCESS' : 'FAILED') : 'NOT ATTENDED'}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-3">
                                                        {question.type === 'Coding' ? (
                                                            <div className="space-y-4 mt-4">
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Execution Accuracy</p>
                                                                        <p className="text-sm font-black text-slate-800">
                                                                            {ans?.codingResults?.testCasesPassed || 0} / {ans?.codingResults?.totalTestCases || question.codingMetadata?.testCases?.length || 0}
                                                                            <span className="ml-2 text-[9px] text-slate-400 font-bold">Passed</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/30">
                                                                        <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Logic Fidelity Score</p>
                                                                        <p className="text-sm font-black text-blue-600">
                                                                            {Math.max(
                                                                                ans?.codingResults?.aiFeedback?.logicScore || 0,
                                                                                Math.round(((ans?.codingResults?.testCasesPassed || 0) / (ans?.codingResults?.totalTestCases || 1)) * 100)
                                                                            )}%
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="p-4 bg-emerald-50/30 rounded-xl border border-emerald-100/30 relative overflow-hidden">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                                            <Sparkles size={10} /> AI Synthesis Feedback
                                                                        </p>
                                                                        <span className="text-[6px] font-black text-emerald-400 uppercase tracking-widest">Real-time Analysis</span>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                                                            {ans?.codingResults?.aiFeedback?.suggestions || "The logic was evaluated based on execution performance. No critical syntax errors were detected during synthesis."}
                                                                        </p>
                                                                        <div className="flex gap-4 pt-1 border-t border-emerald-100/50">
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quality Index: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.quality || 'Standard'}</span></p>
                                                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Logic Flow: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.complexity || 'Linear'}</span></p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-[#0f0f1a] shadow-inner">
                                                                    <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
                                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Script Submission Protocol ({ans?.language?.toUpperCase() || 'SCRIPT'})</p>
                                                                        <div className="flex gap-1">
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500/50" />
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
                                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                                                        </div>
                                                                    </div>
                                                                    <pre className="p-6 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                                                                        {ans?.code || 'No code footprint recorded in system'}
                                                                    </pre>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-3">
                                                                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Candidate Selection</p>
                                                                    <p className={`text-xs font-black ${ans ? (isCorrect ? 'text-emerald-600' : 'text-rose-500') : 'text-slate-400'}`}>
                                                                        {ans ? (ans.selectedOption || 'Null') : 'NO RESPONSE'}
                                                                    </p>
                                                                </div>
                                                                <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100/30">
                                                                    <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Validated Logic (Correct Key)</p>
                                                                    <p className="text-xs font-black text-blue-600">{question.correctAnswer}</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentDashboard;
