import type { CSSProperties, ReactNode } from 'react';

const iconBase: CSSProperties = {
  width: 18,
  height: 18,
  display: 'block',
};

function Stroke({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={iconBase} aria-hidden="true">
      {children}
    </svg>
  );
}

function Fill({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={iconBase} aria-hidden="true">
      {children}
    </svg>
  );
}

export function AdminIcon({ name }: { name: string }) {
  switch (name) {
    case 'logo':
      return (
        <Fill>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <rect x="10.75" y="6.5" width="2.5" height="11" fill="white" />
          <rect x="6.5" y="10.75" width="11" height="2.5" fill="white" />
        </Fill>
      );
    case 'overview':
      return (
        <Fill>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" opacity="0.72" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" opacity="0.72" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </Fill>
      );
    case 'providers':
      return (
        <Stroke>
          <path d="M8 14a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
          <path d="M16 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
          <path d="M3.5 19a5.5 5.5 0 0 1 9 0" />
          <path d="M13.5 19a4.5 4.5 0 0 1 7 0" />
        </Stroke>
      );
    case 'bookings':
      return (
        <Stroke>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </Stroke>
      );
    case 'finance':
      return (
        <Stroke>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="M7 12h10M7 15h6" />
        </Stroke>
      );
    case 'settings':
      return (
        <Stroke>
          <path d="M12 8.5A3.5 3.5 0 1 1 8.5 12 3.5 3.5 0 0 1 12 8.5Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.4.1" />
        </Stroke>
      );
    case 'support':
      return (
        <Stroke>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.4 9.5a2.6 2.6 0 1 1 4.8 1.3c-.7.7-1.6 1.2-1.6 2.7" />
          <path d="M12 16.8h.01" />
        </Stroke>
      );
    case 'logout':
      return (
        <Stroke>
          <path d="M10 17l-5-5 5-5" />
          <path d="M5 12h10" />
          <path d="M14 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3" />
        </Stroke>
      );
    case 'search':
      return (
        <Stroke>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </Stroke>
      );
    case 'bell':
      return (
        <Stroke>
          <path d="M15 18H9" />
          <path d="M18 16V11a6 6 0 1 0-12 0v5l-1.5 2h15Z" />
        </Stroke>
      );
    case 'download':
      return (
        <Stroke>
          <path d="M12 4v10" />
          <path d="m8 10 4 4 4-4" />
          <path d="M4 19h16" />
        </Stroke>
      );
    case 'sync':
      return (
        <Stroke>
          <path d="M20 7v5h-5" />
          <path d="M4 17v-5h5" />
          <path d="M7.2 9A7 7 0 0 1 19 12" />
          <path d="M17 15a7 7 0 0 1-12-3" />
        </Stroke>
      );
    case 'alert':
      return (
        <Fill>
          <path d="M12 3 2.8 19.5A1 1 0 0 0 3.7 21h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
          <rect x="11" y="9" width="2" height="5.8" fill="white" />
          <rect x="11" y="16.7" width="2" height="2" fill="white" />
        </Fill>
      );
    case 'chart':
      return (
        <Stroke>
          <path d="M4 20V10" />
          <path d="M10 20V6" />
          <path d="M16 20v-8" />
          <path d="M22 20V3" />
        </Stroke>
      );
    case 'spark':
      return (
        <Fill>
          <path d="M13.6 2 6.9 13h4.4L10.4 22l6.7-11h-4.5L13.6 2Z" />
        </Fill>
      );
    case 'queue':
      return (
        <Stroke>
          <path d="M8 7h12" />
          <path d="M8 12h12" />
          <path d="M8 17h8" />
          <circle cx="4.5" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4.5" cy="17" r="1" fill="currentColor" stroke="none" />
        </Stroke>
      );
    case 'money':
      return (
        <Stroke>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <circle cx="12" cy="12" r="3" />
          <path d="M7 9h.01M17 15h.01" />
        </Stroke>
      );
    default:
      return (
        <Stroke>
          <circle cx="12" cy="12" r="8" />
        </Stroke>
      );
  }
}
