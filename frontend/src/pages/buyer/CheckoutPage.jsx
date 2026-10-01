import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const initialAddress = { name: '', phone: '', line1: '', line2: '', city: '', region: '', postalCode: '', country: 'India' };
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#f3a847] focus:outline-none focus:ring-2 focus:ring-amber-100';
function money(value, currency = 'INR') { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(value || 0); }

export default function CheckoutPage() {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [address, setAddress] = useState({ ...initialAddress, name: user?.name || '' });
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [pendingOrder, setPendingOrder] = useState(null);

  useEffect(() => {
    api.get('/cart').then(({ data }) => setCart(data.data.cart)).catch((err) => setError(err.message || 'Could not load cart.')).finally(() => setLoading(false));
  }, []);

  function updateAddress(event) { setAddress((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function startPayment(orderId) {
    setError('');
    setPlacing(true);
    try {
      const { data } = await api.post(`/orders/${orderId}/payments/stripe`);
      window.location.assign(data.data.url);
    } catch (err) { setError(err.message || 'Could not start Stripe Checkout.'); }
    finally { setPlacing(false); }
  }

  async function placeOrder(event) {
    event.preventDefault();
    setError('');
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', { shippingAddress: address });
      setPendingOrder(data.data.order);
      window.dispatchEvent(new Event('marketplace:cart-updated'));
      setPlacing(false);
      await startPayment(data.data.order._id);
    } catch (err) { setError(err.message || 'Could not place order.'); setPlacing(false); }
  }

  const hasUnavailableItems = cart?.items?.some((item) => !item.available);
  const unavailable = hasUnavailableItems || cart?.mixedCurrencies;
  if (pendingOrder) return <div className="min-h-screen bg-[#eaeded]"><StoreHeader/><main className="mx-auto max-w-2xl px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a4d00]">Order reserved</p><h1 className="mt-2 text-3xl font-bold">Finish your payment</h1><p className="mt-3 text-sm leading-6 text-slate-600">Order {pendingOrder.orderNumber} is waiting for payment. Your items are reserved while you complete Stripe Checkout.</p>{error&&<p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button disabled={placing} onClick={()=>startPayment(pendingOrder._id)} className="mt-6 rounded-lg bg-[#ffd814] px-5 py-3 font-semibold text-[#0f1111] disabled:opacity-50">{placing?'Opening Stripe…':'Continue to secure payment'}</button><Link to={`/orders/${pendingOrder._id}`} className="mt-4 block text-sm font-semibold text-[#9a4d00] hover:underline">View order details</Link></div></main></div>;

  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader/><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><Link to="/cart" className="text-sm font-semibold text-[#9a4d00] hover:underline">← Back to cart</Link><h1 className="mt-3 text-3xl font-bold">Checkout</h1>
    {error && <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
    {loading ? <p className="mt-8 text-slate-500">Loading checkout…</p> : !cart?.items?.length ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center"><p>Your cart is empty.</p><Link to="/shop" className="mt-3 inline-block font-semibold text-[#9a4d00]">Browse products</Link></div> : <form onSubmit={placeOrder} className="mt-7 grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-semibold">Shipping address</h2><p className="mt-1 text-sm text-slate-500">Where should we send your order?</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{[['name','Full name'],['phone','Phone number'],['line1','Address line 1'],['line2','Address line 2 (optional)'],['city','City'],['region','State / region'],['postalCode','Postal code'],['country','Country']].map(([name,label])=><label key={name} className={`text-sm font-medium ${['line1','line2'].includes(name)?'sm:col-span-2':''}`}>{label}<input className={fieldClass} name={name} value={address[name]} onChange={updateAddress} required={!['line2'].includes(name)} maxLength={name==='line1'||name==='line2'?120:80} autoComplete={name==='name'?'name':name==='phone'?'tel':undefined}/></label>)}</div></section>
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Order summary</h2><div className="mt-4 max-h-64 space-y-3 overflow-y-auto">{cart.items.map(({product,quantity,available})=><div key={product?._id} className="flex justify-between gap-3 text-sm"><span className="min-w-0 truncate text-slate-600">{quantity} × {product?.name || 'Unavailable'}</span><span className="shrink-0 font-medium">{available?money(product.price*quantity,product.currency):'Unavailable'}</span></div>)}</div><div className="my-4 h-px bg-slate-200"/><div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span>{cart.mixedCurrencies?'—':money(cart.subtotal,cart.currency)}</span></div><div className="mt-2 flex justify-between text-sm text-slate-600"><span>Shipping</span><span>Free</span></div><div className="my-4 h-px bg-slate-200"/><div className="flex justify-between text-lg font-bold"><span>Total</span><span>{cart.mixedCurrencies?'—':money(cart.subtotal,cart.currency)}</span></div>{hasUnavailableItems&&<p className="mt-3 text-xs text-amber-800">Update or remove unavailable products in your cart first.</p>}{cart.mixedCurrencies&&<p className="mt-3 text-xs text-amber-800">Check out products with one currency at a time.</p>}<button disabled={placing||unavailable} className="mt-5 w-full rounded-lg bg-[#ffd814] px-4 py-3 font-semibold text-[#0f1111] hover:bg-[#f7ca00] disabled:opacity-50">{placing?'Preparing checkout…':'Continue to Stripe'}</button><p className="mt-3 text-center text-xs leading-5 text-slate-500">You’ll pay securely on Stripe. Payment confirmation returns to your order page.</p></aside>
    </form>}
  </main></div>;
}
