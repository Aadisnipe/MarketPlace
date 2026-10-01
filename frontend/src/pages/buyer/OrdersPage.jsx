import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import ProductImage from '../../components/ProductImage';
import api from '../../services/api';

function money(value, currency = 'INR') { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0); }
function label(status) { return status?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setLoading(true);
    api.get(`/orders?page=${page}&limit=10`).then(({ data }) => {
      if (!current) return;
      setOrders(data.data.orders);
      setMeta(data.meta || { pages: 1, total: 0 });
    }).catch((err) => { if (current) setError(err.message || 'Could not load orders.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page]);

  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#9a4d00]">Your account</p><h1 className="mt-2 text-3xl font-bold">Your orders</h1>
    {error&&<p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading?<p className="mt-8 text-slate-500">Loading orders…</p>:orders.length===0?<div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center"><h2 className="text-lg font-semibold">No orders yet</h2><p className="mt-2 text-sm text-slate-600">Orders you place will appear here.</p><Link to="/shop" className="mt-4 inline-block font-semibold text-[#9a4d00]">Browse the shop</Link></div>:<div className="mt-6 space-y-4">{orders.map((order)=><article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{order.orderNumber}</p><p className="mt-1 text-xs text-slate-500">Placed {new Date(order.createdAt).toLocaleDateString()}</p></div><Status status={order.status}/></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex items-center gap-3">{order.items.slice(0,3).map((item)=><div key={item._id} className="flex items-center gap-2">{item.imageUrl||item.product?.images?.[0]?<ProductImage src={item.imageUrl||item.product.images[0]} alt="" className="h-11 w-11 rounded-lg bg-slate-100 object-cover"/>:<div className="grid h-11 w-11 place-items-center rounded-lg bg-[#fff8e1] font-bold text-[#b87935]">{item.name.slice(0,1)}</div>}</div>)}<span className="text-sm text-slate-600">{order.items.length} item{order.items.length===1?'':'s'}</span></div><div className="flex items-center gap-4"><span className="font-bold">{money(order.total,order.currency)}</span><Link to={`/orders/${order._id}`} className="text-sm font-semibold text-[#9a4d00] hover:underline">View details</Link></div></div></article>)}</div>}
    {meta.pages>1&&<div className="mt-6 flex items-center justify-center gap-4"><button disabled={page<=1} onClick={()=>setPage((p)=>p-1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-600">Page {page} of {meta.pages}</span><button disabled={page>=meta.pages} onClick={()=>setPage((p)=>p+1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </main></div>;
}

export function OrderDetailPage() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    api.get(`/orders/${id}`).then(({data})=>{if(current)setOrder(data.data.order);}).catch((err)=>{if(current)setError(err.message||'Could not load order.');}).finally(()=>{if(current)setLoading(false);});
    return ()=>{current=false;};
  },[id]);
  async function cancelOrder(){
    if(!window.confirm('Cancel this unpaid order? This cannot be undone.'))return;
    setWorking(true);setError('');
    try{const {data}=await api.post(`/orders/${id}/cancel`);setOrder(data.data.order);}
    catch(err){setError(err.message||'Could not cancel order.');}
    finally{setWorking(false);}
  }
  async function payOrder(){
    setPaying(true);setError('');
    try{const {data}=await api.post(`/orders/${id}/payments/stripe`);window.location.assign(data.data.url);}
    catch(err){setError(err.message||'Could not open Stripe Checkout.');setPaying(false);}
  }
  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6"><Link to="/orders" className="text-sm font-semibold text-[#9a4d00] hover:underline">← Your orders</Link>
    {loading?<p className="mt-8 text-slate-500">Loading order…</p>:error&&!order?<p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>:order&&<><div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#9a4d00]">Order details</p><h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1><p className="mt-1 text-sm text-slate-500">Placed {new Date(order.createdAt).toLocaleString()}</p></div><Status status={order.status}/></div>
      {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="font-semibold">Delivery progress</h2><OrderTimeline status={order.status} history={order.statusHistory}/></section>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Items</h2><div className="mt-4 divide-y divide-slate-100">{order.items.map((item)=><div key={item._id} className="flex gap-4 py-4 first:pt-0 last:pb-0">{item.imageUrl||item.product?.images?.[0]?<ProductImage src={item.imageUrl||item.product.images[0]} alt="" className="h-16 w-16 rounded-lg bg-slate-100 object-cover"/>:<div className="grid h-16 w-16 place-items-center rounded-lg bg-[#fff8e1] text-xl font-bold text-[#b87935]">{item.name.slice(0,1)}</div>}<div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">Sold by {item.seller?.name||'Marketplace seller'} · Qty {item.quantity}</p><p className="mt-2 text-xs font-medium text-slate-600">{label(item.fulfillmentStatus)}</p></div><p className="font-semibold">{money(item.unitPrice*item.quantity,order.currency)}</p></div>)}</div></section>
        <aside className="h-fit space-y-4"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Shipping to</h2><p className="mt-3 text-sm font-medium">{order.shippingAddress.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">{order.shippingAddress.line1}{order.shippingAddress.line2&&<><br/>{order.shippingAddress.line2}</>}<br/>{order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode}<br/>{order.shippingAddress.country}<br/>{order.shippingAddress.phone}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Payment summary</h2><div className="mt-3 flex justify-between text-sm text-slate-600"><span>Payment status</span><span className="capitalize">{order.payment.status}</span></div><div className="mt-4 flex justify-between border-t border-slate-100 pt-4 font-bold"><span>Total</span><span>{money(order.total,order.currency)}</span></div></section>{order.status==='pending'&&order.payment.status!=='paid'&&<><button disabled={paying} onClick={payOrder} className="w-full rounded-lg bg-[#ffd814] px-4 py-2.5 text-sm font-semibold text-[#0f1111] hover:bg-[#f7ca00] disabled:opacity-50">{paying?'Opening Stripe…':'Pay securely with Stripe'}</button><button disabled={working} onClick={cancelOrder} className="w-full rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{working?'Cancelling…':'Cancel order'}</button></>}</aside>
      </div>
    </>}
  </main></div>;
}

function Status({status}){
  const colors={pending:'bg-amber-50 text-amber-800',confirmed:'bg-blue-50 text-blue-700',processing:'bg-[#fff8e1] text-[#9a4d00]',shipped:'bg-violet-50 text-violet-700',out_for_delivery:'bg-cyan-50 text-cyan-800',delivered:'bg-emerald-50 text-emerald-700',cancelled:'bg-slate-100 text-slate-700'};
  return <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${colors[status]||colors.pending}`}>{status?.replaceAll('_',' ')}</span>;
}

function OrderTimeline({status,history=[]}){
  const steps=['pending','confirmed','processing','shipped','out_for_delivery','delivered'];
  const current=steps.indexOf(status);
  if(status==='cancelled')return <div className="mt-4 rounded-lg bg-slate-100 p-4 text-sm text-slate-700">This order was cancelled.</div>;
  return <><ol className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">{steps.map((step,index)=><li key={step} className="relative"><div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${index<=current?'bg-[#ffd814] text-[#0f1111]':'bg-slate-100 text-slate-500'}`}>{index<current?'✓':index+1}</div><p className={`mt-2 text-center text-[11px] leading-4 ${index<=current?'font-semibold text-slate-900':'text-slate-500'}`}>{step.replaceAll('_',' ')}</p></li>)}</ol><div className="mt-6 space-y-2 border-t border-slate-100 pt-4">{history.slice().reverse().map((entry,index)=><p key={`${entry.changedAt}-${index}`} className="flex justify-between gap-4 text-xs text-slate-500"><span>{entry.note||entry.status.replaceAll('_',' ')}</span><time>{new Date(entry.changedAt).toLocaleString()}</time></p>)}</div></>;
}
