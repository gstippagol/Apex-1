import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Mail, Lock, User, UserPlus, ChevronRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/logo_transparent.png';

const Register = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        department: '',
        usn: '',
        mobileNumber: '+91',
        role: 'student'
    });
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: Info, 2: OTP
    const [otp, setOtp] = useState('');
    const { register, sendOTP, verifyOTP, settings } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (settings && !settings.isRegistrationOpen) {
            navigate('/login');
        }
    }, [settings, navigate]);

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
        if (formData.password !== formData.confirmPassword) {
            return toast.error('Passwords do not match');
        }

        const emailDomain = formData.email.split('@')[1]?.toLowerCase() || '';
        const allowedDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'protonmail.com', 'zoho.com', 'live.com', 'msn.com', 'ymail.com', 'googlemail.com', 'apex.com'];
        const isEduDomain = emailDomain.endsWith('.edu') || emailDomain.endsWith('.edu.in') || emailDomain.endsWith('.ac.in');

        if (!allowedDomains.includes(emailDomain) && !isEduDomain) {
            return toast.error('Please use a valid institution or primary email provider. Temporary emails are strictly blocked.');
        }

        // Password strength validation
        const password = formData.password;
        if (password.length < 10 || password.length > 16) {
            return toast.error('Password must be between 10 and 16 characters long');
        }
        if (!/[A-Z]/.test(password)) {
            return toast.error('Password must contain at least one uppercase letter');
        }
        if (!/[a-z]/.test(password)) {
            return toast.error('Password must contain at least one lowercase letter');
        }
        if (!/[^A-Za-z0-9]/.test(password)) {
            return toast.error('Password must contain at least one special character');
        }
        if (formData.mobileNumber.length !== 13) {
            return toast.error('Mobile number must be exactly 10 digits with +91');
        }
        setLoading(true);
        try {
            if (settings?.isEmailEnabled === false) {
                const res = await register(formData);
                if (res.success) {
                    toast.success('Registration successful! Welcome to APEX.');
                    navigate(formData.role === 'admin' ? '/admin' : '/student');
                }
            } else {
                const res = await sendOTP(formData);
                if (res.success) {
                    toast.success('Verification code dispatched to your email');
                    setStep(2);
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || (settings?.isEmailEnabled === false ? 'Failed to complete registration' : 'Failed to dispatch verification code'));
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) return toast.error('Please enter a valid 6-digit code');

        setLoading(true);
        try {
            const res = await verifyOTP({ ...formData, otp });
            if (res.success) {
                toast.success('Identity Verified! Welcome to APEX.');
                navigate(formData.role === 'admin' ? '/admin' : '/student');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Verification protocol failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
            <div className="absolute top-0 left-0 w-full h-full -z-10">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-100/40 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-100/40 blur-[100px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 p-8 my-8"
            >
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 bg-slate-50 p-2 rounded-2xl border border-slate-100 shadow-inner">
                            <img src={logo} alt="APEX" className="w-full h-full object-contain scale-110" />
                        </div>
                    </div>
                    <h2 className="text-3xl font-bold mb-2">{step === 1 ? 'Create Account' : 'Verify Identity'}</h2>
                    <p className="text-slate-500">
                        {step === 1 ? 'Join APEX Club platform today' : `Enter the 6-digit code sent to ${formData.email}`}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 ? (
                        <motion.form
                            key="step1"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Full Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            required
                                            className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                                            placeholder="Harshith"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="email"
                                            required
                                            className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                                            placeholder="harshith@gmail.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Department</label>
                                    <select
                                        required
                                        className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold cursor-pointer"
                                        value={formData.department}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    >
                                        <option value="">Select Dept</option>
                                        <option value="CSD">Computer Science & Design</option>
                                        <option value="CSE">Computer Science & Engineering</option>
                                        <option value="AIML">Artificial Intelligence & ML</option>
                                        <option value="AIDS">Artificial Intelligence & DS</option>
                                        <option value="CEE">Civil & Env Engineering</option>
                                        <option value="BMRE">Biomedical and Robotic Engineering</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">USN</label>
                                    <input
                                        type="text"
                                        required
                                        maxLength={9}
                                        className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold uppercase tracking-widest"
                                        placeholder="23SECD049"
                                        value={formData.usn}
                                        onChange={(e) => setFormData({ ...formData, usn: e.target.value.toUpperCase().slice(0, 9) })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Mobile Number</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full text-sm px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                                    placeholder="+919102020202"
                                    value={formData.mobileNumber}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (!val.startsWith('+91')) {
                                            val = '+91' + val.replace(/\D/g, '');
                                        } else {
                                            val = '+91' + val.slice(3).replace(/\D/g, '');
                                        }
                                        setFormData({ ...formData, mobileNumber: val.slice(0, 13) });
                                    }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="password"
                                            required
                                            minLength={10}
                                            maxLength={16}
                                            className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Confirm Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="password"
                                            required
                                            minLength={10}
                                            maxLength={16}
                                            className="w-full text-sm pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                                            placeholder="••••••••"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                                    settings?.isEmailEnabled === false ? (
                                        <>
                                            Complete Registration <ChevronRight size={18} />
                                        </>
                                    ) : (
                                        <>
                                            Get Verification Code <ChevronRight size={18} />
                                        </>
                                    )
                                )}
                            </button>
                        </motion.form>
                    ) : (
                        <motion.form
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onSubmit={handleVerifyOTP}
                            className="space-y-6"
                        >
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-500 uppercase mb-1 text-center">One-Time Code</label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    className="w-full text-3xl text-center py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:outline-none focus:ring-8 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black tracking-[0.5em] text-slate-800"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                    <>
                                        Verify & Complete Registry <UserPlus size={20} />
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="w-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all"
                            >
                                ← Back to Information
                            </button>
                        </motion.form>
                    )}
                </AnimatePresence>

                <p className="text-center mt-8 text-sm text-slate-500">
                    Already have an account?{' '}
                    <Link to="/login" className="text-blue-600 font-bold hover:underline">
                        Log In
                    </Link>
                </p>
            </motion.div>
        </div>
    );
};

export default Register;
