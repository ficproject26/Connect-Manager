import React, { useState, useEffect } from 'react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import { authService } from '../services/api';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Shield,
  Calendar,
  Building,
  Layers,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Users,
  Store,
  Smartphone,
  KeyRound,
  RotateCcw
} from 'lucide-react';

const Login = ({ onNavigate }) => {
  const { login, loginWithOtp } = useAuth();
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // OTP Login states
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (d) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (d) => {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password.trim()) {
      setError('Please provide your email/mobile and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);
      const userStatus = String(res?.user?.status || '').toLowerCase();
      if (res?.user && userStatus !== 'active' && userStatus !== 'approved') {
        const flowState = userStatus === 'kyc_pending' ? 'kyc_pending' : 'under_review';
        onNavigate('register', {
          user: res.user,
          flowState,
          token: res.token
        });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setOtpMessage('');
    const cleanPhone = mobile.trim();
    if (!cleanPhone || !/^[6-9][0-9]{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await authService.sendOtp(cleanPhone);
      setOtpSent(true);
      setOtpMessage(res.message || 'OTP sent successfully.');
      if (res.otp) {
        setOtp(res.otp);
      }
    } catch (err) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await loginWithOtp(mobile.trim(), otp.trim());
      const userStatus = String(res?.user?.status || '').toLowerCase();
      if (res?.user && userStatus !== 'active' && userStatus !== 'approved') {
        const flowState = userStatus === 'kyc_pending' ? 'kyc_pending' : 'under_review';
        onNavigate('register', {
          user: res.user,
          flowState,
          token: res.token
        });
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (acc) => {
    setIdentifier(acc.email);
    setPassword(acc.password);
    setError('');
    setLoading(true);
    try {
      await login(acc.email, acc.password);
    } catch (err) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  // 4 Primary representative tiers for clean demo selection
  const primaryDemoAccounts = [
    {
      role: 'state_manager',
      title: 'State Manager',
      scope: 'Karnataka (Statewide)',
      email: 'state.mgr1@example.com',
      password: 'Password@123',
      icon: Building,
      color: '#f59e0b',
      bg: '#fffbeb',
      border: '#fde68a'
    },
    {
      role: 'district_manager',
      title: 'District Manager',
      scope: 'Bengaluru Urban District',
      email: 'dist.mgr1@example.com',
      password: 'Password@123',
      icon: Shield,
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd'
    },
    {
      role: 'division_manager',
      title: 'Division Manager',
      scope: 'Bengaluru South Division',
      email: 'div.mgr1@example.com',
      password: 'Password@123',
      icon: Layers,
      color: '#8b5cf6',
      bg: '#f5f3ff',
      border: '#ddd6fe'
    },
    {
      role: 'pincode_manager',
      title: 'PIN Code Manager',
      scope: 'PIN 560034 (Koramangala)',
      email: 'pin.mgr1@example.com',
      password: 'Password@123',
      icon: MapPin,
      color: '#10b981',
      bg: '#ecfdf5',
      border: '#a7f3d0'
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      backgroundImage: `
        radial-gradient(at 0% 0%, rgba(245, 158, 11, 0.08) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(99, 102, 241, 0.06) 0px, transparent 50%),
        radial-gradient(at 50% 50%, rgba(241, 245, 249, 0.5) 0px, transparent 100%)
      `,
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Background Architectural Watermark Overlay from Assets */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url('/assets/temple_watermark.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          opacity: 0.04,
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* 1. Sleek Top Header Bar */}
      <header style={{
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.85)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
        zIndex: 10,
        position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
            border: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.15)'
          }}>
            <img 
              src="/assets/forge_badge.png" 
              alt="Forge India Connect" 
              style={{ width: '30px', height: '30px', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              FORGE INDIA CONNECT
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#ffffff',
                padding: '1px 6px',
                borderRadius: '4px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}>
                Official
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              Agent Manager Portal &bull; Territorial Governance & Merchant Operations
            </div>
          </div>
        </div>

        {/* Live Date/Time Capsule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
          }}>
            <Calendar size={13} style={{ color: '#d97706' }} />
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#334155' }}>
              {formatDate(currentTime)}
            </div>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b' }}>
              {formatTime(currentTime)}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Vertically Centered Main Body */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '490px',
        margin: '0 auto',
        padding: '30px 20px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: '18px',
        zIndex: 5,
        position: 'relative'
      }}>
        {/* Brand Greeting & Status Pill */}
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            color: '#b45309',
            fontSize: '0.72rem',
            fontWeight: 800,
            border: '1px solid #fde68a',
            boxShadow: '0 2px 8px rgba(245, 158, 11, 0.12)'
          }}>
            <Shield size={13} />
            <span>4-Tier Territorial Jurisdiction Gateway</span>
          </div>

          <h1 style={{
            fontSize: '1.6rem',
            fontWeight: 900,
            color: '#0f172a',
            margin: '2px 0 0',
            letterSpacing: '-0.03em',
            lineHeight: 1.2
          }}>
            Sign In to <span style={{
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>Manager Portal</span>
          </h1>

          <p style={{
            fontSize: '0.82rem',
            color: '#64748b',
            margin: 0,
            lineHeight: 1.45,
            maxWidth: '380px'
          }}>
            Enter your authorized manager credentials to access field operations and merchant management.
          </p>
        </div>

        {/* Primary Manager Sign-In Card with Asset Header Banner */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(241, 245, 249, 0.8)',
          overflow: 'hidden',
          transition: 'all 0.2s ease'
        }}>
          {/* Card Top Community Banner from Assets */}
          <div style={{
            position: 'relative',
            height: '92px',
            backgroundImage: `url('/assets/community_banner_v2.jpg')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            display: 'flex',
            alignItems: 'flex-end',
            padding: '12px 18px'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(15, 23, 42, 0.25) 0%, rgba(15, 23, 42, 0.75) 100%)'
            }} />
            <div style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <div style={{ color: '#ffffff' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                  Manager Authentication
                </div>
                <div style={{ fontSize: '0.7rem', color: '#fef08a', fontWeight: 600 }}>
                  Authorized Regional Access
                </div>
              </div>

              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
              }}>
                <Lock size={16} style={{ color: '#b45309' }} />
              </div>
            </div>
          </div>

          <div style={{ padding: '22px 26px 22px' }}>
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 14px',
                borderRadius: '10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '18px'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Mode Selector Tabs */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '18px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => { setLoginMode('password'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loginMode === 'password' ? '#ffffff' : 'transparent',
                  color: loginMode === 'password' ? '#0f172a' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: loginMode === 'password' ? 800 : 600,
                  boxShadow: loginMode === 'password' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Lock size={14} /> Password Login
              </button>
              <button
                type="button"
                onClick={() => { setLoginMode('otp'); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: loginMode === 'otp' ? '#ffffff' : 'transparent',
                  color: loginMode === 'otp' ? '#0f172a' : '#64748b',
                  fontSize: '0.8rem',
                  fontWeight: loginMode === 'otp' ? 800 : 600,
                  boxShadow: loginMode === 'otp' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Smartphone size={14} /> Mobile OTP Login
              </button>
            </div>

            {loginMode === 'password' ? (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Official Email / Mobile Input */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#334155',
                    marginBottom: '6px'
                  }}>
                    Official Email or Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8'
                    }}>
                      <Mail size={16} />
                    </div>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. manager@example.com or 10-digit mobile"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      style={{
                        paddingLeft: '40px',
                        fontSize: '0.86rem',
                        height: '42px',
                        borderRadius: '10px',
                        borderColor: '#cbd5e1',
                        background: '#f8fafc',
                        transition: 'all 0.15s ease'
                      }}
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="form-group" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                      Password <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => onNavigate('forgot-password')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#d97706',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#94a3b8'
                    }}>
                      <Lock size={16} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-input"
                      placeholder="Enter account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{
                        paddingLeft: '40px',
                        paddingRight: '42px',
                        fontSize: '0.86rem',
                        height: '42px',
                        borderRadius: '10px',
                        borderColor: '#cbd5e1',
                        background: '#f8fafc',
                        transition: 'all 0.15s ease'
                      }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Sign In Primary Button */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 18px',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    border: 'none',
                    boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginTop: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            ) : (
              /* Mobile OTP Login Form */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {otpMessage && (
                  <div style={{
                    padding: '10px 12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    color: '#166534',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                    <span>{otpMessage}</span>
                  </div>
                )}

                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    color: '#334155',
                    marginBottom: '6px'
                  }}>
                    Registered Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: '#64748b',
                      fontSize: '0.84rem',
                      fontWeight: 700
                    }}>
                      <Smartphone size={16} style={{ color: '#94a3b8' }} /> +91
                    </div>
                    <input
                      type="tel"
                      maxLength={10}
                      className="form-input"
                      placeholder="10-digit mobile number"
                      value={mobile}
                      disabled={otpSent}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      style={{
                        paddingLeft: '56px',
                        fontSize: '0.86rem',
                        height: '42px',
                        borderRadius: '10px',
                        borderColor: '#cbd5e1',
                        background: otpSent ? '#f1f5f9' : '#f8fafc',
                        letterSpacing: '0.5px',
                        fontWeight: 600
                      }}
                      required
                    />
                  </div>
                </div>

                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || mobile.length !== 10}
                    style={{
                      width: '100%',
                      padding: '12px 18px',
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      border: 'none',
                      boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                      cursor: (loading || mobile.length !== 10) ? 'not-allowed' : 'pointer',
                      opacity: (loading || mobile.length !== 10) ? 0.6 : 1,
                      marginTop: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {loading ? 'Sending OTP...' : 'Get Verification OTP'}
                    {!loading && <ArrowRight size={16} />}
                  </button>
                ) : (
                  <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', margin: 0 }}>
                          Enter 6-Digit OTP <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => { setOtpSent(false); setOtp(''); setOtpMessage(''); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#d97706',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: 0
                          }}
                        >
                          <RotateCcw size={12} /> Change Number
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <div style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8'
                        }}>
                          <KeyRound size={16} />
                        </div>
                        <input
                          type="text"
                          maxLength={6}
                          className="form-input"
                          placeholder="e.g. 123456"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          style={{
                            paddingLeft: '40px',
                            fontSize: '1.1rem',
                            letterSpacing: '4px',
                            fontWeight: 800,
                            height: '44px',
                            borderRadius: '10px',
                            borderColor: '#d97706',
                            background: '#fffbeb',
                            textAlign: 'center'
                          }}
                          required
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length !== 6}
                      style={{
                        width: '100%',
                        padding: '12px 18px',
                        fontSize: '0.92rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        border: 'none',
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
                        cursor: (loading || otp.length !== 6) ? 'not-allowed' : 'pointer',
                        opacity: (loading || otp.length !== 6) ? 0.6 : 1,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {loading ? 'Verifying OTP...' : 'Verify OTP & Sign In'}
                      {!loading && <ArrowRight size={16} />}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Quick Demo Credentials Helper */}
            <div style={{
              marginTop: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Quick demo:</span>
              <button
                type="button"
                onClick={() => { setIdentifier('admin@example.com'); setPassword('admin123'); setError(''); }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                Admin (admin@example.com)
              </button>
              <button
                type="button"
                onClick={() => { setIdentifier('state.mgr1@example.com'); setPassword('Password@123'); setError(''); }}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#92400e',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                State Mgr (state.mgr1@example.com)
              </button>
            </div>

            {/* Single, Prominent Registration Callout Footer */}
            <div style={{
              marginTop: '22px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.8rem'
            }}>
              <span style={{ color: '#64748b' }}>Don't have a manager account?</span>
              <button
                type="button"
                onClick={() => onNavigate('register')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#d97706',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Register as Manager <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

{/* Footer Security Badges */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.7rem',
          color: '#94a3b8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Shield size={12} style={{ color: '#10b981' }} />
            <span>256-Bit SSL Encrypted</span>
          </div>
          <span>&bull;</span>
          <span>ISO 27001 Certified</span>
          <span>&bull;</span>
          <span>Forge India Connect</span>
        </div>
      </main>
    </div>
  );
};

export default Login;

