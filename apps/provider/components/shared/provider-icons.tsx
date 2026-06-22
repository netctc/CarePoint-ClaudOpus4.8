import type { SVGProps } from 'react';

type IconName =
  | 'shield'
  | 'dashboard'
  | 'schedule'
  | 'queue'
  | 'availability'
  | 'messages'
  | 'patients'
  | 'telehealth'
  | 'orders'
  | 'analytics'
  | 'settings'
  | 'support'
  | 'search'
  | 'bell'
  | 'sync'
  | 'sparkle'
  | 'camera'
  | 'mic'
  | 'attach'
  | 'send'
  | 'logout';

export function ProviderIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const shared = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'shield':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M12 3l7 3v5c0 5-3.4 8.4-7 10-3.6-1.6-7-5-7-10V6l7-3z"/><path {...shared} d="M12 8v8"/><path {...shared} d="M8.8 12H15.2"/></svg>;
    case 'dashboard':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="4" y="4" width="7" height="7" rx="1.5"/><rect {...shared} x="13" y="4" width="7" height="11" rx="1.5"/><rect {...shared} x="4" y="13" width="7" height="7" rx="1.5"/><rect {...shared} x="13" y="17" width="7" height="3" rx="1.5"/></svg>;
    case 'schedule':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="3.5" y="5" width="17" height="15" rx="2"/><path {...shared} d="M8 3.5v3"/><path {...shared} d="M16 3.5v3"/><path {...shared} d="M3.5 9.5H20.5"/></svg>;
    case 'queue':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...shared} cx="7" cy="8" r="2.5"/><circle {...shared} cx="17" cy="8" r="2.5"/><path {...shared} d="M3.5 17c.6-2.5 2.4-4 4.9-4s4.3 1.5 4.9 4"/><path {...shared} d="M10.5 17c.4-1.7 1.6-2.8 3.4-3.3 1.8-.5 3.9.3 5.1 1.9"/></svg>;
    case 'availability':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="4" y="5" width="16" height="15" rx="2"/><path {...shared} d="M8 3.5v3"/><path {...shared} d="M16 3.5v3"/><path {...shared} d="M7.5 13l2.3 2.3 6.7-6.6"/></svg>;
    case 'messages':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M5 5.5h14a2 2 0 0 1 2 2V16a2 2 0 0 1-2 2H10l-5 3V7.5a2 2 0 0 1 2-2z"/></svg>;
    case 'patients':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...shared} cx="12" cy="8" r="3"/><path {...shared} d="M5 19c1-3.3 3.4-5 7-5s6 1.7 7 5"/></svg>;
    case 'telehealth':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="4" y="6" width="11" height="12" rx="2"/><path {...shared} d="M15 10l5-3v10l-5-3z"/></svg>;
    case 'orders':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="5" y="4" width="14" height="16" rx="2"/><path {...shared} d="M9 9h6"/><path {...shared} d="M9 13h6"/><path {...shared} d="M9 17h4"/></svg>;
    case 'analytics':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M4 19.5h16"/><path {...shared} d="M7 16V10"/><path {...shared} d="M12 16V6"/><path {...shared} d="M17 16v-3"/></svg>;
    case 'settings':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...shared} cx="12" cy="12" r="3"/><path {...shared} d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.8 1.8 0 1 1-3.6 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a1.8 1.8 0 1 1 0-3.6h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.8 1.8 0 0 1 2.5-2.5l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a1.8 1.8 0 1 1 3.6 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.8 1.8 0 0 1 2.5 2.5l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a1.8 1.8 0 1 1 0 3.6h-.1a1 1 0 0 0-.9.6z"/></svg>;
    case 'support':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...shared} cx="12" cy="12" r="8"/><path {...shared} d="M9.5 9.2a2.7 2.7 0 1 1 4.8 1.7c-.7.7-1.3 1-1.7 1.6-.2.2-.3.6-.3 1"/><path {...shared} d="M12 17h.01"/></svg>;
    case 'search':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><circle {...shared} cx="11" cy="11" r="6"/><path {...shared} d="M20 20l-4.2-4.2"/></svg>;
    case 'bell':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path {...shared} d="M10 19a2 2 0 0 0 4 0"/></svg>;
    case 'sync':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M20 7v5h-5"/><path {...shared} d="M4 17v-5h5"/><path {...shared} d="M7.5 8.5A6 6 0 0 1 18 12"/><path {...shared} d="M16.5 15.5A6 6 0 0 1 6 12"/></svg>;
    case 'sparkle':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/></svg>;
    case 'camera':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="4" y="7" width="16" height="11" rx="2"/><path {...shared} d="M9 7l1.2-2h3.6L15 7"/><circle {...shared} cx="12" cy="12.5" r="3"/></svg>;
    case 'mic':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><rect {...shared} x="9" y="4" width="6" height="10" rx="3"/><path {...shared} d="M6.5 11.5a5.5 5.5 0 0 0 11 0"/><path {...shared} d="M12 17v3"/><path {...shared} d="M9 20h6"/></svg>;
    case 'attach':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M8.5 12.5l6.4-6.4a3 3 0 0 1 4.2 4.2l-8.5 8.5a4.5 4.5 0 0 1-6.4-6.4l8.1-8.1"/></svg>;
    case 'send':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M4 20l16-8L4 4l2.5 8L20 12"/></svg>;
    case 'logout':
      return <svg viewBox="0 0 24 24" aria-hidden="true" {...props}><path {...shared} d="M10 17l-5-5 5-5"/><path {...shared} d="M5 12h10"/><path {...shared} d="M14 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3"/></svg>;
  }
}
