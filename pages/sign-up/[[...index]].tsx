// pages/sign-up/[[...index]].tsx
// Clerk-hosted sign-up UI with email + phone OTP support
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg, #0d1117)',
      padding: '24px 16px',
    }}>
      <a
        href="/"
        style={{
          marginBottom: 24,
          color: '#a5b4fc',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        ← Back to jobs
      </a>
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#6366f1',
            colorBackground: '#161b27',
            colorText: '#e8ecff',
            colorInputBackground: '#1e2535',
            colorInputText: '#e8ecff',
            borderRadius: '12px',
          },
        }}
      />
    </div>
  );
}
