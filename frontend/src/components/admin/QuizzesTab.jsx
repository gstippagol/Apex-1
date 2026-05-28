import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Rocket, Trash2, Edit2, Play, Power, Calendar, Clock, CheckSquare, ShieldOff, Camera, Mic, Shield, Maximize2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../ConfirmModal';

const QuizzesTab = () => {
    const navigate = useNavigate();
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);

    const getLocalISO = (date) => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString();
    };
    const minDate = getLocalISO(new Date()).split('T')[0];
    const [searchTerm, setSearchTerm] = useState('');
    const [showLaunchModal, setShowLaunchModal] = useState(false);

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
    const [launchForm, setLaunchForm] = useState({
        title: '',
        duration: 30, // minutes
        scheduledDate: '',
        isRestricted: false,
        fullscreenOnly: false,
        proctoring: { camera: false, microphone: false }
    });

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
            toast.error('Failed to sync quizzes');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateQuiz = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_BASE}/api/quiz`, {
                ...launchForm,
                duration: launchForm.duration * 60 // convert to seconds
            });
            toast.success('Quiz Blueprint Created');
            setShowLaunchModal(false);
            fetchQuizzes();
            navigate(`/admin/quiz/${res.data.data._id}`);
        } catch (err) {
            toast.error('Creation failed');
        }
    };

    const handleDeleteQuiz = async (id, quizTitle = 'this quiz') => {
        triggerConfirm({
            title: 'Delete Quiz Protocol',
            message: `Are you sure you want to delete "${quizTitle}"? This will permanently delete the quiz and all associated questions.`,
            confirmText: 'Delete Quiz',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE}/api/quiz/${id}`);
                    toast.success('Protocol Terminated');
                    fetchQuizzes();
                } catch (err) {
                    toast.error('Deletion failed');
                }
            }
        });
    };

    const handleStopQuiz = async (id) => {
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/stop`);
            toast.success('Quiz session terminated');
            fetchQuizzes();
        } catch (err) {
            toast.error('End session failed');
        }
    };

    const handleWithdrawQuiz = async (id) => {
        try {
            await axios.patch(`${API_BASE}/api/quiz/${id}/withdraw`);
            toast.success('Quiz withdrawn from students');
            fetchQuizzes();
        } catch (err) {
            toast.error('Withdrawal failed');
        }
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            Draft: 'bg-slate-100 text-slate-400',
            Published: 'bg-blue-50 text-blue-600',
            Ongoing: 'bg-emerald-50 text-emerald-600 animate-pulse',
            Stopped: 'bg-red-50 text-red-600',
            Withdrawn: 'bg-amber-50 text-amber-600 border-amber-100'
        };
        return <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${colors[status] || 'bg-slate-50'}`}>{status}</span>;
    };

    const filteredQuizzes = quizzes.filter(q => 
        q.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">Quiz Portfolio</h2>
                    <p className="text-slate-500 font-medium uppercase text-[10px] tracking-[0.2em]">Manage quick assessments and logic tests</p>
                </div>
                <button 
                    onClick={() => setShowLaunchModal(true)}
                    className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-slate-900/10 active:scale-95"
                >
                    <Plus size={20} /> Launch New Quiz
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative group max-w-xl">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input 
                    type="text" 
                    placeholder="Filter quiz registry..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-16 pr-8 py-5 bg-white border border-slate-200 rounded-3xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm"
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4" />
                    <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Accessing Registry...</p>
                </div>
            ) : filteredQuizzes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredQuizzes.map(quiz => (
                        <div key={quiz._id} className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 hover:shadow-2xl hover:border-blue-100 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all flex gap-2">
                                <button 
                                    disabled={quiz.status !== 'Draft' && quiz.status !== 'Withdrawn'}
                                    onClick={() => navigate(`/admin/quiz/${quiz._id}`)} 
                                    className={`p-3 bg-white border border-slate-100 rounded-xl text-blue-600 hover:shadow-lg transition-all ${(quiz.status !== 'Draft' && quiz.status !== 'Withdrawn') ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    title={(quiz.status !== 'Draft' && quiz.status !== 'Withdrawn') ? 'Cannot edit published quiz' : 'Edit Quiz'}
                                >
                                    <Edit2 size={16}/>
                                </button>
                                <button onClick={() => handleDeleteQuiz(quiz._id, quiz.title)} className="p-3 bg-white border border-slate-100 rounded-xl text-rose-500 hover:shadow-lg transition-all" title="Delete Quiz"><Trash2 size={16}/></button>
                            </div>
                            
                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 group-hover:bg-blue-50 group-hover:border-blue-100 transition-all">
                                <Rocket size={24} className="text-slate-400 group-hover:text-blue-600 transition-all" />
                            </div>

                            <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight group-hover:text-blue-600 transition-colors truncate pr-16">{quiz.title}</h3>
                            
                            <div className="flex flex-wrap gap-2 mb-6">
                                <StatusBadge status={quiz.status} />
                                <span className="px-3 py-1.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-full border border-blue-100/50">{Math.round(quiz.duration/60)} Mins</span>
                            </div>

                            <div className="space-y-3 pt-6 border-t border-slate-50">
                                <div className="flex items-center gap-3 text-slate-400">
                                    <CheckSquare size={16} />
                                    <span className="text-xs font-bold">{quiz.questions?.length || 0} Questions Loaded</span>
                                </div>
                                {quiz.scheduledDate && (
                                    <div className="flex items-center gap-3 text-slate-400">
                                        <Calendar size={16} />
                                        <span className="text-xs font-bold">{quiz.scheduledDate}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 flex gap-3">
                                {quiz.status === 'Published' || quiz.status === 'Ongoing' ? (
                                    <>
                                        <button 
                                            onClick={() => handleStopQuiz(quiz._id)}
                                            className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/10 flex items-center justify-center gap-2"
                                        >
                                            <Power size={14} /> END
                                        </button>
                                        <button 
                                            onClick={() => handleWithdrawQuiz(quiz._id)}
                                            className="px-4 py-4 bg-amber-500 text-white rounded-2xl font-black hover:bg-amber-600 transition-all shadow-lg shadow-amber-600/10 flex items-center justify-center"
                                            title="Withdraw Quiz"
                                        >
                                            <ShieldOff size={14} />
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={() => navigate(`/admin/quiz/${quiz._id}`)}
                                        className="w-full py-4 bg-slate-50 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all border border-slate-100"
                                    >
                                        Open Builder
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-[3rem] border border-dashed border-slate-200 p-20 text-center">
                    <Rocket size={48} className="mx-auto text-slate-200 mb-6" />
                    <h3 className="text-xl font-black text-slate-400 mb-2">No Quizzes Found</h3>
                    <p className="text-slate-300 font-bold text-sm">Launch a new quiz to populate this registry.</p>
                </div>
            )}

            {/* Launch Modal */}
            {showLaunchModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-[2rem] sm:rounded-[3.5rem] w-full max-w-xl p-6 sm:p-10 shadow-2xl relative overflow-y-auto max-h-[95vh]">
                        <button onClick={() => setShowLaunchModal(false)} className="absolute right-6 top-6 sm:right-8 sm:top-8 p-2 text-slate-400 hover:bg-slate-50 rounded-full transition-all"><Plus className="rotate-45" size={24} /></button>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight mb-8">New Quiz Protocol</h2>
                        <form onSubmit={handleCreateQuiz} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Quiz Title</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={launchForm.title} 
                                    onChange={e => setLaunchForm({...launchForm, title: e.target.value})}
                                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="e.g., Weekly Logic Quiz"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Duration (Minutes)</label>
                                <input 
                                    type="number" 
                                    required 
                                    value={launchForm.duration} 
                                    onChange={e => setLaunchForm({...launchForm, duration: e.target.value})}
                                    className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Scheduling Date</label>
                                    <input 
                                        type="date" 
                                        min={minDate}
                                        value={launchForm.scheduledDate} 
                                        onChange={e => setLaunchForm({...launchForm, scheduledDate: e.target.value})}
                                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${launchForm.proctoring.camera ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <Camera size={18} className={launchForm.proctoring.camera ? 'text-blue-600' : 'text-slate-400'} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Camera</span>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={launchForm.proctoring.camera} onChange={() => setLaunchForm({...launchForm, proctoring: {...launchForm.proctoring, camera: !launchForm.proctoring.camera}})} />
                                    <div className={`w-8 h-4 rounded-full relative transition-all ${launchForm.proctoring.camera ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${launchForm.proctoring.camera ? 'left-4.5' : 'left-0.5'}`} style={{ left: launchForm.proctoring.camera ? '18px' : '2px' }} />
                                    </div>
                                </label>
                                <label className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${launchForm.proctoring.microphone ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <Mic size={18} className={launchForm.proctoring.microphone ? 'text-blue-600' : 'text-slate-400'} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Microphone</span>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={launchForm.proctoring.microphone} onChange={() => setLaunchForm({...launchForm, proctoring: {...launchForm.proctoring, microphone: !launchForm.proctoring.microphone}})} />
                                    <div className={`w-8 h-4 rounded-full relative transition-all ${launchForm.proctoring.microphone ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${launchForm.proctoring.microphone ? 'left-4.5' : 'left-0.5'}`} style={{ left: launchForm.proctoring.microphone ? '18px' : '2px' }} />
                                    </div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <label className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${launchForm.isRestricted ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-4">
                                        <Shield size={20} className={launchForm.isRestricted ? 'text-amber-600' : 'text-slate-400'} />
                                        <div>
                                            <span className="block text-[10px] font-black uppercase tracking-widest leading-none mb-1">Restrict Session</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase leading-tight block">Strict protocol (Tabs + FS)</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={launchForm.isRestricted} onChange={() => setLaunchForm({...launchForm, isRestricted: !launchForm.isRestricted, fullscreenOnly: false})} />
                                    <div className={`w-10 h-5 rounded-full relative transition-all ${launchForm.isRestricted ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${launchForm.isRestricted ? 'left-6' : 'left-1'}`} />
                                    </div>
                                </label>
                                <label className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer ${launchForm.fullscreenOnly ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center gap-4">
                                        <Maximize2 size={20} className={launchForm.fullscreenOnly ? 'text-blue-600' : 'text-slate-400'} />
                                        <div>
                                            <span className="block text-[10px] font-black uppercase tracking-widest leading-none mb-1">Only Full Screen</span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase leading-tight block">No tab switch detection</span>
                                        </div>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={launchForm.fullscreenOnly} onChange={() => setLaunchForm({...launchForm, fullscreenOnly: !launchForm.fullscreenOnly, isRestricted: false})} />
                                    <div className={`w-10 h-5 rounded-full relative transition-all ${launchForm.fullscreenOnly ? 'bg-blue-500' : 'bg-slate-300'}`}>
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${launchForm.fullscreenOnly ? 'left-6' : 'left-1'}`} />
                                    </div>
                                </label>
                            </div>

                            <button type="submit" className="w-full py-6 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl active:scale-95 transition-all">Establish Protocol</button>
                        </form>
                    </div>
                </div>
            )}
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

export default QuizzesTab;
