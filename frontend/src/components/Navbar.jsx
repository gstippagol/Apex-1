import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, Menu, X, Home, Info, Phone, LogIn, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/logo_transparent.png';
import museLogo from '../assets/muse_logo.png';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = (id) => {
    if (location.pathname === '/') {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
        window.history.pushState(null, null, `#${id}`);
        setIsMobileMenuOpen(false);
      }
    } else {
      navigate(`/#${id}`);
      setIsMobileMenuOpen(false);
    }
  };

  const scrollToTop = () => {
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
      window.scrollTo({ top: 0 });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-[60] w-full bg-white/60 backdrop-blur-3xl border-b border-white/10 pt-2 md:pt-4 pb-2 safe-pt">
      <nav className="mx-2 md:mx-6 px-4 md:px-10 py-2.5 md:py-3.5 rounded-[1.5rem] md:rounded-[2.5rem] bg-white border border-slate-200/60 shadow-[0_10px_30px_rgba(0,0,0,0.05)] md:shadow-[0_20px_50px_rgba(0,0,0,0.1)]">
        <div className="w-full flex justify-between items-center">
          <Link to="/" onClick={scrollToTop} className="flex items-center gap-2 md:gap-10 group overflow-hidden">
            <div className="flex items-center gap-2 md:gap-5 pr-3 md:pr-10 border-r border-slate-200 shrink-0">
              <div className="w-7 h-7 md:w-12 md:h-12">
                <img src={logo} alt="APEX" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] md:text-2xl font-bold tracking-tight text-slate-800 leading-none">
                  APEX <span className="text-blue-600">Club</span>
                </span>
                <span className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 leading-none">
                  Peak of Success
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
              <div className="w-7 h-7 md:w-10 md:h-10 shrink-0">
                <img src={museLogo} alt="MUSE" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="hidden md:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5">Affiliated To</span>
                <span className="text-[7px] md:text-xs font-bold text-slate-600 tracking-tight leading-[1.1] uppercase max-w-[120px] md:max-w-none whitespace-normal">
                  Mysore University School of Engineering
                </span>
              </div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" onClick={scrollToTop} className="text-[13px] font-semibold uppercase tracking-[0.15em] text-slate-500 hover:text-blue-600 transition-colors">Home</Link>
            <button onClick={() => scrollToSection('footer')} className="text-[13px] font-semibold uppercase tracking-[0.15em] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none">About</button>
            <button onClick={() => scrollToSection('footer')} className="text-[13px] font-semibold uppercase tracking-[0.15em] text-slate-500 hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-none">Contact</button>

            {user ? (
              <div className="flex items-center gap-5">
                <Link
                  to="/account"
                  className="flex items-center gap-3 text-slate-800 font-bold bg-slate-50 px-5 py-2.5 rounded-2xl hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm border border-slate-100"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center text-[11px] font-bold shadow-md">
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[150px] truncate text-sm">{(user.role === 'admin' || user.role === 'superadmin') ? 'Administrator' : user.name}</span>
                </Link>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-red-500 hover:bg-red-50 px-5 py-2.5 rounded-2xl transition-all border border-transparent hover:border-red-100"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <Link to="/login" className="text-[13px] font-semibold uppercase tracking-widest text-slate-500 hover:text-blue-600 px-3 py-2 transition-all">Login</Link>
                <Link to="/register" className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[11px] font-semibold uppercase tracking-widest shadow-2xl hover:bg-black hover:scale-105 active:scale-95 transition-all">Get Started</Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed top-[88px] inset-0 bg-slate-900/60 backdrop-blur-md z-[51] md:hidden"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-[88px] left-4 right-4 max-h-[calc(100vh-120px)] bg-white z-[52] md:hidden shadow-2xl rounded-[2.5rem] flex flex-col p-8 overflow-y-auto border border-slate-100"
            >
              <div className="flex flex-col gap-3 flex-1">
                {[
                  { to: "/", icon: Home, label: "Home", action: scrollToTop },
                  { icon: Info, label: "About", action: () => scrollToSection('footer') },
                  { icon: Phone, label: "Contact", action: () => scrollToSection('footer') },
                  ...(user ? [{ to: '/account', icon: User, label: "Account", highlight: true }] : [])
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * idx }}
                  >
                    {item.to ? (
                      <Link 
                        to={item.to} 
                        onClick={() => { if(item.action) item.action(); setIsMobileMenuOpen(false); }}
                        className={`flex items-center gap-4 p-4 rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] transition-all ${
                          item.highlight ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                      >
                        <item.icon size={18} /> {item.label}
                      </Link>
                    ) : (
                      <button 
                        onClick={() => { item.action(); setIsMobileMenuOpen(false); }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all text-left"
                      >
                        <item.icon size={18} /> {item.label}
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                {user ? (
                  <motion.button 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                    className="flex items-center justify-center gap-3 w-full py-4 bg-red-50 text-red-500 rounded-2xl font-semibold text-[11px] uppercase tracking-[0.2em] transition-all border border-red-100/50"
                  >
                    <LogOut size={18} /> Logout
                  </motion.button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <Link 
                      to="/login" 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="flex items-center justify-center gap-2 py-4 bg-slate-50 text-slate-600 rounded-2xl font-semibold text-[10px] uppercase tracking-[0.15em] border border-slate-200/50"
                    >
                      Login
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={() => setIsMobileMenuOpen(false)} 
                      className="flex items-center justify-center gap-2 py-4 bg-slate-900 text-white rounded-2xl font-semibold text-[10px] uppercase tracking-[0.15em] shadow-lg shadow-slate-900/20"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
