import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Award, CheckCircle, XCircle, Eye,
    Send, Filter, ChevronRight, User, Terminal, Plus,
    LayoutDashboard, List, Users, Book, UserCheck, UserMinus, RotateCcw, Calendar,
    Activity, Monitor, Bell, UserX, Settings, Rocket
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';

const EvaluationPage = () => {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const API_BASE = (window.location.hostname.includes('loca.lt') || window.location.hostname.includes('trycloudflare.com'))
        ? 'https://green-ears-first-donated.trycloudflare.com'
        : `http://${window.location.hostname}:5000`;

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/exams`);
            setExams(res.data.data);
        } catch (err) {
            toast.error('Failed to load exams');
        }
    };

    const handleExamSelect = async (examId) => {
        setSelectedExamId(examId);
        if (!examId) {
            setSubmissions([]);
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/results/exam/${examId}`);
            setSubmissions(res.data.data);
        } catch (err) {
            toast.error('Failed to fetch submissions');
        } finally {
            setLoading(false);
        }
    };

    const toggleAttendance = async (resultId) => {
        try {
            await axios.patch(`${API_BASE}/api/results/${resultId}/toggle-attendance`);
            toast.success('Attendance status updated');
            handleExamSelect(selectedExamId); // Refresh
        } catch (err) {
            toast.error('Failed to update attendance');
        }
    };

    const publishAllResults = async () => {
        if (!selectedExamId) return toast.error('Please select an exam first');
        if (!window.confirm('Broadcast results to all present students?')) return;

        try {
            const res = await axios.patch(`${API_BASE}/api/results/publish/${selectedExamId}`);
            toast.success(res.data.message);
            handleExamSelect(selectedExamId);
        } catch (err) {
            toast.error('Publishing failed');
        }
    };

    const toggleIndividualPublish = async (resultId, currentStatus) => {
        try {
            await axios.patch(`${API_BASE}/api/results/${resultId}/toggle-publish`);
            toast.success(`Result ${currentStatus ? 'unpublished' : 'published'}`);
            handleExamSelect(selectedExamId);
        } catch (err) {
            toast.error('Status update failed');
        }
    };

    const handleRetest = async (sub) => {
        const studentName = sub.userId?.name || 'this student';
        if (!window.confirm(`Grant retest to ${studentName}?\n\nThis will DELETE their current submission so they can retake the exam.`)) return;
        try {
            await axios.delete(`${API_BASE}/api/results/${sub._id}`);
            toast.success(`Retest granted to ${studentName}`);
            handleExamSelect(selectedExamId); // Refresh table
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to grant retest');
        }
    };

    const SidebarLink = ({ to, icon: Icon, label, active = false }) => (
        <Link
            to={to}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${active ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
            <Icon size={20} /> <span className="hidden md:inline">{label}</span>
        </Link>
    );

    const MobileTabButton = ({ to, icon: Icon, label, active = false }) => (
        <Link
            to={to}
            className={`flex flex-col items-center gap-1 p-2 flex-1 transition-all ${active ? 'text-blue-600 scale-110' : 'text-slate-400'}`}
        >
            <div className={`p-1.5 rounded-xl transition-all ${active ? 'bg-blue-50' : ''}`}>
                <Icon size={20} />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
        </Link>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Navbar />

            <div className="flex-1 flex flex-col md:flex-row relative">
                {/* Desktop Sidebar */}
                <aside className="hidden md:block md:w-64 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 p-6 md:fixed md:top-[140px] md:bottom-8 md:left-8 z-20 overflow-y-auto custom-scrollbar">
                    <nav className="space-y-1">
                        <SidebarLink to="/admin?tab=overview" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarLink to="/admin?tab=exams" icon={List} label="Exams Section" />
                        <SidebarLink to="/admin?tab=test-results" icon={Award} label="Test Results" />
                        <SidebarLink to="/admin?tab=events" icon={Calendar} label="Events" />
                        <SidebarLink to="/admin?tab=users" icon={Users} label="Manage Users" />
                        <SidebarLink to="/admin?tab=blocked-users" icon={UserX} label="Blocked" />
                        <SidebarLink to="/admin?tab=notices" icon={Bell} label="Notices" />
                        <SidebarLink to="/admin?tab=resources" icon={Book} label="Resources" />
                        <SidebarLink to="/admin?tab=quizzes" icon={Rocket} label="Quizzes Section" />
                        <SidebarLink to="/admin?tab=monitoring" icon={Activity} label="Test Monitoring" />
                        <SidebarLink to="/admin?tab=quiz-monitoring" icon={Activity} label="Quiz Monitoring" />
                        <SidebarLink to="/admin/evaluate" icon={CheckCircle} label="Evaluation Matrix" active={true} />
                        <SidebarLink to="/admin?tab=settings" icon={Settings} label="Global Settings" />
                    </nav>
                </aside>

                {/* Mobile Bottom Navigation */}
                <div className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-slate-100 pt-1 pb-1 px-2 shadow-[0_-10px_30_rgba(0,0,0,0.05)] safe-pb">
                    <div className="h-16 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm flex items-center justify-around px-2">
                        <MobileTabButton to="/admin?tab=overview" icon={LayoutDashboard} label="Home" />
                        <MobileTabButton to="/admin?tab=exams" icon={List} label="Exams" />
                        <MobileTabButton to="/admin?tab=resources" icon={Book} label="Library" />
                        <MobileTabButton to="/admin/evaluate" icon={CheckCircle} label="Matrix" active={true} />
                        <button
                            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                            className="flex flex-col items-center gap-1 p-2 flex-1 transition-all text-slate-400"
                        >
                            <div className="p-1.5 rounded-xl">
                                <Plus size={20} />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tighter">More</span>
                        </button>
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
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 mb-2">Extended Protocols</div>
                                <Link to="/admin?tab=test-results" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Award size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Test Results</span>
                                </Link>
                                <Link to="/admin?tab=events" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Calendar size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Events Management</span>
                                </Link>
                                <Link to="/admin?tab=users" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Users size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Manage Users</span>
                                </Link>
                                <Link to="/admin?tab=blocked-users" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <UserX size={20} className="text-rose-500" />
                                    <span className="font-bold text-slate-700">Blocked Registry</span>
                                </Link>
                                <Link to="/admin?tab=notices" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Bell size={20} className="text-amber-500" />
                                    <span className="font-bold text-slate-700">Notice Board</span>
                                </Link>
                                <Link to="/admin?tab=monitoring" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Activity size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Test Monitoring</span>
                                </Link>
                                <Link to="/admin?tab=quizzes" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Rocket size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Quizzes Section</span>
                                </Link>
                                <Link to="/admin?tab=quiz-monitoring" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Activity size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Quiz Monitoring</span>
                                </Link>
                                <Link to="/admin?tab=settings" className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-all">
                                    <Settings size={20} className="text-blue-500" />
                                    <span className="font-bold text-slate-700">Global Settings</span>
                                </Link>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Main Content - Pushed on desktop */}
                <main className="flex-1 p-4 md:p-8 ml-0 md:ml-[320px] md:pr-8 md:pt-10 mb-24 md:mb-0">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                            <div className="empty-header-placeholder" />
                        </div>

                        {/* Header Section */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                            <div>
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Evaluation Matrix</h1>
                                <p className="text-slate-500 font-medium">Verify submissions and broadcast performance outcomes.</p>
                            </div>

                            <div className="flex flex-wrap gap-4 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <select
                                        value={selectedExamId}
                                        onChange={(e) => handleExamSelect(e.target.value)}
                                        className="w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none shadow-sm"
                                    >
                                        <option value="">Select Assessment</option>
                                        {exams.map(e => (
                                            <option key={e._id} value={e._id}>{e.title}</option>
                                        ))}
                                    </select>
                                </div>

                                {submissions.length > 0 && (
                                    <button
                                        onClick={publishAllResults}
                                        className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95"
                                    >
                                        <Send size={20} /> Publish Results
                                    </button>
                                )}
                            </div>
                        </div>

                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="bg-white rounded-[2.5rem] p-32 shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center"
                                >
                                    <div className="w-16 h-16 border-8 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-6" />
                                    <p className="font-black text-slate-400 uppercase tracking-widest text-sm">Compiling Data...</p>
                                </motion.div>
                            ) : selectedExamId ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-8"
                                >
                                    {/* Results Table */}
                                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                            <h3 className="text-xl font-black text-slate-800">Active Candidate Ledgers</h3>
                                            <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {submissions.length} Total Records
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Candidate Identity</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Accuracy Index</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Attendance</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {submissions.map((sub) => (
                                                        <tr key={sub._id} className="hover:bg-slate-50/80 transition-all group/row">
                                                            <td className="px-8 py-6">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-[1rem] flex items-center justify-center font-black text-xl shadow-sm border border-blue-200/50">
                                                                        {sub.userId?.name ? sub.userId.name.charAt(0) : '?'}
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-black text-slate-800 text-lg tracking-tight">{sub.userId?.name || 'Deleted User'}</div>
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="text-xs font-bold text-slate-400">{sub.userId?.email || 'No Email'}</div>
                                                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${(sub.score >= (sub.examId?.passingMarks || 0)) ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                                {(sub.score >= (sub.examId?.passingMarks || 0)) ? 'PASS' : 'FAIL'}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Reg: {sub.userId?.usn || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <div className="flex flex-col">
                                                                    <span className={`text-xl font-black ${(sub.score / (sub.totalMarks || sub.totalQuestions)) >= 0.5 ? 'text-emerald-500' : 'text-slate-900'}`}>
                                                                        {Math.round((sub.score / (sub.totalMarks || sub.totalQuestions)) * 100)}%
                                                                    </span>
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase">{sub.score} / {sub.totalMarks || sub.totalQuestions} Marks</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <button
                                                                    onClick={() => toggleAttendance(sub._id)}
                                                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${sub.attendance === 'Present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'}`}
                                                                >
                                                                    {sub.attendance === 'Present' ? <UserCheck size={14} /> : <UserMinus size={14} />}
                                                                    {sub.attendance}
                                                                </button>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <button
                                                                    onClick={() => toggleIndividualPublish(sub._id, sub.isPublished)}
                                                                    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 active:scale-95 ${sub.isPublished ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}
                                                                >
                                                                    {sub.isPublished ? <CheckCircle size={12} /> : <Terminal size={12} />}
                                                                    {sub.isPublished ? 'Published' : 'Drafting'}
                                                                </button>
                                                            </td>
                                                            <td className="px-8 py-6 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {/* Retest Button */}
                                                                    <button
                                                                        onClick={() => handleRetest(sub)}
                                                                        title={`Grant retest to ${sub.userId?.name}`}
                                                                        className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300 rounded-[1.25rem] transition-all shadow-sm text-[10px] font-black uppercase tracking-widest group/retest"
                                                                    >
                                                                        <RotateCcw size={14} className="group-hover/retest:rotate-[-90deg] transition-transform duration-300" />
                                                                        Retest
                                                                    </button>

                                                                    {/* View Result Button */}
                                                                    <button
                                                                        onClick={() => setViewingResult(sub)}
                                                                        title="View result detail"
                                                                        className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-300 rounded-[1.25rem] transition-all shadow-sm group/btn hover:shadow-lg"
                                                                    >
                                                                        <Eye size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-white rounded-[3rem] border border-slate-100 p-32 shadow-xl flex flex-col items-center justify-center text-center"
                                >
                                    <div className="w-32 h-32 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-10 shadow-inner">
                                        <Filter size={60} className="opacity-20" />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3">SELECT PROTOCOL MEMBER</h2>
                                    <p className="text-slate-400 font-bold max-w-sm">Choose an assessment from the dropdown above to audit student performance.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </main>
            </div>

            {/* Modal for detailed view */}
            <AnimatePresence>
                {viewingResult && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setViewingResult(null)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl shadow-blue-600/20">
                                        {viewingResult.userId?.name?.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="text-3xl font-black text-slate-900 tracking-tight">{viewingResult.userId?.name}</h4>
                                        <div className="flex items-center gap-3">
                                            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{viewingResult.userId?.email}</p>
                                            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${(viewingResult.score >= (viewingResult.examId?.passingMarks || 0)) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                                                {(viewingResult.score >= (viewingResult.examId?.passingMarks || 0)) ? 'PASS' : 'FAIL'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => toggleAttendance(viewingResult._id)}
                                        className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${viewingResult.attendance === 'Present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'}`}
                                    >
                                        {viewingResult.attendance === 'Present' ? <UserCheck size={18} /> : <UserMinus size={18} />}
                                        Mark {viewingResult.attendance === 'Present' ? 'Absent' : 'Present'}
                                    </button>
                                    <button onClick={() => setViewingResult(null)} className="p-4 hover:bg-slate-200 rounded-2xl transition-colors font-black text-slate-400">EXIT LOGS</button>
                                </div>
                            </div>

                            <div className="p-10 overflow-y-auto space-y-12">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    <StatsEntry label="Total Score" value={`${viewingResult.score} / ${viewingResult.totalMarks || viewingResult.totalQuestions}`} />
                                    <StatsEntry label="Minimum Marks" value={viewingResult.examId?.passingMarks || 0} />
                                    <StatsEntry label="Success Rate" value={`${Math.round((viewingResult.score / (viewingResult.totalMarks || viewingResult.totalQuestions)) * 100)}%`} />
                                    <StatsEntry label="Tab Switches" value={viewingResult.violations?.tabSwitches || 0} color={viewingResult.violations?.tabSwitches > 0 ? 'text-rose-500' : ''} />
                                </div>

                                <div className="space-y-8">
                                    <h5 className="text-xl font-black text-slate-800 uppercase tracking-wider flex items-center gap-3"><Terminal className="text-blue-600" /> Evidence Analysis</h5>
                                    <div className="space-y-6">
                                        {viewingResult.examId?.questions?.map((question, idx) => {
                                            const ans = viewingResult.answers.find(a =>
                                                (a.questionId?._id || a.questionId) === (question._id || question)
                                            );

                                            if (!ans) {
                                                return (
                                                    <div key={idx} className="p-8 rounded-[2.5rem] border bg-slate-50 border-slate-200 opacity-80">
                                                        <div className="flex gap-6">
                                                            <div className="mt-1">
                                                                <XCircle className="text-slate-300" size={28} />
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start mb-6">
                                                                    <p className="text-xl font-bold text-slate-800 leading-tight">{question.questionText}</p>
                                                                    <span className="px-4 py-1.5 bg-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Not attended</span>
                                                                </div>
                                                                <div className="p-5 bg-white/50 rounded-2xl border border-slate-200">
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Correct Key</p>
                                                                    <p className="font-black text-slate-600">{question.correctAnswer || (question.type === 'Coding' ? 'Coding Challenge' : 'N/A')}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            const isCorrectAns = question.type === 'Coding' 
                                                ? (ans.codingResults?.testCasesPassed === ans.codingResults?.totalTestCases && ans.codingResults?.totalTestCases > 0)
                                                : ans.isCorrect;

                                            return (
                                                <div key={idx} className={`p-8 rounded-[2.5rem] border ${isCorrectAns ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'}`}>
                                                    <div className="flex gap-6">
                                                        <div className="mt-1">
                                                            {isCorrectAns ? <CheckCircle className="text-emerald-500" size={28} /> : <XCircle className="text-rose-500" size={28} />}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-6">
                                                                <p className="text-xl font-bold text-slate-800 leading-tight">{question.questionText || ans.questionId?.questionText}</p>
                                                                <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isCorrectAns ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                    {isCorrectAns ? 'Correct' : 'Incorrect'}
                                                                </span>
                                                            </div>

                                                            {ans.code ? (
                                                                <div className="space-y-4">
                                                                    <div className="bg-slate-900 rounded-2xl p-6 font-mono text-sm text-blue-300 shadow-inner max-h-[300px] overflow-y-auto">
                                                                        <pre><code>{ans.code}</code></pre>
                                                                    </div>
                                                                    {ans.codingResults && (
                                                                        <div className="p-6 bg-white/50 rounded-2xl border border-slate-200">
                                                                            <div className="flex items-center justify-between mb-4">
                                                                                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Test Case Validation</div>
                                                                                <div className="text-xs font-black text-emerald-600 uppercase tracking-widest">{ans.codingResults.testCasesPassed} / {ans.codingResults.totalTestCases} Passed</div>
                                                                            </div>
                                                                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6">
                                                                                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(ans.codingResults.testCasesPassed / ans.codingResults.totalTestCases) * 100}%` }} />
                                                                            </div>
                                                                            {ans.codingResults.aiFeedback && (
                                                                                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 italic text-blue-800 text-sm">
                                                                                    <div className="font-black uppercase text-[10px] mb-2 tracking-widest text-blue-400 flex items-center gap-2"><Award size={14} /> AI Observation</div>
                                                                                    "{ans.codingResults.aiFeedback.suggestions}"
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                    <div className="p-5 bg-white/50 rounded-2xl border border-slate-200">
                                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User Selection</p>
                                                                        <p className={`font-black ${isCorrectAns ? 'text-emerald-600' : 'text-rose-600'}`}>{ans.selectedOption}</p>
                                                                    </div>
                                                                    {!isCorrectAns && (
                                                                        <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                                                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Correct Key</p>
                                                                            <p className="font-black text-emerald-700">{ans.questionId?.correctAnswer || question.correctAnswer}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
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

const StatsEntry = ({ label, value, color = 'text-slate-900' }) => (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
);

export default EvaluationPage;
