import React from 'react';
import logo from '../assets/logo_transparent.png';

const LoadingScreen = ({ message = "Synchronizing...", fullScreen = true, dark = true }) => {
    // Determine the container layout based on fullScreen and theme options
    const containerStyle = fullScreen
        ? {
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: dark ? '#0f0f1a' : '#f8fafc', // dark theme or light slate theme
            zIndex: 9999,
            fontFamily: 'Inter, system-ui, sans-serif',
          }
        : {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 0',
            width: '100%',
            fontFamily: 'Inter, system-ui, sans-serif',
          };

    const textStyle = {
        marginTop: '20px',
        fontSize: fullScreen ? '18px' : '14px',
        fontWeight: '900',
        color: dark ? '#60a5fa' : '#2563eb', // blue theme
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        animation: 'pulse 1.5s infinite ease-in-out',
    };

    return (
        <div style={containerStyle}>
            {/* Keyframe animations injected dynamically if they don't exist */}
            <style>{`
                @keyframes spin-loader {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
            `}</style>

            <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* Buffering ring */}
                <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: `4px solid ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(37,99,235,0.08)'}`,
                    borderTop: `4px solid ${dark ? '#3b82f6' : '#2563eb'}`, // Blue spinner
                    borderRight: `4px solid ${dark ? '#60a5fa' : '#60a5fa'}`, // Lighter blue accent
                    animation: 'spin-loader 1s linear infinite',
                }} />
                
                {/* Small Logo Centered */}
                <img 
                    src={logo} 
                    alt="APEX Logo" 
                    style={{ 
                        width: '44px', 
                        height: '44px', 
                        objectFit: 'contain',
                        opacity: 0.95
                    }} 
                />
            </div>
            {message && <div style={textStyle}>{message}</div>}
        </div>
    );
};

export default LoadingScreen;
