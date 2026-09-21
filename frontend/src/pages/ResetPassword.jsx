import React, { useState } from 'react';
import { authService } from '../services/api';
import { Lock, ArrowLeft, CheckCircle2, AlertCircle, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';

const ResetPassword = ({ onNavigate, token: initialToken = '' }) => {
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Please provide the reset token');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.resetPassword(token.trim(), newPassword);
      if (res.success) {
        setSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--bg-main)',
      display: 'flex',
      flexDirection: 'column',
      width: '100%'
    }}>
      {/* 1. Clean Top Header Bar */}
      <header style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border-normal)',
        padding: '12px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src="/assets/forge_badge.png" 
            alt="Forge India Connect" 
            style={{ width: '38px', height: '38px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              FORGE INDIA CONNECT
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--forge-gold-dark)', fontWeight: 700 }}>
              Agent Manager Portal &bull; Set New Password
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('login')}
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ArrowLeft size={13} /> Back to Sign In
        </button>
      </header>

      {/* 2. Full-Screen Window-Fit Body */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '28px 24px 36px'
      }}>
        {/* Panoramic Hero Welcome Card */}
        <section aria-label="Password reset banner" className="hero-welcome-card" style={{ marginBottom: '16px' }}>
          <div 
            className="hero-watermark-overlay" 
            style={{ backgroundImage: `url('/assets/temple_watermark.jpg')` }}
          />

          <div className="hero-top-row">
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: '#fef3c7',
                color: '#b45309',
                fontSize: '0.68rem',
                fontWeight: 700,
                marginBottom: '6px',
                border: '1px solid #fde68a'
              }}>
                <Shield size={12} /> Security Protocol &bull; Token Verification
              </div>
              <h1 className="hero-greeting-title" style={{ fontSize: '1.45rem' }}>
                Set New <span className="hero-greeting-name">Manager Password</span>
              </h1>
              <p className="hero-greeting-sub" style={{ fontSize: '0.85rem' }}>
                Provide the authorization reset token and choose a secure 6+ character password.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="hero-quote-box">
                “ Connecting Businesses <br />Creating Opportunities ”
              </div>
            </div>
          </div>
        </section>

        {/* Main Card */}
        <div style={{
          maxWidth: '560px',
          margin: '0 auto'
        }}>
          <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                Create New Confidential Password
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Step 2 of 2
              </span>
            </div>

            <div className="card-body" style={{ padding: '22px' }}>
              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '0.78rem',
                  marginBottom: '16px'
                }}>
                  <AlertCircle size={15} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {success ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px'
                  }}>
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                    Password Reset Successful!
                  </h3>
                  <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '6px', marginBottom: '20px' }}>
                    Your manager portal password has been updated. You can now sign in with your new credentials.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      background: 'var(--forge-gold-vibrant)',
                      color: '#0f172a',
                      border: 'none'
                    }}
                    onClick={() => onNavigate('login')}
                  >
                    Sign In with New Password
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                      Reset Authorization Token <span style={{ color: 'var(--forge-red)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      style={{ fontSize: '0.84rem' }}
                      placeholder="Enter or paste reset token"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                      New Password (Min 6 chars) <span style={{ color: 'var(--forge-red)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        className="form-input"
                        style={{ paddingLeft: '38px', paddingRight: '38px', fontSize: '0.84rem' }}
                        placeholder="Enter strong password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '18px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                      Confirm New Password <span style={{ color: 'var(--forge-red)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        className="form-input"
                        style={{ paddingLeft: '38px', paddingRight: '38px', fontSize: '0.84rem' }}
                        placeholder="Re-enter password to confirm"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      background: 'var(--forge-gold-vibrant)',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Updating Password...' : 'Save New Password & Authorize'}
                    {!loading && <ArrowRight size={15} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
