import React, { useState } from 'react';
import { COLORS, BRAND } from '../shared/theme';
import {
  isValidEmail,
  isValidPassword,
  isPublicDomain,
  registerUser,
  loginUser,
  saveAuthState,
  isOfflineMode,
  forgotPassword,
  resendVerification,
} from '../shared/auth-utils';

const P = COLORS.primary;

interface AuthScreenProps {
  onAuthSuccess: (data: { token: string; userId: string; email: string; role: string }) => void;
}

type AuthMode = 'login' | 'signup' | 'forgot' | 'verify-notice';

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [domainWarning, setDomainWarning] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const validate = (): boolean => {
    setError(null);
    setDomainWarning(false);
    if (!isValidEmail(email)) { setError('Please enter a valid email'); return false; }
    if (mode !== 'forgot' && !isValidPassword(password)) { setError('Password must be at least 8 characters'); return false; }
    if (mode === 'signup' && isPublicDomain(email)) setDomainWarning(true);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setOfflineNotice(false);
    try {
      if (mode === 'forgot') {
        const res = await forgotPassword(email);
        setSuccess(res.message || 'If an account exists, a reset link has been sent to your email.');
        setLoading(false);
        return;
      }

      if (mode === 'signup') {
        const res = await registerUser(email, password, name || undefined);
        if (res.emailVerified === false) {
          setMode('verify-notice');
          setSuccess('Account created! Please check your email and click the verification link before signing in.');
          setLoading(false);
          return;
        }
      }

      if (mode === 'login') {
        const res = await loginUser(email, password);
        await saveAuthState(res.token, {
          userId: res.userId,
          email: res.email,
          role: res.role || 'MEMBER',
        });
        const offline = await isOfflineMode();
        if (offline) setOfflineNotice(true);
        onAuthSuccess({ token: res.token, userId: res.userId, email: res.email, role: res.role || 'MEMBER' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      // If email not verified, show verify-notice mode
      if (msg.includes('verify your email')) {
        setMode('verify-notice');
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) { setError('Please enter your email address'); return; }
    setLoading(true);
    try {
      const res = await resendVerification(email);
      setSuccess(res.message || 'Verification email sent. Please check your inbox.');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 10, borderRadius: 8,
    border: '1px solid #ddd', fontFamily: "'Outfit', sans-serif",
    fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
  };

  const linkStyle: React.CSSProperties = {
    color: P, cursor: 'pointer', fontWeight: 600, fontSize: 13,
  };

  return (
    <div style={{ width: 360, fontFamily: "'Outfit', sans-serif", background: '#fff' }}>
      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={BRAND.logoUrl} alt="FYI Guard" height={32} />
          <h2 style={{ margin: '8px 0 4px', fontSize: 18, color: '#1a1a2e' }}>
            {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Verify Email'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            {mode === 'login' ? 'Sign in to FYI Guard'
              : mode === 'signup' ? 'Start protecting your prompts'
              : mode === 'forgot' ? 'Enter your email to receive a reset link'
              : 'Check your inbox for the verification link'}
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: 10,
            borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        {success && (
          <div style={{ background: '#D1FAE5', color: '#065F46', padding: 10,
            borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{success}</div>
        )}

        {offlineNotice && (
          <div style={{ background: '#DBEAFE', color: '#1D4ED8', padding: 10,
            borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            Running in offline mode. Your data is stored locally.
          </div>
        )}

        {domainWarning && (
          <div style={{ background: '#FEF3C7', color: '#92400E', padding: 10,
            borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            Public email detected. Use a work email to join your organization.
          </div>
        )}

        {/* Verify-notice mode */}
        {mode === 'verify-notice' && (
          <div>
            <input style={inputStyle} type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} />
            <button onClick={handleResendVerification} disabled={loading} style={{
              width: '100%', padding: 12, background: loading ? '#aaa' : P,
              color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginTop: 4,
            }}>Resend Verification Email</button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
              Already verified?{' '}
              <span onClick={() => { setMode('login'); setError(null); setSuccess(null); }} style={linkStyle}>Sign In</span>
            </div>
          </div>
        )}

        {/* Forgot password mode */}
        {mode === 'forgot' && (
          <div>
            <input style={inputStyle} type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            <button onClick={handleSubmit} disabled={loading} style={{
              width: '100%', padding: 12, background: loading ? '#aaa' : P,
              color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginTop: 4,
            }}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
              Remember your password?{' '}
              <span onClick={() => { setMode('login'); setError(null); setSuccess(null); }} style={linkStyle}>Sign In</span>
            </div>
          </div>
        )}

        {/* Login / Signup mode */}
        {(mode === 'login' || mode === 'signup') && (
          <div>
            {mode === 'signup' && (
              <input style={inputStyle} placeholder="Full Name" value={name}
                onChange={e => setName(e.target.value)} />
            )}
            <input style={inputStyle} type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)} />
            <input style={inputStyle} type="password" placeholder="Password (min 8 chars)"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

            {mode === 'login' && (
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <span onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }}
                  style={{ ...linkStyle, fontSize: 12, fontWeight: 500 }}>Forgot Password?</span>
              </div>
            )}

            <button onClick={handleSubmit} disabled={loading} style={{
              width: '100%', padding: 12, background: loading ? '#aaa' : P,
              color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginTop: 4,
            }}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>

            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setSuccess(null); }}
                style={linkStyle}>
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;