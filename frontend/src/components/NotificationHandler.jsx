import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { Bell, Info, AlertTriangle, Megaphone } from 'lucide-react';

const NotificationHandler = () => {
    const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? `http://${window.location.hostname}:5000`
    : 'https://apex-s1q2.onrender.com';

    useEffect(() => {
        const socket = io(API_BASE);

        socket.on('broadcast-notice', (data) => {
            console.log('New notice received:', data);
            
            // Determine icon based on type
            const Icon = data.type === 'urgent' ? AlertTriangle : 
                         data.type === 'exam' ? Megaphone : Info;
            
            const iconColor = data.type === 'urgent' ? 'text-red-500' : 
                             data.type === 'exam' ? 'text-blue-500' : 'text-amber-500';

            toast.custom((t) => (
                <div
                    className={`${
                        t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white shadow-2xl rounded-[2rem] pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-slate-100 overflow-hidden`}
                >
                    <div className="flex-1 w-0 p-6">
                        <div className="flex items-start">
                            <div className={`flex-shrink-0 pt-0.5 ${iconColor}`}>
                                <Icon size={24} />
                            </div>
                            <div className="ml-4 flex-1">
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                                    New Broadcast
                                </p>
                                <p className="text-sm font-black text-slate-900 tracking-tight">
                                    {data.title}
                                </p>
                                <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-2">
                                    {data.content}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-l border-slate-100">
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-xs font-black text-blue-600 hover:bg-blue-50 focus:outline-none transition-all uppercase tracking-widest"
                        >
                            Close
                        </button>
                    </div>
                </div>
            ), {
                duration: 6000,
                position: 'top-right'
            });
        });

        return () => socket.disconnect();
    }, [API_BASE]);

    return null;
};

export default NotificationHandler;
