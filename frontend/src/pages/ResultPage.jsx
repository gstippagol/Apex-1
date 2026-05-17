import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { 
    Trophy, ArrowLeft, CheckCircle, XCircle, 
    AlertCircle, BarChart, Terminal, Code,
    Award, Check, X
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import Navbar from '../components/Navbar';

ChartJS.register(ArcElement, Tooltip, Legend);

const ResultPage = () => {
    const { id } = useParams();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const API_BASE = `http://${window.location.hostname}:5000`;

    useEffect(() => {
        const fetchResult = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/results/${id}`);
                setResult(res.data.data);
                setLoading(false);
            } catch (err) {
                console.error('Fetch error:', err);
                setLoading(false);
            }
        };
        fetchResult();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-black text-blue-600 animate-pulse text-2xl uppercase tracking-tighter">Synchronizing Report...</div>;
    if (!result) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">Report logic compromised or data missing</div>;

    const percentage = Math.round((result.score / (result.totalMarks || result.totalQuestions)) * 100);
    
    const chartData = {
        labels: ['Correct', 'Incorrect'],
        datasets: [
            {
                data: [result.score, (result.totalMarks || result.totalQuestions) - result.score],
                backgroundColor: ['#10b981', '#ef4444'],
                borderWidth: 0,
            },
        ],
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <div className="max-w-5xl mx-auto px-6 py-12">
                <Link to="/student" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-8 font-black text-xs uppercase tracking-widest transition-colors">
                    <ArrowLeft size={18} /> Back to Dashboard
                </Link>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100"
                >
                    {/* Header Summary */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-12 text-center text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 10 }}
                        >
                            <Trophy size={64} className="mx-auto mb-6 text-white" />
                        </motion.div>
                        <h1 className="text-4xl font-black mb-2 tracking-tight">Performance Deciphered!</h1>
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-blue-100 text-lg font-medium opacity-80">You completed <b>{result.examId?.title}</b></p>
                            <span className={`px-10 py-3 rounded-full text-sm font-black uppercase tracking-[0.3em] shadow-2xl transition-all ${result.score >= (result.examId?.passingMarks || 0) ? 'bg-emerald-500 text-white shadow-emerald-500/40 ring-4 ring-emerald-500/20' : 'bg-rose-500 text-white shadow-rose-500/40 ring-4 ring-rose-500/20'}`}>
                                {result.score >= (result.examId?.passingMarks || 0) ? 'STATUS: PASS' : 'STATUS: FAIL'}
                            </span>
                        </div>
                    </div>

                    <div className="p-8 md:p-14">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                            {/* Stats */}
                            <div className="space-y-10">
                                <div>
                                    <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                        <BarChart size={14} /> Analytics Node
                                    </h2>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
                                            <p className="text-4xl font-black text-slate-900">{percentage}%</p>
                                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Accuracy</p>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
                                            <p className="text-4xl font-black text-slate-900">{result.score}/{result.totalMarks || result.totalQuestions}</p>
                                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Marks Obtained</p>
                                        </div>
                                        <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
                                            <p className="text-xl font-black text-blue-600">{result.userId?.usn || 'N/A'}</p>
                                            <p className="text-[10px] font-black text-slate-400 mt-2 uppercase tracking-widest">Register Number</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Proctoring Metrics</h3>
                                    <div className="flex flex-wrap gap-3">
                                        <div className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${result.violations.tabSwitches > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                            Tab Switches: {result.violations.tabSwitches}
                                        </div>
                                        <div className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${result.violations.fullscreenExits > 0 ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
                                            FS Exits: {result.violations.fullscreenExits}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="flex justify-center max-w-[280px] mx-auto p-4 bg-white rounded-full shadow-inner border border-slate-50">
                                <Pie data={chartData} options={{ maintainAspectRatio: true, plugins: { legend: { display: false } } }} />
                            </div>
                        </div>

                        {/* Detailed Answer Review */}
                        <div className="mt-20 pt-16 border-t border-slate-100">
                            <div className="flex items-center gap-4 mb-10">
                                <Terminal size={24} className="text-blue-600" />
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Script Execution Review</h2>
                            </div>
                            
                            <div className="space-y-10">
                                {result.examId?.questions?.map((question, idx) => {
                                    const ans = result.answers.find(a => 
                                        (a.questionId?._id || a.questionId) === question._id || 
                                        (a.questionId?._id || a.questionId) === question._id.toString()
                                    );

                                    if (!ans) {
                                        return (
                                            <div key={idx} className="p-10 rounded-[3rem] border bg-slate-50/50 border-slate-100">
                                                <div className="flex items-start gap-6">
                                                    <div className="mt-1.5 p-1 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                                                        <XCircle className="text-slate-300" size={24} strokeWidth={2.5} />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-start justify-between mb-8 gap-4">
                                                            <p className="text-xl font-black text-slate-800 leading-tight">{question.questionText}</p>
                                                            <div className="shrink-0 px-4 py-2 bg-slate-200/50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
                                                                Not Attended
                                                            </div>
                                                        </div>
                                                        
                                                        {question.type !== 'Coding' && (
                                                            <div className="p-6 bg-white rounded-2xl border border-slate-100 flex flex-col justify-center">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Correct Key</p>
                                                                <p className="text-lg font-bold text-slate-700">{question.correctAnswer || "Not specified"}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const isCorrectAns = question.type === 'Coding' 
                                        ? (ans.codingResults?.testCasesPassed === ans.codingResults?.totalTestCases && ans.codingResults?.totalTestCases > 0)
                                        : ans.isCorrect;

                                    return (
                                        <div key={idx} className={`p-10 rounded-[3rem] border transition-all ${isCorrectAns ? 'bg-emerald-50/20 border-emerald-100' : 'bg-rose-50/20 border-rose-100'}`}>
                                            <div className="flex items-start gap-6">
                                                <div className="mt-1.5 p-2 rounded-xl bg-white shadow-sm border border-slate-100">
                                                    {isCorrectAns ? <CheckCircle className="text-emerald-500" size={28} /> : <XCircle className="text-rose-500" size={28} />}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xl font-black text-slate-800 mb-8 leading-tight">{ans.questionId?.questionText || question.questionText}</p>
                                                    
                                                    {ans.code ? (
                                                        <div className="space-y-6">
                                                            <div className="relative group">
                                                                <div className="absolute top-4 right-4 text-[10px] font-black text-blue-400 bg-slate-800 px-3 py-1 rounded-full uppercase tracking-widest border border-slate-700 z-10">{ans.language}</div>
                                                                <div className="bg-slate-900 rounded-[2rem] p-8 font-mono text-sm text-blue-300 shadow-2xl border border-slate-800 overflow-x-auto">
                                                                    <pre><code>{ans.code}</code></pre>
                                                                </div>
                                                            </div>

                                                            {ans.codingResults && (
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                                    <div className="md:col-span-2 p-8 bg-white/60 rounded-[2rem] border border-slate-200">
                                                                        <div className="flex items-center justify-between mb-6">
                                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Test Battery Validation</div>
                                                                            <div className="flex items-center gap-4">
                                                                                <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-widest"><Check size={14}/> {ans.codingResults.testCasesPassed} Pass</span>
                                                                                <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest"><X size={14}/> {ans.codingResults.totalTestCases - ans.codingResults.testCasesPassed} Fail</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-6 shadow-inner">
                                                                            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(ans.codingResults.testCasesPassed/ans.codingResults.totalTestCases)*100}%` }} />
                                                                        </div>
                                                                        <p className="text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Aggregate Efficiency: {Math.round((ans.codingResults.testCasesPassed/ans.codingResults.totalTestCases)*100)}%</p>
                                                                    </div>

                                                                    {ans.codingResults.aiFeedback && (
                                                                        <div className="p-8 bg-blue-600 text-white rounded-[2rem] shadow-xl shadow-blue-600/20 relative overflow-hidden group">
                                                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform"><Award size={48} /></div>
                                                                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">AI Diagnostic</h4>
                                                                            <div className="space-y-3">
                                                                                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                                                                    <span className="text-[10px] font-bold opacity-60">Logic Score</span>
                                                                                    <span className="text-sm font-black">{ans.codingResults.aiFeedback.logicScore}%</span>
                                                                                </div>
                                                                                <p className="text-xs font-medium leading-relaxed italic opacity-90 line-clamp-3">
                                                                                    "{ans.codingResults.aiFeedback.suggestions}"
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div className="p-6 bg-white/50 rounded-2xl border border-slate-200">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">User Registry Selection</p>
                                                                <p className={`text-lg font-bold ${isCorrectAns ? 'text-emerald-600' : 'text-rose-600'}`}>{ans.selectedOption}</p>
                                                            </div>
                                                            {!isCorrectAns && (
                                                                <div className="p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex flex-col justify-center">
                                                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Validated Protocol Key</p>
                                                                    <p className="text-lg font-bold text-emerald-700">{ans.questionId?.correctAnswer || question.correctAnswer}</p>
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
        </div>
    );
};

export default ResultPage;
