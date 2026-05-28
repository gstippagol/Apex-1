import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Award, CheckCircle, Clock, Eye, Filter, RotateCcw, Terminal, UserCheck, UserMinus,
    ChevronRight, Send, XCircle, Download, Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../../assets/logo_transparent.png';
import museLogo from '../../assets/muse_logo.png';
import rightShield from '../../assets/LogoL.png';
import ConfirmModal from '../ConfirmModal';

const StatsEntry = ({ label, value, color = 'text-slate-900' }) => (
    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
);

const EvaluationTab = () => {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

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
        triggerConfirm({
            title: 'Broadcast Exam Results',
            message: 'Are you sure you want to broadcast results to all present students? This will make their scores and review logs instantly accessible on their portfolios.',
            confirmText: 'Broadcast Results',
            type: 'info',
            onConfirm: async () => {
                try {
                    const res = await axios.patch(`${API_BASE}/api/results/publish/${selectedExamId}`);
                    toast.success(res.data.message);
                    handleExamSelect(selectedExamId);
                } catch (err) {
                    toast.error('Publishing failed');
                }
            }
        });
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
        triggerConfirm({
            title: 'Grant Exam Retest',
            message: `Are you sure you want to grant a retest to ${studentName}? This will permanently delete their current submission and allow them to restart the exam session from scratch.`,
            confirmText: 'Grant Retest',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/results/${sub._id}`);
                    toast.success(`Retest granted to ${studentName}`);
                    handleExamSelect(selectedExamId); // Refresh table
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to grant retest');
                }
            }
        });
    };

    const downloadReport = async () => {
        const selectedExam = exams.find(e => e._id === selectedExamId);
        if (!selectedExam) return;

        const doc = new jsPDF();
        const timestamp = new Date().toLocaleString();

        // Helper to load image and return base64
        const loadImage = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = () => resolve(null);
                img.src = url;
            });
        };

        const [museLogoData, clubLogoData, rightShieldData] = await Promise.all([
            loadImage(museLogo),
            loadImage(logo),
            loadImage(rightShield)
        ]);

        // Add Header Logos (Swapped Positions)
        if (rightShieldData) {
            doc.addImage(rightShieldData, 'PNG', 15, 10, 25, 25);
        }
        if (museLogoData) {
            doc.addImage(museLogoData, 'PNG', 170, 10, 25, 25);
        }

        // Add Header Text
        doc.setTextColor(0, 51, 153); // Blue
        doc.setFontSize(14); // Reduced size to avoid overlap
        doc.setFont("helvetica", "bold");
        doc.text("MYSORE UNIVERSITY SCHOOL OF ENGINEERING", 105, 18, { align: "center" });

        doc.setFontSize(9); // Reduced size
        doc.setFont("helvetica", "normal");
        doc.text("Manasagangotri Campus, Mysuru (Approved by AICTE, New Delhi)", 105, 24, { align: "center" });

        // APEX CLUB with logo in middle
        doc.setTextColor(0, 0, 0); // Black
        doc.setFontSize(26); // Slightly smaller for better fit
        doc.setFont("helvetica", "bold");

        // Balanced positioning for "APEX [Logo] CLUB"
        doc.text("APEX", 88, 48, { align: "right" });
        if (clubLogoData) {
            doc.addImage(clubLogoData, 'PNG', 93, 35, 18, 18);
        }
        doc.text("CLUB", 122, 48, { align: "left" });

        doc.setFontSize(16);
        doc.text("Examination Performance Report", 105, 58, { align: "center" });

        doc.setLineWidth(0.8);
        doc.line(15, 62, 195, 62);

        // Meta Info
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(selectedExam.title, 15, 75);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Report Generated: ${timestamp}`, 195, 75, { align: "right" });

        doc.text(`Scheduled Date: ${new Date(selectedExam.createdAt).toLocaleDateString()}`, 15, 85);
        doc.text(`Total Candidates: ${submissions.length}`, 15, 95);

        doc.setLineWidth(0.5);
        doc.line(15, 102, 195, 102);

        // Table Data
        const tableData = submissions.map((sub) => [
            sub.userId?.name || 'N/A',
            sub.userId?.usn || 'N/A',
            `${sub.score} / ${sub.totalMarks || sub.totalQuestions}`,
            `${Math.round((sub.score / (sub.totalMarks || sub.totalQuestions || 1)) * 100)}%`
        ]);

        autoTable(doc, {
            startY: 110,
            head: [['Student Name', 'Register Number', 'Marks Obtained', 'Percentage']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 9, fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
            bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
            margin: { left: 15, right: 15 }
        });

        // Add Summary Page
        const totalAttended = submissions.length;
        const above50 = submissions.filter(s => (s.score / (s.totalMarks || s.totalQuestions || 1)) >= 0.5).length;
        const below50 = totalAttended - above50;
        const avgPercentage = submissions.length > 0 
            ? Math.round((submissions.reduce((acc, s) => acc + (s.score / (s.totalMarks || s.totalQuestions || 1)), 0) / submissions.length) * 100) 
            : 0;

        doc.addPage();
        
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("Performance Summary Analytics", 105, 30, { align: "center" });
        doc.setLineWidth(0.5);
        doc.line(15, 35, 195, 35);

        // Stats Box
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        
        const statsY = 50;
        doc.text("Assessment Metrics Overview", 15, statsY);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Total Number of Students Attended:`, 15, statsY + 15);
        doc.setFont("helvetica", "bold");
        doc.text(`${totalAttended}`, 120, statsY + 15);

        doc.setFont("helvetica", "normal");
        doc.text(`Students Scoring Above 50%:`, 15, statsY + 25);
        doc.setTextColor(0, 150, 0); // Green
        doc.setFont("helvetica", "bold");
        doc.text(`${above50}`, 120, statsY + 25);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Students Scoring Below 50%:`, 15, statsY + 35);
        doc.setTextColor(200, 0, 0); // Red
        doc.setFont("helvetica", "bold");
        doc.text(`${below50}`, 120, statsY + 35);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Overall Batch Percentage:`, 15, statsY + 45);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`${avgPercentage}%`, 120, statsY + 45);

        // Add Footers to all pages (Post-processing)
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.setFont("helvetica", "normal");
            doc.text(`Page ${i} of ${totalPages}`, 105, 285, { align: 'center' });
            doc.text("© APEX Club Assessment System - Official Document", 105, 290, { align: 'center' });
        }

        doc.save(`${selectedExam.title.replace(/\s+/g, '_')}_Report.pdf`);
    };

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Evaluation Matrix</h1>
                    <p className="text-slate-500 font-medium">Verify submissions and broadcast performance outcomes.</p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
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
                        <>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by Name or USN..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                                />
                            </div>
                            <button
                                onClick={publishAllResults}
                                className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95"
                            >
                                <Send size={20} /> Publish Results
                            </button>
                        </>
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
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Violations</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {submissions.filter(sub => {
                                            const term = searchQuery.toLowerCase();
                                            const nameMatch = sub.userId?.name?.toLowerCase().includes(term);
                                            const usnMatch = sub.userId?.usn?.toLowerCase().includes(term);
                                            return nameMatch || usnMatch;
                                        }).map((sub) => (
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
                                                        {sub.attendance === 'Present' ? <CheckCircle size={14} /> : <XCircle size={14} />}
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
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className={`text-xs font-black ${((sub.violations?.tabSwitches || 0) + (sub.violations?.fullscreenExits || 0)) > 0 ? 'text-rose-500 font-extrabold' : 'text-slate-500'}`}>
                                                            {((sub.violations?.tabSwitches || 0) + (sub.violations?.fullscreenExits || 0))} / 3
                                                        </span>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                                                            {sub.violations?.fullscreenExits || 0} FS | {sub.violations?.tabSwitches || 0} Tab
                                                        </span>
                                                    </div>
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

            {/* Modal for detailed view */}
            <AnimatePresence>
                {viewingResult && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6">
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
                            className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 sm:p-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-50/50">
                                <div className="flex items-center gap-4 sm:gap-6 min-w-0 w-full md:w-auto">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-xl shadow-blue-600/20">
                                        {viewingResult.userId?.name?.charAt(0)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">{viewingResult.userId?.name}</h4>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                                            <p className="text-[10px] sm:text-sm font-black text-slate-400 uppercase tracking-widest truncate">{viewingResult.userId?.email}</p>
                                            <span className={`px-3 sm:px-4 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest shrink-0 ${(viewingResult.score >= (viewingResult.examId?.passingMarks || 0)) ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                                                {(viewingResult.score >= (viewingResult.examId?.passingMarks || 0)) ? 'PASS' : 'FAIL'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
                                    <button
                                        onClick={() => toggleAttendance(viewingResult._id)}
                                        className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-4 sm:px-6 py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all border ${viewingResult.attendance === 'Present' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' : 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'}`}
                                    >
                                        {viewingResult.attendance === 'Present' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                                        <span className="hidden sm:inline">Mark</span> {viewingResult.attendance === 'Present' ? 'Absent' : 'Present'}
                                    </button>
                                    <button onClick={() => setViewingResult(null)} className="flex-1 md:flex-none p-3 sm:p-4 hover:bg-slate-200 bg-slate-100 md:bg-transparent rounded-2xl transition-colors font-black text-slate-400 text-[10px] sm:text-sm uppercase tracking-widest text-center">EXIT LOGS</button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-10 overflow-y-auto space-y-8 sm:space-y-12">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Score</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{viewingResult.score} / {viewingResult.totalMarks || viewingResult.totalQuestions || 0}</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{Math.round((viewingResult.score / (viewingResult.totalMarks || viewingResult.totalQuestions || 1)) * 100)}%</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Invested</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{Math.floor((viewingResult.timeTaken || 0) / 60)}m {(viewingResult.timeTaken || 0) % 60}s</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Violations</p>
                                        <p className={`text-lg sm:text-xl font-black ${((viewingResult.violations?.tabSwitches || 0) + (viewingResult.violations?.fullscreenExits || 0)) > 0 ? 'text-rose-500' : 'text-slate-900'}`}>
                                            {((viewingResult.violations?.tabSwitches || 0) + (viewingResult.violations?.fullscreenExits || 0))} / 3
                                        </p>
                                        <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold tracking-widest uppercase mt-1">
                                            {viewingResult.violations?.fullscreenExits || 0} FS Exit | {viewingResult.violations?.tabSwitches || 0} Tab
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Terminal size={16} className="text-blue-500" /> Answer Sequence Analysis</h5>
                                    <div className="space-y-6">
                                        {(viewingResult.examId?.questions || []).map((question, idx) => {
                                            const ans = viewingResult.answers.find(a =>
                                                (a.questionId?._id || a.questionId) === (question._id || question)
                                            );
                                            // Fallback validation if isCorrect is missing (for legacy results)
                                            const isCorrect = ans 
                                                ? (question.type === 'Coding'
                                                    ? (ans.codingResults?.testCasesPassed === ans.codingResults?.totalTestCases && ans.codingResults?.totalTestCases > 0)
                                                    : (ans.isCorrect !== undefined ? ans.isCorrect : (ans.selectedOption === question.correctAnswer)))
                                                : false;

                                            return (
                                                <div key={idx} className="p-4 sm:p-6 bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden text-left">
                                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${ans ? (isCorrect ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-slate-300'}`} />
                                                    <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
                                                        <p className="font-bold text-slate-800 text-[12px] sm:text-sm break-words w-full sm:pr-4">{question.questionText}</p>
                                                        <span className={`self-start px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 ${ans ? (isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')
                                                                : 'bg-slate-100 text-slate-400'
                                                            }`}>
                                                            {ans ? (isCorrect ? 'Correct' : 'Incorrect') : 'Not Attended'}
                                                        </span>
                                                    </div>
                                                    {question.type === 'Coding' ? (
                                                        <div className="col-span-2 space-y-4">
                                                            <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2">
                                                                <div className="p-3 sm:p-4 bg-white rounded-2xl border border-slate-100">
                                                                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Execution Pipeline</p>
                                                                    <p className="text-sm font-black text-slate-800">
                                                                        {ans?.codingResults?.testCasesPassed || 0} / {ans?.codingResults?.totalTestCases || question.codingMetadata?.testCases?.length || 0}
                                                                        <span className="ml-2 text-[9px] text-slate-400 font-bold tracking-widest">PASSED</span>
                                                                    </p>
                                                                </div>
                                                                <div className="p-3 sm:p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                                                    <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Logic Fidelity Score</p>
                                                                    <p className="text-sm font-black text-blue-600">
                                                                        {Math.max(
                                                                            ans?.codingResults?.aiFeedback?.logicScore || 0,
                                                                            Math.round(((ans?.codingResults?.testCasesPassed || 0) / (ans?.codingResults?.totalTestCases || 1)) * 100)
                                                                        )}%
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="p-4 sm:p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 relative overflow-hidden">
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" /> AI Synthesis Audit
                                                                    </div>
                                                                    <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Automated Review</span>
                                                                </div>
                                                                <p className="text-[11px] text-slate-600 leading-relaxed font-medium mb-3 italic">
                                                                    &quot;{ans?.codingResults?.aiFeedback?.suggestions || 'The submission was audited via execution metrics. Logic appears consistent with output requirements.'}&quot;
                                                                </p>
                                                                <div className="flex gap-6 pt-2 border-t border-emerald-100/30">
                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quality: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.quality || 'N/A'}</span></p>
                                                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Complexity: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.complexity || 'N/A'}</span></p>
                                                                </div>
                                                            </div>

                                                            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-[#0f0f1a] shadow-inner">
                                                                <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-slate-900 border-b border-white/5">
                                                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Script Submission Protocol ({ans?.language?.toUpperCase() || 'CODE'})</p>
                                                                </div>
                                                                <pre className="p-6 text-[11px] font-mono text-blue-100/80 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                                                                    {ans?.code || 'No code footprint recorded'}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                                            <div className="p-3 bg-white rounded-xl border border-slate-100">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Selection</p>
                                                                <p className={`text-xs font-bold ${ans ? (isCorrect ? 'text-emerald-600' : 'text-rose-500') : 'text-slate-400 italic'}`}>
                                                                    {ans ? (ans.selectedOption || 'Null') : 'NO RESPONSE'}
                                                                </p>
                                                            </div>
                                                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                                                <p className="text-[8px] font-black text-blue-400 uppercase mb-1">Correct Key</p>
                                                                <p className="text-xs font-bold text-blue-600">{question.correctAnswer}</p>
                                                            </div>
                                                        </div>
                                                    )}
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

export default EvaluationTab;
