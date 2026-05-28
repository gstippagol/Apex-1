import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Mail, Lock, LogIn, ChevronRight, X, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/logo_transparent.png';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP & New Pass
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotOTP, setForgotOTP] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [isForgotLoading, setIsForgotLoading] = useState(false);

    const { login, forgotPassword, resetPassword, settings } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const handleSecurity = (e) => {
            e.preventDefault();
        };

        const handleKeyDown = (e) => {
            if (e.keyCode === 123 || // F12
                (e.ctrlKey && e.shiftKey && e.keyCode === 73) || // Ctrl+Shift+I
                (e.ctrlKey && e.shiftKey && e.keyCode === 74) || // Ctrl+Shift+J
                (e.ctrlKey && e.shiftKey && e.keyCode === 67) || // Ctrl+Shift+C
                (e.ctrlKey && e.keyCode === 85)) {               // Ctrl+U
                e.preventDefault();
            }
        };

        const blockDevTools = setInterval(() => {
            Function("debugger")();
        }, 50);

        document.addEventListener('copy', handleSecurity);
        document.addEventListener('paste', handleSecurity);
        document.addEventListener('cut', handleSecurity);
        document.addEventListener('contextmenu', handleSecurity);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            clearInterval(blockDevTools);
            document.removeEventListener('copy', handleSecurity);
            document.removeEventListener('paste', handleSecurity);
            document.removeEventListener('cut', handleSecurity);
            document.removeEventListener('contextmenu', handleSecurity);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await login(formData.email, formData.password);
            if (res.success) {
                toast.success('Login Successful!');
                const storedUser = JSON.parse(localStorage.getItem('user'));
                navigate((storedUser.role === 'admin' || storedUser.role === 'superadmin') ? '/admin' : '/student');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotRequest = async (e) => {
        e.preventDefault();
        setIsForgotLoading(true);
        try {
            const res = await forgotPassword(forgotEmail);
            if (res.success) {
                toast.success('Recovery code dispatched');
                setForgotStep(2);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Identity verification failed');
        } finally {
            setIsForgotLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        if (forgotOTP.length !== 6) return toast.error('Invalid 6-digit code');
        if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');
        
        setIsForgotLoading(true);
        try {
            const res = await resetPassword({ email: forgotEmail, otp: forgotOTP, newPassword });
            if (res.success) {
                toast.success('Access Credentials Updated!');
                setShowForgotModal(false);
                setForgotStep(1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Recovery protocol failed');
        } finally {
            setIsForgotLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4 select-none">
            <div className="absolute top-0 left-0 w-full h-full -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/40 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[100px] rounded-full" />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8"
            >
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                            <img src={logo} alt="APEX" className="w-full h-full object-contain scale-110" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Welcome Back</h2>
                    <p className="text-slate-500">Sign in to continue to APEX Club</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                            <input 
                                type="email" 
                                required
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                placeholder="name@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                required
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        {settings?.isEmailEnabled !== false && (
                            <div className="flex justify-end mt-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowForgotModal(true)}
                                    className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-all uppercase tracking-widest"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full btn-primary py-3 flex items-center justify-center gap-2"
                    >
                        {loading ? 'Signing in...' : (
                            <>
                                Sign In <LogIn size={18} />
                            </>
                        )}
                    </button>
                </form>

                {settings?.isRegistrationOpen && (
                    <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                        <p className="text-slate-600">
                            Don't have an account? 
                            <Link to="/register" className="ml-2 text-primary-600 font-semibold hover:underline inline-flex items-center gap-1">
                                Register now <ChevronRight size={14} />
                            </Link>
                        </p>
                    </div>
                )}
            </motion.div>

            {/* Forgot Password Modal */}
            <AnimatePresence>
                {showForgotModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setShowForgotModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
                        />
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-slate-100"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Access Recovery</h3>
                                <button onClick={() => setShowForgotModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={20} /></button>
                            </div>

                            <AnimatePresence mode="wait">
                                {forgotStep === 1 ? (
                                    <motion.form 
                                        key="step1" 
                                        initial={{ opacity: 0, x: -20 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        exit={{ opacity: 0, x: 20 }}
                                        onSubmit={handleForgotRequest} 
                                        className="space-y-6"
                                    >
                                        <p className="text-sm font-bold text-slate-500 leading-relaxed">Enter your registered email terminal to receive a recovery protocol code.</p>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Endpoint</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                <input 
                                                    type="email" 
                                                    required 
                                                    value={forgotEmail} 
                                                    onChange={e => setForgotEmail(e.target.value)}
                                                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                    placeholder="name@example.com"
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            disabled={isForgotLoading}
                                            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                        >
                                            {isForgotLoading ? <Loader2 className="animate-spin" size={20} /> : <>Initialize Recovery <ChevronRight size={18} /></>}
                                        </button>
                                    </motion.form>
                                ) : (
                                    <motion.form 
                                        key="step2" 
                                        initial={{ opacity: 0, x: 20 }} 
                                        animate={{ opacity: 1, x: 0 }} 
                                        exit={{ opacity: 0, x: -20 }}
                                        onSubmit={handleResetPassword} 
                                        className="space-y-6"
                                    >
                                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 mb-2">
                                            <p className="text-xs font-bold text-blue-600 text-center flex items-center justify-center gap-2">
                                                <ShieldCheck size={14} /> Recovery code dispatched to terminal
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">One-Time Recovery Code</label>
                                                <input 
                                                    type="text" 
                                                    required 
                                                    maxLength={6}
                                                    value={forgotOTP} 
                                                    onChange={e => setForgotOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    className="w-full text-center py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-2xl tracking-[0.5em] focus:border-blue-500 outline-none transition-all"
                                                    placeholder="000000"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Secure Passkey</label>
                                                <div className="relative">
                                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                                    <input 
                                                        type="password" 
                                                        required 
                                                        minlength={6}
                                                        value={newPassword} 
                                                        onChange={e => setNewPassword(e.target.value)}
                                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                        placeholder="••••••••"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            disabled={isForgotLoading}
                                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                                        >
                                            {isForgotLoading ? <Loader2 className="animate-spin" size={20} /> : <>Reset Credentials <ShieldCheck size={20} /></>}
                                        </button>
                                        
                                        <button 
                                            type="button" 
                                            onClick={() => setForgotStep(1)}
                                            className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all"
                                        >
                                            ← Incorrect Email Endpoint?
                                        </button>
                                    </motion.form>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Login;
