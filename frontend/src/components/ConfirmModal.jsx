import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertOctagon, HelpCircle, Info, Trash2, X } from 'lucide-react';

const ConfirmModal = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onCancel, 
    confirmText = 'Confirm Action', 
    cancelText = 'Cancel', 
    type = 'danger' 
}) => {
    if (!isOpen) return null;

    const config = {
        danger: {
            bgIcon: 'bg-rose-50 border border-rose-100 text-rose-600',
            button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20',
            icon: <AlertOctagon size={36} />
        },
        warning: {
            bgIcon: 'bg-amber-50 border border-amber-100 text-amber-600',
            button: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20',
            icon: <AlertTriangle size={36} />
        },
        info: {
            bgIcon: 'bg-blue-50 border border-blue-100 text-blue-600',
            button: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20',
            icon: <Info size={36} />
        },
        question: {
            bgIcon: 'bg-indigo-50 border border-indigo-100 text-indigo-600',
            button: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20',
            icon: <HelpCircle size={36} />
        }
    }[type] || {
        bgIcon: 'bg-slate-50 border border-slate-100 text-slate-600',
        button: 'bg-slate-900 hover:bg-black text-white shadow-lg shadow-slate-950/20',
        icon: <HelpCircle size={36} />
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[999] flex items-center justify-center p-4">
                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={onCancel} />
                
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-8 sm:p-10 text-center relative z-10 border border-slate-100 overflow-hidden"
                >
                    {/* Glowing effect in background */}
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

                    <button 
                        onClick={onCancel} 
                        className="absolute right-6 top-6 p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 rounded-full transition-all"
                    >
                        <X size={20} />
                    </button>

                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 ${config.bgIcon}`}>
                        {config.icon}
                    </div>
                    
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3 tracking-tight leading-tight uppercase font-sans">
                        {title}
                    </h3>
                    <p className="text-slate-500 text-xs sm:text-sm mb-8 leading-relaxed font-bold px-2">
                        {message}
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
                        >
                            {cancelText}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            className={`px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${config.button}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default ConfirmModal;
