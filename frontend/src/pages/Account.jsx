import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { 
    User, Mail, Shield, Smartphone, Fingerprint, 
    Building2, Calendar, Award, ShieldCheck, Zap
} from 'lucide-react';

const Account = () => {
    const { user } = useAuth();

    if (!user) return null;

    const infoGroups = [
        {
            title: "Identity Protocol",
            icon: <Fingerprint className="text-blue-500" />,
            items: [
                { label: "Full Name", value: user.name, icon: <User size={16} /> },
                { label: "Register Number (USN)", value: user.usn || 'NOT_ASSIGNED', icon: <Shield size={16} /> },
                { label: "Department", value: user.department || 'GENERAL_CORE', icon: <Building2 size={16} /> }
            ]
        },
        {
            title: "Contact Mesh",
            icon: <Smartphone className="text-emerald-500" />,
            items: [
                { label: "Email Terminal", value: user.email, icon: <Mail size={16} /> },
                { label: "Mobile Mobile", value: user.mobileNumber || '+91 XXX XXX XXXX', icon: <Smartphone size={16} /> }
            ]
        },
        {
            title: "System Clearance",
            icon: <ShieldCheck className="text-purple-500" />,
            items: [
                { label: "Access Level", value: user.role.toUpperCase(), icon: <Zap size={16} /> },
                { label: "Account Status", value: "AUTHENTICATED", icon: <Award size={16} /> }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            
            <main className="max-w-4xl mx-auto px-6 py-20">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-12"
                >
                    <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Account Registry</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Secure Identity & Protocol Overview</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                    {/* Header Card */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700" />
                        
                        <div className="flex flex-col md:flex-row items-center gap-10 relative">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-blue-600/30">
                                {user.name?.[0]}
                            </div>
                            <div className="text-center md:text-left">
                                <h2 className="text-3xl font-black text-slate-800 mb-2">{user.name}</h2>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                                    <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2">
                                        <ShieldCheck size={14} /> {user.role}
                                    </span>
                                    <span className="px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-100 flex items-center gap-2">
                                        <Calendar size={14} /> Active Session
                                    </span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Info Sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {infoGroups.map((group, idx) => (
                            <motion.div 
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white rounded-[2.5rem] p-8 shadow-lg shadow-slate-100 border border-slate-100"
                            >
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="p-2 bg-slate-50 rounded-xl">
                                        {group.icon}
                                    </div>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{group.title}</h3>
                                </div>
                                
                                <div className="space-y-6">
                                    {group.items.map((item, i) => (
                                        <div key={i} className="group">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1 flex items-center gap-2 opacity-70">
                                                {item.icon} {item.label}
                                            </p>
                                            <div className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 group-hover:border-blue-200 transition-colors">
                                                {item.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                        
                        {/* Summary Stats / Extra Card */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-900/20 text-white flex flex-col justify-between relative overflow-hidden"
                        >
                            <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-2">Portal Access</h3>
                                <p className="text-slate-400 text-xs font-bold leading-relaxed">
                                    Your account is fully synchronized with the APEX Club central database. All administrative actions are logged for security.
                                </p>
                            </div>
                            <div className="mt-12 flex items-center justify-between">
                                <div className="flex -space-x-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center">
                                            <ShieldCheck size={14} className="text-blue-400" />
                                        </div>
                                    ))}
                                </div>
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Verified Identity</span>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Account;
