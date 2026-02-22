import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSettings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { COLORS, BRAND } from '../shared/theme';

const Options: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'detection' | 'platforms' | 'notifications' | 'advanced'>('detection');

  useEffect(() => {
    chrome.storage.local.get(['settings'], (data) => {
      if (data.settings) setSettings(data.settings);
    });
  }, []);

  const save = () => {
    chrome.storage.local.set({ settings }, () => {
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", maxWidth: 720, margin: '0 auto', padding: 32, background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ color: COLORS.primary, fontSize: 28, margin: 0 }}>FYI Guard Settings</h1>
        <p style={{ color: '#6b7280', marginTop: 4 }}>Configure detection rules, platform settings, and notifications</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #e5e7eb', paddingBottom: 8 }}>
        {(['detection', 'platforms', 'notifications', 'advanced'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', borderRadius: '6px 6px 0 0',
            background: activeTab === tab ? COLORS.primary : 'transparent',
            color: activeTab === tab ? '#fff' : '#6b7280',
            fontWeight: activeTab === tab ? 600 : 400,
            fontFamily: "'Outfit', sans-serif", fontSize: 14, textTransform: 'capitalize',
          }}>{tab}</button>
        ))}
      </div>

      {activeTab === 'detection' && (
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Detection Categories</h3>
          <p style={sectionDesc}>Choose which types of sensitive data to detect</p>
          {Object.entries(settings.categories).map(([key, val]) => (
            <label key={key} style={toggleRow}>
              <span style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              <input type="checkbox" checked={val as boolean}
                onChange={e => setSettings({ ...settings, categories: { ...settings.categories, [key]: e.target.checked } })} />
            </label>
          ))}
          <h3 style={{ ...sectionTitle, marginTop: 24 }}>Sensitivity Level</h3>
          <select value={settings.sensitivity}
            onChange={e => setSettings({ ...settings, sensitivity: e.target.value as any })}
            style={selectStyle}>
            <option value="LOW">Low - Only high-confidence matches</option>
            <option value="MEDIUM">Medium - Balanced detection</option>
            <option value="HIGH">High - Aggressive, may have false positives</option>
          </select>
        </div>
      )}

      {activeTab === 'platforms' && (
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Monitored Platforms</h3>
          <p style={sectionDesc}>FYI Guard monitors these AI platforms</p>
          {['ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Perplexity'].map(p => (
            <div key={p} style={{ ...toggleRow, justifyContent: 'space-between' }}>
              <span>{p}</span>
              <span style={{ color: COLORS.primary, fontSize: 12 }}>Active</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Notification Settings</h3>
          <label style={toggleRow}>
            <span>Browser notifications</span>
            <input type="checkbox" checked={settings.notifications.browser}
              onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, browser: e.target.checked } })} />
          </label>
          <label style={toggleRow}>
            <span>Sound alerts</span>
            <input type="checkbox" checked={settings.notifications.sound || false}
              onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, sound: e.target.checked } })} />
          </label>
        </div>
      )}

      {activeTab === 'advanced' && (
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Advanced Settings</h3>
          <label style={toggleRow}>
            <span>Auto-block critical findings</span>
            <input type="checkbox" checked={settings.autoBlock}
              onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
          </label>
          <label style={toggleRow}>
            <span>Log events locally</span>
            <input type="checkbox" checked={settings.logEvents !== false}
              onChange={e => setSettings({ ...settings, logEvents: e.target.checked })} />
          </label>
          <button onClick={reset} style={{ marginTop: 16, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: "'Outfit', sans-serif" }}>
            Reset to Defaults
          </button>
        </div>
      )}

      <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} style={{ padding: '10px 24px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontFamily: "'Outfit', sans-serif", fontSize: 15 }}>
          Save Settings
        </button>
        {saved && <span style={{ color: COLORS.primary, fontWeight: 500 }}>Settings saved!</span>}
      </div>

      <div style={{ marginTop: 48, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
        FYI Guard v1.0.0 | Powered by <a href={BRAND.website} target="_blank" style={{ color: COLORS.primary }}>{BRAND.name}</a>
      </div>
    </div>
  );
};

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#1a1a2e', margin: '0 0 4px' };
const sectionDesc: React.CSSProperties = { fontSize: 13, color: '#6b7280', margin: '0 0 16px' };
const toggleRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' };
const selectStyle: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontFamily: "'Outfit', sans-serif", fontSize: 14 };

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}