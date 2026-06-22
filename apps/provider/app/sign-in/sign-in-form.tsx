"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { persistBrowserSession, clearBrowserSession } from '@/lib/auth/browser-session';
import { providerApi } from '@/services/api-client';
import { ProviderIcon } from '@/components/shared/provider-icons';
import { ProviderLanguageSwitcher } from '@/components/i18n/provider-language-switcher';
import { useProviderLocale } from '@/components/i18n/provider-locale-provider';

type Stage = 'credentials' | 'challenge';
type SsoConfig = { available: boolean; providerName: string; note: string; allowedDomains: string[] };
type RiskSummary = { level: string; reasons: string[]; requiresAcknowledgement: boolean; ssoRecommended: boolean; allowedDomains: string[] };

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M10.7 4.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4l-4.6 4.6a1 1 0 0 1-1.4-1.4l2.88-2.9H4a1 1 0 1 1 0-2h9.58l-2.88-2.88a1 1 0 0 1 0-1.42Z" fill="currentColor" />
    </svg>
  );
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, dir } = useProviderLocale();
  const nextPath = searchParams.get('next') || '/portal/dashboard';
  const [email, setEmail] = useState('provider@carecenter.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [managedDevice, setManagedDevice] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    providerApi.ssoConfig('provider').then(setSsoConfig).catch(() => setSsoConfig(null));
  }, []);

  useEffect(() => {
    if (stage !== 'challenge' || remainingSeconds <= 0) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stage, remainingSeconds]);

  async function submitCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!managedDevice) {
      setError(t.signIn.managedDeviceError);
      return;
    }
    if (!riskAcknowledged) {
      setError(t.signIn.riskAcknowledgedError);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await providerApi.startPrivilegedChallenge({
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
      setRiskSummary(result.risk ?? null);
      setChallengeStoreMode(result.challengeStoreMode ?? null);
      if (result.sso) {
        setSsoConfig(result.sso);
      }
    } catch (err) {
      clearBrowserSession();
      setError(err instanceof Error ? err.message : t.signIn.unableStartVerification);
    } finally {
      setLoading(false);
    }
  }

  async function verifyChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeId) {
      setStage('credentials');
      setError(t.signIn.startAgain);
      return;
    }
    if (code.trim().length < 6) {
      setError(t.signIn.enter6Digits);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const result = await providerApi.verifyPrivilegedChallenge({ challengeId, code: code.trim() });
      persistBrowserSession(result.accessToken, result.user.role);
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      clearBrowserSession();
      setError(err instanceof Error ? err.message : t.signIn.unableVerify);
    } finally {
      setLoading(false);
    }
  }

  async function resendChallenge() {
    if (!challengeId || remainingSeconds > 0) return;
    setResending(true);
    setError(null);
    try {
      const result = await providerApi.resendPrivilegedChallenge(challengeId);
      setChallengeId(result.challengeId);
      setResendAvailableAt(Date.now() + result.resendAfterSeconds * 1000);
      setDevCode(result.devCode ?? null);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.unableResend);
    } finally {
      setResending(false);
    }
  }

  async function startEnterpriseSso() {
    setSsoLoading(true);
    setError(null);
    try {
      const result = await providerApi.startSso({ email, roleHint: 'provider', returnTo: nextPath });
      window.location.assign(result.authorizeUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signIn.unableStartSso);
    } finally {
      setSsoLoading(false);
    }
  }

  const approvedDomainsText = ssoConfig?.allowedDomains?.length ? ssoConfig.allowedDomains.join(', ') : 'Local provider credentials';

  return (
    <main className="provider-v13-login-shell" dir={dir}>
      <section className="provider-v13-login-frame">
        <aside className="provider-v13-login-hero">
          <div className="provider-v13-login-brand">
            <div className="provider-v13-login-brand-mark">
              <ProviderIcon name="shield" width={22} height={22} />
            </div>
            <div>
              <strong>{t.common.appName}</strong>
              <span>{t.common.appTagline}</span>
            </div>
          </div>

          <div className="provider-v13-login-copy">
            <span>PR-01 · Secure provider access</span>
            <h1>{t.signIn.title}</h1>
            <p>{t.signIn.subtitle}</p>
          </div>

          <div className="provider-v13-login-metrics">
            <article>
              <span>Session posture</span>
              <strong>Clinical</strong>
              <p>Protected access for queue, telehealth, pharmacy, and schedule workflows.</p>
            </article>
            <article>
              <span>{t.signIn.approvedDomains}</span>
              <strong>{ssoConfig?.allowedDomains?.length || 0}</strong>
              <p>{approvedDomainsText}</p>
            </article>
          </div>
        </aside>

        <section className="provider-v13-login-panel">
          <div className="provider-v13-login-panel-top">
            <div>
              <span className="provider-v13-login-eyebrow">{stage === 'credentials' ? t.signIn.workEmailOrPhone : t.signIn.verificationCode}</span>
              <h2>{stage === 'credentials' ? t.signIn.title : t.signIn.verificationSent}</h2>
            </div>
            <ProviderLanguageSwitcher />
          </div>

          <div className="provider-v13-login-warning">
            <ProviderIcon name="shield" width={18} height={18} />
            <p>{t.signIn.privilegedNotice}</p>
          </div>

          {stage === 'credentials' ? (
            <form className="provider-v13-login-form" onSubmit={submitCredentials}>
              <label className="provider-v13-login-field">
                <span>{t.signIn.workEmailOrPhone}</span>
                <input type="email" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} placeholder={t.signIn.credentialsPlaceholder} />
              </label>
              <label className="provider-v13-login-field">
                <span>{t.signIn.password}</span>
                <input type="password" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder={t.signIn.passwordPlaceholder} />
              </label>
              <label className="provider-v13-login-check">
                <input type="checkbox" checked={managedDevice} onChange={(e: ChangeEvent<HTMLInputElement>) => setManagedDevice(e.target.checked)} />
                <span>{t.signIn.managedDeviceConfirm}</span>
              </label>
              <label className="provider-v13-login-check">
                <input type="checkbox" checked={riskAcknowledged} onChange={(e: ChangeEvent<HTMLInputElement>) => setRiskAcknowledged(e.target.checked)} />
                <span>{t.signIn.privilegedNotice}</span>
              </label>
              {ssoConfig?.allowedDomains?.length ? (
                <div className="provider-v13-login-note">
                  <strong>{t.signIn.approvedDomains}</strong>
                  <p>{approvedDomainsText}</p>
                </div>
              ) : null}
              {error ? <div className="provider-v13-login-error">{error}</div> : null}
              <button type="submit" className="provider-v13-login-primary" disabled={loading}>
                <span>{loading ? t.signIn.startingVerification : t.signIn.sendOtp.replace(/\s?[←→]$/, '')}</span>
                <ArrowIcon />
              </button>
              {ssoConfig?.available ? (
                <button type="button" className="provider-v13-login-secondary" disabled={ssoLoading} onClick={startEnterpriseSso}>
                  <ProviderIcon name="sparkle" width={18} height={18} />
                  <span>{ssoLoading ? `${t.signIn.redirectingTo} ${ssoConfig.providerName}…` : `${t.signIn.useProvider} ${ssoConfig.providerName}`}</span>
                </button>
              ) : null}
              <div className="provider-v13-login-help">{t.signIn.troubleSigningIn}</div>
            </form>
          ) : (
            <form className="provider-v13-login-form" onSubmit={verifyChallenge}>
              <label className="provider-v13-login-field">
                <span>{t.signIn.verificationCode}</span>
                <input inputMode="numeric" value={code} onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={t.signIn.verificationCodePlaceholder} />
              </label>
              <div className="provider-v13-login-note">
                <strong>{t.signIn.verificationSent}</strong>
                <p>{t.signIn.challengeStartedFor} {email}.</p>
                <p>{remainingSeconds > 0 ? `${t.signIn.requestAnotherIn} 00:${String(remainingSeconds).padStart(2, '0')}.` : t.signIn.requestAnotherNow}</p>
                {challengeStoreMode ? <p>{t.signIn.challengeStore}: {challengeStoreMode}</p> : null}
                {devCode ? <p>{t.signIn.developmentCode}: {devCode}</p> : null}
              </div>
              {riskSummary?.reasons?.length ? (
                <div className="provider-v13-login-note">
                  <strong>{t.signIn.riskLevel}: {riskSummary.level}</strong>
                  <ul>
                    {riskSummary.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                </div>
              ) : null}
              {error ? <div className="provider-v13-login-error">{error}</div> : null}
              <div className="provider-v13-login-actions">
                <button type="button" className="provider-v13-login-secondary" onClick={() => { setStage('credentials'); setError(null); }} disabled={loading}>{t.signIn.back}</button>
                <button type="button" className="provider-v13-login-secondary" onClick={resendChallenge} disabled={resending || loading || remainingSeconds > 0}>{resending ? t.signIn.sending : t.signIn.resendCode}</button>
                <button type="submit" className="provider-v13-login-primary provider-v13-login-primary--inline" disabled={loading}>{loading ? t.signIn.verifying : t.signIn.verifyAndSignIn}</button>
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
