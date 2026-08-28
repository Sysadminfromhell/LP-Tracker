import { useState, type FormEvent } from 'react';

interface AdminLoginProps {
  onLogin: () => void;
}

interface LoginResponse {
  ok: boolean;

  admin: {
    id: number;
    username: string;
  };
}

function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid username or password.');
        }
        throw new Error(`Login failed with HTTP ${response.status}`);
      }
      const data = (await response.json()) as LoginResponse;
      if (!data.ok) {
        throw new Error('Login failed.');
      }
      setPassword('');
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-login-card">
        <div className="admin-login-heading">
          <span className="eyebrow">LP GAIN EVENT</span>
          <h1>Admin</h1>
          <p>Sign in to manage the event.</p>
        </div>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              disabled={submitting}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              disabled={submitting}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </label>

          {error && <div className="admin-login-error">{error}</div>}

          <button className="admin-primary-button" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <a className="admin-back-link" href="#">
          ← Back to leaderboard
        </a>
      </section>
    </main>
  );
}

export default AdminLogin;
