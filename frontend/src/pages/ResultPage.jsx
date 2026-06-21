import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingScreen from '../components/LoadingScreen';
import {
    ArrowLeft, Terminal, Award, Clock,
    Activity, CheckSquare, Monitor, Sparkles,
    Check, X as XIcon, ShieldAlert, TabletSmartphone, Maximize2, Video
} from 'lucide-react';
import Navbar from '../components/Navbar';

const API_BASE = (
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1')
)
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

const ResultPage = () => {
    const { id } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/results/${id}`);
                setResult(res.data.data);
            } catch (err) {
                console.error('Fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchResult();
    }, [id]);

    if (loading) return (
        <LoadingScreen message="Synchronizing Report..." dark={false} fullScreen={true} />
    );

    if (!result) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">
            Report logic compromised or data missing.
        </div>
    );

    const total     = result.totalMarks || result.totalQuestions || 1;
    const score     = result.score ?? 0;
    const pct       = Math.round((score / total) * 100);
    const timeTaken = result.timeTaken ?? 0;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Back link */}
                <Link
                    to="/student"
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 font-black text-xs uppercase tracking-widest transition-colors"
                >
                    <ArrowLeft size={18} /> Back to Dashboard
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white w-full rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* ── Gradient Header (identical to quiz modal) ───── */}
                    <div className="relative h-40 sm:h-48 shrink-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-6 sm:p-8 flex flex-col items-center justify-center text-center overflow-hidden">
                        {/* dot-grid overlay */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:40px_40px] rotate-12" />
                        </div>
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-2xl">
                            <Award size={28} className="text-white" />
                        </div>
                        <h1 className="text-xl sm:text-3xl font-black text-white mb-1 tracking-tight leading-tight">
                            Performance Deciphered!
                        </h1>
                        <p className="text-white/60 font-bold text-[9px] sm:text-[10px] tracking-wide uppercase px-4 truncate w-full">
                            Assessment: {result.examId?.title}
                        </p>
                    </div>

                    {/* ── Analytics Body ───────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-10 bg-slate-50/30">

                        {/* ── 4-stat cards ─────────────────────────────── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
                            {/* Success % */}
                            <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                                    <Activity size={12} className="text-blue-500" /> Success
                                </p>
                                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{pct}%</p>
                            </div>

                            {/* Score */}
                            <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                                    <CheckSquare size={12} className="text-emerald-500" /> Score
                                </p>
                                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{score}/{total}</p>
                            </div>

                            {/* USN */}
                            <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                                    <Monitor size={12} className="text-indigo-500" /> USN
                                </p>
                                <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase truncate">
                                    {result.userId?.usn || 'N/A'}
                                </p>
                            </div>

                            {/* Time */}
                            <div className="p-4 sm:p-6 bg-white rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/10 flex flex-col justify-center text-center sm:text-left">
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center sm:justify-start gap-2">
                                    <Clock size={12} className="text-rose-500" /> Time
                                </p>
                                <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                                    {Math.floor(timeTaken / 60)}m {timeTaken % 60}s
                                </p>
                            </div>
                        </div>

                        {/* ── Proctoring Violations Panel ──────────────── */}
                        {result.violations && (
                            <div className="mb-8 sm:mb-10">
                                {/* Section header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <ShieldAlert size={14} className="text-rose-500" />
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                        Proctoring Violations
                                    </h4>
                                    <div className="h-0.5 flex-1 bg-slate-200/50 rounded-full" />
                                </div>

                                <div className={`grid grid-cols-1 sm:grid-cols-2 ${result.examId?.proctoring?.camera ? 'lg:grid-cols-3' : ''} gap-3 sm:gap-4`}>
                                    {/* Tab Switches */}
                                    {(() => {
                                        const val   = result.violations.tabSwitches  ?? 0;
                                        const max   = 3;
                                        const pctV  = Math.min((val / max) * 100, 100);
                                        const safe  = val === 0;
                                        const warn  = val > 0 && val < max;
                                        const danger = val >= max;
                                        return (
                                            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 ${
                                                safe   ? 'bg-emerald-50/40 border-emerald-100'
                                                : warn  ? 'bg-amber-50/50  border-amber-100'
                                                : 'bg-rose-50/50    border-rose-100'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <TabletSmartphone size={13} className={safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'} />
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tab Switching</p>
                                                    </div>
                                                    <span className={`text-lg font-black tracking-tight ${
                                                        safe ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        {val}<span className="text-slate-300 font-bold">/{max}</span>
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${
                                                            safe ? 'bg-emerald-400' : warn ? 'bg-amber-400' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${pctV}%` }}
                                                    />
                                                </div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${
                                                    safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'
                                                }`}>
                                                    {safe ? 'No violations' : warn ? `Warning — ${max - val} remaining` : 'Limit reached'}
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {/* Fullscreen Exits */}
                                    {(() => {
                                        const val   = result.violations.fullscreenExits ?? 0;
                                        const max   = 3;
                                        const pctV  = Math.min((val / max) * 100, 100);
                                        const safe  = val === 0;
                                        const warn  = val > 0 && val < max;
                                        const danger = val >= max;
                                        return (
                                            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 ${
                                                safe   ? 'bg-emerald-50/40 border-emerald-100'
                                                : warn  ? 'bg-amber-50/50  border-amber-100'
                                                : 'bg-rose-50/50    border-rose-100'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Maximize2 size={13} className={safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'} />
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fullscreen Exit</p>
                                                    </div>
                                                    <span className={`text-lg font-black tracking-tight ${
                                                        safe ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        {val}<span className="text-slate-300 font-bold">/{max}</span>
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${
                                                            safe ? 'bg-emerald-400' : warn ? 'bg-amber-400' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${pctV}%` }}
                                                    />
                                                </div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${
                                                    safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'
                                                }`}>
                                                    {safe ? 'No violations' : warn ? `Warning — ${max - val} remaining` : 'Limit reached'}
                                                </p>
                                            </div>
                                        );
                                    })()}

                                    {/* Camera Violations */}
                                    {result.examId?.proctoring?.camera && (() => {
                                        const val   = result.violations.aiViolations ?? 0;
                                        const max   = 3;
                                        const pctV  = Math.min((val / max) * 100, 100);
                                        const safe  = val === 0;
                                        const warn  = val > 0 && val < max;
                                        const danger = val >= max;
                                        return (
                                            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-3 ${
                                                safe   ? 'bg-emerald-50/40 border-emerald-100'
                                                : warn  ? 'bg-amber-50/50  border-amber-100'
                                                : 'bg-rose-50/50    border-rose-100'
                                            }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Video size={13} className={safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'} />
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Camera Off/Missing</p>
                                                    </div>
                                                    <span className={`text-lg font-black tracking-tight ${
                                                        safe ? 'text-emerald-600' : warn ? 'text-amber-600' : 'text-rose-600'
                                                    }`}>
                                                        {val}<span className="text-slate-300 font-bold">/{max}</span>
                                                    </span>
                                                </div>
                                                {/* Progress bar */}
                                                <div className="w-full h-2 bg-white/70 rounded-full overflow-hidden border border-slate-100 shadow-inner">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${
                                                            safe ? 'bg-emerald-400' : warn ? 'bg-amber-400' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${pctV}%` }}
                                                    />
                                                </div>
                                                <p className={`text-[8px] font-black uppercase tracking-widest ${
                                                    safe ? 'text-emerald-500' : warn ? 'text-amber-500' : 'text-rose-500'
                                                }`}>
                                                    {safe ? 'No violations' : warn ? `Warning — ${max - val} remaining` : 'Limit reached'}
                                                </p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* ── Script Execution Review ───────────────────── */}
                        <div className="space-y-6">
                            {/* Section header */}
                            <div className="flex items-center gap-4 mb-8">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                    <Terminal size={16} className="text-blue-500" /> Script Execution Review
                                </h4>
                                <div className="h-0.5 flex-1 bg-slate-200/50 rounded-full" />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {(result.examId?.questions || []).map((question, idx) => {
                                    const ans = result.answers?.find(a =>
                                        (a.questionId?._id || a.questionId) === question._id ||
                                        (a.questionId?._id || a.questionId) === question._id?.toString()
                                    );

                                    const isCorrect = ans
                                        ? (question.type === 'Coding'
                                            ? (ans.codingResults?.testCasesPassed === ans.codingResults?.totalTestCases &&
                                               ans.codingResults?.totalTestCases > 0)
                                            : (ans.isCorrect !== undefined
                                                ? ans.isCorrect
                                                : ans.selectedOption === question.correctAnswer))
                                        : false;

                                    const status = !ans ? 'NOT ATTENDED' : isCorrect ? 'SUCCESS' : 'FAILED';

                                    return (
                                        <div
                                            key={idx}
                                            className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 border border-slate-100 shadow-sm transition-all group overflow-hidden relative"
                                        >
                                            {/* Left colour stripe */}
                                            <div className={`absolute top-0 left-0 w-1.5 h-full ${
                                                !ans ? 'bg-slate-300' : isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                                            }`} />

                                            {/* Question row */}
                                            <div className="flex justify-between items-start gap-4 mb-4">
                                                <p className="font-bold text-slate-800 text-base leading-snug tracking-tight pl-2">
                                                    {question.questionText}
                                                </p>
                                                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shrink-0 ${
                                                    !ans
                                                        ? 'bg-slate-50 text-slate-400 border-slate-200'
                                                        : isCorrect
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : 'bg-rose-50 text-rose-500 border-rose-100'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>

                                            {/* ── Coding question ─────────────────────── */}
                                            {question.type === 'Coding' ? (
                                                <div className="space-y-4 mt-4">
                                                    {/* Accuracy + Logic Score */}
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                            <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                                Execution Accuracy
                                                            </p>
                                                            <p className="text-sm font-black text-slate-800">
                                                                {ans?.codingResults?.testCasesPassed || 0}
                                                                {' / '}
                                                                {ans?.codingResults?.totalTestCases || question.codingMetadata?.testCases?.length || 1}
                                                                <span className="ml-2 text-[9px] text-slate-400 font-bold">Passed</span>
                                                            </p>
                                                        </div>
                                                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/30">
                                                            <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">
                                                                Logic Fidelity Score
                                                            </p>
                                                            <p className="text-sm font-black text-blue-600">
                                                                {Math.max(
                                                                    ans?.codingResults?.aiFeedback?.logicScore || 0,
                                                                    Math.round(
                                                                        ((ans?.codingResults?.testCasesPassed || 0) /
                                                                         (ans?.codingResults?.totalTestCases || 1)) * 100
                                                                    )
                                                                )}%
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* AI Synthesis Feedback */}
                                                    <div className="p-4 bg-emerald-50/30 rounded-xl border border-emerald-100/30 relative overflow-hidden">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <p className="text-[7px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                                <Sparkles size={10} /> AI Synthesis Feedback
                                                            </p>
                                                            <span className="text-[6px] font-black text-emerald-400 uppercase tracking-widest">Real-time Analysis</span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                                                                {ans?.codingResults?.aiFeedback?.suggestions ||
                                                                    'The logic was evaluated based on execution performance. No critical syntax errors were detected during synthesis.'}
                                                            </p>
                                                            <div className="flex gap-4 pt-1 border-t border-emerald-100/50">
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                    Quality Index: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.quality || 'Standard'}</span>
                                                                </p>
                                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                                                    Logic Flow: <span className="text-emerald-600">{ans?.codingResults?.aiFeedback?.complexity || 'Linear'}</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Dark code terminal */}
                                                    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-[#0f0f1a] shadow-inner">
                                                        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-white/5">
                                                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                                                                Script Submission Protocol ({ans?.language?.toUpperCase() || 'SCRIPT'})
                                                            </p>
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
                                                /* ── MCQ / Short-answer question ────────── */
                                                <div className="space-y-3 pl-2">
                                                    <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                                            Candidate Selection
                                                        </p>
                                                        <p className={`text-xs font-black ${
                                                            !ans ? 'text-slate-400'
                                                                : isCorrect ? 'text-emerald-600' : 'text-rose-500'
                                                        }`}>
                                                            {ans ? (ans.selectedOption || 'Null') : 'NO RESPONSE'}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 bg-blue-50/30 rounded-xl border border-blue-100/30">
                                                        <p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1">
                                                            Validated Logic (Correct Key)
                                                        </p>
                                                        <p className="text-xs font-black text-blue-600">
                                                            {ans?.questionId?.correctAnswer || question.correctAnswer || 'N/A'}
                                                        </p>
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
        </div>
    );
};

export default ResultPage;
