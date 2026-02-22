import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DetectionEvent, UserSettings, ExtensionState } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { COLORS, BRAND } from '../shared/theme';
import AuthScreen from './AuthScreen';

const P = COLORS.primary;
const FREE_SCAN_LIMIT = 5;

interface AuthState {
  isAuthenticated: boolean;
  user: { userId: string; email: string; role: string } | null;
}

interface PlanState {
  plan: 'free' | 'pro';
  scansToday: number;
  scanLimit: number;
}

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loading, setLoading] = useState<boolean>(true);
  const [state, setState] = useState<ExtensionState>({
    isEnabled: true,
    user: null,
    policies: [],
    recentEvents: [],
    analyticsCache: null,
    lastSync: null,
  });
  const [tab, setTab] = useState<'dashboard' | 'events' | 'settings'>('dashboard');
  const [planState, setPlanState] = useState<PlanState>({
    plan: 'free',
    scansToday: 0,
    scanLimit: FREE_SCAN_LIMIT,
  });
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (res) => {
      if (res?.isAuthenticated) {
        setAuth({ isAuthenticated: true, user: res.user });
      }
      setLoading(false);
    });

    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.settings) setState(prev => ({ ...prev, ...res.settings }));
    });

    chrome.storage.local.get(null, (data) => {
      const events = Object.entries(data)
        .filter(([k]) => k.startsWith('event_'))
        .map(([, v]) => v as DetectionEvent)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);
      setState(prev => ({ ...prev, recentEvents: events }));

      // Load plan state
      const today = new Date().toISOString().slice(0, 10);
      const scanKey = `scans_${today}`;
      const scansToday = (data[scanKey] as number) || 0;
      const plan = (data['user_plan'] as 'free' | 'pro') || 'free';
      setPlanState({
        plan,
        scansToday,
        scanLimit: plan === 'pro' ? Infinity : FREE_SCAN_LIMIT,
      });

      // Show onboarding if first time
      if (!data['onboarding_seen']) {
        setShowOnboarding(true);
        chrome.storage.local.set({ onboarding_seen: true });
      }
    });
  }, []);

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
      setAuth({ isAuthenticated: false, user: null });
    });
  };

  if (loading) return <div style={{ width: 360, padding: 40, textAlign: 'center' }}>Loading...</div>;

  if (!auth.isAuthenticated) {
    return <AuthScreen onAuthSuccess={(data) => {
      setAuth({ isAuthenticated: true, user: { userId: data.userId, email: data.email, role: data.role } });
    }} />;
  }

  const scansRemaining = planState.plan === 'pro' ? Infinity : planState.scanLimit - planState.scansToday;

  return (
    <div style={{ width: 360, fontFamily: "'Outfit', sans-serif", background: '#F8F9FA' }}>
      {/* Onboarding Tooltip */}
      {showOnboarding && (
        <div style={{
          background: P, color: '#fff', padding: '12px 16px', fontSize: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Welcome! FYI Guard scans your AI prompts for sensitive data in real-time.</span>
          <button
            onClick={() => setShowOnboarding(false)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginLeft: 8 }}
          >x</button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>FYI Guard</span>
          <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{auth.user?.email}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
            background: state.isEnabled ? '#E8F5EC' : '#FEE2E2',
            color: state.isEnabled ? P : '#FF4444',
          }}>{state.isEnabled ? 'ON' : 'OFF'}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 11, color: '#6b7280' }}>Logout</button>
        </div>
      </div>

      {/* Freemium Banner */}
      {planState.plan === 'free' && (
        <div style={{ background: '#FFF8E1', padding: '8px 16px', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #FFE082' }}>
          <span>{scansRemaining > 0 ? `${scansRemaining}/${FREE_SCAN_LIMIT} free scans left today` : 'Daily free scans used'}</span>
          <button
            onClick={() => chrome.tabs.create({ url: BRAND.website + '/pricing' })}
            style={{ background: P, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
          >Upgrade</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #eee' }}>
        {(['dashboard', 'events', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? '#E8F5EC' : '#fff',
            color: tab === t ? P : '#666',
            fontWeight: tab === t ? 600 : 400,
            fontFamily: "'Outfit', sans-serif",
            borderBottom: tab === t ? `2px solid ${P}` : '2px solid transparent',
            fontSize: 13, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {tab === 'dashboard' && <Dashboard events={state.recentEvents} plan={planState.plan} />}
        {tab === 'events' && <EventsList events={state.recentEvents} />}
        {tab === 'settings' && <SettingsPanel />}
      </div>

      {/* Footer with Privacy Link */}
      <div style={{ textAlign: 'center', padding: '8px 16px 12px', fontSize: 11, color: '#999', borderTop: '1px solid #eee', background: '#fff' }}>
        Powered by <a href={BRAND.website} target="_blank" rel="noopener noreferrer" style={{ color: P, textDecoration: 'none' }}>{BRAND.name}</a>
        {' | '}
        <a href={BRAND.privacyUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#999', textDecoration: 'none' }}>Privacy</a>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ events: DetectionEvent[]; plan: string }> = ({ events, plan }) => {
  const blocked = events.filter(e => e.eventType === 'BLOCK').length;
  const warned = events.filter(e => e.eventType === 'WARN').length;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <StatCard label="Blocked" value={blocked} color="#FF4444" />
        <StatCard label="Warned" value={warned} color="#FF9800" />
        <StatCard label="Total" value={events.length} color={P} />
      </div>

      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Recent Activity</h3>
      {events.slice(0, 5).map((e, i) => (
        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
          <span style={{
            display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600,
            background: e.eventType === 'BLOCK' ? '#FFEBEE' : '#FFF8E1',
            color: e.eventType === 'BLOCK' ? '#FF4444' : '#FF9800',
          }}>{e.eventType}</span>{' '}
          <strong>{e.detection.category}</strong>{' '}
          <span style={{ color: '#999' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
      {!events.length && (
        <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>&#128737;</div>
          <p style={{ margin: 0, fontSize: 13 }}>No events yet</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#bbb' }}>Start using AI tools to see detection activity</p>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
  </div>
);

const EventsList: React.FC<{ events: DetectionEvent[] }> = ({ events }) => (
  <div>
    {events.map((e, i) => (
      <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 12 }}>
          <strong>{e.eventType}</strong>: {e.detection.category}{' '}
          <span style={{ color: '#999', fontSize: 11 }}>{new Date(e.timestamp).toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          Platform: {e.context.platform} | Confidence: {Math.round(e.detection.confidence * 100)}%
        </div>
      </div>
    ))}
    {!events.length && <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 13 }}>No events recorded</div>}
  </div>
);

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.settings) setSettings(res.settings);
    });
  }, []);

  const save = () => {
    chrome.storage.local.set({ settings });
  };

  return (
    <div>
      <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>Categories</h3>
      {Object.entries(settings.categories).map(([key, val]) => (
        <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
          <span>{key}</span>
          <input type="checkbox" checked={val as boolean}
            onChange={e => setSettings({ ...settings, categories: { ...settings.categories, [key]: e.target.checked } })} />
        </label>
      ))}

      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Sensitivity</h3>
      <select
        value={settings.sensitivity}
        onChange={e => setSettings({ ...settings, sensitivity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
        style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}
      >
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
      </select>

      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>General</h3>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        <span>Auto-block critical</span>
        <input type="checkbox" checked={settings.autoBlock}
          onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
      </label>

      <button onClick={save} style={{
        width: '100%', padding: 10, marginTop: 16, background: P, color: '#fff',
        border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13,
      }}>Save Settings</button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);