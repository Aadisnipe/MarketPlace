import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthPage({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'buyer' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const account = isRegister ? await register(form) : await login({ email: form.email, password: form.password });
      navigate(location.state?.from?.pathname || (account.role === 'seller' ? '/seller' : account.role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to complete your request.');
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100';
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link to="/" className="text-sm font-semibold text-amber-800">← Marketplace</Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-950">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-2 text-sm text-slate-600">{isRegister ? 'Join as a buyer or start selling.' : 'Sign in to continue to your marketplace.'}</p>
        {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {isRegister && <label className="block text-sm font-medium">Full name<input className={fieldClass} name="name" value={form.name} onChange={update} autoComplete="name" required minLength={2} maxLength={80} /></label>}
          <label className="block text-sm font-medium">Email<input className={fieldClass} type="email" name="email" value={form.email} onChange={update} autoComplete="email" required maxLength={254} /></label>
          <label className="block text-sm font-medium">Password<input className={fieldClass} type="password" name="password" value={form.password} onChange={update} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} /></label>
          {isRegister && <label className="block text-sm font-medium">Account type<select className={fieldClass} name="role" value={form.role} onChange={update}><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label>}
          <button className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{isRegister ? 'Already have an account?' : 'New to the marketplace?'}{' '}
          <Link className="font-semibold text-amber-800 hover:underline" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </section>
    </main>
  );
}
