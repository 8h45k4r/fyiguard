// FYI Guard - Branding & Theme Constants
// Single source for all branding values used across popup, content scripts, and overlays.

export const BRAND = {
  name: 'FYI Guard',
  tagline: 'AI Prompt Guardian',
  logoUrl: 'https://certifyi.ai/wp-content/uploads/2025/01/logoblue.svg',
  website: 'https://certifyi.ai',
  poweredBy: 'Certifyi.ai',
} as const;

export const COLORS = {
  primary: '#368F4D',
  primaryDark: '#2B7A3E',
  primaryLight: '#E8F5EC',
  danger: '#FF4444',
  warning: '#FF9800',
  success: '#4CAF50',
  text: '#333333',
  textMuted: '#666666',
  textLight: '#999999',
  background: '#FFFFFF',
  backgroundAlt: '#F8F9FA',
  border: '#EEEEEE',
  borderLight: '#F0F0F0',
} as const;

export const FONTS = {
  family: "'Outfit', sans-serif",
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '13px',
  sizeLg: '14px',
  sizeXl: '18px',
  weightNormal: 400,
  weightMedium: 500,
  weightSemiBold: 600,
  weightBold: 700,
} as const;

export const LAYOUT = {
  popupWidth: 380,
  borderRadius: '8px',
  borderRadiusSm: '6px',
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
  },
} as const;