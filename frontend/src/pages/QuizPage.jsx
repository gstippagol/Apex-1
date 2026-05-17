import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Maximize2, Monitor, Rocket, Camera, Mic, CameraOff, MicOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Components
import Timer from '../components/exam/Timer';
import QuestionCard from '../components/exam/QuestionCard';
import SubmitConfirmation from '../components/exam/SubmitConfirmation';
import WebcamMonitor from '../components/exam/WebcamMonitor';

const QuizPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const API_BASE = (window.location.hostname.includes('loca.lt') || window.location.hostname.includes('trycloudflare.com'))
        ? 'https://green-ears-first-donated.trycloudflare.com'
        : `http://${window.location.hostname}:5000`;

    const VIOLATION_LIMIT = 3;

    // Quiz Data
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);

    // Quiz Progress State
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);
    const [quizResult, setQuizResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasTriggeredLimit = useRef(false);

    // Proctoring & UI State
    const [backButtonHits, setBackButtonHits] = useState(0);
    const [tabSwitches, setTabSwitches] = useState(0);
    const [fullscreenExits, setFullscreenExits] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mediaStatus, setMediaStatus] = useState('pending'); // pending, granted, denied
    const [showPermissionGate, setShowPermissionGate] = useState(true);
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

    if (isMobile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6 text-center">
                <div className="bg-gray-800 p-8 rounded-xl shadow-2xl max-w-md">
                    <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Desktop Required</h1>
                    <p className="text-gray-400">This assessment requires a desktop device to ensure proctoring integrity and security protocols.</p>
                </div>
            </div>
        );
    }

    const submitQuiz = useCallback(async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const formattedAnswers = quiz.questions.map(q => {
                const ans = answers[q._id];
                if (!ans) return null;

                let isCorrect = false;
                if (q.type === 'Coding') {
                    if (ans.codingResults) {
                        isCorrect = ans.codingResults.testCasesPassed === ans.codingResults.totalTestCases;
                    }
                } else {
                    isCorrect = ans === q.correctAnswer;
                }

                return typeof ans === 'object'
                    ? { questionId: q._id, ...ans, isCorrect }
                    : { questionId: q._id, selectedOption: ans, isCorrect };
            }).filter(a => a !== null);

            const totalMarks = quiz.questions.reduce((acc, q) => acc + (q.marks || 1), 0);
            const totalQuestions = quiz.questions.length;
            
            let score = 0;
            quiz.questions.forEach(q => {
                const ans = answers[q._id];
                if (ans) {
                    if (q.type === 'Coding') {
                        if (ans.codingResults) {
                            const ratio = ans.codingResults.testCasesPassed / ans.codingResults.totalTestCases;
                            score += (q.marks || 1) * (ratio || 0);
                        }
                    } else {
                        if (ans === q.correctAnswer) {
                            score += (q.marks || 1);
                        }
                    }
                }
            });

            const res = await axios.post(`${API_BASE}/api/quiz/submit`, {
                quizId: id,
                answers: formattedAnswers,
                score,
                totalMarks,
                totalQuestions,
                timeTaken: quiz.duration - timeLeft,
                violations: { tabSwitches, fullscreenExits }
            });

            if (res.data.success) {
                setQuizResult(res.data.data);
                toast.success('Quiz submitted successfully!');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Submission failed');
        }
    }, [answers, id, quiz, timeLeft, API_BASE, tabSwitches, fullscreenExits]);

    const handleJump = (idx) => {
        if (!quiz?.questions?.[idx]) return;
        setCurrentIdx(idx);
    };

    const enterFullscreen = () => {
        document.documentElement.requestFullscreen().catch(() => {
            toast.error('Failed to enter fullscreen');
        });
    };

    // Permission Check
    const requestPermissions = async () => {
        try {
            const constraints = {
                video: quiz?.proctoring?.camera || false,
                audio: quiz?.proctoring?.microphone || false
            };

            if (constraints.video || constraints.audio) {
                await navigator.mediaDevices.getUserMedia(constraints);
            }
            setMediaStatus('granted');
            setShowPermissionGate(false);
            enterFullscreen();
        } catch (err) {
            console.error("Media access denied:", err);
            setMediaStatus('denied');
            toast.error("Camera/Mic access is REQUIRED to establish this protocol.");
        }
    };

    // Initial Fetch
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                // Check if already submitted
                const resultCheck = await axios.get(`${API_BASE}/api/quiz/results?quizId=${id}`);
                if (resultCheck.data.data && resultCheck.data.data.length > 0) {
                    toast.error('You have already submitted this quiz.');
                    navigate('/student');
                    return;
                }

                const res = await axios.get(`${API_BASE}/api/quiz/${id}`);
                const data = res.data.data;
                // Ensure proctoring and questions exist
                if (!data.proctoring) data.proctoring = { camera: false, microphone: false };
                if (!data.questions) data.questions = [];
                
                setQuiz(data);
                setTimeLeft(data.duration);
                setLoading(false);

                // If no proctoring and no restriction, we can bypass gate if we want, 
                // but user said "if i restriction is on all rules will be follow... if not off then normal full screen mode"
                // This implies full screen is ALWAYS needed.
            } catch (err) {
                toast.error('Failed to load quiz');
                navigate('/student');
            }
        };
        fetchQuiz();
    }, [id, API_BASE, navigate]);

    // Timer logic
    useEffect(() => {
        if (loading || !quiz || timeLeft <= 0 || showPermissionGate) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); submitQuiz(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, quiz, timeLeft, submitQuiz, showPermissionGate]);

    // Always track fullscreen state
    useEffect(() => {
        const handleFSChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFSChange);
        return () => document.removeEventListener('fullscreenchange', handleFSChange);
    }, []);

    // Restriction Protocols (Tab Switch, Fullscreen, etc.)
    useEffect(() => {
        if (loading || !quiz || showPermissionGate || quizResult || isSubmitting) return;
        const isStrict = quiz.isRestricted;
        const isFSOnly = quiz.fullscreenOnly;

        if (!isStrict && !isFSOnly) return;

        const handleVisibility = () => {
            if (document.hidden && quiz.isRestricted) {
                setTabSwitches(s => s + 1);
                toast.error('TAB SWITCH DETECTED! Warning: This event has been logged with a snapshot.', {
                    duration: 5000,
                    style: { backgroundColor: '#991b1b', color: '#fff', fontWeight: 'bold' }
                });
                // Snapshot trigger logic can be handled via socket or specific violation endpoint
            }
        };

        const handleFullscreenViolation = () => {
            if (!document.fullscreenElement && isStrict) {
                setFullscreenExits(e => e + 1);
                toast.error('FULLSCREEN EXITED! Re-enter immediately to continue the session.', {
                    duration: 5000,
                    style: { backgroundColor: '#000', color: '#fff', border: '2px solid #ef4444', fontWeight: 'bold' }
                });
            }
        };

        const handlePopState = () => {
            if (isStrict || isFSOnly) {
                window.history.pushState(null, null, window.location.pathname);
                
                if (isStrict) {
                    setTabSwitches(s => s + 1);
                    toast.error('CRITICAL VIOLATION: BACK BUTTON DETECTED! Session terminated.', {
                        duration: 5000,
                        style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
                    });
                    setTimeout(() => {
                        submitQuiz();
                    }, 1500);
                } else {
                    setBackButtonHits(prev => {
                        const next = prev + 1;
                        if (next >= 3) {
                            toast.error('MAXIMUM ATTEMPTS REACHED! Session terminated.', {
                                duration: 5000,
                                style: { background: '#000', color: '#fff', border: '2px solid #ef4444', fontWeight: '900' }
                            });
                            setTimeout(() => submitQuiz(), 1000);
                        } else {
                            toast.error(`SECURITY ALERT [${next}/3]: Back button is restricted. Please re-enter fullscreen.`, {
                                duration: 5000,
                                style: { background: '#7c2d12', color: '#fff', fontWeight: 'bold' }
                            });
                            setIsFullscreen(false); // Force re-entry
                        }
                        return next;
                    });
                }
            }
        };

        const handleKeyDown = (e) => {
            if (quiz.isRestricted) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setTabSwitches(s => s + 1);
                    toast.error('ESCAPE KEY DETECTED! This action is logged as a violation.', {
                        duration: 4000,
                        style: { background: '#7c2d12', color: '#fff', fontWeight: 'bold' }
                    });
                }
                if (e.key === 'PrintScreen' || e.key === 'Snapshot' || (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
                    setTabSwitches(s => s + 1);
                    // Attempt to clear clipboard to prevent screenshot retention
                    navigator.clipboard.writeText('').catch(() => {});
                    toast.error('SCREENSHOT ATTEMPT DETECTED! Security violation logged.', {
                        duration: 5000,
                        style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
                    });
                }
            }
        };

        const handleKeyUp = (e) => {
            if (quiz.isRestricted && (e.key === 'PrintScreen' || e.key === 'Snapshot')) {
                setTabSwitches(s => s + 1);
                navigator.clipboard.writeText('').catch(() => {});
                toast.error('SCREENSHOT ATTEMPT DETECTED! Security violation logged.', {
                    duration: 5000,
                    style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
                });
            }
        };

        const prevent = (e) => {
            if (quiz.isRestricted) e.preventDefault();
        };

        if (isStrict) {
            document.addEventListener('visibilitychange', handleVisibility);
            window.addEventListener('keydown', handleKeyDown);
            window.addEventListener('keyup', handleKeyUp);
            document.addEventListener('contextmenu', prevent);
            document.addEventListener('copy', prevent);
            document.addEventListener('paste', prevent);
            document.addEventListener('selectstart', prevent);
        }

        if (isStrict || isFSOnly) {
            window.history.pushState(null, null, window.location.pathname);
            window.addEventListener('popstate', handlePopState);
            document.addEventListener('fullscreenchange', handleFullscreenViolation);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('fullscreenchange', handleFullscreenViolation);
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('selectstart', prevent);
        };
    }, [loading, quiz, showPermissionGate, tabSwitches, fullscreenExits, submitQuiz]);

    // Violation Limit Enforcement
    useEffect(() => {
        if (!quiz?.isRestricted || hasTriggeredLimit.current) return;
        
        const total = tabSwitches + fullscreenExits;
        if (total >= VIOLATION_LIMIT) {
            hasTriggeredLimit.current = true;
            toast.error('VIOLATION LIMIT REACHED! Your session is being automatically submitted.', {
                duration: 5000,
                style: { background: '#000', color: '#fff', border: '3px solid #ef4444', fontWeight: '900' }
            });
            setTimeout(() => {
                submitQuiz();
            }, 1500);
        }
    }, [tabSwitches, fullscreenExits, quiz, submitQuiz]);

    if (isMobile) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f1a] text-center p-10 font-sans">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 border border-rose-500/20">
                <Monitor size={48} className="text-rose-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Desktop Required</h1>
            <p className="text-slate-400 font-bold max-w-md leading-relaxed">
                Security protocols for this assessment require a desktop or laptop environment. Mobile access is strictly prohibited.
            </p>
            <button 
                onClick={() => navigate('/student')}
                className="mt-10 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
            >
                Return to Dashboard
            </button>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] text-blue-400 font-bold text-lg">
            Synchronizing Quiz Terminal...
        </div>
    );

    const currentQuestion = quiz.questions?.[currentIdx] || null;
    const stats = {
        answered: Object.keys(answers).length,
        total: quiz.questions?.length || 0
    };

    const QSidebar = () => (
        <aside className="w-[58px] bg-[#13131f] border-r border-white/10 flex flex-col items-center py-4 gap-2 overflow-y-auto shrink-0">
            <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest mb-1">Q No.</span>
            {(quiz.questions || []).map((q, idx) => {
                const isAnswered = !!answers[q._id];
                const isCurrent = idx === currentIdx;
                return (
                    <button
                        key={q._id}
                        onClick={() => handleJump(idx)}
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                            isCurrent ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0f0f1a]' : ''
                        } ${
                            isAnswered ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-300' : 'bg-rose-100 text-rose-600 border-2 border-rose-300'
                        }`}
                    >
                        {idx + 1}
                    </button>
                );
            })}
        </aside>
    );

    if (showPermissionGate) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-4 sm:p-8 text-center font-sans overflow-y-auto">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#13131f] p-8 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] border border-white/10 shadow-2xl max-w-2xl w-full my-auto">
                    <div className="w-24 h-24 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Rocket size={48} />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight uppercase">Protocol Initialization</h2>
                    <p className="text-slate-400 font-bold mb-10 text-lg">This session requires administrative verification and environment locking.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
                        <div className={`p-6 rounded-3xl border transition-all ${quiz?.proctoring?.camera ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'}`}>
                            <Camera className={`mx-auto mb-3 ${quiz?.proctoring?.camera ? 'text-blue-500' : 'text-slate-600'}`} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Camera</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{quiz?.proctoring?.camera ? 'Required' : 'Not Required'}</p>
                        </div>
                        <div className={`p-6 rounded-3xl border transition-all ${quiz?.proctoring?.microphone ? 'bg-white/5 border-white/10' : 'bg-white/2 border-white/5 opacity-50'}`}>
                            <Mic className={`mx-auto mb-3 ${quiz?.proctoring?.microphone ? 'text-blue-500' : 'text-slate-600'}`} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">Microphone</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">{quiz?.proctoring?.microphone ? 'Required' : 'Not Required'}</p>
                        </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 mb-10 text-left">
                        <div className="flex items-start gap-4">
                            <ShieldAlert className="text-amber-500 shrink-0" size={24} />
                            <div>
                                <h4 className="text-amber-500 font-black text-[10px] uppercase tracking-widest mb-1">Session Integrity Rules</h4>
                                <p className="text-slate-400 text-[9px] font-bold uppercase leading-relaxed">
                                    • {quiz.isRestricted ? 'Full protocol enforcement: No tab switching or browser exits allowed.' : 'Normal protocol: Fullscreen mode is required throughout the session.'}<br />
                                    • Navigation is locked. Do not attempt to use the back button.<br />
                                    • Ensure your environment is clear of any unauthorized aids.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={requestPermissions}
                        className="w-full py-6 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs hover:bg-blue-700 transition-all active:scale-95 shadow-xl shadow-blue-600/20"
                    >
                        Establish Secure Connection
                    </button>
                    {mediaStatus === 'denied' && (
                        <p className="mt-6 text-rose-500 font-black text-[10px] uppercase animate-pulse">Permissions Refused. Access to protocol is locked.</p>
                    )}
                </motion.div>
            </div>
        );
    }

    if (quizResult) {
        return (
            <div className="min-h-screen bg-[#0f0f1a] flex flex-col items-center justify-center p-8 font-sans">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[#13131f] p-12 rounded-[3.5rem] border border-white/10 shadow-2xl max-w-xl w-full text-center">
                    <div className="w-24 h-24 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Rocket size={48} />
                    </div>
                    <h2 className="text-4xl font-black text-white mb-2 tracking-tight">Quiz Complete</h2>
                    <p className="text-slate-400 font-bold mb-12 uppercase tracking-[0.25em] text-[10px]">Your performance has been securely logged</p>

                    <button 
                        onClick={() => navigate('/student')}
                        className="w-full py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
                    >
                        Return to Dashboard
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-[#0f0f1a] flex flex-col font-sans overflow-hidden fixed inset-0">
            {/* Header */}
            <header className="h-14 bg-[#13131f] border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Rocket size={18} className="text-blue-500" />
                        <h1 className="text-sm font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent uppercase tracking-wider">
                            {quiz.title}
                        </h1>
                    </div>
                    <div className="w-[1px] h-5 bg-white/10" />
                    <div className="flex items-center gap-6">
                        {quiz.isRestricted && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <ShieldAlert size={12} className={tabSwitches + fullscreenExits > 0 ? 'text-rose-500' : 'text-slate-500'} />
                                Violations: <span className={tabSwitches + fullscreenExits > 0 ? 'text-rose-500' : 'text-emerald-500'}>{tabSwitches + fullscreenExits}/{VIOLATION_LIMIT}</span>
                            </div>
                        )}
                        <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {quiz.isRestricted ? 'Strict Protocol' : quiz.fullscreenOnly ? 'Immersive Mode' : 'Standard Mode'}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[11px] font-bold text-slate-400">
                        {stats.answered}<span className="text-slate-600">/{stats.total}</span> Answered
                    </div>
                    <Timer timeLeft={timeLeft} />
                    <button
                        onClick={() => setShowSubmitModal(true)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                    >
                        Finish Quiz
                    </button>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 flex overflow-hidden relative">
                <QSidebar />
                <div className="flex-1 overflow-hidden flex flex-col">
                    <QuestionCard
                        question={currentQuestion}
                        index={currentIdx}
                        totalQuestions={quiz?.questions?.length || 0}
                        selectedAnswer={currentQuestion ? answers[currentQuestion._id] : null}
                        onSelect={(val) => currentQuestion && setAnswers({ ...answers, [currentQuestion._id]: val })}
                        onPrev={() => handleJump(Math.max(0, currentIdx - 1))}
                        onNext={() => handleJump(Math.min((quiz?.questions?.length || 1) - 1, currentIdx + 1))}
                        isFirst={currentIdx === 0}
                        isLast={currentIdx === (quiz?.questions?.length || 1) - 1}
                    />
                </div>

                {/* Webcam Monitor if enabled */}
                {(quiz?.proctoring?.camera || quiz?.proctoring?.microphone) && (
                    <div className="absolute top-4 right-4 w-40 z-50">
                        <WebcamMonitor
                            allowCamera={quiz?.proctoring?.camera}
                            allowMicrophone={quiz?.proctoring?.microphone}
                            onStatusChange={(status) => setMediaStatus(status)}
                            triggerSnapshotOnFocusLoss={quiz?.isRestricted}
                        />
                    </div>
                )}
            </main>

            {/* Fullscreen Gate */}
            {!isFullscreen && !showPermissionGate && (quiz?.isRestricted || quiz?.fullscreenOnly) && (
                <div className="fixed inset-0 bg-[#0f0f1a]/95 z-[100] flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-full flex items-center justify-center mb-6">
                        <Maximize2 size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-3">Fullscreen Protocol Interrupted</h2>
                    <p className="text-slate-400 font-bold mb-8 max-w-sm">Academic integrity requires an immersive session environment. Re-establish fullscreen to proceed.</p>
                    <button 
                        onClick={enterFullscreen}
                        className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
                    >
                        Restore Session
                    </button>
                </div>
            )}

            {showSubmitModal && (
                <SubmitConfirmation
                    stats={stats}
                    onCancel={() => setShowSubmitModal(false)}
                    onConfirm={submitQuiz}
                />
            )}
        </div>
    );
};

export default QuizPage;
