'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi } from '@/lib/api-client';
import { persistBrowserSession } from '@/lib/auth/browser-session';
import { MOCK_ADMIN_SESSION } from '@/lib/auth/mock-session';
import { AdminLanguageSwitcher } from '@/components/i18n/admin-language-switcher';
import { useAdminLocale } from '@/components/i18n/admin-locale-provider';

const DEMO_ACCESS_TOKEN = 'demo-admin-token';
const DEMO_ROLE = 'SUPER_ADMIN';
const ALLOW_DEMO_SIGNIN = process.env.NEXT_PUBLIC_ALLOW_DEMO_SIGNIN === 'true';

type Stage = 'credentials' | 'challenge';
type SsoConfig = { available: boolean; providerName: string; note: string; allowedDomains: string[] };
type RiskSummary = { level: string; reasons: string[]; requiresAcknowledgement: boolean; ssoRecommended: boolean; allowedDomains: string[] };

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, dir } = useAdminLocale();
  const nextPath = searchParams.get('next') || '/portal/dashboard';
  const [email, setEmail] = useState('admin@carecenter.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [managedDevice, setManagedDevice] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'api' | 'demo'>('api');
  const [stage, setStage] = useState<Stage>('credentials');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [resendAvailableAt, setResendAvailableAt] = useState<number>(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [ssoConfig, setSsoConfig] = useState<SsoConfig | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [challengeStoreMode, setChallengeStoreMode] = useState<string | null>(null);

  const remainingSeconds = useMemo(() => {
    const diff = resendAvailableAt - nowMs;
    return diff <= 0 ? 0 : Math.ceil(diff / 1000);
  }, [resendAvailableAt, nowMs]);

  useEffect(() => {
    adminApi.ssoConfig('admin').then(setSsoConfig).catch(() => setSsoConfig(null));
  }, []);

  useEffect(() => {
    if (stage !== 'challenge' || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [stage, remainingSeconds]);

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    if (!managedDevice) {
      setError(t.signIn.confirmManagedDeviceError);
      return;
    }
    if (!riskAcknowledged) {
      setError(t.signIn.acknowledgeNoticeError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.startPrivilegedChallenge({
        email,
        password,
        managedDevice,
        riskAcknowledged,
        channel: 'totp',
      });
      setChallengeId(result.challengeId);
      setResendAvailableAt(Date.now() + result.resendAfterSeconds * 1000);
      setDevCode(result.devCode ?? null);
      setCode('');
      setStage('challenge');
      setMode('api');
      setRiskSummary(result.risk ?? null);
      setChallengeStoreMode(result.challengeStoreMode ?? null);
      if (result.sso) {
        setSsoConfig(result.sso);
      }
    } catch (err) {
      if (ALLOW_DEMO_SIGNIN) {
        persistBrowserSession(DEMO_ACCESS_TOKEN, DEMO_ROLE);
        setMode('demo');
        setError(t.signIn.liveApiUnavailable);
        router.push(nextPath);
      } else {
        setMode('api');
        setError(err instanceof Error ? err.message : t.signIn.unableStartFlow);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyChallenge(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) {
      setError(t.signIn.startFlowAgain);
      setStage('credentials');
      return;
    }
    if (code.trim().length < 6) {
      setError(t.signIn.enter6Digits);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await adminApi.verifyPrivilegedChallenge({ challengeId, code: code.trim() });
      persistBrowserSession(result.accessToken, result.user.role);
      router.push(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.unableVerifyCode);
    } finally {
      setLoading(false);
    }
  }

  async function resendChallenge() {
    if (!challengeId || remainingSeconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const result = await adminApi.resendPrivilegedChallenge(challengeId);
      setChallengeId(result.challengeId);
      setResendAvailableAt(Date.now() + result.resendAfterSeconds * 1000);
      setDevCode(result.devCode ?? null);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.unableResendCode);
    } finally {
      setResending(false);
    }
  }

  async function startEnterpriseSso() {
    setSsoLoading(true);
    setError(null);
    try {
      const result = await adminApi.startSso({ email, roleHint: 'admin', returnTo: nextPath });
      window.location.assign(result.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.unableStartSso);
    } finally {
      setSsoLoading(false);
    }
  }

  return (
    <div className="admin-auth-shell" dir={dir}>
      <div className="auth-card auth-card--admin">
        <section className="auth-hero auth-hero-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div className="page-eyebrow" style={{ background: 'rgba(255,255,255,0.16)', color: 'white' }}>
              {t.signIn.eyebrow}
            </div>
            <AdminLanguageSwitcher />
          </div>
          <h1 style={{ fontSize: 42, margin: 0, lineHeight: 1.02 }}>{t.signIn.title}</h1>
          <p style={{ color: 'rgba(255,255,255,0.86)', fontSize: 17, lineHeight: 1.7, margin: 0 }}>
            {t.signIn.description}
          </p>
          <ul className="auth-bullet-list">
            <li>{t.signIn.bulletManaged}</li>
            <li>{t.signIn.bulletMonitored}</li>
            <li>{t.signIn.bulletFallback}</li>
          </ul>
          <div className="hero-metrics" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div className="hero-metric" style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.16)', color: 'white' }}>
              <div className="hero-metric-label" style={{ color: 'rgba(255,255,255,0.72)' }}>{t.signIn.sessionPosture}</div>
              <div className="hero-metric-value">{t.signIn.highPrivilege}</div>
              <div className="hero-metric-detail" style={{ color: 'rgba(255,255,255,0.82)' }}>{t.signIn.sessionDetail}</div>
            </div>
            <div className="hero-metric" style={{ background: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.16)', color: 'white' }}>
              <div className="hero-metric-label" style={{ color: 'rgba(255,255,255,0.72)' }}>{t.signIn.approvedDomains}</div>
              <div className="hero-metric-value">{ssoConfig?.allowedDomains?.length || 0}</div>
              <div className="hero-metric-detail" style={{ color: 'rgba(255,255,255,0.82)' }}>{ssoConfig?.allowedDomains?.join(', ') || t.signIn.localCredentials}</div>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="banner warning" style={{ marginBottom: 0 }}>
            {t.signIn.privilegedWarning}
          </div>

          {stage === 'credentials' ? (
            <form className="form-stack" onSubmit={submitCredentials}>
              <div className="page-breadcrumbs"><span>{t.signIn.access}</span><span>•</span><span>{t.signIn.credentials}</span><span>•</span><span>{t.signIn.verification}</span></div>
              <label className="label">{t.signIn.workEmail}<input className="input" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} /></label>
              <label className="label">{t.signIn.password}<input className="input" type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} /></label>
              <div className="auth-option-card">
                <label className="label" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input type="checkbox" checked={managedDevice} onChange={(e: ChangeEvent<HTMLInputElement>) => setManagedDevice(e.target.checked)} />
                  <span>{t.signIn.managedDeviceConfirm}</span>
                </label>
                <label className="label" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
                  <input type="checkbox" checked={riskAcknowledged} onChange={(e: ChangeEvent<HTMLInputElement>) => setRiskAcknowledged(e.target.checked)} />
                  <span>{t.signIn.privilegedAccessNotice}</span>
                </label>
              </div>
              {ssoConfig?.allowedDomains?.length ? (
                <div className="auth-option-card">
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{t.signIn.approvedEnterpriseDomains}</div>
                  <div className="muted">{ssoConfig.allowedDomains.join(', ')}</div>
                </div>
              ) : null}
              {error ? <div className="banner warning">{error}</div> : null}
              <div className="inline-actions">
                <button className="button primary" type="submit" disabled={loading}>{loading ? t.signIn.startingVerification : t.signIn.continueVerification}</button>
                {ssoConfig?.available ? (
                  <button className="button secondary" type="button" disabled={ssoLoading} onClick={startEnterpriseSso}>
                    {ssoLoading ? `${t.signIn.redirectingTo} ${ssoConfig.providerName}…` : `${t.signIn.useProvider} ${ssoConfig.providerName}`}
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className="form-stack" onSubmit={verifyChallenge}>
              <div className="page-breadcrumbs"><span>{t.signIn.access}</span><span>•</span><span>{t.signIn.verificationChallenge}</span><span>•</span><span>{t.signIn.sessionIssuance}</span></div>
              <label className="label">{t.signIn.verificationCode}<input className="input" inputMode="numeric" value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t.signIn.codePlaceholder} /></label>
              <div className="auth-option-card">
                <p style={{ marginTop: 0 }}>{t.signIn.challengeSentFor} <strong>{email}</strong>.</p>
                <p style={{ marginBottom: 0, color: 'var(--muted)' }}>
                  {remainingSeconds > 0 ? `${t.signIn.requestAnotherIn} 00:${String(remainingSeconds).padStart(2, '0')}.` : t.signIn.requestAnotherNow}
                </p>
                {challengeStoreMode ? <p style={{ marginBottom: 0, color: 'var(--muted)' }}>{t.signIn.challengeStore}: {challengeStoreMode}</p> : null}
                {devCode ? <p style={{ marginBottom: 0, color: 'var(--muted)' }}>{t.signIn.developmentCode}: {devCode}</p> : null}
              </div>
              {riskSummary?.reasons?.length ? (
                <div className="auth-option-card">
                  <p style={{ marginTop: 0 }}><strong>{t.signIn.riskLevel}:</strong> {riskSummary.level}</p>
                  <ul className="simple-list" style={{ margin: 0 }}>
                    {riskSummary.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="inline-actions">
                <button className="button secondary" type="button" onClick={() => { setStage('credentials'); setError(null); }} disabled={loading}>{t.signIn.back}</button>
                <button className="button secondary" type="button" onClick={resendChallenge} disabled={resending || loading || remainingSeconds > 0}>{resending ? t.signIn.sending : t.signIn.resendCode}</button>
                <button className="button primary" type="submit" disabled={loading}>{loading ? t.signIn.verifying : t.signIn.verifyAndSignIn}</button>
              </div>
              {error ? <div className="banner warning">{error}</div> : null}
            </form>
          )}

          <div className="auth-option-card">
            <h3 style={{ marginTop: 0 }}>{t.signIn.baselineAccess}</h3>
            <p style={{ marginBottom: 8 }}>
              {t.signIn.seededAccount} {ALLOW_DEMO_SIGNIN ? t.signIn.enabledReview : t.signIn.disabledBuild}
            </p>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              {t.signIn.demoUser}: {MOCK_ADMIN_SESSION.name} · {MOCK_ADMIN_SESSION.email} · {MOCK_ADMIN_SESSION.role}
            </p>
            <p style={{ marginTop: 8, marginBottom: 0, color: 'var(--muted)' }}>
              {t.signIn.lastSignInMode}: {mode === 'api' ? t.signIn.liveApiChallenge : t.signIn.reviewDemo}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
