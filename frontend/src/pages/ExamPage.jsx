import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Maximize2, CameraOff, MicOff, Monitor, Shield, Lock, Video } from 'lucide-react';

// Components
import Timer from '../components/exam/Timer';
import QuestionCard from '../components/exam/QuestionCard';
import WebcamMonitor from '../components/exam/WebcamMonitor';
import SubmitConfirmation from '../components/exam/SubmitConfirmation';
import LoadingScreen from '../components/LoadingScreen';
import { io } from 'socket.io-client';

const VIOLATION_LIMIT = 3;

const ExamPage = () => {
        const { id } = useParams();
    const navigate = useNavigate();
    const hasSubmittedRef = useRef(false);
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    // Exam Data
    const [exam, setExam] = useState(null);
    const [loading, setLoading] = useState(true);

    // Exam Progress State
    const [currentIdx, setCurrentIdx] = useState(0);
    const [answers, setAnswers] = useState({});
    const [visited, setVisited] = useState([]);
    const [markedForReview, setMarkedForReview] = useState([]);

    // Proctoring & UI State
    const [tabSwitches, setTabSwitches] = useState(0);
    const [fullscreenExits, setFullscreenExits] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasStartedExam, setHasStartedExam] = useState(false);
    const [frameStatus, setFrameStatus] = useState('loading');
    const [timeLeft, setTimeLeft] = useState(0);
    const [mediaStatus, setMediaStatus] = useState('pending'); // pending, granted, denied
    const [resultId, setResultId] = useState(null);
    const [aiViolations, setAiViolations] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [hasAcceptedProtocols, setHasAcceptedProtocols] = useState(false);
    const [isChecked, setIsChecked] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

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

    if (isMobile) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f1a] text-center p-10 font-sans">
            <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 border border-rose-500/20">
                <Monitor size={48} className="text-rose-500" />
            </div>
            <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">Desktop Required</h1>
            <p className="text-slate-400 font-bold max-w-md leading-relaxed">
                Examination protocols require a desktop or laptop environment. Mobile access is strictly prohibited for security integrity.
            </p>
            <button 
                onClick={() => navigate('/student')}
                className="mt-10 px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-white/10"
            >
                Return to Dashboard
            </button>
        </div>
    );

        const submitExam = useCallback(async () => {
        if (hasSubmittedRef.current) return;
        hasSubmittedRef.current = true;
        try {
            const formattedAnswers = Object.keys(answers).map(qId => {
                const answer = answers[qId];
                return typeof answer === 'object'
                    ? { questionId: qId, ...answer }
                    : { questionId: qId, selectedOption: answer };
            });

            const res = await axios.post(`${API_BASE}/api/results`, {
                examId: id,
                answers: formattedAnswers,
                violations: { tabSwitches, fullscreenExits, aiViolations },
                timeTaken: (exam?.duration || 0) - timeLeft
            });

            if (res.data.success) {
                localStorage.removeItem(`exam_save_${id}`);
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => {});
                }
                setIsSubmitted(true);
                setTimeout(() => {
                    navigate('/student');
                }, 5000);
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Submission failed';
            toast.error(errorMsg);
            
            if (errorMsg === 'You have already submitted this assessment.') {
                navigate('/student');
            } else {
                hasSubmittedRef.current = false;
            }
        }
    }, [answers, tabSwitches, fullscreenExits, aiViolations, id, navigate, exam, timeLeft, API_BASE]);

    const handleJump = (idx) => {
        if (!exam?.questions?.[idx]) return;
        setCurrentIdx(idx);
        const qId = exam.questions[idx]._id;
        if (!visited.includes(qId)) setVisited([...visited, qId]);
    };

    const enterFullscreen = () => {
        document.documentElement.requestFullscreen().catch(() => {
            toast.error('Failed to enter fullscreen');
        });
    };

    const [socket, setSocket] = useState(null);

    // Socket Connection
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
            console.log("Exam Session Socket Connected");
            s.emit('join-exam', { examId: id, userId: user.id || user._id, role: 'student' });
        });

        s.on('session-suspended', (data) => {
            if (data.examId === id) {
                setExam(prev => ({ ...prev, status: 'Suspended', suspensionReason: data.reason }));
                localStorage.removeItem(`exam_save_${id}`);
                toast.error('Session suspended by admin', { duration: 10000 });
            }
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
        const fetchExam = async () => {
            try {
                const res = await axios.get(`${API_BASE}/api/exams/${id}`);
                let examData = res.data.data;
                if (examData.status === 'Stopped') {
                    toast.error('This session has concluded.');
                    return navigate('/student');
                }

                const saved = localStorage.getItem(`exam_save_${id}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (parsed.shuffledQuestions) {
                        examData.questions = parsed.shuffledQuestions;
                    } else if (examData.questions) {
                        const q = [...examData.questions];
                        for (let i = q.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [q[i], q[j]] = [q[j], q[i]];
                        }
                        examData.questions = q;
                    }
                    const firstQId = examData.questions?.[0]?._id || null;
                    setAnswers(parsed.answers || {});
                    setMarkedForReview(parsed.marked || []);
                    setVisited(parsed.visited || (firstQId ? [firstQId] : []));
                } else {
                    if (examData.questions) {
                        const q = [...examData.questions];
                        for (let i = q.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [q[i], q[j]] = [q[j], q[i]];
                        }
                        examData.questions = q;
                    }
                    const firstQId = examData.questions?.[0]?._id || null;
                    setVisited(firstQId ? [firstQId] : []);
                }

                setExam(examData);
                setTimeLeft(examData.duration);

                // Initialize/Register attempt
                try {
                    const startRes = await axios.post(`${API_BASE}/api/results/start`, { examId: id });
                    setResultId(startRes.data.data._id);

                    // Check if already suspended from DB on initial load
                    if (startRes.data.data.status === 'Suspended') {
                        setExam(prev => ({ ...prev, status: 'Suspended', suspensionReason: startRes.data.data.suspensionReason }));
                    }
                } catch (e) {
                    console.error("Start recording failed", e);
                    if (localStorage.getItem(`exam_auto_submitted_${id}`)) {
                        toast.error('Refreshing detected. Auto-submitting assessment.', { id: 'exam-auto-submitted', duration: 6000 });
                        localStorage.removeItem(`exam_auto_submitted_${id}`);
                    } else {
                        toast.error(e.response?.data?.message || 'You cannot access this assessment.', { id: 'exam-already-submitted' });
                    }
                    navigate('/student');
                    return;
                }

                setLoading(false);
            } catch (err) {
                toast.error('Load failure');
                navigate('/student');
            }
        };
        fetchExam();
    }, [id, navigate, API_BASE]);

    // Timer logic
    useEffect(() => {
        if (loading || !exam || timeLeft <= 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timer); submitExam(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [loading, exam, timeLeft, submitExam]);

    // Auto-save
    useEffect(() => {
        if (!loading && exam) {
            localStorage.setItem(`exam_save_${id}`, JSON.stringify({
                answers, marked: markedForReview, visited,
                shuffledQuestions: exam.questions
            }));
        }
    }, [answers, markedForReview, visited, loading, id, exam]);

    // Tab Switch
    useEffect(() => {
        if (!isFullscreen || !hasAcceptedProtocols || isSubmitted) return;
        const isStrict = exam?.isRestricted;
        if (!isStrict) return;

        const handleVisibility = () => {
            if (document.hidden) {
                setTabSwitches(s => s + 1);
                const currentViolations = tabSwitches + fullscreenExits + aiViolations + 1;
                const remaining = VIOLATION_LIMIT - currentViolations;

                if (remaining > 0) {
                    toast.error(`TAB SWITCH DETECTED! Warning: ${remaining} chances remaining before session termination.`, {
                        duration: 8000,
                        style: { backgroundColor: '#991b1b', color: '#fff', fontWeight: 'bold' }
                    });
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [tabSwitches, fullscreenExits, aiViolations, isFullscreen, hasAcceptedProtocols, exam, isSubmitted]);

    // Refs to store the latest values for unmount/exit submission to avoid useEffect dependency triggers
    const answersRef = useRef(answers);
    const examRef = useRef(exam);
    const tabSwitchesRef = useRef(tabSwitches);
    const fullscreenExitsRef = useRef(fullscreenExits);
    const aiViolationsRef = useRef(aiViolations);
    const hasAcceptedProtocolsRef = useRef(hasAcceptedProtocols);
    useEffect(() => { hasAcceptedProtocolsRef.current = hasAcceptedProtocols; }, [hasAcceptedProtocols]);
    const timeLeftRef = useRef(timeLeft);
    const hasEnteredFullscreenRef = useRef(false);
    useEffect(() => {
        if (isFullscreen) {
            hasEnteredFullscreenRef.current = true;
        }
    }, [isFullscreen]);

    useEffect(() => { answersRef.current = answers; }, [answers]);
    useEffect(() => { examRef.current = exam; }, [exam]);
    useEffect(() => { tabSwitchesRef.current = tabSwitches; }, [tabSwitches]);
    useEffect(() => { fullscreenExitsRef.current = fullscreenExits; }, [fullscreenExits]);
    useEffect(() => { aiViolationsRef.current = aiViolations; }, [aiViolations]);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

    const submitExamRef = useRef(submitExam);
    useEffect(() => { submitExamRef.current = submitExam; }, [submitExam]);

    // Component Unmount (True Client-Side Page Leaves)
    useEffect(() => {
        return () => {
            if (!hasSubmittedRef.current && examRef.current && hasEnteredFullscreenRef.current) {
                hasSubmittedRef.current = true;
                const formattedAnswers = Object.keys(answersRef.current).map(qId => {
                    const answer = answersRef.current[qId];
                    return typeof answer === 'object'
                        ? { questionId: qId, ...answer }
                        : { questionId: qId, selectedOption: answer };
                });
                const payload = {
                    examId: id,
                    answers: formattedAnswers,
                    violations: { 
                        tabSwitches: tabSwitchesRef.current, 
                        fullscreenExits: fullscreenExitsRef.current, 
                        aiViolations: aiViolationsRef.current 
                    },
                    timeTaken: (examRef.current?.duration || 0) - timeLeftRef.current
                };
                fetch(`${API_BASE}/api/results`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                });
                localStorage.removeItem(`exam_save_${id}`);
            }
        };
    }, [id, API_BASE]);

    // Active Proctoring Navigation & Unload Lock Listeners
    useEffect(() => {
        if (isFullscreen && !hasStartedExam) {
            setHasStartedExam(true);
        }
    }, [isFullscreen, hasStartedExam]);

    useEffect(() => {
        if (!hasStartedExam || isSubmitted) return;

        window.history.pushState(null, null, window.location.pathname);

        const handlePopState = () => {
            window.history.pushState(null, null, window.location.pathname);
            toast.error('BACK BUTTON DETECTED! Security protocol activated. Auto-submitting assessment for security integrity...', {
                duration: 6000,
                style: { background: '#000', color: '#f87171', border: '1px solid #f87171', fontWeight: '900' }
            });
            setTimeout(() => {
                submitExamRef.current();
            }, 1000);
        };

        const handleBeforeUnload = (e) => {
            const msg = "Are you sure you want to exit? Your exam session will be terminated and auto-submitted.";
            e.preventDefault();
            e.returnValue = msg;
            return msg;
        };

        const handleUnload = () => {
            if (!hasSubmittedRef.current && examRef.current && hasEnteredFullscreenRef.current) {
                hasSubmittedRef.current = true;
                const formattedAnswers = Object.keys(answersRef.current).map(qId => {
                    const answer = answersRef.current[qId];
                    return typeof answer === 'object'
                        ? { questionId: qId, ...answer }
                        : { questionId: qId, selectedOption: answer };
                });
                const payload = {
                    examId: id,
                    answers: formattedAnswers,
                    violations: { 
                        tabSwitches: tabSwitchesRef.current, 
                        fullscreenExits: fullscreenExitsRef.current, 
                        aiViolations: aiViolationsRef.current 
                    },
                    timeTaken: (examRef.current?.duration || 0) - timeLeftRef.current
                };
                fetch(`${API_BASE}/api/results`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(payload),
                    keepalive: true
                });
                localStorage.removeItem(`exam_save_${id}`);
                localStorage.setItem(`exam_auto_submitted_${id}`, 'true');
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
    }, [id, API_BASE, hasStartedExam, isSubmitted]);

    // Fullscreen detection
    useEffect(() => {
        if (!hasAcceptedProtocols || isSubmitted) return;

        const handleFullscreen = () => {
            if (!document.fullscreenElement) {
                setIsFullscreen(false);
                setFullscreenExits(e => e + 1);
                const currentViolations = tabSwitches + fullscreenExits + 1;
                const remaining = VIOLATION_LIMIT - currentViolations;

                if (remaining > 0) {
                    toast.error(`FULLSCREEN EXITED! Warning: ${remaining} chances remaining. Re-enter fullscreen immediately or the session will terminate.`, {
                        duration: 8000,
                        style: { backgroundColor: '#000', color: '#fff', border: '2px solid #ef4444', fontWeight: 'bold' }
                    });
                }
            } else {
                setIsFullscreen(true);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreen);
        return () => document.removeEventListener('fullscreenchange', handleFullscreen);
    }, [tabSwitches, fullscreenExits, aiViolations, hasAcceptedProtocols, isSubmitted]);

    // Sync violations with server
    useEffect(() => {
        if (!resultId || isSubmitted) return;
        const syncViolations = async () => {
            try {
                await axios.patch(`${API_BASE}/api/results/${resultId}/session`, {
                    violations: { tabSwitches, fullscreenExits, aiViolations }
                });
            } catch (e) { }
        };
        syncViolations();
    }, [tabSwitches, fullscreenExits, aiViolations, resultId, API_BASE, isSubmitted]);

    // Tab/Fullscreen Violation limit
    useEffect(() => {
        if (isSubmitted) return;
        const totalViolations = tabSwitches + fullscreenExits;
        if (totalViolations >= VIOLATION_LIMIT) {
            toast.error('Violation limit reached! Auto-submitting...', { duration: 5000 });
            submitExam();
        }
    }, [tabSwitches, fullscreenExits, submitExam, isSubmitted]);

    // AI/Camera Violation limit
    useEffect(() => {
        if (isSubmitted) return;
        if (aiViolations >= VIOLATION_LIMIT) {
            toast.error('Camera violation limit reached! Auto-submitting...', { duration: 5000 });
            submitExam();
        }
    }, [aiViolations, submitExam, isSubmitted]);

    // Right-click & Copy-Paste Prevention & Anti-Screenshot
    useEffect(() => {
        if (!isFullscreen || !hasAcceptedProtocols || isSubmitted) return;

        const prevent = (e) => e.preventDefault();

        const handleKeyDown = (e) => {
            // Block common screenshot shortcuts and PrintScreen
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                setTabSwitches(s => s + 1);
                toast.error('Screenshot attempt detected! Violation recorded.', { duration: 5000 });
                return false;
            }

            // Win/Cmd + Shift + S (Snipping Tool)
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                setTabSwitches(s => s + 1);
                toast.error('Screen capture tool detected! Violation recorded.', { duration: 5000 });
            }

            // Block developer tools (F12, Ctrl+Shift+I/J, Ctrl+U)
            if (e.keyCode === 123 ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
                ((e.ctrlKey || e.metaKey) && e.key === 'u')) {
                e.preventDefault();
                toast.error('Developer tools are restricted.', { duration: 3000 });
                return false;
            }
        };

        const handleBlur = () => {
            // Blur happens when user opens another app or screenshot tool
            setTabSwitches(s => s + 1);
            toast.error('Focus loss detected! Do not leave the exam window or use external software.', {
                duration: 5000,
                style: { backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 'bold' }
            });
        };

        document.addEventListener('contextmenu', prevent);
        document.addEventListener('copy', prevent);
        document.addEventListener('paste', prevent);
        document.addEventListener('selectstart', prevent);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('contextmenu', prevent);
            document.removeEventListener('copy', prevent);
            document.removeEventListener('paste', prevent);
            document.removeEventListener('selectstart', prevent);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isFullscreen, hasAcceptedProtocols, tabSwitches, fullscreenExits, aiViolations, isSubmitted]);


    if (loading) return (
        <LoadingScreen message="Synchronizing Terminal..." dark={true} fullScreen={true} />
    );

    if (isSubmitted) return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f0f1a',
            color: '#fff',
            textAlign: 'center',
            padding: '24px',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{
                background: '#131325',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: '2rem',
                padding: '3rem 2.5rem',
                maxWidth: '550px',
                width: '100%',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px'
            }}>
                <div style={{ 
                    width: '72px', 
                    height: '72px', 
                    borderRadius: '50%', 
                    background: 'rgba(16,185,129,0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: '1px solid rgba(16,185,129,0.3)',
                    color: '#10b981',
                    marginBottom: '8px'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                </div>
                
                <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.02em', margin: 0, textTransform: 'uppercase', color: '#fff' }}>
                    Thank You!
                </h1>
                
                <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#10b981', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Submission Successful
                </h3>
                
                <p style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '500', lineHeight: '1.6', maxWidth: '400px', margin: 0 }}>
                    Grading will be in progress. Your result will be announced within 24 hours on your dashboard.
                </p>
                
                <button
                    onClick={() => navigate('/student')}
                    style={{
                        width: '100%',
                        background: '#2563eb',
                        color: '#fff',
                        padding: '14px 28px',
                        borderRadius: '12px',
                        fontWeight: '900',
                        fontSize: '13px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginTop: '12px',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                    onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                >
                    Return to Dashboard
                </button>
            </div>
        </div>
    );

    if (exam?.status === 'Suspended') return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', color: '#fff', textAlign: 'center', padding: '2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                <ShieldAlert size={40} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em' }}>SESSION SUSPENDED</h1>
            <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem', lineHeight: 1.6 }}>
                Administrative intervention has terminated your session. <br />
                <b>Reason:</b> {exam.suspensionReason || 'Failure to follow examination protocols.'}
            </p>
            <button
                onClick={() => navigate('/student')}
                style={{ padding: '1rem 3rem', background: '#ef4444', color: '#fff', borderRadius: '1rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
                Return to Dashboard
            </button>
        </div>
    );

    const currentQuestion = exam.questions?.[currentIdx] || null;
    const stats = {
        answered: Object.keys(answers).length,
        total: exam.questions?.length || 0
    };

    /* ── Shared vertical sidebar renderer ── */
    const QSidebar = () => (
        <aside style={{
            width: '58px',
            background: '#13131f',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '14px',
            paddingBottom: '14px',
            gap: '9px',
            overflowY: 'auto',
            flexShrink: 0,
        }}>
            {/* Label */}
            <span style={{
                fontSize: '7px', fontWeight: '900', color: '#475569',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '4px', display: 'block'
            }}>Q No.</span>

            {(exam.questions || []).map((q, idx) => {
                const isAnswered = !!answers[q._id];
                const isCurrent = idx === currentIdx;

                let bg = '#fee2e2';
                let textColor = '#dc2626';
                let border = '2px solid #fca5a5';
                if (isAnswered) {
                    bg = '#dcfce7';
                    textColor = '#16a34a';
                    border = '2px solid #86efac';
                }
                let boxShadow = 'none';
                if (isCurrent) boxShadow = '0 0 0 3px #3b82f6, 0 0 0 5px rgba(59,130,246,0.25)';

                return (
                    <button
                        key={q._id}
                        onClick={() => handleJump(idx)}
                        title={`Q${idx + 1} – ${isAnswered ? 'Answered' : 'Not Answered'}`}
                        style={{
                            width: '34px', height: '34px', borderRadius: '50%',
                            background: bg, border, boxShadow,
                            color: textColor, fontSize: '11px', fontWeight: '800',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', transition: 'all 0.15s ease',
                            flexShrink: 0, fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.13)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                    >
                        {idx + 1}
                    </button>
                );
            })}

            {/* Legend */}
            <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dcfce7', border: '1.5px solid #86efac' }} />
                    <span style={{ fontSize: '6px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Done</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fee2e2', border: '1.5px solid #fca5a5' }} />
                    <span style={{ fontSize: '6px', color: '#475569', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pend</span>
                </div>
            </div>
        </aside>
    );

    const totalViolations = tabSwitches + fullscreenExits;

    return (
        <div style={{
            height: '100vh',
            width: '100vw',
            background: '#0f0f1a',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0
        }}>
            {/* ── LANDSCAPE ORIENTATION GATE ── */}
            <style>{`
                @media (orientation: portrait) {
                    #orientation-gate { display: flex !important; }
                }
            `}</style>
            <div id="orientation-gate" style={{
                position: 'fixed', inset: 0, background: '#0f0f1a', zIndex: 9999,
                display: 'none', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center', padding: '40px'
            }}>
                <div style={{ transform: 'rotate(-90deg)', marginBottom: '30px' }}>
                    <Monitor size={64} color="#60a5fa" />
                </div>
                <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: 900 }}>Rotate Your Device</h2>
                <p style={{ color: '#94a3b8', marginTop: '10px' }}>This assessment protocol requires landscape orientation for optimal visibility.</p>
            </div>

            {/* ── TOP HEADER ── */}
            <header style={{
                height: '56px', flexShrink: 0,
                background: '#13131f',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 60,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h1 style={{
                        fontSize: '14px', fontWeight: '900',
                        background: 'linear-gradient(90deg, #60a5fa, #818cf8)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                    }}>
                        {exam.title}
                    </h1>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700', color: '#94a3b8' }}>
                        <ShieldAlert size={14} style={{ color: totalViolations > 0 ? '#f59e0b' : '#94a3b8' }} />
                        Violations:&nbsp;
                        <span style={{ color: totalViolations > 0 ? '#f87171' : '#34d399', fontWeight: '900' }}>
                            {totalViolations}/{VIOLATION_LIMIT}
                        </span>
                        
                        {exam?.proctoring?.camera && (
                            <>
                                <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
                                <Video size={14} style={{ color: aiViolations > 0 ? '#f59e0b' : '#94a3b8' }} />
                                Camera:&nbsp;
                                <span style={{ color: aiViolations > 0 ? '#f87171' : '#34d399', fontWeight: '900' }}>
                                    {aiViolations}/{VIOLATION_LIMIT}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Progress pill */}
                    <div style={{
                        padding: '4px 12px', background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '99px',
                        fontSize: '11px', fontWeight: '700', color: '#94a3b8',
                    }}>
                        {stats.answered}<span style={{ color: '#475569' }}>/{stats.total}</span> answered
                    </div>

                    <Timer timeLeft={timeLeft} onWarning={() => toast('Final 5 minutes!', { icon: '⏰' })} />

                    <button
                        onClick={() => setShowSubmitModal(true)}
                        style={{
                            background: '#2563eb', color: '#fff',
                            padding: '8px 20px', borderRadius: '10px',
                            fontWeight: '800', fontSize: '13px', border: 'none',
                            cursor: 'pointer', letterSpacing: '0.02em',
                            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}
                    >
                        Submit Exam
                    </button>
                </div>
            </header>

            {/* ── ASSESSMENT PROTOCOLS AGREEMENT GATE ── */}
            {!hasAcceptedProtocols && (
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
                            {exam?.isRestricted && (
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }}><ShieldAlert size={16} /></div>
                                    <div>
                                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Strict Tab Detention</h4>
                                        <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>Leaving this browser window, switching tabs, or clicking outside will immediately log a secure protocol violation.</p>
                                    </div>
                                </div>
                            )}

                            {/* Screen Capture Blocking */}
                            {exam?.isRestricted && (
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0 }}><Monitor size={16} /></div>
                                    <div>
                                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Screen Capture Blocking</h4>
                                        <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>PrintScreen keys, Win+Shift+S snipping tools, and record utilities are strictly disabled. Any capture attempt records a violation.</p>
                                    </div>
                                </div>
                            )}

                            {/* Fullscreen Immersive Mode */}
                            {exam?.fullscreenOnly && !exam?.isRestricted && (
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0 }}><Maximize2 size={16} /></div>
                                    <div>
                                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Fullscreen Immersive Mode</h4>
                                        <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>This assessment requires fullscreen mode to remain active throughout the session to prevent distractions.</p>
                                    </div>
                                </div>
                            )}

                            {/* Webcam Monitoring */}
                            {exam?.proctoring?.camera && (
                                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{ color: '#ef4444', marginTop: '2px', flexShrink: 0 }}><Video size={16} /></div>
                                    <div>
                                        <h4 style={{ color: '#fff', fontSize: '13px', fontWeight: '800', margin: '0 0 2px 0' }}>Webcam Monitoring</h4>
                                        <p style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '500', lineHeight: '1.4', margin: 0 }}>Continuous real-time proctoring tracks presence. Absence, secondary faces, or external lookaways will register flags.</p>
                                    </div>
                                </div>
                            )}

                            {/* Audio Monitoring */}
                            {exam?.proctoring?.microphone && (
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
                                        {exam?.isRestricted 
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
                                I agree to honor exam integrity, confirm my testing environment is silent and compliant, and consent to dynamic webcam and activity proctoring.
                            </span>
                        </label>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                            <button
                                onClick={() => navigate('/student')}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255,255,255,0.05)',
                                    color: '#fff',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontWeight: '800',
                                    fontSize: '13px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}
                            >
                                Exit
                            </button>
                            <button
                                disabled={!isChecked}
                                onClick={() => setHasAcceptedProtocols(true)}
                                style={{
                                    flex: 2,
                                    background: isChecked ? '#2563eb' : 'rgba(37,99,235,0.3)',
                                    color: isChecked ? '#fff' : 'rgba(255,255,255,0.4)',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontWeight: '900',
                                    fontSize: '13px',
                                    border: 'none',
                                    cursor: isChecked ? 'pointer' : 'not-allowed',
                                    boxShadow: isChecked ? '0 4px 20px rgba(37,99,235,0.4)' : 'none',
                                    textAlign: 'center',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    transition: 'all 0.2s'
                                }}
                            >
                                Agree & Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── FULLSCREEN GATE ── */}
            {hasAcceptedProtocols && mediaStatus === 'granted' && !isFullscreen && (
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
                    <p style={{ color: '#64748b', maxWidth: '400px', marginBottom: '24px', lineHeight: 1.6 }}>
                        This exam requires fullscreen mode to ensure academic integrity.
                    </p>
                    
                    {!hasStartedExam && exam?.proctoring?.camera && (
                        <div style={{ marginBottom: '32px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', minWidth: '300px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>AI Pre-Check Status</div>
                            {frameStatus === 'loading' && <div style={{ color: '#60a5fa', fontWeight: '600' }}>Loading AI Models...</div>}
                            {frameStatus === 'no_person' && <div style={{ color: '#ef4444', fontWeight: '600' }}>No face detected in camera frame</div>}
                            {frameStatus === 'multiple_persons' && <div style={{ color: '#ef4444', fontWeight: '600' }}>Multiple people detected in frame</div>}
                            {frameStatus === 'valid' && <div style={{ color: '#10b981', fontWeight: '600' }}>Frame Verified - Ready</div>}
                        </div>
                    )}

                    <button
                        onClick={enterFullscreen}
                        disabled={!hasStartedExam && exam?.proctoring?.camera && frameStatus !== 'valid'}
                        style={{
                            background: (hasStartedExam || !exam?.proctoring?.camera || frameStatus === 'valid') ? '#2563eb' : 'rgba(37,99,235,0.3)', 
                            color: (hasStartedExam || !exam?.proctoring?.camera || frameStatus === 'valid') ? '#fff' : 'rgba(255,255,255,0.4)', 
                            padding: '14px 40px',
                            borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                            border: 'none', cursor: (hasStartedExam || !exam?.proctoring?.camera || frameStatus === 'valid') ? 'pointer' : 'not-allowed',
                            boxShadow: (hasStartedExam || !exam?.proctoring?.camera || frameStatus === 'valid') ? '0 4px 20px rgba(37,99,235,0.4)' : 'none',
                        }}
                    >
                        Enter Fullscreen
                    </button>
                </div>
            )}

            {/* ── MAIN CONTENT: sidebar + question (SAME for all types) ── */}
            <main style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
                <QSidebar />

                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <QuestionCard
                        question={currentQuestion}
                        index={currentIdx}
                        totalQuestions={exam.questions?.length || 0}
                        selectedAnswer={currentQuestion ? answers[currentQuestion._id] : null}
                        onSelect={(val) => currentQuestion && setAnswers({ ...answers, [currentQuestion._id]: val })}
                        onPrev={() => handleJump(Math.max(0, currentIdx - 1))}
                        onNext={() => handleJump(Math.min((exam.questions?.length || 1) - 1, currentIdx + 1))}
                        isFirst={currentIdx === 0}
                        isLast={currentIdx === (exam.questions?.length || 1) - 1}
                    />
                </div>
            </main>

            {hasAcceptedProtocols && (
                <WebcamMonitor
                    allowCamera={exam?.proctoring?.camera ?? true}
                    allowMicrophone={exam?.proctoring?.microphone ?? false}
                    onStatusChange={(status) => setMediaStatus(status)}
                    onFrameStatus={(status) => setFrameStatus(status)}
                    showPreview={!isFullscreen && !hasStartedExam}
                    isExamActive={hasStartedExam}
                    examResultId={resultId}
                    violations={{ tabSwitches, fullscreenExits, aiViolations }}
                    onViolation={(reason) => {
                        setAiViolations(v => v + 1);
                        const remaining = VIOLATION_LIMIT - (aiViolations + 1);
                        if (remaining >= 0) {
                            toast.error(`CAMERA ALERT: ${reason}. Warning: ${remaining} camera chances remaining.`, {
                                duration: 6000,
                                style: { backgroundColor: '#ef4444', color: '#fff', fontWeight: 'bold' }
                            });
                        }
                    }}
                />
            )}

            {/* ── MEDIA ACCESS GATE ── */}
            {hasAcceptedProtocols && mediaStatus !== 'granted' && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15,15,26,0.98)',
                    zIndex: 200, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px',
                }}>
                    <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.1); } }`}</style>
                    {mediaStatus === 'pending' ? (
                        <>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                <Video size={32} style={{ color: '#3b82f6', animation: 'pulse 2s infinite' }} />
                            </div>
                            <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
                                Requesting Hardware Access
                            </h2>
                            <p style={{ color: '#64748b', maxWidth: '450px', marginBottom: '32px', lineHeight: 1.6 }}>
                                Please allow camera and microphone permissions in your browser when prompted to proceed with the exam.
                            </p>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
                                {exam?.proctoring?.camera && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CameraOff size={32} style={{ color: '#ef4444' }} /></div>}
                                {exam?.proctoring?.microphone && <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MicOff size={32} style={{ color: '#ef4444' }} /></div>}
                            </div>
                            <h2 style={{ color: '#fff', fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
                                {mediaStatus === 'not-found' ? 'Hardware Not Detected' : 'Access Denied'}
                            </h2>
                            <p style={{ color: '#64748b', maxWidth: '450px', marginBottom: '32px', lineHeight: 1.6 }}>
                                {mediaStatus === 'not-found'
                                    ? `We couldn't detect a required ${exam?.proctoring?.camera ? 'camera' : ''} ${exam?.proctoring?.camera && exam?.proctoring?.microphone ? 'or' : ''} ${exam?.proctoring?.microphone ? 'microphone' : ''}. Please plug in the necessary hardware and refresh.`
                                    : `You have blocked camera/microphone access. This exam cannot be taken without active monitoring. Please enable permissions in your browser settings and refresh.`
                                }
                            </p>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    background: '#2563eb', color: '#fff', padding: '14px 40px',
                                    borderRadius: '12px', fontWeight: '800', fontSize: '15px',
                                    border: 'none', cursor: 'pointer',
                                    boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                                }}
                            >
                                Refresh & Try Again
                            </button>
                        </>
                    )}
                </div>
            )}

            {showSubmitModal && (
                <SubmitConfirmation
                    stats={stats}
                    onCancel={() => setShowSubmitModal(false)}
                    onConfirm={submitExam}
                />
            )}
        </div>
    );
};

export default ExamPage;
