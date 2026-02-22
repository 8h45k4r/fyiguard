// FYI Guard - Shared Utilities (pure functions)

export const generateEventId = (): string =>
  `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const sanitizeForLog = (text: string, maxLen = 50): string =>
  text.replace(/[a-zA-Z0-9]/g, 'X').substring(0, maxLen);

export const maskSensitiveData = (value: string): string => {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
};

export const luhnCheck = (cardNumber: string): boolean => {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T, ms: number
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export const getExtensionVersion = (): string => {
  try {
    return chrome.runtime.getManifest?.()?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

export const getBrowserInfo = (): string => {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return `Chrome/${ua.match(/Chrome\/(\d+)/)?.[1] || 'unknown'}`;
  if (ua.includes('Firefox')) return `Firefox/${ua.match(/Firefox\/(\d+)/)?.[1] || 'unknown'}`;
  return 'Unknown';
};