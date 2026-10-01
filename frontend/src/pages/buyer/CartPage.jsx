import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import api from '../../services/api';

function money(value, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(value || 0);
}

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState({ items: [], subtotal: 0, currency: 'INR', itemCount: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/cart');
      setCart(data.data.cart);
      setError('');
    } catch (err) { setError(err.message || 'Could not load your cart.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCart(); }, [loadCart]);

  async function updateItem(productId, quantity) {
    setBusy(productId);
    setError('');
    try {
      const { data } = await api.patch(`/cart/items/${productId}`, { quantity });
      setCart(data.data.cart);
      window.dispatchEvent(new Event('marketplace:cart-updated'));
    } catch (err) { setError(err.message || 'Could not update cart.'); }
    finally { setBusy(''); }
  }

  async function removeItem(productId) {
    setBusy(productId);
    setError('');
    try {
      const { data } = await api.delete(`/cart/items/${productId}`);
      setCart(data.data.cart);
      window.dispatchEvent(new Event('marketplace:cart-updated'));
    } catch (err) { setError(err.message || 'Could not remove item.'); }
    finally { setBusy(''); }
  }

  const unavailable = cart.items.some((item) => !item.available);
  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a4d00]">Your basket</p><h1 className="mt-2 text-3xl font-bold">Shopping cart</h1>
    {error && <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
    {loading ? <p className="mt-8 text-slate-500">Loading cart…</p> : cart.items.length === 0 ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"><p className="text-lg font-semibold">Your cart is empty</p><p className="mt-2 text-sm text-slate-600">Browse the marketplace to find something you like.</p><Link to="/shop" className="mt-5 inline-flex rounded-lg bg-[#ffd814] px-5 py-3 text-sm font-semibold text-[#0f1111]">Browse products</Link></div> : <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="space-y-3">{cart.items.map(({ product, quantity, available }) => <article key={product?._id} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <Link to={product ? `/products/${product._id}` : '/shop'} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-28 sm:w-28">{product?.images?.[0] ? <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-3xl font-bold text-[#b87935]">{product?.name?.slice(0, 1) || '?'}</div>}</Link>
        <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><div><Link to={product ? `/products/${product._id}` : '/shop'} className="font-semibold hover:text-[#9a4d00]">{product?.name || 'Unavailable product'}</Link><p className="mt-1 text-xs text-slate-500">{product?.seller?.name || 'Marketplace seller'}</p></div><p className="shrink-0 font-bold">{available ? money(product.price * quantity, product.currency) : '—'}</p></div>
          {available ? <><p className="mt-2 text-xs text-emerald-700">{product.stock} available</p><div className="mt-3 flex items-center gap-3"><label className="sr-only" htmlFor={`qty-${product._id}`}>Quantity for {product.name}</label><select id={`qty-${product._id}`} value={quantity} disabled={busy === product._id} onChange={(event) => updateItem(product._id, Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">{Array.from({ length: Math.min(product.stock, 10) }, (_, i) => i + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select><button disabled={busy === product._id} onClick={() => removeItem(product._id)} className="text-xs font-semibold text-slate-500 hover:text-red-700">Remove</button></div></> : <><p className="mt-2 text-xs font-medium text-amber-800">Unavailable or quantity exceeds current stock. Remove this item to continue.</p><button disabled={busy === product?._id} onClick={() => removeItem(product?._id)} className="mt-3 text-xs font-semibold text-red-700 hover:underline">Remove item</button></>}
        </div>
      </article>)}</section>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Order summary</h2><div className="mt-5 flex justify-between text-sm text-slate-600"><span>Items ({cart.itemCount})</span><span>{cart.mixedCurrencies ? '—' : money(cart.subtotal, cart.currency)}</span></div><div className="mt-3 flex justify-between text-sm text-slate-600"><span>Shipping</span><span>Calculated at checkout</span></div><div className="my-4 h-px bg-slate-200"/><div className="flex justify-between font-bold"><span>Subtotal</span><span>{cart.mixedCurrencies ? '—' : money(cart.subtotal, cart.currency)}</span></div><button disabled={unavailable || cart.mixedCurrencies} onClick={() => navigate('/checkout')} className="mt-5 w-full rounded-lg bg-[#ffd814] px-4 py-3 font-semibold text-[#0f1111] hover:bg-[#f7ca00] disabled:cursor-not-allowed disabled:opacity-50">Continue to checkout</button>{unavailable && <p className="mt-3 text-xs text-amber-800">Remove unavailable items before checking out.</p>}{cart.mixedCurrencies && <p className="mt-3 text-xs text-amber-800">Your cart contains multiple currencies. Check out one currency at a time.</p>}<Link to="/shop" className="mt-4 block text-center text-sm font-semibold text-[#9a4d00] hover:underline">Continue shopping</Link></aside>
    </div>}
  </main></div>;
}
