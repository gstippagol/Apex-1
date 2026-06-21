import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Award, CheckCircle, XCircle, Eye,
    Filter, ChevronRight, User, Terminal,
    Activity, Clock, CheckSquare, RotateCcw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import logo from '../../assets/logo_transparent.png';
import museLogo from '../../assets/muse_logo.png';
import rightShield from '../../assets/LogoL.png';
import ConfirmModal from '../ConfirmModal';
import LoadingScreen from '../LoadingScreen';

const QuizMonitoringTab = () => {
    const [quizzes, setQuizzes] = useState([]);

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

    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewingResult, setViewingResult] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/quiz`);
            setQuizzes(res.data.data);
        } catch (err) {
            toast.error('Failed to load quizzes');
        }
    };

    const downloadReport = async () => {
        const selectedQuiz = quizzes.find(q => q._id === selectedQuizId);
        if (!selectedQuiz) return;

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
        doc.text("Weekly Assessment Results", 105, 58, { align: "center" });

        doc.setLineWidth(0.8);
        doc.line(15, 62, 195, 62);

        // Meta Info
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(selectedQuiz.title, 15, 75);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Report Generated: ${timestamp}`, 195, 75, { align: "right" });

        doc.text(`Scheduled Date: ${new Date(selectedQuiz.createdAt).toLocaleDateString()}`, 15, 85);
        doc.text(`Total Candidates: ${submissions.length}`, 15, 95);

        doc.setLineWidth(0.5);
        doc.line(15, 102, 195, 102);

        // Table Data
        const tableData = submissions.map((sub) => [
            sub.userId?.name || 'N/A',
            sub.userId?.usn || 'N/A',
            `${sub.score} / ${sub.totalMarks}`,
            `${Math.round((sub.score / (sub.totalMarks || 1)) * 100)}%`
        ]);

        autoTable(doc, {
            startY: 110,
            head: [['Student Name', 'Register Number', 'Marks Obtained', 'Percentage']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 9, fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
            bodyStyles: { fontSize: 8, textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
            margin: { top: 30, bottom: 40, left: 15, right: 15 }
        });

        // Add Summary Page
        const totalAttended = submissions.length;
        const above50 = submissions.filter(s => (s.score / (s.totalMarks || 1)) >= 0.5).length;
        const below50 = totalAttended - above50;
        const avgPercentage = submissions.length > 0 
            ? Math.round((submissions.reduce((acc, s) => acc + (s.score / (s.totalMarks || 1)), 0) / submissions.length) * 100) 
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

        doc.save(`${selectedQuiz.title.replace(/\s+/g, '_')}_Report.pdf`);
    };

    const handleQuizSelect = async (quizId) => {
        setSelectedQuizId(quizId);
        if (!quizId) {
            setSubmissions([]);
            return;
        }
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/quiz/results?quizId=${quizId}`);
            setSubmissions(res.data.data);
        } catch (err) {
            toast.error('Failed to fetch submissions');
        } finally {
            setLoading(false);
        }
    };

    const handleRetest = async (resultId, studentName = 'this candidate') => {
        triggerConfirm({
            title: 'Grant Retest Protocol',
            message: `Are you sure you want to grant a retest to ${studentName}? This will permanently delete their current submission so they can retake the quiz.`,
            confirmText: 'Grant Retest',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/quiz/results/${resultId}`);
                    toast.success('Retest granted successfully');
                    // Refresh submissions
                    handleQuizSelect(selectedQuizId);
                } catch (err) {
                    toast.error('Failed to grant retest');
                }
            }
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Quiz Monitoring</h1>
                    <p className="text-slate-500 font-medium">Audit real-time quiz performance and candidate metrics.</p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <select
                            value={selectedQuizId}
                            onChange={(e) => handleQuizSelect(e.target.value)}
                            className="w-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none shadow-sm"
                        >
                            <option value="">Select Quiz Protocol</option>
                            {quizzes.map(q => (
                                <option key={q._id} value={q._id}>{q.title}</option>
                            ))}
                        </select>
                    </div>

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
                </div>
            </div>

            <AnimatePresence mode="wait">
                {loading ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-white rounded-[2.5rem] p-16 shadow-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                        <LoadingScreen message="Synchronizing Ledger..." dark={false} fullScreen={false} />
                    </motion.div>
                ) : selectedQuizId ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <h3 className="text-xl font-black text-slate-800">Quiz Candidate Logs</h3>
                                <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    {submissions.length} Submissions
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Candidate</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Index</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Logs</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Violations</th>
                                            <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {submissions.filter(sub => {
                                            const term = searchQuery.toLowerCase();
                                            const nameMatch = sub.userId?.name?.toLowerCase().includes(term);
                                            const usnMatch = sub.userId?.usn?.toLowerCase().includes(term);
                                            return nameMatch || usnMatch;
                                        }).map((sub) => (
                                            <tr key={sub._id} className="hover:bg-slate-50/80 transition-all">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                                                            {sub.userId?.name?.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-slate-800 tracking-tight">{sub.userId?.name}</div>
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">{sub.userId?.usn}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-lg font-black text-slate-900">{sub.score} <span className="text-xs text-slate-400">/ {sub.totalMarks}</span></span>
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-blue-500" style={{ width: `${(sub.score / sub.totalMarks) * 100}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-xs font-bold text-slate-500">
                                                    {Math.floor(sub.timeTaken / 60)}m {sub.timeTaken % 60}s
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
                                                        <button
                                                            onClick={() => handleRetest(sub._id, sub.userId?.name)}
                                                            title={`Grant retest to ${sub.userId?.name}`}
                                                            className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 hover:border-amber-300 rounded-[1.25rem] transition-all shadow-sm text-[10px] font-black uppercase tracking-widest group/retest"
                                                        >
                                                            <RotateCcw size={14} className="group-hover/retest:rotate-[-90deg] transition-transform duration-300" />
                                                            Retest
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    setLoading(true);
                                                                    const quizRes = await axios.get(`${API_BASE}/api/quiz/${sub.quizId?._id}`);
                                                                    setViewingResult({ ...sub, fullQuiz: quizRes.data.data });
                                                                } catch (err) {
                                                                    setViewingResult(sub);
                                                                } finally {
                                                                    setLoading(false);
                                                                }
                                                            }}
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[3rem] border border-slate-100 p-32 shadow-xl flex flex-col items-center justify-center text-center">
                        <div className="w-24 h-24 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mb-8">
                            <Activity size={48} className="opacity-20" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">SELECT QUIZ PROTOCOL</h2>
                        <p className="text-slate-400 font-bold max-w-sm">Choose a quiz from the menu to audit candidate performance data.</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Detailed View Modal (Similar to EvaluationPage) */}
            <AnimatePresence>
                {viewingResult && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setViewingResult(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-4xl max-h-[90vh] rounded-[2rem] sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-lg sm:text-xl shrink-0">{viewingResult.userId?.name?.charAt(0)}</div>
                                    <div className="min-w-0">
                                        <h4 className="text-xl sm:text-2xl font-black text-slate-900 truncate">{viewingResult.userId?.name}</h4>
                                        <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{viewingResult.userId?.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setViewingResult(null)} className="w-full sm:w-auto px-6 py-2 bg-slate-200/50 sm:bg-transparent hover:bg-slate-200 rounded-xl transition-all font-black text-slate-400 text-[10px] uppercase tracking-widest">Exit Log</button>
                            </div>
                            <div className="p-5 sm:p-8 overflow-y-auto">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Final Score</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{viewingResult.score} / {viewingResult.totalMarks}</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Success Rate</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{Math.round((viewingResult.score / viewingResult.totalMarks) * 100)}%</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Time Invested</p>
                                        <p className="text-lg sm:text-xl font-black text-slate-900">{Math.floor(viewingResult.timeTaken / 60)}m {viewingResult.timeTaken % 60}s</p>
                                    </div>
                                    <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-center items-center sm:items-start text-center sm:text-left">
                                        <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Submission Protocol</p>
                                        <p className={`text-lg sm:text-xl font-black ${viewingResult.submissionType === 'Auto' ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {viewingResult.submissionType === 'Auto' ? 'Auto Submitted' : 'Normal Submit'}
                                        </p>
                                        <p className="text-[7px] sm:text-[8px] text-slate-400 font-bold tracking-widest uppercase mt-1">
                                            {viewingResult.submissionType === 'Auto' ? 'Security/Time Trigger' : 'User Initiated'}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h5 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Terminal size={16} className="text-blue-500" /> Answer Sequence Analysis</h5>
                                    {(viewingResult.fullQuiz?.questions || []).map((question, idx) => {
                                        const ans = viewingResult.answers.find(a => a.questionId?._id === question._id);
                                        // Fallback validation if isCorrect is missing (for legacy results)
                                        const isCorrect = ans ? (ans.isCorrect !== undefined ? ans.isCorrect : (ans.selectedOption === question.correctAnswer)) : false;

                                        return (
                                            <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 relative overflow-hidden">
                                                <div className={`absolute top-0 left-0 w-1.5 h-full ${ans ? (isCorrect ? 'bg-emerald-500' : 'bg-rose-500') : 'bg-slate-300'}`} />
                                                <div className="flex justify-between items-start mb-4">
                                                    <p className="font-bold text-slate-800 text-sm pr-4">{question.questionText}</p>
                                                    <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 ${ans ? (isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600')
                                                            : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                        {ans ? (isCorrect ? 'Correct' : 'Incorrect') : 'Not Attended'}
                                                    </span>
                                                </div>
                                                {question.type === 'Coding' ? (
                                                    <div className="col-span-2 space-y-4">
                                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                                            <div className="p-4 bg-white rounded-2xl border border-slate-100">
                                                                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Execution Pipeline</p>
                                                                <p className="text-sm font-black text-slate-800">
                                                                    {ans?.codingResults?.testCasesPassed || 0} / {ans?.codingResults?.totalTestCases || question.codingMetadata?.testCases?.length || 0}
                                                                    <span className="ml-2 text-[9px] text-slate-400 font-bold tracking-widest">PASSED</span>
                                                                </p>
                                                            </div>
                                                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                                                <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">Logic Fidelity Score</p>
                                                                <p className="text-sm font-black text-blue-600">
                                                                    {Math.max(
                                                                        ans?.codingResults?.aiFeedback?.logicScore || 0,
                                                                        Math.round(((ans?.codingResults?.testCasesPassed || 0) / (ans?.codingResults?.totalTestCases || 1)) * 100)
                                                                    )}%
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="p-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 relative overflow-hidden">
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
                                                            <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
                                                                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Script Submission Protocol ({ans?.language?.toUpperCase() || 'CODE'})</p>
                                                            </div>
                                                            <pre className="p-6 text-[11px] font-mono text-blue-100/80 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                                                                {ans?.code || 'No code footprint recorded'}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
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
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
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

export default QuizMonitoringTab;
