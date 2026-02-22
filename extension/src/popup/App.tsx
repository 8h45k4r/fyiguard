import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DetectionEvent, UserSettings, ExtensionState } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { COLORS, BRAND } from '../shared/theme';

const P = COLORS.primary;

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
    <div style={{ width: 360, fontFamily: "'Outfit', sans-serif", background: '#fff' }}>
      <header style={{ background: P, color: '#fff', padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={BRAND.logoUrl} alt="FYI Guard" height={28} />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>FYI Guard</h1>
          <p style={{ margin: 0, fontSize: 12, opacity: 0.85 }}>AI Prompt Guardian</p>
        </div>
        <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <span style={{ fontSize: 11 }}>{state.isEnabled ? 'ON' : 'OFF'}</span>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: state.isEnabled ? '#fff' : 'rgba(255,255,255,0.3)', position: 'relative', transition: '0.2s' }}
            onClick={() => setState(prev => ({ ...prev, isEnabled: !prev.isEnabled }))}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: state.isEnabled ? P : '#ccc', position: 'absolute', top: 2, left: state.isEnabled ? 18 : 2, transition: '0.2s' }} />
          </div>
        </label>
      </header>

      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {(['dashboard', 'events', 'settings'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: 10, border: 'none', cursor: 'pointer',
            background: tab === t ? '#E8F5EC' : '#fff',
            color: tab === t ? P : '#666', fontWeight: tab === t ? 600 : 400,
            fontFamily: "'Outfit', sans-serif", borderBottom: tab === t ? `2px solid ${P}` : '2px solid transparent',
            fontSize: 13, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ padding: 16, minHeight: 300 }}>
        {tab === 'dashboard' && <Dashboard events={state.recentEvents} />}
        {tab === 'events' && <EventsList events={state.recentEvents} />}
        {tab === 'settings' && <Settings />}
      </div>

      <footer style={{ textAlign: 'center', padding: 12, fontSize: 11, color: '#999', borderTop: '1px solid #eee' }}>
        Powered by <a href={BRAND.website} target="_blank" style={{ color: P }}>Certifyi.ai</a>
      </footer>
    </div>
  );
};

const Dashboard: React.FC<{ events: DetectionEvent[] }> = ({ events }) => {
  const blocked = events.filter(e => e.eventType === 'BLOCK').length;
  const warned = events.filter(e => e.eventType === 'WARN').length;
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <StatCard label="Blocked" value={blocked} color={COLORS.danger} />
        <StatCard label="Warnings" value={warned} color={COLORS.warning} />
        <StatCard label="Total" value={events.length} color={P} />
      </div>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Recent Activity</h3>
      {events.slice(0, 5).map((e, i) => (
        <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', fontSize: 13 }}>
          <span style={{ background: e.eventType === 'BLOCK' ? '#fee' : '#fff8e1', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{e.eventType}</span>
          {' '}<strong>{e.detection.category}</strong>
          <span style={{ float: 'right', color: '#999', fontSize: 11 }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
        </div>
      ))}
      {!events.length && <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No events yet</p>}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ flex: 1, background: '#f8f9fa', borderRadius: 8, padding: 12, textAlign: 'center' }}>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#666' }}>{label}</div>
  </div>
);

const EventsList: React.FC<{ events: DetectionEvent[] }> = ({ events }) => (
  <div>
    {events.map((e, i) => (
      <div key={i} style={{ padding: 10, marginBottom: 8, background: '#f8f9fa', borderRadius: 8, fontSize: 13 }}>
        <div><strong>{e.eventType}</strong>: {e.detection.category} <span style={{ float: 'right', fontSize: 11, color: '#999' }}>{new Date(e.timestamp).toLocaleString()}</span></div>
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Platform: {e.context.platform} | Confidence: {Math.round(e.detection.confidence * 100)}%</div>
      </div>
    ))}
    {!events.length && <p style={{ color: '#999', textAlign: 'center', padding: 40 }}>No events recorded</p>}
  </div>
);

const Settings: React.FC = () => {
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
    <div style={{ fontSize: 13 }}>
      <h3 style={{ fontSize: 14, marginBottom: 12 }}>Categories</h3>
      {Object.entries(settings.categories).map(([key, val]) => (
        <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ textTransform: 'capitalize' }}>{key}</span>
          <input type="checkbox" checked={val as boolean} onChange={e => setSettings({
            ...settings, categories: { ...settings.categories, [key]: e.target.checked }
          })} />
        </label>
      ))}
      <h3 style={{ fontSize: 14, margin: '16px 0 12px' }}>General</h3>
      <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Auto-block critical</span>
        <input type="checkbox" checked={settings.autoBlock} onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
      </label>
      <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span>Browser notifications</span>
        <input type="checkbox" checked={settings.notifications.browser} onChange={e => setSettings({
          ...settings, notifications: { ...settings.notifications, browser: e.target.checked }
        })} />
      </label>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Sensitivity</label>
        <select value={settings.sensitivity} onChange={e => setSettings({ ...settings, sensitivity: e.target.value as any })} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd', fontFamily: "'Outfit', sans-serif" }}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>
      <button onClick={save} style={{ width: '100%', padding: 10, background: P, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: 14 }}>Save Settings</button>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);