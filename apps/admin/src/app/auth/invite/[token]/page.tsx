'use client';

import { FormEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function validate(): string | null {
    if (!firstName.trim()) return 'First name is required.';
    if (!lastName.trim()) return 'Last name is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setStatus('submitting');
    try {
      const response = await fetch(`${API_BASE_URL}/api/iam/invitations/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
        }),
      });

      if (response.status === 201 || response.ok) {
        setStatus('success');
        setTimeout(() => {
          router.push('/auth/sign-in');
        }, 3000);
      } else {
        const data = await response.json().catch(() => ({ error: 'An unexpected error occurred.' }));
        setStatus('error');
        setErrorMessage(data.error || data.message || 'Failed to accept invitation.');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  return (
    <div className="admin-auth-shell">
      <div style={{ width: 'min(520px, 100%)', margin: '0 auto' }}>
        <div className="card" style={{ borderRadius: 28, padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(160deg, #113873, #1f69df 58%, #52b6ff)',
              color: 'white',
              padding: '32px 36px',
            }}
          >
            <div
              className="page-eyebrow"
              style={{ background: 'rgba(255,255,255,0.16)', color: 'white', marginBottom: 12 }}
            >
              Invitation
            </div>
            <h1 style={{ fontSize: 28, margin: 0, lineHeight: 1.1 }}>Accept Your Invitation</h1>
            <p style={{ color: 'rgba(255,255,255,0.84)', fontSize: 15, margin: '10px 0 0', lineHeight: 1.6 }}>
              Complete your account setup by providing your details below.
            </p>
          </div>

          {/* Body */}
          <div style={{ padding: '32px 36px' }}>
            {status === 'success' ? (
              <div>
                <div className="banner success" style={{ marginBottom: 16 }}>
                  Account created successfully! Redirecting to sign in…
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  You will be redirected to the login page in a few seconds. If not,{' '}
                  <a href="/auth/sign-in" style={{ color: 'var(--primary-strong)', fontWeight: 700 }}>
                    click here
                  </a>.
                </p>
              </div>
            ) : (
              <form className="form-stack" onSubmit={handleSubmit}>
                {errorMessage && (
                  <div className="banner warning">{errorMessage}</div>
                )}

                <div className="form-grid">
                  <label className="label">
                    First Name
                    <input
                      className="input"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label className="label">
                    Last Name
                    <input
                      className="input"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      autoComplete="family-name"
                      required
                    />
                  </label>
                </div>

                <label className="label">
                  Password
                  <input
                    className="input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </label>

                <label className="label">
                  Confirm Password
                  <input
                    className="input"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                  />
                </label>

                <button
                  className="button primary"
                  type="submit"
                  disabled={status === 'submitting'}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  {status === 'submitting' ? 'Creating Account…' : 'Accept Invitation'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p
          style={{
            textAlign: 'center',
            marginTop: 20,
            color: 'var(--muted)',
            fontSize: '0.84rem',
          }}
        >
          Already have an account?{' '}
          <a href="/auth/sign-in" style={{ color: 'var(--primary-strong)', fontWeight: 700 }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
