'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

type State = { error: string } | undefined;

export default function LoginPage() {
  const [state, action, isPending] = useActionState<State, FormData>(signIn, undefined);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-8)',
      }}
    >
      {/* Wordmark */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <span
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9 2L3 7v8h4v-5h4v5h4V7L9 2z" fill="white" stroke="none" />
              <path
                d="M9 2L3 7v8h4v-5h4v5h4V7L9 2z"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-xl)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--color-ink-1)',
              letterSpacing: 'var(--tracking-tight)',
            }}
          >
            EarthLink
          </span>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-2)',
            margin: 0,
          }}
        >
          ESG Carbon Auditor
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-8)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--color-ink-1)',
            margin: '0 0 var(--space-6)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          Sign in to your account
        </h1>

        <form
          action={action}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label
              htmlFor="email"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--color-ink-2)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={isPending}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-base)',
                color: 'var(--color-ink-1)',
                outline: 'none',
                transition: `border-color var(--duration-fast) var(--ease-out-expo)`,
                width: '100%',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label
              htmlFor="password"
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--color-ink-2)',
                letterSpacing: 'var(--tracking-wide)',
                textTransform: 'uppercase',
              }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
              style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-base)',
                color: 'var(--color-ink-1)',
                outline: 'none',
                transition: `border-color var(--duration-fast) var(--ease-out-expo)`,
                width: '100%',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Error */}
          {state?.error && (
            <div
              role="alert"
              style={{
                background: 'var(--color-signal-hi-bg)',
                border: '1px solid var(--color-signal-hi)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-signal-hi)',
              }}
            >
              {state.error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            style={{
              background: isPending ? 'var(--color-accent-dim)' : 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-6)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--fw-semibold)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              transition: `opacity var(--duration-fast) var(--ease-out-expo), transform var(--duration-fast) var(--ease-out-expo)`,
              width: '100%',
              marginTop: 'var(--space-2)',
            }}
          >
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p
        style={{
          textAlign: 'center',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-3)',
          margin: 0,
        }}
      >
        EarthLink ESG Auditor · Scope 1 &amp; 2 carbon accounting
      </p>
    </div>
  );
}
