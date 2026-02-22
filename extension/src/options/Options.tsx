import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { UserSettings } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/defaultPolicy';
import { COLORS, BRAND } from '../shared/theme';
import { authFetch, getAuthState } from '../shared/auth-utils';
import { API_ENDPOINTS } from '../shared/config';

type Tab = 'detection' | 'platforms' | 'notifications' | 'organization' | 'advanced';

const Options: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('detection');
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['settings'], (data) => {
      if (data.settings) setSettings(data.settings);
    });
    getAuthState().then(({ user: u }) => {
      if (u) setUser({ email: u.email, role: u.role });
    });
  }, []);

  const save = () => {
    chrome.storage.local.set({ settings }, () => {
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED', settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32, fontFamily: "'Outfit', sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>FYI Guard Settings</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>
        Configure detection, platforms, org, and notifications.
        {user && <span> ({user.email} - {user.role})</span>}
      </p>

      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {(['detection', 'platforms', 'notifications', 'organization', 'advanced'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 14px', border: 'none', cursor: 'pointer',
            borderRadius: '6px 6px 0 0',
            background: activeTab === tab ? COLORS.primary : 'transparent',
            color: activeTab === tab ? '#fff' : '#6b7280',
            fontWeight: activeTab === tab ? 600 : 400,
            fontSize: 13, textTransform: 'capitalize',
          }}>{tab}</button>
        ))}
      </div>

      <div style={cardStyle}>
        {activeTab === 'detection' && <DetectionTab settings={settings} setSettings={setSettings} />}
        {activeTab === 'platforms' && <PlatformsTab settings={settings} setSettings={setSettings} />}
        {activeTab === 'notifications' && <NotificationsTab settings={settings} setSettings={setSettings} />}
        {activeTab === 'organization' && <OrgTab userRole={user?.role || 'MEMBER'} />}
        {activeTab === 'advanced' && <AdvancedTab settings={settings} setSettings={setSettings} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={save} style={{
          padding: '10px 24px', background: COLORS.primary, color: '#fff', border: 'none',
          borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14,
        }}>Save Settings</button>
        {saved && <span style={{ color: '#22C55E', fontWeight: 600 }}>Saved!</span>}
      </div>

      <p style={{ marginTop: 24, color: '#9ca3af', fontSize: 12 }}>
        FYI Guard v1.0.0 | <a href={BRAND.website} target="_blank" rel="noreferrer">{BRAND.name}</a>
      </p>
    </div>
  );
};

const DetectionTab: React.FC<{ settings: UserSettings; setSettings: (s: UserSettings) => void }> = ({ settings, setSettings }) => (
  <div>
    <h3 style={sTitle}>Detection Categories</h3>
    {Object.entries(settings.categories).map(([key, val]) => (
      <label key={key} style={toggleRow}>
        <span>{key.replace(/_/g, ' ')}</span>
        <input type="checkbox" checked={val as boolean}
          onChange={e => setSettings({ ...settings, categories: { ...settings.categories, [key]: e.target.checked } })} />
      </label>
    ))}
    <h3 style={{ ...sTitle, marginTop: 16 }}>Sensitivity</h3>
    <select value={settings.sensitivity}
      onChange={e => setSettings({ ...settings, sensitivity: e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' })}
      style={selStyle}>
      <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
    </select>
  </div>
);

const PlatformsTab: React.FC<{ settings: UserSettings; setSettings: (s: UserSettings) => void }> = ({ settings, setSettings }) => {
  const platforms = [
    { key: 'chatgpt.com', label: 'ChatGPT' },
    { key: 'claude.ai', label: 'Claude' },
    { key: 'gemini.google.com', label: 'Gemini' },
    { key: 'copilot.microsoft.com', label: 'Copilot' },
    { key: 'perplexity.ai', label: 'Perplexity' },
    { key: 'poe.com', label: 'Poe' },
  ];
  const toggle = (domain: string) => {
    const list = settings.enabledPlatforms;
    const next = list.includes(domain) ? list.filter(d => d !== domain) : [...list, domain];
    setSettings({ ...settings, enabledPlatforms: next });
  };
  return (
    <div>
      <h3 style={sTitle}>Monitored Platforms</h3>
      {platforms.map(p => (
        <label key={p.key} style={toggleRow}>
          <span>{p.label}</span>
          <input type="checkbox" checked={settings.enabledPlatforms.includes(p.key)} onChange={() => toggle(p.key)} />
        </label>
      ))}
    </div>
  );
};

const NotificationsTab: React.FC<{ settings: UserSettings; setSettings: (s: UserSettings) => void }> = ({ settings, setSettings }) => (
  <div>
    <h3 style={sTitle}>Notification Settings</h3>
    <label style={toggleRow}>
      <span>Browser notifications</span>
      <input type="checkbox" checked={settings.notifications.browser}
        onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, browser: e.target.checked } })} />
    </label>
    <label style={toggleRow}>
      <span>Email notifications</span>
      <input type="checkbox" checked={settings.notifications.email}
        onChange={e => setSettings({ ...settings, notifications: { ...settings.notifications, email: e.target.checked } })} />
    </label>
  </div>
);

const OrgTab: React.FC<{ userRole: string }> = ({ userRole }) => {
  const [org, setOrg] = useState<{ id: string; name: string; slug: string; members: { user: { email: string; role: string } }[] } | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [newOrg, setNewOrg] = useState({ name: '', slug: '' });
  const isAdmin = userRole === 'ADMIN';
  const baseUrl = API_ENDPOINTS.events.replace('/events', '');

  useEffect(() => {
    authFetch(`${baseUrl}/organizations/mine`).then(r => r.json()).then(data => {
      if (data.organizations?.length > 0) setOrg(data.organizations[0].org);
    }).catch(() => {});
  }, []);

  const createOrg = async () => {
    if (!newOrg.name || !newOrg.slug) return;
    const res = await authFetch(`${baseUrl}/organizations`, {
      method: 'POST', body: JSON.stringify(newOrg),
    });
    if (res.ok) {
      const data = await res.json();
      setOrg(data.org);
      setMsg('Organization created!');
    } else {
      const err = await res.json();
      setMsg(err.message || 'Failed');
    }
  };

  const invite = async () => {
    if (!inviteEmail || !org) return;
    const res = await authFetch(`${baseUrl}/organizations/${org.id}/invite`, {
      method: 'POST', body: JSON.stringify({ email: inviteEmail, role: 'member' }),
    });
    const data = await res.json();
    setMsg(data.message || 'Done');
    setInviteEmail('');
  };

  if (!org) {
    return (
      <div>
        <h3 style={sTitle}>Create Organization</h3>
        <input style={inputStyle} placeholder="Organization Name" value={newOrg.name}
          onChange={e => setNewOrg({ ...newOrg, name: e.target.value })} />
        <input style={inputStyle} placeholder="slug (lowercase, no spaces)" value={newOrg.slug}
          onChange={e => setNewOrg({ ...newOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
        <button onClick={createOrg} style={btnStyle}>Create Organization</button>
        {msg && <p style={{ color: '#22C55E', marginTop: 8 }}>{msg}</p>}
      </div>
    );
  }

  return (
    <div>
      <h3 style={sTitle}>{org.name}</h3>
      <p style={{ color: '#6b7280', fontSize: 13 }}>Slug: {org.slug} | Members: {org.members?.length || 0}</p>
      {isAdmin && (
        <div style={{ marginTop: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600 }}>Invite Member</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ ...inputStyle, flex: 1 }} placeholder="user@company.com" value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)} />
            <button onClick={invite} style={btnStyle}>Invite</button>
          </div>
        </div>
      )}
      <h4 style={{ fontSize: 14, fontWeight: 600, marginTop: 16 }}>Members</h4>
      {org.members?.map((m, i) => (
        <div key={i} style={toggleRow}>
          <span>{m.user.email}</span>
          <span style={{ color: '#6b7280', fontSize: 12 }}>{m.user.role}</span>
        </div>
      ))}
      {msg && <p style={{ color: '#22C55E', marginTop: 8 }}>{msg}</p>}
    </div>
  );
};

const AdvancedTab: React.FC<{ settings: UserSettings; setSettings: (s: UserSettings) => void }> = ({ settings, setSettings }) => (
  <div>
    <h3 style={sTitle}>Advanced</h3>
    <label style={toggleRow}>
      <span>Auto-block critical</span>
      <input type="checkbox" checked={settings.autoBlock}
        onChange={e => setSettings({ ...settings, autoBlock: e.target.checked })} />
    </label>
  </div>
);

const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const sTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: '#1a1a2e', margin: '0 0 12px' };
const toggleRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' };
const selStyle: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 14 };
const inputStyle: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 14, marginBottom: 8, boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { padding: '10px 16px', background: COLORS.primary, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 };

const container = document.getElementById('root');
if (container) { createRoot(container).render(<Options />); }
