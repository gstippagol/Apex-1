import { ChevronLeft, ChevronRight, Bookmark, CheckCircle } from 'lucide-react';

const NavigationControls = ({ 
    onPrev, 
    onNext, 
    onMarkReview, 
    isFirst, 
    isLast, 
    isMarked 
}) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 lg:right-80 bg-white border-t border-slate-100 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4 z-40">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                    onClick={onPrev}
                    disabled={isFirst}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                    <ChevronLeft size={20} /> Previous
                </button>
                <button
                    onClick={onNext}
                    disabled={isLast}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                    Next <ChevronRight size={20} />
                </button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                    onClick={onMarkReview}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                        isMarked 
                        ? 'bg-yellow-500 text-white shadow-lg shadow-yellow-500/20' 
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100'
                    }`}
                >
                    <Bookmark size={20} fill={isMarked ? 'white' : 'transparent'} />
                    {isMarked ? 'Marked' : 'Mark for Review'}
                </button>
                
                {isLast && (
                    <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
                        Final Preview <CheckCircle size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default NavigationControls;
