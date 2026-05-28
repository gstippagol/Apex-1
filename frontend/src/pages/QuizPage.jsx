import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Maximize2, Monitor, Rocket, Camera, Mic, CameraOff, MicOff, AlertCircle, Shield, Lock, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';

// Components
import Timer from '../components/exam/Timer';
import QuestionCard from '../components/exam/QuestionCard';
import SubmitConfirmation from '../components/exam/SubmitConfirmation';
import WebcamMonitor from '../components/exam/WebcamMonitor';
import LoadingScreen from '../components/LoadingScreen';

const QuizPage = () => {
        const { id } = useParams();
    const navigate = useNavigate();
    const hasSubmittedRef = useRef(false);
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

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
    const [hasAcceptedProtocols, setHasAcceptedProtocols] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
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

        const submitQuiz = useCallback(async (isAutoSubmit = false) => {
        if (hasSubmittedRef.current) return;
        hasSubmittedRef.current = true;
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
                violations: { tabSwitches, fullscreenExits },
                submissionType: isAutoSubmit ? 'Auto' : 'Normal'
            });

            if (res.data.success) {
                setQuizResult(res.data.data);
                toast.success('Quiz submitted successfully!');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Submission failed';
            toast.error(errorMsg);
            
            if (errorMsg === 'You have already submitted this assessment.') {
                navigate('/student');
            } else {
                hasSubmittedRef.current = false;
                setIsSubmitting(false);
            }
        }
    }, [answers, id, quiz, timeLeft, API_BASE, tabSwitches, fullscreenExits, navigate]);

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

    // Socket Connection
    const [socket, setSocket] = useState(null);
    useEffect(() => {
        const saved = localStorage.getItem('user');
        if (!saved) return;
        const user = JSON.parse(saved);

        const socketUrl = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? `http://${window.location.hostname}:5000`
            : 'https://apex-s1q2.onrender.com';

        const s = io(socketUrl, {
            reconnectionAttempts: 5,
            reconnectionDelay: 5000,
        });
        setSocket(s);

        s.on('connect', () => {
            console.log("Quiz Session Socket Connected");
            s.emit('join-exam', { examId: id, userId: user.id || user._id, role: 'student' });
        });

        s.on('admin-message', (data) => {
            toast(data.message, {
                duration: 5000,
                position: 'top-right',
                icon: '💬',
                style: {
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #3b82f6',
                    fontWeight: 'bold'
                }
            });
        });

        return () => s.disconnect();
    }, [id]);

    // Initial Fetch
    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                // Check if already submitted
                const resultCheck = await axios.get(`${API_BASE}/api/quiz/results?quizId=${id}`);
                if (resultCheck.data.data && resultCheck.data.data.length > 0) {
                    if (localStorage.getItem(`quiz_auto_submitted_${id}`)) {
                        toast.error('Refreshing detected. Auto-submitting assessment.', { id: 'quiz-auto-submitted', duration: 6000 });
                        localStorage.removeItem(`quiz_auto_submitted_${id}`);
                    } else {
                        toast.error('You have already submitted this assessment.', { id: 'quiz-already-submitted' });
                    }
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
        if (loading || !quiz || timeLeft <= 0 || !isFullscreen || !hasAcceptedProtocols) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); submitQuiz(true); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, quiz, timeLeft, submitQuiz, isFullscreen, hasAcceptedProtocols]);

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
        if (loading || !quiz || !isFullscreen || !hasAcceptedProtocols || quizResult || isSubmitting) return;
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
            document.addEventListener('fullscreenchange', handleFullscreenViolation);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('fullscreenchange', handleFullscreenViolation);
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('selectstart', prevent);
        };
    }, [loading, quiz, isFullscreen, hasAcceptedProtocols, tabSwitches, fullscreenExits, submitQuiz, quizResult, isSubmitting]);

    // Refs to store the latest values for unmount/exit submission to avoid useEffect dependency triggers
    const answersRef = useRef(answers);
    const quizRef = useRef(quiz);
    const tabSwitchesRef = useRef(tabSwitches);
    const fullscreenExitsRef = useRef(fullscreenExits);
    const timeLeftRef = useRef(timeLeft);
    const hasEnteredFullscreenRef = useRef(false);
    useEffect(() => {
        if (isFullscreen) {
            hasEnteredFullscreenRef.current = true;
        }
    }, [isFullscreen]);

    const submitQuizRef = useRef(submitQuiz);
    useEffect(() => { submitQuizRef.current = submitQuiz; }, [submitQuiz]);
    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { quizRef.current = quiz; }, [quiz]);
    useEffect(() => { tabSwitchesRef.current = tabSwitches; }, [tabSwitches]);
    useEffect(() => { fullscreenExitsRef.current = fullscreenExits; }, [fullscreenExits]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

    // Component Unmount (True Client-Side Page Leaves) for Quiz
    useEffect(() => {
        const getPayload = () => {
            const currentQuiz = quizRef.current;
            if (!currentQuiz) return null;

            const formattedAnswers = currentQuiz.questions.map(q => {
                const ans = answersRef.current[q._id];
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

            const totalMarks = currentQuiz.questions.reduce((acc, q) => acc + (q.marks || 1), 0);
            const totalQuestions = currentQuiz.questions.length;
            
            let score = 0;
            currentQuiz.questions.forEach(q => {
                const ans = answersRef.current[q._id];
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

            return {
                quizId: id,
                answers: formattedAnswers,
                score,
                totalMarks,
                totalQuestions,
                timeTaken: currentQuiz.duration - timeLeftRef.current,
                violations: { tabSwitches: tabSwitchesRef.current, fullscreenExits: fullscreenExitsRef.current }
            };
        };

        return () => {
            if (!hasSubmittedRef.current && hasEnteredFullscreenRef.current) {
                const payload = getPayload();
                if (!payload) return;
                hasSubmittedRef.current = true;
                fetch(`${API_BASE}/api/quiz/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                });
            }
        };
    }, [id, API_BASE]);

    // Active Proctoring Navigation & Unload Lock Listeners for Quiz
    useEffect(() => {
        if (loading || !quiz || !hasAcceptedProtocols || quizResult || isSubmitting) return;

        window.history.pushState(null, null, window.location.pathname);

        const handlePopState = () => {
            window.history.pushState(null, null, window.location.pathname);
            toast.error('BACK BUTTON DETECTED! Security protocol activated. Auto-submitting quiz for security integrity...', {
                duration: 5000,
                style: { background: '#991b1b', color: '#fff', fontWeight: 'bold' }
            });
            setTimeout(() => {
                submitQuizRef.current(true);
            }, 1000);
        };

        const handleBeforeUnload = (e) => {
            const msg = "Are you sure you want to exit? Your quiz session will be terminated and auto-submitted.";
            e.preventDefault();
            e.returnValue = msg;
            return msg;
        };

        const getPayload = () => {
            const currentQuiz = quizRef.current;
            if (!currentQuiz) return null;

            const formattedAnswers = currentQuiz.questions.map(q => {
                const ans = answersRef.current[q._id];
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

            const totalMarks = currentQuiz.questions.reduce((acc, q) => acc + (q.marks || 1), 0);
            const totalQuestions = currentQuiz.questions.length;
            
            let score = 0;
            currentQuiz.questions.forEach(q => {
                const ans = answersRef.current[q._id];
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

            return {
                quizId: id,
                answers: formattedAnswers,
                score,
                totalMarks,
                totalQuestions,
                timeTaken: currentQuiz.duration - timeLeftRef.current,
                violations: { tabSwitches: tabSwitchesRef.current, fullscreenExits: fullscreenExitsRef.current },
                submissionType: 'Auto'
            };
        };

        const handleUnload = () => {
            if (!hasSubmittedRef.current && hasEnteredFullscreenRef.current) {
                const payload = getPayload();
                if (!payload) return;
                hasSubmittedRef.current = true;
                fetch(`${API_BASE}/api/quiz/submit`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                });
                localStorage.setItem(`quiz_auto_submitted_${id}`, 'true');
            }
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('unload', handleUnload);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('unload', handleUnload);
        };
    }, [id, API_BASE, loading, quiz, hasAcceptedProtocols, quizResult, isSubmitting]);

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
                submitQuiz(true);
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
        <LoadingScreen message="Synchronizing Quiz Terminal..." dark={true} fullScreen={true} />
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

    if (!hasAcceptedProtocols) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: '#0f0f1a',
                zIndex: 101, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: '24px',
                overflowY: 'auto'
            }}>
                <div style={{
                    background: '#131325',
                    border: '1px solid rgba(96,165,250,0.15)',
                    borderRadius: '2rem',
                    padding: '2.5rem',
                    maxWidth: '650px',
                    width: '100%',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px'
                }}>
                    {/* Header Lock Badge */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', border: '1px solid rgba(96,165,250,0.2)' }}>
                            <Shield size={32} style={{ color: '#60a5fa' }} />
                        </div>
                        <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: '900', letterSpacing: '-0.02em', textTransform: 'uppercase', margin: 0 }}>Assessment Protocols</h2>
                        <p style={{ color: '#64748b', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0 }}>APEX SECURE ASSESSMENT TERMINAL</p>
                    </div>

                    {/* Rules List Container */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', background: 'rgba(255,255,255,0.02)', borderRadius: '1.5rem', padding: '1.5rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                        
                        {/* Strict Tab Detention */}
                        {quiz?.isRestricted && (
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }}><ShieldAlert size={16} /></div>
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Strict Tab Detention</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>Leaving this browser window, switching tabs, or clicking outside will immediately log a secure protocol violation.</p>
                                </div>
                            </div>
                        )}

                        {/* Screen Capture Blocking */}
                        {quiz?.isRestricted && (
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0 }}><Monitor size={16} /></div>
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Screen Capture Blocking</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>PrintScreen keys, Win+Shift+S snipping tools, and record utilities are strictly disabled. Any capture attempt records a violation.</p>
                                </div>
                            </div>
                        )}

                        {/* Fullscreen Immersive Mode */}
                        {quiz?.fullscreenOnly && !quiz?.isRestricted && (
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0 }}><Maximize2 size={16} /></div>
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Fullscreen Immersive Mode</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>This assessment requires fullscreen mode to remain active throughout the session to prevent distractions.</p>
                                </div>
                            </div>
                        )}

                        {/* Webcam Monitoring */}
                        {quiz?.proctoring?.camera && (
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }}><Video size={16} /></div>
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Webcam Monitoring</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>Continuous real-time proctoring tracks presence. Absence, secondary faces, or external lookaways will register flags.</p>
                                </div>
                            </div>
                        )}

                        {/* Audio Monitoring */}
                        {quiz?.proctoring?.microphone && (
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                <div style={{ color: '#ec4899', marginTop: '2px', flexShrink: 0 }}><Mic size={16} /></div>
                                <div>
                                    <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Audio Monitoring</h4>
                                    <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>Continuous real-time audio analysis tracks sound in your environment. Excessive speech or voice activity will register flags.</p>
                                </div>
                            </div>
                        )}

                        {/* Auto-Submission Action */}
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                            <div style={{ color: '#818cf8', marginTop: '2px', flexShrink: 0 }}><Lock size={16} /></div>
                            <div>
                                <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Auto-Submission Action</h4>
                                <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>
                                    {quiz?.isRestricted 
                                        ? 'Reaching 3 total violations, attempting back button navigation, page refresh, or closing the tab triggers auto-submission.'
                                        : 'Attempting back button navigation, page refresh, or closing the active assessment tab triggers auto-submission.'
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Checkbox agreement */}
                    <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer', userSelect: 'none' }}>
                        <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={(e) => setIsChecked(e.target.checked)}
                            style={{
                                marginTop: '3px',
                                width: '16px',
                                height: '16px',
                                accentColor: '#2563eb',
                                cursor: 'pointer'
                            }}
                        />
                        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600', lineHeight: '1.4' }}>
                            I agree to honor quiz integrity, confirm my testing environment is silent and compliant, and consent to dynamic webcam and activity proctoring.
                        </span>
                    </label>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                        <button
                            onClick={() => navigate('/student')}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                color: '#94a3b8',
                                padding: '14px 20px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        >
                            Cancel & Exit
                        </button>
                        <button
                            disabled={!isChecked}
                            onClick={() => setHasAcceptedProtocols(true)}
                            style={{
                                flex: 1,
                                background: isChecked ? '#2563eb' : '#1e1b4b',
                                border: 'none',
                                color: isChecked ? '#fff' : '#475569',
                                padding: '14px 20px',
                                borderRadius: '12px',
                                fontWeight: '800',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                cursor: isChecked ? 'pointer' : 'not-allowed',
                                transition: 'all 0.15s',
                                boxShadow: isChecked ? '0 4px 14px rgba(37,99,235,0.35)' : 'none'
                            }}
                            onMouseEnter={e => { if (isChecked) e.currentTarget.style.background = '#1d4ed8'; }}
                            onMouseLeave={e => { if (isChecked) e.currentTarget.style.background = '#2563eb'; }}
                        >
                            Agree & Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (hasAcceptedProtocols && !isFullscreen) {
        return (
            <div style={{
                position: 'fixed', inset: 0, background: 'rgba(15,15,26,0.96)',
                zIndex: 100, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
                overflowY: 'auto'
            }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                    <Maximize2 size={36} style={{ color: '#60a5fa' }} />
                </div>
                <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>Fullscreen Required</h2>
                <p style={{ color: '#64748b', maxWidth: '400px', marginBottom: '32px', lineHeight: 1.6 }}>
                    This quiz requires fullscreen mode to ensure academic integrity.
                </p>
                <button
                    onClick={enterFullscreen}
                    style={{
                        background: '#2563eb', color: '#fff',
                        padding: '16px 40px', borderRadius: '14px',
                        fontWeight: '900', fontSize: '11px', border: 'none',
                        cursor: 'pointer', textTransform: 'uppercase',
                        letterSpacing: '0.08em', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                        transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                >
                    Enter Fullscreen
                </button>
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
                    <Timer timeLeft={timeLeft} onWarning={() => toast('Final 5 minutes!', { icon: '⏰' })} />
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
            {!isFullscreen && hasAcceptedProtocols && (quiz?.isRestricted || quiz?.fullscreenOnly) && (
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

            {/* ── MEDIA ACCESS GATE ── */}
            {(mediaStatus === 'denied' || mediaStatus === 'not-found') && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,15,26,0.98)',
                    zIndex: 200, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
                }}>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                        {quiz?.proctoring?.camera && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraOff size={32} style={{ color: '#ef4444' }} /></div>}
                        {quiz?.proctoring?.microphone && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicOff size={32} style={{ color: '#ef4444' }} /></div>}
                    </div>
                    <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
                        {mediaStatus === 'not-found' ? 'Hardware Not Detected' : 'Access Denied'}
                    </h2>
                    <p style={{ color: '#64748b', maxWidth: '450px', marginBottom: '32px', lineHeight: 1.6 }}>
                        {mediaStatus === 'not-found'
                            ? `We couldn't detect a required ${quiz?.proctoring?.camera ? 'camera' : ''} ${quiz?.proctoring?.camera && quiz?.proctoring?.microphone ? 'or' : ''} ${quiz?.proctoring?.microphone ? 'microphone' : ''}. Please plug in the necessary hardware and refresh.`
                            : `You have blocked camera/microphone access. This quiz cannot be taken without active monitoring. Please enable permissions in your browser settings and refresh.`
                        }
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#2563eb', color: '#fff',
                            padding: '16px 40px', borderRadius: '14px',
                            fontWeight: '900', fontSize: '11px', border: 'none',
                            cursor: 'pointer', textTransform: 'uppercase',
                            letterSpacing: '0.08em', boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                    >
                        Refresh & Try Again
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
