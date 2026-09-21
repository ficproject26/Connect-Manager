import React, { useState } from 'react';
import { authService } from '../services/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Key, Shield, ArrowRight } from 'lucide-react';

const ForgotPassword = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [demoToken, setDemoToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await authService.forgotPassword(email);
      if (res.success) {
        setSubmitted(true);
        if (res.demoResetToken) {
          setDemoToken(res.demoResetToken);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to request password reset');
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
              Agent Manager Portal &bull; Password Assistance
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
        <section aria-label="Password recovery banner" className="hero-welcome-card" style={{ marginBottom: '16px' }}>
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
                <Shield size={12} /> Account Recovery &bull; Security Verification
              </div>
              <h1 className="hero-greeting-title" style={{ fontSize: '1.45rem' }}>
                Manager Credential <span className="hero-greeting-name">Password Recovery</span>
              </h1>
              <p className="hero-greeting-sub" style={{ fontSize: '0.85rem' }}>
                Official verification protocol for registered State, District, Division, and PIN Code Managers.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="hero-quote-box">
                “ Connecting Businesses <br />Creating Opportunities ”
              </div>
            </div>
          </div>
        </section>

        {/* Main Recovery Card Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 500px)',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* Left Column: Security Instructions */}
          <div className="card" style={{ margin: 0, padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Key size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Security Verification Guidelines
                </h3>
                <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
                  Resetting your managerial portal access key
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Official Email Match:</strong> Enter the exact official email address you used during manager registration.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>One-Time Reset Token:</strong> An authorization token will be generated to securely update your password.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Territory Retention:</strong> Resetting your password retains your assigned territory (State, District, Division, PIN) without any interruption.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Reset Form Card */}
          <div className="card" style={{ margin: 0, boxShadow: 'var(--shadow-card)' }}>
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0 }}>
                Request Password Reset
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Step 1 of 2
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

              {submitted ? (
                <div>
                  <div style={{
                    padding: '14px',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: 'var(--radius-md)',
                    color: '#065f46',
                    marginBottom: '18px',
                    fontSize: '0.84rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
                      <CheckCircle2 size={18} />
                      Reset Token Issued
                    </div>
                    <div>If your email is registered in our records, a secure password reset token has been generated.</div>
                  </div>

                  {demoToken && (
                    <div style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      padding: '14px',
                      borderRadius: 'var(--radius-sm)',
                      marginBottom: '18px'
                    }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Generated Reset Token:
                      </div>
                      <code style={{ fontSize: '0.8rem', color: '#4338ca', wordBreak: 'break-all', display: 'block', padding: '6px 8px', background: '#eef2ff', borderRadius: '4px' }}>
                        {demoToken}
                      </code>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          background: 'var(--forge-gold-vibrant)',
                          color: '#0f172a',
                          fontWeight: 800,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onClick={() => onNavigate('reset-password', { token: demoToken })}
                      >
                        <span>Proceed to Set New Password</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                      Registered Official Email <span style={{ color: 'var(--forge-red)' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="email"
                        required
                        className="form-input"
                        style={{ paddingLeft: '38px', fontSize: '0.84rem' }}
                        placeholder="e.g. rohan.deshmukh@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
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
                    {loading ? 'Processing...' : 'Request Password Reset Token'}
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

export default ForgotPassword;
