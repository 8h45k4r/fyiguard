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
} from '../shared/auth-utils';

const P = COLORS.primary;

interface AuthScreenProps {
  onAuthSuccess: (data: { token: string; userId: string; email: string; role: string }) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainWarning, setDomainWarning] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState(false);

  const validate = (): boolean => {
    setError(null);
    setDomainWarning(false);
    if (!isValidEmail(email)) { setError('Please enter a valid email'); return false; }
    if (!isValidPassword(password)) { setError('Password must be at least 8 characters'); return false; }
    if (mode === 'signup' && isPublicDomain(email)) setDomainWarning(true);
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setOfflineNotice(false);
    try {
      const res = mode === 'login'
        ? await loginUser(email, password)
        : await registerUser(email, password, name || undefined);

      await saveAuthState(res.token, {
        userId: res.userId,
        email: res.email,
        role: res.role || 'MEMBER',
      });

      // Check if we ended up in offline mode
      const offline = await isOfflineMode();
      if (offline) setOfflineNotice(true);

      onAuthSuccess({ token: res.token, userId: res.userId, email: res.email, role: res.role || 'MEMBER' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: 10, borderRadius: 8,
    border: '1px solid #ddd', fontFamily: "'Outfit', sans-serif",
    fontSize: 14, boxSizing: 'border-box', marginBottom: 10,
  };

  return (
    <div style={{ width: 360, fontFamily: "'Outfit', sans-serif", background: '#fff' }}>
      <div style={{ padding: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src={BRAND.logoUrl} alt="FYI Guard" height={32} />
          <h2 style={{ margin: '8px 0 4px', fontSize: 18, color: '#1a1a2e' }}>
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            {mode === 'login' ? 'Sign in to FYI Guard' : 'Start protecting your prompts'}
          </p>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', color: '#DC2626', padding: 10,
            borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        {offlineNotice && (
          <div style={{ background: '#DBEAFE', color: '#1D4ED8', padding: 10,
            borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            Running in offline mode. Your data is stored locally. Detection features work without a backend.
          </div>
        )}

        {domainWarning && (
          <div style={{ background: '#FEF3C7', color: '#92400E', padding: 10,
            borderRadius: 8, fontSize: 12, marginBottom: 12 }}>
            Public email detected. Use a work email to join your organization.
          </div>
        )}

        {mode === 'signup' && (
          <input style={inputStyle} placeholder="Full Name" value={name}
            onChange={e => setName(e.target.value)} />
        )}
        <input style={inputStyle} type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} />
        <input style={inputStyle} type="password" placeholder="Password (min 8 chars)"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />

        <button onClick={handleSubmit} disabled={loading} style={{
          width: '100%', padding: 12, background: loading ? '#aaa' : P,
          color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
          fontSize: 14, fontWeight: 600, fontFamily: "'Outfit', sans-serif", marginTop: 4,
        }}>{loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</button>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#6b7280' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <span onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            style={{ color: P, cursor: 'pointer', fontWeight: 600 }}>
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
