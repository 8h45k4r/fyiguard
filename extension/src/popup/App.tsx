import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DetectionEvent, UserSettings, ExtensionState } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { COLORS, BRAND } from '../shared/theme';
import AuthScreen from './AuthScreen';

const P = COLORS.primary;

interface AuthState {
  isAuthenticated: boolean;
  user: { userId: string; email: string; role: string } | null;
}

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<ExtensionState>({
    isEnabled: true, user: null, policies: [], recentEvents: [], analyticsCache: null, lastSync: null,
  });
  const [tab, setTab] = useState<'dashboard' | 'events' | 'settings'>('dashboard');

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

  return (
    <div style={{ width: 360, fontFamily: "'Outfit', sans-serif", background: '#F8FAFC' }}>
      <div style={{ background: P, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>FYI Guard</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{auth.user?.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: state.isEnabled ? '#22C55E' : '#EF4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
            {state.isEnabled ? 'ON' : 'OFF'}
          </span>
          <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
        {(['dashboard', 'events', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? '#E8F5EC' : '#fff', color: tab === t ? P : '#666',
            fontWeight: tab === t ? 600 : 400, fontFamily: "'Outfit', sans-serif",
            borderBottom: tab === t ? `2px solid ${P}` : '2px solid transparent',
            fontSize: 13, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 12, maxHeight: 340, overflow: 'auto' }}>
        {tab === 'dashboard' && <Dashboard events={state.recentEvents} />}
        {tab === 'events' && <EventsList events={state.recentEvents} />}
        {tab === 'settings' && <SettingsPanel />}
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid #E5E7EB', textAlign: 'center', fontSize: 11, color: '#9CA3AF' }}>
        Powered by <a href={BRAND.website} target="_blank" style={{ color: P, textDecoration: 'none' }}>{BRAND.name}</a>
      </div>
    </div>
  );
};

const Dashboard: React.FC<{ events: DetectionEvent[] }> = ({ events }) => {
  const blocked = events.filter(e => e.eventType === 'BLOCK').length;
  const warned = events.filter(e => e.eventType === 'WARN').length;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <StatCard label="Blocked" value={blocked} color="#EF4444" />
        <StatCard label="Warned" value={warned} color="#F59E0B" />
        <StatCard label="Total" value={events.length} color={COLORS.primary} />
      </div>
      <h3 style={{ fontSize: 14, margin: '16px 0 12px' }}>Recent Activity</h3>
      {events.slice(0, 5).map((e, i) => (
        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
          <span style={{ background: e.eventType === 'BLOCK' ? '#FEE2E2' : '#FEF3C7', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, color: e.eventType === 'BLOCK' ? '#DC2626' : '#92400E' }}>{e.eventType}</span>
          {' '}<strong>{e.detection.category}</strong>
          <span style={{ float: 'right', color: '#9CA3AF' }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
      {!events.length && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No events yet</div>}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fff', borderRadius: 8, padding: '12px 8px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
    <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6B7280' }}>{label}</div>
  </div>
);

const EventsList: React.FC<{ events: DetectionEvent[] }> = ({ events }) => (
  <div>
    {events.map((e, i) => (
      <div key={i} style={{ padding: 10, borderBottom: '1px solid #F3F4F6', fontSize: 12 }}>
        <div><strong>{e.eventType}</strong>: {e.detection.category} <span style={{ float: 'right', color: '#9CA3AF' }}>{new Date(e.timestamp).toLocaleString()}</span></div>
        <div style={{ color: '#6B7280', fontSize: 11, marginTop: 4 }}>Platform: {e.context.platform} | Confidence: {Math.round(e.detection.confidence * 100)}%</div>
      </div>
    ))}
    {!events.length && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 20 }}>No events recorded</div>}
  </div>
);

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (res) => {
      if (res?.settings) setSettings(res.settings);
    });
  }, []);
  const save = () => { chrome.storage.local.set({ settings }); };
  return (
    <div style={{ fontSize: 13 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 12px' }}>Categories</h3>
      {Object.entries(settings.categories).map(([key, val]) => (
        <label key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, cursor: 'pointer' }}>
          <span>{key}</span>
          <input type="checkbox" checked={val as boolean}
            onChange={e => setSettings({ ...settings, categories: { ...settings.categories, [key]: e.target.checked } })} />
        </label>
      ))}
      <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>General</h3>
      <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span>Auto-block critical</span>
        <input type="checkbox" checked={settings.autoBlock}
          onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
      </label>
      <button onClick={save} style={{
        width: '100%', padding: 10, background: COLORS.primary, color: '#fff',
        border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, marginTop: 12,
      }}>Save Settings</button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);