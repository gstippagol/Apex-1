import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const SubmitConfirmation = ({ onConfirm, onCancel, stats }) => {
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center"
            >
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Final Submission</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    Are you sure you want to end the exam? You have answered <b>{stats.answered}</b> out of <b>{stats.total}</b> questions.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                        Review Answers
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                        Yes, Submit <CheckCircle2 size={18} />
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default SubmitConfirmation;
