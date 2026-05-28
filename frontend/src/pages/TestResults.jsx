import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Award, ChevronDown, User as UserIcon,
    Calendar, BarChart, PieChart, Info, Eye, X,
    FileDown, ShieldAlert, Zap, Binary, ChevronRight, Loader2, ShieldCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUniv from '../assets/LogoL.png';
import logoMUSE from '../assets/muse_logo.png';
import logoApex from '../assets/logo_transparent.png';

const TestResults = () => {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState(null);
    const [isPlagiarismAnalyzing, setIsPlagiarismAnalyzing] = useState(false);
    const [plagiarismData, setPlagiarismData] = useState(null);
    const [showPlagiarismModal, setShowPlagiarismModal] = useState(false);
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    useEffect(() => {
        fetchExams();
    }, []);

    useEffect(() => {
        if (selectedResult) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [selectedResult]);

    const fetchExams = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/exams`);
            setExams(res.data.data);
        } catch (err) {
            toast.error('Failed to load exams');
        }
    };

    const fetchResults = async (examId) => {
        if (!examId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/api/results/exam/${examId}`);
            setResults(res.data.data);
        } catch (err) {
            toast.error('Failed to load results');
        } finally {
            setLoading(false);
        }
    };

    const handleRunPlagiarismAnalysis = async () => {
        if (!selectedExamId) return toast.error('Please select an assessment first');
        setIsPlagiarismAnalyzing(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_BASE}/api/results/plagiarism/${selectedExamId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setPlagiarismData(res.data);
            setShowPlagiarismModal(true);
            toast.success('Plagiarism Radar Scan Complete');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Plagiarism analysis protocol failed');
        } finally {
            setIsPlagiarismAnalyzing(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            if (!selectedExamId || results.length === 0) {
                toast.error('No results available to download');
                return;
            }

            const exam = exams.find(e => e._id === selectedExamId);
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

                        // Helper to load image as a Promise
            const loadImg = (src) => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = src;
                });
            };

            // Preload all logos
            const [logoMUSEImg, logoUnivImg, logoApexImg] = await Promise.all([
                loadImg(logoMUSE),
                loadImg(logoUniv),
                loadImg(logoApex)
            ]);

            // --- 1. Institutional Header ---
            // Left Logo (University of Mysore)
            if (logoUnivImg) {
                try {
                    doc.addImage(logoUnivImg, 'PNG', 15, 10, 20, 20);
                } catch (e) {
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(15, 10, 20, 20);
                    doc.setFontSize(6);
                    doc.text("UNIVERSITY", 25, 20, { align: 'center' });
                }
            } else {
                doc.setDrawColor(200, 200, 200);
                doc.rect(15, 10, 20, 20);
                doc.setFontSize(6);
                doc.text("UNIVERSITY", 25, 20, { align: 'center' });
            }

            // Center Text
            doc.setTextColor(0, 51, 102); // Dark blue
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text("MYSORE UNIVERSITY SCHOOL OF ENGINEERING", pageWidth / 2, 15, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("Manasagangotri Campus, Mysuru (Approved by AICTE, New Delhi)", pageWidth / 2, 21, { align: 'center' });

                        // Right Logo (Department/APEX) - Using MUSE Logo
            if (logoMUSEImg) {
                try {
                    doc.addImage(logoMUSEImg, 'PNG', pageWidth - 35, 10, 20, 20);
                } catch (e) {
                    doc.rect(pageWidth - 35, 10, 20, 20);
                    doc.setFontSize(6);
                    doc.text("MUSE", pageWidth - 25, 20, { align: 'center' });
                }
            } else {
                doc.rect(pageWidth - 35, 10, 20, 20);
                doc.setFontSize(6);
                doc.text("MUSE", pageWidth - 25, 20, { align: 'center' });
            }

            // --- 2. Branding & Title ---
            doc.setTextColor(0, 0, 0);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');

            // Draw APEX and CLUB with logo in between
            const apexWidth = doc.getTextWidth("APEX");
            const clubWidth = doc.getTextWidth("CLUB");
            const logoW = 25; // Zoomed width
            const logoH = 20; // Adjusted height for better fit
            const spacing = 2; // Reduced space significantly
            const totalWidth = apexWidth + clubWidth + logoW + (spacing * 2);
            const startX = (pageWidth - totalWidth) / 2;

            doc.text("APEX", startX, 48);
                        if (logoApexImg) {
                try {
                    // Centering the zoomed logo vertically relative to text
                    doc.addImage(logoApexImg, 'PNG', startX + apexWidth + spacing, 30, logoW, logoH);
                } catch (e) {
                    doc.setDrawColor(218, 165, 32);
                    doc.rect(startX + apexWidth + spacing, 30, logoW, logoH);
                }
            } else {
                doc.setDrawColor(218, 165, 32);
                doc.rect(startX + apexWidth + spacing, 30, logoW, logoH);
            }
            doc.text("CLUB", startX + apexWidth + logoW + (spacing * 2), 48);

            doc.setFontSize(16);
            doc.text("Official Assessment Result Announcement", pageWidth / 2, 58, { align: 'center' });
            doc.setLineWidth(0.5);
            doc.line(20, 62, pageWidth - 20, 62);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${exam?.title || 'Exam Name'}`, 20, 75);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Report Generated: ${new Date().toLocaleString('en-US', { hour12: true })}`, pageWidth - 20, 75, { align: 'right' });

            doc.text(`Scheduled Date: ${exam?.scheduledDate || 'DD/MM/YYYY'}`, 20, 85);
            doc.text(`Start Time: ${exam?.startTime || '00:00 AM'}`, 20, 95);

            doc.line(20, 102, pageWidth - 20, 102);

            // --- 4. Results Table ---
            const tableColumn = ["Student Name", "Register Number", "Marks Obtained", "Percentage", "Pass/Fail"];
            const tableRows = results.map(r => {
                const percentage = Math.round((r.score / (r.totalMarks || r.totalQuestions)) * 100);
                return [
                    r.userId?.name || 'Unknown',
                    r.userId?.usn || 'N/A', // Register Number / USN ID
                    `${r.totalMarks || r.totalQuestions} / ${r.score}`,
                    `${percentage}%`,
                    `${r.score >= (exam?.passingMarks || 0) ? 'Pass' : 'Fail'}`
                ];
            });

            autoTable(doc, {
                startY: 110,
                head: [tableColumn],
                body: tableRows,
                theme: 'grid',
                margin: { top: 110, bottom: 65 },
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
                    fontSize: 9,
                    halign: 'center',
                    lineWidth: 0.1,
                    lineColor: [0, 0, 0]
                },
                columnStyles: {
                    0: { halign: 'left' }
                },
                margin: { left: 20, right: 20 }
            });

            // --- 5. Signatories & Footer ---
            // --- 5. Executive Summary (New Page) ---
            doc.addPage();
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text("EXECUTIVE PERFORMANCE SUMMARY", 20, 40);

            doc.setDrawColor(37, 99, 235);
            doc.setLineWidth(1);
            doc.line(20, 45, 100, 45);

            // Statistics Grid
            doc.setFontSize(12);
            doc.setTextColor(50, 50, 50);

            const statsY = 65;
            doc.setFont('helvetica', 'bold');
            doc.text("OVERALL STATISTICS", 20, statsY);

            doc.setFont('helvetica', 'normal');
            doc.text(`Total Students Attended:`, 20, statsY + 15);
            doc.setFont('helvetica', 'bold');
            doc.text(`${results.length}`, 110, statsY + 15);

            doc.setFont('helvetica', 'normal');
            doc.text(`Passed Students:`, 20, statsY + 25);
            doc.setTextColor(22, 163, 74); // Green
            doc.setFont('helvetica', 'bold');
            doc.text(`${results.filter(r => r.score >= (exam?.passingMarks || 0)).length}`, 110, statsY + 25);

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(`Failed Students:`, 20, statsY + 35);
            doc.setTextColor(220, 38, 38); // Red
            doc.setFont('helvetica', 'bold');
            doc.text(`${results.filter(r => r.score < (exam?.passingMarks || 0)).length}`, 110, statsY + 35);

            doc.setTextColor(50, 50, 50);
            doc.setFont('helvetica', 'normal');
            const avgPercentage = results.length > 0
                ? (results.reduce((acc, r) => acc + (r.score / (r.totalMarks || r.totalQuestions)), 0) / results.length * 100).toFixed(2)
                : "0.00";
            doc.text(`Average Performance Score:`, 20, statsY + 45);
            doc.setFont('helvetica', 'bold');
            doc.text(`${avgPercentage}%`, 110, statsY + 45);

            // Top 5 Performers
            const top5 = [...results]
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            doc.setFont('helvetica', 'bold');
            doc.setTextColor(37, 99, 235);
            doc.text("TOP 5 PERFORMERS (MERIT LIST)", 20, statsY + 70);

            const top5TableColumn = ["Rank", "Name", "Register Number", "Marks Obtained"];
            const top5TableRows = top5.map((r, i) => [
                `Rank ${i + 1}`,
                r.userId?.name || 'N/A',
                r.userId?.usn || 'N/A',
                `${r.score} / ${r.totalMarks || r.totalQuestions}`
            ]);

            autoTable(doc, {
                startY: statsY + 75,
                head: [top5TableColumn],
                body: top5TableRows,
                theme: 'striped',
                headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
                margin: { left: 20, right: 20 }
            });

            // --- 6. Signatories (Last Page Bottom Only) ---
            let finalY = pageHeight - 40;

            const sigWidth = (pageWidth - 40) / 4;
            const sigs = [
                { title: "Mock Test Coordinator", dept: "APEX CLUB, MUSE" },
                { title: "Student Coordinator", dept: "APEX CLUB, MUSE" },
                { title: "Placement & Training Officer", dept: "MUSE" },
                { title: "Director, MUSE", dept: "" }
            ];

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(50, 50, 50);
            sigs.forEach((sig, i) => {
                const xPos = 20 + (i * sigWidth);
                doc.setDrawColor(37, 99, 235); // Blue line for signatures
                doc.line(xPos + 2, finalY, xPos + sigWidth - 2, finalY);
                doc.text(sig.title, xPos + sigWidth / 2, finalY + 5, { align: 'center' });
                if (sig.dept) doc.text(sig.dept, xPos + sigWidth / 2, finalY + 9, { align: 'center' });
            });

            // Global Footer
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150);
                doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
                doc.text("© APEX Club Mock Test Department - System Generated Report", pageWidth / 2, pageHeight - 10, { align: 'center' });
            }

            doc.save(`${(exam?.title || 'Report').replace(/\s+/g, '_')}_Official_Announcement.pdf`);
            toast.success('Official Result Announcement Generated');
        } catch (error) {
            console.error('PDF Error:', error);
            toast.error('Failed to generate official report');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <main className="max-w-7xl mx-auto w-full p-4 md:p-8">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-10 gap-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Examination Insight</h1>
                        <p className="text-slate-500 text-xs font-medium">Analyze student performance and manage result visibility.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <select
                                value={selectedExamId}
                                onChange={(e) => {
                                    setSelectedExamId(e.target.value);
                                    fetchResults(e.target.value);
                                }}
                                className="w-full pl-6 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none transition-all"
                            >
                                <option value="">Select an Assessment</option>
                                {exams.map(e => (
                                    <option key={e._id} value={e._id}>{e.title}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={20} />
                        </div>

                        {results.length > 0 && (
                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                <button
                                    onClick={handleRunPlagiarismAnalysis}
                                    disabled={isPlagiarismAnalyzing}
                                    className="px-8 py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20 active:scale-95 disabled:opacity-70"
                                >
                                    {isPlagiarismAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <ShieldAlert size={20} />}
                                    Plagiarism Radar
                                </button>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95"
                                >
                                    <FileDown size={20} /> Download Result
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {selectedExamId ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-8"
                        >
                            {/* Quick Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatsCard
                                    label="Submissions"
                                    value={results.length}
                                    icon={UserIcon}
                                    color="bg-slate-900"
                                />
                                <StatsCard
                                    label="Average Score"
                                    value={(results.reduce((acc, r) => acc + (r.score / (r.totalMarks || r.totalQuestions)) * 100, 0) / (results.length || 1)).toFixed(1) + '%'}
                                    icon={BarChart}
                                    color="bg-blue-600"
                                />
                                <StatsCard
                                    label="Passing Candidates"
                                    value={results.filter(r => r.score > (exams.find(e => e._id === selectedExamId)?.passingMarks || 0)).length}
                                    icon={PieChart}
                                    color="bg-emerald-600"
                                />
                            </div>

                            {/* Results Table */}
                            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                                <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50/50 gap-4">
                                    <h3 className="text-xl font-black text-slate-800">Candidate Ledgers</h3>
                                    <div className="relative w-full sm:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input type="text" placeholder="Search student..." className="w-full pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-blue-500/10 font-bold text-sm" />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest w-1/3">Student Identity</th>
                                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Performance</th>
                                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Evaluation</th>
                                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest hidden lg:table-cell">Date</th>
                                                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {results.map((r) => (
                                                <tr key={r._id} className="hover:bg-slate-50/80 transition-all group">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                                                                {r.userId?.name ? r.userId.name.charAt(0) : '?'}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-slate-800 tracking-tight flex items-center gap-2">
                                                                    {r.userId?.name || 'Deleted Student'}
                                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${r.score >= (exams.find(e => e._id === selectedExamId)?.passingMarks || 0) ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                                        {r.score >= (exams.find(e => e._id === selectedExamId)?.passingMarks || 0) ? 'PASS' : 'FAIL'}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs font-bold text-slate-400">{r.userId?.email || 'No Email'}</div>
                                                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-1">Reg: {r.userId?.usn || 'N/A'}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6">
                                                        <div className="flex flex-col gap-1">
                                                            <span className={`text-lg font-black ${(r.score / (r.totalMarks || r.totalQuestions)) >= 0.5 ? 'text-emerald-600' : 'text-slate-900'}`}>
                                                                {Math.round((r.score / (r.totalMarks || r.totalQuestions)) * 100)}%
                                                            </span>
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">{r.score} / {r.totalMarks || r.totalQuestions} Marks</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 hidden md:table-cell">
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-600">
                                                                AUTO Graded
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 hidden lg:table-cell">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                                                            <Calendar size={14} /> {new Date(r.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <button
                                                            onClick={() => setSelectedResult(r)}
                                                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm group-hover:shadow-md"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-40 text-slate-300">
                            <Award size={100} className="mb-6 opacity-20" />
                            <p className="text-xl font-black tracking-tight">Select an Assessment to Begin Analysis</p>
                        </div>
                    )}
                </AnimatePresence>

                {/* Detail Modal */}
                <AnimatePresence>
                    {selectedResult && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSelectedResult(null)}
                                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-8"
                            >
                                <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-5xl md:max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                                    {/* Modal Header */}
                                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 flex items-center justify-between shadow-lg relative z-10">
                                        <div>
                                            <h2 className="text-2xl font-black mb-1">{selectedResult.userId?.name || 'Student'}</h2>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
                                                <p className="text-blue-100 text-[11px] font-black uppercase tracking-widest">{selectedResult.userId?.email || 'No Email'}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedResult(null)}
                                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 shadow-inner"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {/* Modal Scrollable Content */}
                                    <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                                        {/* Result Status Display */}
                                        <div className={`w-full px-6 py-4 ${selectedResult.isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'} rounded-2xl font-black text-center flex items-center justify-center gap-2 border`}>
                                            {selectedResult.isPublished ? 'Result Publicly Available' : 'Internal Performance Data'}
                                        </div>

                                        {/* Student Info Grid */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Overall Score</p>
                                                <p className="text-4xl font-black text-blue-600">{Math.round((selectedResult.score / (selectedResult.totalMarks || selectedResult.totalQuestions)) * 100)}%</p>
                                                <p className="text-sm font-bold text-slate-500 mt-2">{selectedResult.score} / {selectedResult.totalMarks || selectedResult.totalQuestions} Marks</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Attendance</p>
                                                <p className={`text-2xl font-black ${selectedResult.attendance === 'Present' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {selectedResult.attendance || 'Present'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Result Status</p>
                                                <p className={`text-2xl font-black ${selectedResult.score >= (exams.find(e => e._id === selectedExamId)?.passingMarks || 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {selectedResult.score >= (exams.find(e => e._id === selectedExamId)?.passingMarks || 0) ? 'PASS' : 'FAIL'}
                                                </p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Time Taken</p>
                                                <p className="text-2xl font-black text-slate-800">{Math.floor(selectedResult.timeTaken / 60)}m {selectedResult.timeTaken % 60}s</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Minimum Marks</p>
                                                <p className="text-2xl font-black text-slate-800">{exams.find(e => e._id === selectedExamId)?.passingMarks || 0}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Submission Date</p>
                                                <p className="text-sm font-black text-slate-800">{new Date(selectedResult.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        {/* Coding Score */}
                                        {selectedResult.totalCodingScore > 0 && (
                                            <div className="bg-slate-50 rounded-2xl p-6">
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Coding Performance</p>
                                                <div className="flex items-center gap-6">
                                                    <div>
                                                        <p className="text-3xl font-black text-purple-600">{Math.round(selectedResult.totalCodingScore)}%</p>
                                                        <p className="text-xs font-bold text-slate-500">Coding Score</p>
                                                    </div>
                                                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                                                            style={{ width: `${selectedResult.totalCodingScore}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Questions Summary */}
                                        <div className="bg-slate-50 rounded-2xl p-6">
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Assessment Summary</p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center">
                                                    <p className="text-2xl font-black text-slate-800">{selectedResult.totalQuestions}</p>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">Questions</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-black text-blue-600">{selectedResult.totalMarks || selectedResult.totalQuestions}</p>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">Total Marks</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-black text-emerald-600">{selectedResult.answers?.filter(a => a.isCorrect === true || (a.codingResults && a.codingResults.testCasesPassed === a.codingResults.totalTestCases && a.codingResults.totalTestCases > 0)).length || 0}</p>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">Correct Answers</p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-2xl font-black text-rose-600">{selectedResult.answers?.filter(a => a.isCorrect === false || (a.codingResults && a.codingResults.testCasesPassed !== a.codingResults.totalTestCases)).length || 0}</p>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">Incorrect Answers</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Violations */}
                                        {selectedResult.violations && selectedResult.violations.length > 0 && (
                                            <div className="bg-rose-50 rounded-2xl p-6 border border-rose-200">
                                                <p className="text-xs font-black text-rose-600 uppercase tracking-widest mb-4">⚠️ Violations Detected</p>
                                                <ul className="space-y-2">
                                                    {selectedResult.violations.map((v, i) => (
                                                        <li key={i} className="text-sm font-bold text-rose-700 flex items-start gap-2">
                                                            <span className="text-rose-500 mt-1">•</span>
                                                            <span>{v.type}: {v.details}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
                {/* Plagiarism Modal */}
                <AnimatePresence>
                    {showPlagiarismModal && plagiarismData && (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowPlagiarismModal(false)}
                                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200]"
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 50 }}
                                className="fixed inset-0 z-[201] flex items-center justify-center p-4"
                            >
                                <div className="bg-white rounded-[2rem] sm:rounded-[3rem] shadow-2xl border border-slate-100 max-w-5xl md:max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                                    <div className="p-6 sm:p-8 bg-rose-600 text-white flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 sm:p-3 bg-white/20 rounded-xl sm:rounded-2xl shrink-0">
                                                <ShieldAlert size={24} className="sm:w-8 sm:h-8" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl sm:text-3xl font-black tracking-tight leading-tight">Plagiarism Radar Report</h2>
                                                <p className="text-rose-100 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1">
                                                    Scan Analysis • {plagiarismData.totalAnalyzed} Probed
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowPlagiarismModal(false)}
                                            className="p-3 sm:p-4 bg-white/10 hover:bg-white/20 rounded-2xl sm:rounded-3xl transition-all ml-2"
                                        >
                                            <X size={20} className="sm:w-6 sm:h-6" />
                                        </button>
                                    </div>

                                    <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                                        {plagiarismData.matchesFound > 0 ? (
                                            <div className="space-y-4">
                                                {plagiarismData.data.map((match, i) => (
                                                    <div key={i} className="bg-slate-50 rounded-[2.5rem] border border-slate-100 overflow-hidden group hover:border-rose-200 transition-all">
                                                        <div className="p-6 flex flex-col lg:flex-row items-center justify-between gap-6">
                                                            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-12 w-full lg:w-auto">
                                                                <div className="text-center bg-white p-4 rounded-2xl border border-slate-100 min-w-[100px]">
                                                                    <div className={`text-3xl sm:text-4xl font-black ${match.similarity > 80 ? 'text-rose-600' : 'text-amber-500'}`}>
                                                                        {match.similarity}%
                                                                    </div>
                                                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Logic Match</div>
                                                                </div>
                                                                <div className="flex items-center gap-4 flex-1 justify-center sm:justify-start">
                                                                    <div className="text-right flex-1 min-w-0">
                                                                        <p className="font-black text-slate-800 truncate">{match.studentA.name}</p>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{match.studentA.usn}</p>
                                                                    </div>
                                                                    <div className="w-8 sm:w-12 h-[2px] bg-slate-200 relative shrink-0">
                                                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1 rounded-full border border-slate-200">
                                                                            <Binary size={10} className="text-slate-400" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-left flex-1 min-w-0">
                                                                        <p className="font-black text-slate-800 truncate">{match.studentB.name}</p>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{match.studentB.usn}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                                                                    match.status === 'Critical' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'bg-amber-100 text-amber-600 border border-amber-200'
                                                                }`}>
                                                                    {match.status}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {match.aiAnalysis && (
                                                            <div className="px-6 pb-6 pt-2">
                                                                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
                                                                    <div className="absolute top-0 right-0 p-4 opacity-5">
                                                                        <Zap size={40} className="text-blue-600" />
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mb-3">
                                                                        <Zap size={14} className="text-blue-600" />
                                                                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Gemini AI Verification</span>
                                                                        <span className="ml-auto text-[10px] font-black text-slate-400 uppercase">Confidence: {match.aiAnalysis.confidence}%</span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                                                                        "{match.aiAnalysis.reasoning}"
                                                                    </p>
                                                                    <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                                                                        match.aiAnalysis.isPlagiarism ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                                                                    }`}>
                                                                        Result: {match.aiAnalysis.isPlagiarism ? 'CONFIRMED PLAGIARISM' : 'COINCIDENTAL SIMILARITY'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-20 text-center">
                                                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                                                    <ShieldCheck size={40} />
                                                </div>
                                                <p className="text-slate-400 font-black uppercase tracking-widest">No significant plagiarism patterns detected in this batch</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                                        <div className="flex items-center gap-3">
                                            <Info size={16} className="text-blue-600 shrink-0" />
                                            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-md text-center sm:text-left">
                                                Heuristic engine uses token-based Jaccard similarity. AI verification uses semantic structural analysis.
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => setShowPlagiarismModal(false)}
                                            className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
                                        >
                                            Close Report
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};

const StatsCard = ({ label, value, icon: Icon, color }) => (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex items-center justify-between group overflow-hidden relative">
        <div className={`absolute -right-4 -top-4 w-24 h-24 ${color} opacity-5 rounded-full transition-transform group-hover:scale-150`} />
        <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{label}</p>
            <p className="text-3xl font-black text-slate-900">{value}</p>
        </div>
        <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-white`}>
            <Icon size={28} className={color.replace('bg-', 'text-')} />
        </div>
    </div>
);

export default TestResults;
