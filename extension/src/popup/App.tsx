// FYI Guard - Popup App
// Branding: Primary #368F4D | Font: Outfit | Logo: Certifyi
import React, { useState, useEffect } from 'react';
import { DetectionEvent, UserSettings, ExtensionState } from '../shared/types';

const LOGO_URL = 'https://certifyi.ai/wp-content/uploads/2025/01/logoblue.svg';
const PRIMARY = '#368F4D';
const PRIMARY_DARK = '#2B7A3E';
const PRIMARY_LIGHT = '#E8F5EC';

const App: React.FC = () => {
  const [state, setState] = useState<ExtensionState>({
    isEnabled: true, user: null, policies: [],
    recentEvents: [], analyticsCache: null, lastSync: null,
  });
  const [tab, setTab] = useState<'dashboard' | 'events' | 'settings'>('dashboard');

  useEffect(() => {
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

  return (
    <div style={{ width: 380, fontFamily: 'Outfit, sans-serif', background: '#fff' }}>
      <header style={{ background: PRIMARY, color: '#fff', padding: '16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={LOGO_URL} alt="FYI Guard" height={28} />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>FYI Guard</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>AI Prompt Guardian</p>
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 11 }}>{state.isEnabled ? 'ON' : 'OFF'}</span>
          <div style={{
            width: 36, height: 20, borderRadius: 10,
            background: state.isEnabled ? '#fff' : 'rgba(255,255,255,0.3)',
            position: 'relative', transition: '0.2s',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              background: state.isEnabled ? PRIMARY : '#ccc',
              position: 'absolute', top: 2,
              left: state.isEnabled ? 18 : 2, transition: '0.2s',
            }} />
          </div>
        </label>
      </header>

      <nav style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {(['dashboard', 'events', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
            background: tab === t ? PRIMARY_LIGHT : '#fff',
            color: tab === t ? PRIMARY : '#666',
            fontWeight: tab === t ? 600 : 400, fontFamily: 'Outfit, sans-serif',
            borderBottom: tab === t ? `2px solid ${PRIMARY}` : '2px solid transparent',
            fontSize: 13, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </nav>

      <main style={{ padding: 16, minHeight: 200 }}>
        {tab === 'dashboard' && <Dashboard events={state.recentEvents} />}
        {tab === 'events' && <EventsList events={state.recentEvents} />}
        {tab === 'settings' && <Settings />}
      </main>

      <footer style={{ padding: '8px 16px', borderTop: '1px solid #eee', fontSize: 11, color: '#999', textAlign: 'center' }}>
        Powered by <a href="https://certifyi.ai" style={{ color: PRIMARY }}>Certifyi.ai</a>
      </footer>
    </div>
  );
};

const Dashboard: React.FC<{ events: DetectionEvent[] }> = ({ events }) => {
  const blocked = events.filter(e => e.eventType === 'BLOCK').length;
  const warned = events.filter(e => e.eventType === 'WARN').length;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <StatCard label="Blocked" value={blocked} color="#FF4444" />
        <StatCard label="Warnings" value={warned} color="#FF9800" />
      </div>
      <h3 style={{ fontSize: 14, color: '#333', margin: '12px 0 8px' }}>Recent Activity</h3>
      {events.slice(0, 5).map((e, i) => (
        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
          <span style={{ color: e.eventType === 'BLOCK' ? '#FF4444' : '#FF9800', fontWeight: 600 }}>
            {e.eventType}
          </span>
          {' '}<span style={{ color: '#666' }}>{e.detection.category}</span>
          <span style={{ float: 'right', color: '#999' }}>
            {new Date(e.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
      {!events.length && <p style={{ color: '#999', textAlign: 'center', padding: 20 }}>No events yet</p>}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 16, textAlign: 'center', borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#666' }}>{label}</div>
  </div>
);

const EventsList: React.FC<{ events: DetectionEvent[] }> = ({ events }) => (
  <div>
    {events.map((e, i) => (
      <div key={i} style={{ padding: 12, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: e.eventType === 'BLOCK' ? '#FF4444' : '#FF9800' }}>
            {e.eventType}: {e.detection.category}
          </span>
          <span style={{ fontSize: 11, color: '#999' }}>{new Date(e.timestamp).toLocaleString()}</span>
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>
          Platform: {e.context.platform} | Confidence: {Math.round(e.detection.confidence * 100)}%
        </div>
      </div>
    ))}
    {!events.length && <p style={{ color: '#999', textAlign: 'center', padding: 20 }}>No events recorded</p>}
  </div>
);

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    notifications: { email: false, browser: true },
    sensitivity: 'HIGH', autoBlock: true,
    whitelistedDomains: [], enabledPlatforms: ['chatgpt.com', 'claude.ai', 'gemini.google.com'],
  });
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <span>Auto-block critical data</span>
          <input type="checkbox" checked={settings.autoBlock} onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
        </label>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
          <span>Browser notifications</span>
          <input type="checkbox" checked={settings.notifications.browser} onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, browser: e.target.checked } })} />
        </label>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Sensitivity</label>
        <select value={settings.sensitivity} onChange={e => setSettings({ ...settings, sensitivity: e.target.value as any })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontFamily: 'Outfit, sans-serif' }}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <button style={{ width: '100%', padding: 10, background: PRIMARY, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}>
        Save Settings
      </button>
    </div>
  );
};

export default App;