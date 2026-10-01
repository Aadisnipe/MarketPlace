import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function StoreHeader() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [categories, setCategories] = useState([]);
  const navigate = useNavigate();
  const [urlParams] = useSearchParams();

  useEffect(() => {
    setSearch(urlParams.get('search') || '');
  }, [urlParams]);

  useEffect(() => {
    let current = true;
    api.get('/categories').then(({ data }) => {
      if (current) setCategories(data.data.categories.slice(0, 7));
    }).catch(() => {});
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (user?.role !== 'buyer') { setCartCount(0); return undefined; }
    let current = true;
    const refresh = () => api.get('/cart').then(({ data }) => { if (current) setCartCount(data.data.cart.itemCount); }).catch(() => {});
    refresh();
    window.addEventListener('marketplace:cart-updated', refresh);
    return () => { current = false; window.removeEventListener('marketplace:cart-updated', refresh); };
  }, [user?.role]);

  function submitSearch(event) {
    event.preventDefault();
    navigate(`/shop${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`);
  }

  const accountPath = user?.role === 'seller' ? '/seller' : user?.role === 'admin' ? '/admin' : '/dashboard';
  return (
    <header className="sticky top-0 z-30 shadow-sm">
      <nav aria-label="Main navigation" className="bg-[#131921] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-3 py-2 sm:gap-4 sm:px-5">
          <Link to="/" className="order-1 shrink-0 rounded-sm px-2 py-1 text-lg font-extrabold tracking-tight text-white outline-offset-2 hover:outline hover:outline-1 hover:outline-white sm:text-xl">
            Market<span className="text-[#febd69]">place</span>
            <span className="ml-1 hidden text-[10px] font-medium text-slate-300 sm:inline">LOCAL FINDS</span>
          </Link>

          <form onSubmit={submitSearch} className="order-3 flex w-full overflow-hidden rounded-md bg-white text-slate-900 focus-within:ring-2 focus-within:ring-[#febd69] sm:order-2 sm:ml-1 sm:flex-1">
            <label className="sr-only" htmlFor="store-search">Search Marketplace</label>
            <input id="store-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, brands, and more" className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none sm:px-4" />
            <button type="submit" aria-label="Search" className="grid w-12 shrink-0 place-items-center bg-[#febd69] text-slate-900 transition hover:bg-[#f3a847]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
            </button>
          </form>

          <div className="order-2 ml-auto flex items-center gap-2 sm:order-3 sm:ml-0 sm:gap-4">
            {loading ? <span className="px-2 text-xs text-slate-300">Loading account…</span> : user ? (
              <Link to={accountPath} className="rounded-sm px-2 py-1 leading-tight outline-offset-2 hover:outline hover:outline-1 hover:outline-white">
                <span className="block text-[10px] text-slate-300">Hello, {user.name.split(' ')[0]}</span>
                <span className="block whitespace-nowrap text-xs font-bold sm:text-sm">Account</span>
              </Link>
            ) : (
              <Link to="/login" className="rounded-sm px-2 py-1 leading-tight outline-offset-2 hover:outline hover:outline-1 hover:outline-white">
                <span className="block text-[10px] text-slate-300">Welcome</span>
                <span className="block whitespace-nowrap text-xs font-bold sm:text-sm">Sign in</span>
              </Link>
            )}
            {user?.role === 'buyer' && <Link to="/orders" className="hidden rounded-sm px-2 py-1 leading-tight outline-offset-2 hover:outline hover:outline-1 hover:outline-white sm:block"><span className="block text-[10px] text-slate-300">Track and manage</span><span className="block text-sm font-bold">Orders</span></Link>}
            {user?.role === 'buyer' && <Link to="/cart" className="flex items-end gap-1 rounded-sm px-2 py-1 outline-offset-2 hover:outline hover:outline-1 hover:outline-white"><span aria-hidden="true" className="text-2xl leading-6">🛒</span>{cartCount > 0 && <span className="relative -ml-2 -mt-2 grid h-4 min-w-4 place-items-center rounded-full bg-[#febd69] px-1 text-[10px] font-extrabold text-slate-950">{cartCount}</span>}<span className="hidden text-sm font-bold sm:inline">Cart</span></Link>}
            {!user && !loading && <Link to="/register" className="hidden rounded-md border border-white/40 px-3 py-2 text-xs font-semibold hover:border-white sm:block">Create account</Link>}
          </div>
        </div>
      </nav>

      <nav aria-label="Shop departments" className="bg-[#232f3e] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-3 py-1.5 text-xs font-semibold sm:px-5 sm:text-sm">
          <Link to="/shop" className="shrink-0 rounded-sm border border-transparent px-2 py-1.5 hover:border-white"><span aria-hidden="true" className="mr-1">☰</span>All</Link>
          <Link to="/shop?sort=popular" className="shrink-0 rounded-sm border border-transparent px-2 py-1.5 hover:border-white">Popular</Link>
          <Link to="/shop?sort=newest" className="shrink-0 rounded-sm border border-transparent px-2 py-1.5 hover:border-white">New arrivals</Link>
          {categories.map((category) => <Link key={category._id} to={`/shop?category=${category.slug}`} className="shrink-0 rounded-sm border border-transparent px-2 py-1.5 hover:border-white">{category.name}</Link>)}
        </div>
      </nav>
    </header>
  );
}
