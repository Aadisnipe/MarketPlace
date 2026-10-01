import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/auth/AuthPage';
import SellerDashboard from './pages/seller/SellerDashboard';
import ShopPage from './pages/buyer/ShopPage';
import ProductPage from './pages/buyer/ProductPage';
import CartPage from './pages/buyer/CartPage';
import CheckoutPage from './pages/buyer/CheckoutPage';
import OrdersPage, { OrderDetailPage } from './pages/buyer/OrdersPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PaymentReturnPage from './pages/buyer/PaymentReturnPage';
import RequireAuth from './routes/RequireAuth';

function Home() {
  const { user, loading } = useAuth();
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-lg font-bold text-slate-950">Market<span className="text-amber-800">place</span></Link>
          <div className="flex items-center gap-3">
            {loading ? <span className="text-sm text-slate-500">Checking session…</span> : user ? <Link to={user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/dashboard'} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">My dashboard</Link> : <><Link to="/login" className="px-3 py-2 text-sm font-semibold text-slate-700">Sign in</Link><Link to="/register" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Create account</Link></>}
          </div>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-24 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <div>
          <p className="font-semibold uppercase tracking-[.2em] text-amber-800">A marketplace built for everyone</p>
          <h1 className="mt-5 max-w-2xl text-5xl font-bold leading-tight tracking-tight text-slate-950 md:text-6xl">Good finds. Great sellers. All in one place.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">Discover independent shops and bring your own products to a community of buyers.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link to="/shop" className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800">Browse products</Link><Link to={user ? (user.role === 'seller' ? '/seller' : user.role === 'admin' ? '/admin' : '/dashboard') : '/register'} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100">{user ? 'Go to your dashboard' : 'Get started'}</Link></div>
        </div>
        <div className="rounded-3xl bg-slate-900 p-8 text-white shadow-xl md:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-amber-200">Marketplace roles</p>
          <div className="mt-7 space-y-5">
            <div><h2 className="text-xl font-semibold">Shop as a buyer</h2><p className="mt-1 text-slate-200">Keep your account ready for browsing, carts, and orders.</p></div>
            <div className="h-px bg-white/15" />
            <div><h2 className="text-xl font-semibold">Grow as a seller</h2><p className="mt-1 text-slate-200">Create a seller account and manage your own marketplace presence.</p></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }
  const roleCopy = {
    buyer: 'Your buyer account is ready. Browse products, manage your cart, and track your orders.',
    seller: 'Your seller account is ready. Manage your products and fulfill orders from your seller dashboard.',
    admin: 'You are signed in with administrator access. Marketplace administration arrives in a later phase.',
  };
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4"><Link to="/" className="font-bold">Marketplace</Link><button onClick={signOut} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100">Sign out</button></div></header>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-amber-800">{user.role} account</p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">Welcome, {user.name}</h1>
        <div className="mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Your marketplace account is active</h2><p className="mt-2 leading-7 text-slate-600">{roleCopy[user.role]}</p><p className="mt-4 text-sm text-slate-500">Signed in as {user.email}</p>{user.role==='buyer'&&<Link to="/orders" className="mt-5 inline-flex rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">View my orders</Link>}</div>
      </section>
    </main>
  );
}

function AppRoutes() {
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/shop" element={<ShopPage />} />
    <Route path="/products/:id" element={<ProductPage />} />
    <Route element={<RequireAuth roles={['buyer']} />}>
      <Route path="/payment/success" element={<PaymentReturnPage />} />
      <Route path="/payment/cancel" element={<PaymentReturnPage />} />
    </Route>
    <Route element={<RequireAuth roles={['buyer']} />}>
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Route>
    <Route element={<RequireAuth />}><Route path="/dashboard" element={<Dashboard />} /></Route>
    <Route element={<RequireAuth roles={['seller']} />}><Route path="/seller" element={<SellerDashboard />} /></Route>
    <Route element={<RequireAuth roles={['admin']} />}><Route path="/admin" element={<AdminDashboard />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}

export default function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
