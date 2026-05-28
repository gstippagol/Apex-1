import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import LoadingScreen from '../components/LoadingScreen';
import { 
    ArrowLeft, Edit2, Play, Square, Trash2, Plus, 
    CheckCircle2, Clock, Settings, Award, Calendar,
    Cpu, Code, CheckSquare, X, Save, AlertCircle, PlusCircle, Eye, EyeOff, Power, ShieldOff, Rocket, Camera, Mic, Shield, Maximize2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Editor from '@monaco-editor/react';
import ConfirmModal from '../components/ConfirmModal';

const getInitialArray = (val) => {
    if (Array.isArray(val)) return val.length > 0 ? val : [''];
    if (typeof val === 'string' && val.trim()) {
        return val.split('\n').map(s => s.trim()).filter(Boolean);
    }
    return [''];
};

const getInitialExamples = (meta) => {
    if (Array.isArray(meta.examples) && meta.examples.length > 0) {
        return meta.examples;
    }
    if (meta.sampleInput || meta.sampleOutput) {
        return [{ input: meta.sampleInput || '', output: meta.sampleOutput || '', explanation: '' }];
    }
    return [{ input: '', output: '', explanation: '' }];
};

const QuizDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);

    const getLocalISO = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString();
    };
    const minDate = getLocalISO(new Date()).split('T')[0];

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

    const handleEraseQuiz = () => {
        triggerConfirm({
            title: 'Erase Quiz Blueprint',
            message: `Are you sure you want to permanently erase "${quiz?.title}"? This action cannot be undone.`,
            confirmText: 'Erase Quiz',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/quiz/${id}`); 
                    navigate('/admin?tab=quizzes'); 
                } catch (err) {
                    toast.error('Erase sequence compromised');
                }
            }
        });
    };

    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    const resolveImageUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${API_BASE}${url}`;
    };

    // Modal States
    const [showQuizModal, setShowQuizModal] = useState(false);
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishDepartments, setPublishDepartments] = useState(['All']);
    const [availableDepartments, setAvailableDepartments] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [starterLang, setStarterLang] = useState('python');
    const [uploading, setUploading] = useState(false);

    // Form States
    const [quizForm, setQuizForm] = useState({ 
        title: '', 
        duration: 30, // Default 30 mins
        scheduledDate: '', 
        isRestricted: false,
        fullscreenOnly: false,
        proctoring: { camera: false, microphone: false }
    });
    const [qForm, setQForm] = useState({ 
        type: 'MCQ',
        questionText: '',
        marks: 1,
        options: ['', '', '', ''],
        correctAnswer: '',
        difficulty: 'Medium',
        images: [{ url: '', purpose: '', scale: 100 }],
        codingMetadata: {
            problemDescription: '',
            inputDescription: [''],
            outputDescription: [''],
            constraints: [''],
            sampleInput: '',
            sampleOutput: '',
            examples: [{ input: '', output: '', explanation: '' }],
            testCases: [{ input: '', expectedOutput: '', isVisible: true }],
            starterCode: {
                python: '',
                java: '',
                cpp: '',
                c: ''
            }
        }
    });

    useEffect(() => {
        fetchQuiz();
    }, [id]);

    const fetchQuiz = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/quiz/${id}`);
            const data = res.data.data;
            setQuiz(data);
            setQuizForm({ 
                title: data.title, 
                duration: Math.round(data.duration / 60), // convert to mins for form
                scheduledDate: data.scheduledDate || '',
                isRestricted: data.isRestricted || false,
                fullscreenOnly: data.fullscreenOnly || false,
                proctoring: data.proctoring || { camera: false, microphone: false }
            });
        } catch (err) {
            toast.error('Quiz synchronization failed');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateQuiz = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_BASE}/api/quiz/${id}`, {
                ...quizForm,
                duration: quizForm.duration * 60 // convert back to seconds for DB
            });
            toast.success('Specifications Synchronized');
            setShowQuizModal(false);
            fetchQuiz();
        } catch (err) {
            toast.error('Sync failed');
        }
    };

    const handleQuestionSubmit = async (e) => {
        e.preventDefault();
        try {
            const finalQForm = { ...qForm };
            if (finalQForm.type === 'Coding' && finalQForm.codingMetadata) {
                const examples = finalQForm.codingMetadata.examples || [];
                finalQForm.codingMetadata.sampleInput = examples[0]?.input || '';
                finalQForm.codingMetadata.sampleOutput = examples[0]?.output || '';
            }
            if (currentQuestion) {
                await axios.put(`${API_BASE}/api/questions/${currentQuestion._id}`, finalQForm);
                toast.success('Question Logic Updated');
            } else {
                const res = await axios.post(`${API_BASE}/api/questions`, finalQForm);
                const qId = res.data.data._id;
                await axios.put(`${API_BASE}/api/quiz/${id}`, {
                    questions: [...quiz.questions.map(q => q._id), qId]
                });
                toast.success('Logic Appended to Portfolio');
            }
            setShowQuestionModal(false);
            fetchQuiz();
        } catch (err) {
            toast.error('Injection failed');
        }
    };

    const openQModal = (q = null) => {
        if (q) {
            setCurrentQuestion(q);
            const meta = q.codingMetadata || {};
            setQForm({ 
                ...q, 
                marks: q.marks !== undefined ? q.marks : 1,
                difficulty: q.difficulty || 'Medium',
                codingMetadata: {
                    problemDescription: meta.problemDescription || '',
                    inputDescription: getInitialArray(meta.inputDescription),
                    outputDescription: getInitialArray(meta.outputDescription),
                    constraints: getInitialArray(meta.constraints),
                    sampleInput: meta.sampleInput || '',
                    sampleOutput: meta.sampleOutput || '',
                    examples: getInitialExamples(meta),
                    testCases: meta.testCases || [{ input: '', expectedOutput: '', isVisible: true }],
                    starterCode: meta.starterCode || { python: '', java: '', cpp: '', c: '' }
                } 
            });
        } else {
            setCurrentQuestion(null);
            setQForm({ 
                type: 'MCQ', 
                questionText: '', 
                marks: 1,
                options: ['', '', '', ''], 
                correctAnswer: '', 
                difficulty: 'Medium',
                images: [{ url: '', purpose: '', scale: 100 }],
                codingMetadata: { 
                    problemDescription: '', 
                    inputDescription: [''], 
                    outputDescription: [''], 
                    constraints: [''], 
                    sampleInput: '', 
                    sampleOutput: '', 
                    examples: [{ input: '', output: '', explanation: '' }],
                    testCases: [{ input: '', expectedOutput: '', isVisible: true }],
                    starterCode: { python: '', java: '', cpp: '', c: '' }
                } 
            });
        }
        setStarterLang('python');
        setShowQuestionModal(true);
    };

    const addTestCase = () => {
        setQForm({
            ...qForm,
            codingMetadata: {
                ...qForm.codingMetadata,
                testCases: [...qForm.codingMetadata.testCases, { input: '', expectedOutput: '', isVisible: false }]
            }
        });
    };

    const updateTestCase = (idx, field, val) => {
        const newCases = [...qForm.codingMetadata.testCases];
        newCases[idx][field] = val;
        setQForm({
            ...qForm,
            codingMetadata: { ...qForm.codingMetadata, testCases: newCases }
        });
    };

    const handleImageUpload = async (e, index) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const res = await axios.post(`${API_BASE}/api/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newImages = [...qForm.images];
            newImages[index].url = res.data.url; 
            setQForm({ ...qForm, images: newImages });
            toast.success('Asset Uplink Established');
        } catch (err) {
            toast.error('Uplink failed');
        } finally {
            setUploading(false);
        }
    };

    const addImageField = () => {
        setQForm({
            ...qForm,
            images: [...qForm.images, { url: '', purpose: '', scale: 100 }]
        });
    };

    const removeImageField = (index) => {
        const newImages = [...qForm.images];
        newImages.splice(index, 1);
        setQForm({ ...qForm, images: newImages });
    };

    const updateImageField = (index, field, val) => {
        const newImages = [...qForm.images];
        newImages[index][field] = val;
        setQForm({ ...qForm, images: newImages });
    };

    if (loading) return <LoadingScreen message="Accessing Quiz Builder..." dark={false} fullScreen={true} />;
    if (!quiz) return <div className="min-h-screen flex items-center justify-center">Record Expired</div>;
    const totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks !== undefined ? Number(q.marks) : 1), 0);

    const withdrawQuiz = async () => {
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/withdraw`);
            toast.success('Quiz withdrawn from student screens');
            fetchQuiz();
        } catch (err) {
            toast.error('Withdrawal failed');
        }
    };

    const stopQuiz = async () => {
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/stop`);
            toast.success('Quiz session terminated');
            fetchQuiz();
        } catch (err) {
            toast.error('End session failed');
        }
    };
    const restartQuiz = async () => {
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/restart`);
            toast.success('Assessment Protocol Reactivated');
            fetchQuiz();
        } catch (err) {
            toast.error('Restoration failed');
        }
    };

    const openPublishModal = () => {
        const hardcodedDepts = ['CSD', 'CSE', 'AIML', 'AIDS', 'CEE', 'BMRE'];
        setAvailableDepartments(hardcodedDepts);
        setShowPublishModal(true);
    };

    const togglePublishDepartment = (dept) => {
        if (dept === 'All') {
            setPublishDepartments(['All']);
            return;
        }
        let newSelected = publishDepartments.filter(d => d !== 'All');
        if (newSelected.includes(dept)) {
            newSelected = newSelected.filter(d => d !== dept);
        } else {
            newSelected.push(dept);
        }
        if (newSelected.length === 0) newSelected = ['All'];
        setPublishDepartments(newSelected);
    };

    const handlePublishConfirm = async (e) => {
        e.preventDefault();
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/publish`, { targetDepartments: publishDepartments });
            toast.success('Assessment Published Successfully');
            setShowPublishModal(false);
            fetchQuiz();
        } catch (err) {
            toast.error('Publishing failed');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Navbar />
            
            <main className="max-w-6xl mx-auto w-full p-4 md:p-8">
                <button onClick={() => navigate('/admin?tab=quizzes')} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold mb-8 transition-colors group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-all" /> Dashboard
                </button>

                <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-10 md:p-14 shadow-2xl border border-slate-100 mb-8 relative overflow-hidden">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10 md:mb-16">
                        <div className="flex-1 w-full">
                           <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                                <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">{quiz.title}</h1>
                                <div className="w-fit"><StatusBadge status={quiz.status} /></div>
                           </div>
                           <div className="flex flex-wrap items-center gap-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><Clock size={14} className="text-blue-500" /> {Math.round(quiz.duration/60)} MINS</div>
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><CheckSquare size={14} className="text-emerald-500" /> {quiz.questions?.length} Qs</div>
                                <div className="flex items-center gap-2 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm"><Award size={14} className="text-amber-500" /> {totalMarks} MARKS</div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 w-full md:w-auto">
                             <StatusToggle quiz={quiz} onPublish={openPublishModal} onEnd={stopQuiz} onWithdraw={withdrawQuiz} onRestart={restartQuiz} />
                             <button 
                                 disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                 onClick={() => setShowQuizModal(true)} 
                                 className={`p-4 rounded-2xl transition-all flex items-center justify-center min-h-[56px] ${
                                     (quiz.status !== 'Draft' && quiz.status !== 'Withdrawn')
                                         ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50 shadow-none' 
                                         : 'bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-900/10 active:scale-95'
                                 }`}
                             >
                                 <Edit2 size={22} />
                             </button>
                             <button 
                                 disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                 onClick={handleEraseQuiz} 
                                 className={`p-4 rounded-2xl transition-all border flex items-center justify-center min-h-[56px] ${
                                     (quiz.status !== 'Draft' && quiz.status !== 'Withdrawn')
                                         ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50 shadow-none' 
                                         : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-red-600 hover:border-red-100 hover:bg-red-50 active:scale-95'
                                 }`}
                             >
                                 <Trash2 size={22} />
                             </button>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-10 md:pt-16">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-6">
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Question Portfolio</h3>
                            <button 
                                disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                onClick={() => openQModal()} 
                                className={`w-full sm:w-auto flex items-center justify-center gap-3 bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-[10px] uppercase tracking-[0.2em] hover:bg-blue-700 shadow-2xl shadow-blue-500/30 active:scale-95 transition-all ${(quiz.status !== 'Draft' && quiz.status !== 'Withdrawn') ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                                <Plus size={20} /> Add Question
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-8">
                            {quiz.questions.map((q, idx) => (
                                <motion.div whileHover={{ y: -4 }} key={q._id} className="p-6 md:p-10 bg-slate-50 rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 group transition-all flex flex-col md:flex-row items-start gap-6 md:gap-10 shadow-sm hover:shadow-xl hover:bg-white">
                                    <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-[1rem] md:rounded-[1.5rem] flex items-center justify-center font-black text-blue-600 shrink-0 shadow-lg border border-slate-100 text-xl md:text-2xl">
                                        Q{idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start mb-6">
                                            <p className="font-bold text-slate-800 text-xl leading-tight tracking-tight">{q.questionText}</p>
                                            <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                                <button 
                                                    disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                                    onClick={() => openQModal(q)} 
                                                    className={`p-3 text-blue-600 bg-white border border-blue-50 rounded-[1rem] hover:shadow-lg transition-all ${(quiz.status !== 'Draft' && quiz.status !== 'Withdrawn') ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                >
                                                    <Edit2 size={20} />
                                                </button>
                                                <button 
                                                    disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                                    onClick={() => { 
                                                        triggerConfirm({
                                                            title: 'Erase Question Protocol',
                                                            message: 'Are you sure you want to permanently remove this question from the quiz portfolio?',
                                                            confirmText: 'Erase Question',
                                                            onConfirm: async () => {
                                                                try {
                                                                    await axios.delete(`${API_BASE}/api/questions/${q._id}`); 
                                                                    fetchQuiz(); 
                                                                } catch (err) {
                                                                    toast.error('Removal sequence failed');
                                                                 }
                                                             }
                                                         });
                                                     }} 
                                                    className={`p-3 text-red-500 bg-white border border-red-50 rounded-[1rem] hover:shadow-lg transition-all ${(quiz.status !== 'Draft' && quiz.status !== 'Withdrawn') ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="text-[10px] font-black tracking-widest uppercase px-4 py-2 bg-slate-900 text-white rounded-xl flex items-center gap-3">
                                                {q.type === 'Coding' ? <Code size={14} /> : q.type === 'MCQ' ? <CheckSquare size={14} /> : <AlertCircle size={14} />} {q.type}
                                            </span>
                                            <span className="text-[10px] font-black tracking-[0.1em] text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2 rounded-xl uppercase">
                                                {q.marks !== undefined ? q.marks : 1} Marks
                                            </span>
                                            <span className="text-[10px] font-black tracking-[0.1em] text-slate-400 bg-white border border-slate-100 px-4 py-2 rounded-xl uppercase">Expect: {q.correctAnswer || 'Evaluated'}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {showQuizModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[3.5rem] w-full max-w-2xl p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                            <button onClick={() => setShowQuizModal(false)} className="absolute right-10 top-10 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"><X size={28} /></button>
                            <h2 className="text-3xl font-black mb-10 flex items-center gap-3 tracking-tight"><Settings className="text-blue-600" /> Quiz Specifications</h2>
                            <form onSubmit={handleUpdateQuiz} className="space-y-8">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Quiz Title</label>
                                    <input type="text" required value={quizForm.title} onChange={e => setQuizForm({...quizForm, title: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Duration (Minutes)</label>
                                    <input type="number" required value={quizForm.duration} onChange={e => setQuizForm({...quizForm, duration: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Scheduled Date</label>
                                        <input type="date" min={minDate} value={quizForm.scheduledDate} onChange={e => setQuizForm({...quizForm, scheduledDate: e.target.value})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                    <label className={`flex items-center justify-between p-5 sm:p-6 rounded-[1.5rem] border transition-all cursor-pointer ${quizForm.proctoring.camera ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <Camera size={24} className={quizForm.proctoring.camera ? 'text-blue-600' : 'text-slate-400'} />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Camera Monitoring</span>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={quizForm.proctoring.camera} onChange={() => setQuizForm({...quizForm, proctoring: {...quizForm.proctoring, camera: !quizForm.proctoring.camera}})} />
                                        <div className={`w-10 h-5 rounded-full relative transition-all ${quizForm.proctoring.camera ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${quizForm.proctoring.camera ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </label>
                                    <label className={`flex items-center justify-between p-5 sm:p-6 rounded-[1.5rem] border transition-all cursor-pointer ${quizForm.proctoring.microphone ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <Mic size={24} className={quizForm.proctoring.microphone ? 'text-blue-600' : 'text-slate-400'} />
                                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Mic Access</span>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={quizForm.proctoring.microphone} onChange={() => setQuizForm({...quizForm, proctoring: {...quizForm.proctoring, microphone: !quizForm.proctoring.microphone}})} />
                                        <div className={`w-10 h-5 rounded-full relative transition-all ${quizForm.proctoring.microphone ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${quizForm.proctoring.microphone ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <label className={`flex items-center justify-between p-6 rounded-[1.5rem] border transition-all cursor-pointer ${quizForm.isRestricted ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <Shield size={28} className={quizForm.isRestricted ? 'text-amber-600' : 'text-slate-400'} />
                                            <div>
                                                <span className="block text-xs font-black uppercase tracking-widest">Enforce Strict Session</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Lock student browser protocols (Tab switching, Fullscreen)</span>
                                            </div>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={quizForm.isRestricted} onChange={() => setQuizForm({...quizForm, isRestricted: !quizForm.isRestricted, fullscreenOnly: false})} />
                                        <div className={`w-12 h-6 rounded-full relative transition-all ${quizForm.isRestricted ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${quizForm.isRestricted ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </label>
                                    <label className={`flex items-center justify-between p-6 rounded-[1.5rem] border transition-all cursor-pointer ${quizForm.fullscreenOnly ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <Maximize2 size={28} className={quizForm.fullscreenOnly ? 'text-blue-600' : 'text-slate-400'} />
                                            <div>
                                                <span className="block text-xs font-black uppercase tracking-widest">Only Full Screen Mode</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Enforce immersive view without tab lock penalties</span>
                                            </div>
                                        </div>
                                        <input type="checkbox" className="hidden" checked={quizForm.fullscreenOnly} onChange={() => setQuizForm({...quizForm, fullscreenOnly: !quizForm.fullscreenOnly, isRestricted: false})} />
                                        <div className={`w-12 h-6 rounded-full relative transition-all ${quizForm.fullscreenOnly ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${quizForm.fullscreenOnly ? 'left-7' : 'left-1'}`} />
                                        </div>
                                    </label>
                                </div>

                                <button type="submit" className="w-full py-6 bg-blue-600 text-white font-black rounded-[1.5rem] shadow-2xl active:scale-95 transition-all uppercase tracking-[0.2em] text-[10px]">Update Specifications</button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showQuestionModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4">
                        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl relative">
                            <div className="p-6 sm:p-10 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                                <div>
                                    <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none mb-2 uppercase">{currentQuestion ? 'Modify Logic' : 'New Logic Injection'}</h2>
                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><PlusCircle size={12} /> Instance: Q{quiz.questions.length + (currentQuestion ? 0 : 1)}</p>
                                </div>
                                <button onClick={() => setShowQuestionModal(false)} className="p-3 sm:p-4 text-slate-400 hover:bg-slate-50 rounded-2xl transition-all"><X size={24} /></button>
                            </div>

                            <form onSubmit={handleQuestionSubmit} className="p-6 sm:p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8 sm:space-y-12">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Protocol Type</label>
                                        <select value={qForm.type} onChange={e => setQForm({...qForm, type: e.target.value})} className="w-full p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all">
                                            <option value="MCQ">Standard MCQ</option>
                                            <option value="TrueFalse">Boolean Verdict</option>
                                            <option value="Coding">Advanced Logic (Code)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Marks</label>
                                        <input type="number" required value={qForm.marks} onChange={e => setQForm({ ...qForm, marks: Number(e.target.value) })} className="w-full p-4 sm:p-6 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4">Instruction Text</label>
                                        <textarea rows="3" required value={qForm.questionText} onChange={e => setQForm({...qForm, questionText: e.target.value})} className="w-full p-5 sm:p-8 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-[2rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                    </div>
                                </div>
                                {/* Asset/Image Builder */}
                                <div className="space-y-6">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Examination Visual Assets</label>
                                        <button type="button" onClick={addImageField} className="text-blue-600 font-black text-[10px] uppercase tracking-[0.1em] flex items-center gap-2 hover:text-blue-700 transition-all">+ Add Another Image</button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {qForm.images.map((img, idx) => (
                                            <div key={idx} className="p-5 sm:p-6 bg-slate-50 rounded-2xl sm:rounded-3xl border border-slate-100 flex flex-col gap-4 relative group/asset">
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Asset #{idx+1} Source</label>
                                                        <div className="flex gap-2">
                                                            <input type="text" placeholder="URL or Uploaded Path" value={img.url} onChange={e => updateImageField(idx, 'url', e.target.value)} className="flex-1 p-3 bg-white border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                                                            <input type="file" id={`quiz-img-${idx}`} accept="image/*" hidden onChange={(e) => handleImageUpload(e, idx)} />
                                                            <label htmlFor={`quiz-img-${idx}`} className="shrink-0 p-3 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 transition-all shadow-md"><PlusCircle size={16}/></label>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2">Purpose / Name</label>
                                                        <input type="text" placeholder="e.g. Example 1: Diagram" value={img.purpose} onChange={e => updateImageField(idx, 'purpose', e.target.value)} className="w-full p-3 bg-white border rounded-xl text-[11px] font-bold focus:ring-2 focus:ring-blue-500/10 outline-none" />
                                                    </div>
                                                </div>
                                                
                                                {qForm.images.length > 1 && (
                                                    <button type="button" onClick={() => removeImageField(idx)} className="absolute top-2 right-2 p-2 text-slate-300 hover:text-red-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover/asset:opacity-100">
                                                        <Trash2 size={16}/>
                                                    </button>
                                                )}
                                                {img.url && (
                                                    <div className="space-y-4 pt-2 border-t border-slate-200/60">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Scale: {img.scale || 100}%</label>
                                                            <input 
                                                                type="range" 
                                                                min="10" 
                                                                max="100" 
                                                                value={img.scale || 100} 
                                                                onChange={(e) => updateImageField(idx, 'scale', parseInt(e.target.value))}
                                                                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                                            />
                                                        </div>
                                                        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white mx-auto shadow-sm" style={{ width: `${img.scale || 100}%` }}>
                                                            <img src={resolveImageUrl(img.url)} alt="Preview" className="w-full h-auto block" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {qForm.type === 'MCQ' && (
                                    <div className="space-y-6 border-t border-slate-100 pt-8">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Standardized Options</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                            {qForm.options.map((opt, i) => (
                                                <div key={i} className="relative flex items-center">
                                                    <span className="absolute left-4 font-black text-slate-200 text-xl">{String.fromCharCode(65 + i)}</span>
                                                    <input type="text" placeholder={`Option ${i+1}`} value={opt} onChange={e => { const n = [...qForm.options]; n[i] = e.target.value; setQForm({...qForm, options: n}); }} className="w-full pl-12 pr-6 py-4 sm:py-6 bg-slate-50 border rounded-xl sm:rounded-[1.5rem] font-bold text-sm sm:text-base outline-none focus:ring-4 focus:ring-blue-500/10 transition-all" />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="pt-4">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Logical Key (Correct Answer)</label>
                                            <select value={qForm.correctAnswer} onChange={e => setQForm({...qForm, correctAnswer: e.target.value})} className="w-full p-4 sm:p-6 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl sm:rounded-[1.5rem] font-black text-xs sm:text-sm uppercase tracking-widest outline-none">
                                                <option value="">Select Correct Target</option>
                                                {qForm.options.map((opt, i) => <option key={i} value={opt}>{opt || `Option ${i+1}`}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {qForm.type === 'TrueFalse' && (
                                    <div className="space-y-4 pt-4">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-mono text-center">Correct Boolean Verdict</label>
                                        <div className="flex gap-4 max-w-md mx-auto">
                                            {['True', 'False'].map(v => (
                                                <button 
                                                    key={v} 
                                                    type="button" 
                                                    onClick={() => setQForm({...qForm, correctAnswer: v, options: ['True', 'False']})} 
                                                    className={`flex-1 py-4 rounded-2xl font-black border-2 transition-all text-sm tracking-tight ${qForm.correctAnswer === v ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/20' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-200 hover:text-slate-500'}`}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {qForm.type === 'Coding' && (
                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Difficulty Level</label>
                                                <div className="flex gap-4">
                                                    {['Easy', 'Medium', 'Hard'].map(level => (
                                                        <button
                                                            key={level}
                                                            type="button"
                                                            onClick={() => setQForm({ ...qForm, difficulty: level })}
                                                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                                                                qForm.difficulty === level
                                                                    ? level === 'Easy' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                                                    : level === 'Medium' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20'
                                                                    : 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20'
                                                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            {level}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Problem Statement</label>
                                                <textarea rows="4" value={qForm.codingMetadata.problemDescription} onChange={e => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, problemDescription: e.target.value}})} className="w-full p-6 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none focus:ring-4 focus:ring-blue-500/10" placeholder="Detailed problem requirements..." />
                                            </div>
                                            <div className="md:col-span-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Input Description</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                inputDescription: [...qForm.codingMetadata.inputDescription, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.inputDescription.map((desc, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={desc}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.inputDescription];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, inputDescription: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.inputDescription.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.inputDescription];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, inputDescription: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-1 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Output Description</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                outputDescription: [...qForm.codingMetadata.outputDescription, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.outputDescription.map((desc, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={desc}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.outputDescription];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, outputDescription: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.outputDescription.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.outputDescription];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, outputDescription: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Constraints</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                constraints: [...qForm.codingMetadata.constraints, '']
                                                            }
                                                        })}
                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all flex items-center justify-center"
                                                    >
                                                        <Plus size={12} />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    {qForm.codingMetadata.constraints.map((c, idx) => (
                                                        <div key={idx} className="flex gap-2 items-center">
                                                            <input
                                                                type="text"
                                                                required
                                                                placeholder={`Bullet point ${idx + 1}`}
                                                                value={c}
                                                                onChange={e => {
                                                                    const newArr = [...qForm.codingMetadata.constraints];
                                                                    newArr[idx] = e.target.value;
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, constraints: newArr}});
                                                                }}
                                                                className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-xs focus:bg-white transition-all outline-none"
                                                            />
                                                            {qForm.codingMetadata.constraints.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newArr = [...qForm.codingMetadata.constraints];
                                                                        newArr.splice(idx, 1);
                                                                        setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, constraints: newArr}});
                                                                    }}
                                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="md:col-span-2 space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Sample Examples (Visible to Students)</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setQForm({
                                                            ...qForm,
                                                            codingMetadata: {
                                                                ...qForm.codingMetadata,
                                                                examples: [...qForm.codingMetadata.examples, { input: '', output: '', explanation: '' }]
                                                            }
                                                        })}
                                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-blue-100 transition-all shadow-sm outline-none"
                                                    >
                                                        <Plus size={14} /> Add Example
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-6">
                                                    {qForm.codingMetadata.examples.map((ex, idx) => (
                                                        <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200/60 relative group/example shadow-sm">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Example {idx + 1}</span>
                                                                {qForm.codingMetadata.examples.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr.splice(idx, 1);
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Input</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Input for this example..."
                                                                        value={ex.input}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].input = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-4 focus:ring-blue-500/5 outline-none shadow-inner"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Output</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Expected output..."
                                                                        value={ex.output}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].output = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-4 focus:ring-blue-500/5 outline-none shadow-inner"
                                                                    />
                                                                </div>
                                                                <div className="md:col-span-2">
                                                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Explanation (Optional)</label>
                                                                    <textarea
                                                                        rows="2"
                                                                        placeholder="Explanation of how the input leads to the output..."
                                                                        value={ex.explanation || ''}
                                                                        onChange={e => {
                                                                            const newArr = [...qForm.codingMetadata.examples];
                                                                            newArr[idx].explanation = e.target.value;
                                                                            setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, examples: newArr}});
                                                                        }}
                                                                        className="w-full p-4 bg-white border border-slate-200 rounded-xl font-medium text-xs focus:ring-4 focus:ring-blue-500/5 outline-none"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4 bg-slate-100 p-1.5 rounded-2xl w-fit">
                                                {['python', 'java', 'cpp', 'c'].map(lang => (
                                                    <button 
                                                        key={lang} 
                                                        type="button" 
                                                        onClick={() => setStarterLang(lang)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${starterLang === lang ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:text-slate-800'}`}
                                                    >
                                                        {lang}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="h-[300px] rounded-[2rem] overflow-hidden border border-slate-200 shadow-inner">
                                                <Editor 
                                                    height="100%" 
                                                    theme="vs-dark" 
                                                    language={starterLang === 'c' ? 'c' : starterLang === 'cpp' ? 'cpp' : starterLang === 'java' ? 'java' : 'python'} 
                                                    value={qForm.codingMetadata.starterCode?.[starterLang] || ''} 
                                                    onChange={(val) => setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, starterCode: {...qForm.codingMetadata.starterCode, [starterLang]: val}}})} 
                                                    options={{ minimap: { enabled: false }, fontSize: 14, padding: { top: 20 } }}
                                                />
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 italic">This code will load as default for students selecting {starterLang.toUpperCase()}</p>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="flex justify-between items-center">
                                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Multiple Test Cases</label>
                                                <button type="button" onClick={addTestCase} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100">
                                                    <PlusCircle size={14} /> Append Case
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                {qForm.codingMetadata.testCases.map((tc, idx) => (
                                                    <div key={idx} className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 relative group/tc">
                                                        <div className="flex justify-between items-center mb-6">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 border shadow-sm">#{idx+1}</span>
                                                                <button 
                                                                    type="button" 
                                                                    onClick={() => updateTestCase(idx, 'isVisible', !tc.isVisible)}
                                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${tc.isVisible ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}
                                                                >
                                                                    {tc.isVisible ? <Eye size={12} /> : <EyeOff size={12} />} {tc.isVisible ? 'Visible (Sample)' : 'Hidden (Primary)'}
                                                                </button>
                                                            </div>
                                                            {qForm.codingMetadata.testCases.length > 1 && (
                                                                <button type="button" onClick={() => {
                                                                    const n = [...qForm.codingMetadata.testCases];
                                                                    n.splice(idx, 1);
                                                                    setQForm({...qForm, codingMetadata: {...qForm.codingMetadata, testCases: n}});
                                                                }} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div>
                                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Test Case Input</label>
                                                                <textarea rows="2" value={tc.input} onChange={e => updateTestCase(idx, 'input', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-blue-500/20" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Expected Output</label>
                                                                <textarea rows="2" value={tc.expectedOutput} onChange={e => updateTestCase(idx, 'expectedOutput', e.target.value)} className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-mono text-xs focus:ring-2 focus:ring-blue-500/20" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button type="submit" className="w-full py-5 sm:py-7 bg-slate-900 text-white font-black rounded-xl sm:rounded-[2rem] uppercase tracking-widest text-[10px] sm:text-xs shadow-xl active:scale-95 hover:bg-black transition-all flex items-center justify-center gap-3">
                                    <Save size={18} /> Save Question Logic
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}

                {showPublishModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[2rem] sm:rounded-[3rem] w-full max-w-lg p-6 sm:p-10 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                            <button onClick={() => setShowPublishModal(false)} className="absolute right-6 top-6 sm:right-8 sm:top-8 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all z-10"><X size={24} /></button>
                            
                            <div className="mb-8">
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">Publish Assessment</h2>
                                <p className="text-slate-500 text-[11px] sm:text-xs font-bold leading-relaxed max-w-[85%]">Select the target departments for this assessment. Selecting 'All' will make it available to everyone.</p>
                            </div>

                            <form onSubmit={handlePublishConfirm} className="space-y-8 overflow-hidden flex flex-col flex-1">
                                <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                                    <label className={`flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-2 transition-all ${publishDepartments.includes('All') ? 'bg-blue-50 border-blue-600 shadow-lg shadow-blue-600/10' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${publishDepartments.includes('All') ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                            <input type="checkbox" className="hidden" checked={publishDepartments.includes('All')} onChange={() => togglePublishDepartment('All')} />
                                            {publishDepartments.includes('All') && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                        </div>
                                        <span className={`font-black text-xs sm:text-sm uppercase tracking-widest ${publishDepartments.includes('All') ? 'text-blue-600' : 'text-slate-500'}`}>All Departments</span>
                                    </label>
                                    
                                    {availableDepartments.map(dept => (
                                        <label key={dept} className={`flex items-center gap-5 p-5 rounded-2xl cursor-pointer border-2 transition-all ${publishDepartments.includes(dept) ? 'bg-white border-blue-600 shadow-md' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${publishDepartments.includes(dept) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-200'}`}>
                                                <input type="checkbox" className="hidden" checked={publishDepartments.includes(dept)} onChange={() => togglePublishDepartment(dept)} />
                                                {publishDepartments.includes(dept) && <div className="w-2.5 h-2.5 bg-white rounded-[2px]" />}
                                            </div>
                                            <span className={`font-black text-xs sm:text-sm uppercase tracking-widest ${publishDepartments.includes(dept) ? 'text-slate-900' : 'text-slate-400'}`}>{dept}</span>
                                        </label>
                                    ))}
                                </div>
                                <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all">
                                    <Rocket size={18} /> Execute Publish Protocol
                                </button>
                            </form>
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

const StatusBadge = ({ status }) => {
    const colors = { 
        Draft: 'bg-slate-100 text-slate-400', 
        Published: 'bg-blue-50 text-blue-600', 
        Stopped: 'bg-red-50 text-red-600',
        Withdrawn: 'bg-amber-50 text-amber-600 border-amber-100'
    };
    return <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.25em] border shadow-sm ${colors[status] || 'bg-slate-50'}`}>{status}</span>;
};

const StatusToggle = ({ quiz, onPublish, onEnd, onWithdraw, onRestart }) => {
    return (
        <>
            {(quiz.status === 'Draft' || quiz.status === 'Withdrawn') && (
                <button onClick={onPublish} className="col-span-2 sm:flex-none px-6 py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                    <Rocket size={18} fill="white" /> Publish
                </button>
            )}
            {(quiz.status === 'Published' || quiz.status === 'Ongoing') && (
                <>
                    <button onClick={onEnd} className="px-6 py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <Power size={18} /> END
                    </button>
                    <button onClick={onWithdraw} className="px-6 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <ShieldOff size={18} /> Withdraw
                    </button>
                </>
            )}
            {quiz.status === 'Stopped' && (
                 <>
                    <button onClick={onRestart} className="px-6 py-4 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <Plus size={18} /> Restart
                    </button>
                    <button onClick={onWithdraw} className="px-6 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all flex items-center justify-center gap-3 shadow-xl shadow-amber-600/20 active:scale-95 text-[10px] uppercase tracking-widest min-h-[56px]">
                        <ShieldOff size={18} /> Withdraw
                    </button>
                </>
            )}
        </>
    );
};

export default QuizDetails;
