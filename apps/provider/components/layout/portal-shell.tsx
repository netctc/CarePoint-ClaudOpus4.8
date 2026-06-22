import { SidebarNav } from './sidebar-nav';
import { TopHeader } from './top-header';

export function PortalShell({ children, initialRole }: { children: React.ReactNode; initialRole?: string | null }) {
  return (
    <div className="portal-layout provider-portal-layout cp-app-shell cp-app-shell--provider">
      <a className="skip-link" href="#provider-main-content">Skip to provider workspace</a>
      <SidebarNav />
      <div className="portal-content-shell cp-content-area">
        <TopHeader initialRole={initialRole ?? null} />
        <main id="provider-main-content" className="portal-main provider-portal-main cp-main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
