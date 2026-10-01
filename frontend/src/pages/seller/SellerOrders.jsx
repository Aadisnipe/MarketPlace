import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';

const nextStep = { pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'out_for_delivery', out_for_delivery: 'delivered' };
const label = (value) => value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value || 0);

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/seller/orders?page=${page}&limit=10`);
      setOrders(data.data.orders);
      setMeta(data.meta || { page: 1, pages: 1, total: 0 });
    } catch (err) { setError(err.message || 'Could not load orders.'); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function updateStatus(order, item, status) {
    const key = `${order._id}:${item._id}`;
    setWorking(key);
    setError('');
    try {
      await api.patch(`/seller/orders/${order._id}/items/${item._id}/status`, { status });
      await loadOrders();
    } catch (err) { setError(err.message || 'Could not update fulfillment.'); }
    finally { setWorking(''); }
  }

  return <section className="space-y-5">
    <div><h2 className="text-2xl font-bold">Order fulfillment</h2><p className="mt-1 text-sm text-slate-600">Orders containing your products. You can only update your own items.</p></div>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading?<p className="py-10 text-center text-sm text-slate-500">Loading orders…</p>:orders.length===0?<div className="rounded-2xl border border-slate-200 bg-white p-12 text-center"><h3 className="font-semibold">No orders yet</h3><p className="mt-2 text-sm text-slate-500">Orders that include your products will appear here.</p></div>:<div className="space-y-4">{orders.map((order)=><article key={order._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{order.orderNumber}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()} · Your items total {money(order.sellerSubtotal,order.currency)}</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{label(order.status)}</span></div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">Ship to {order.shippingAddress.name}</p><p className="mt-1 text-xs leading-5 text-slate-600">{order.shippingAddress.line1}{order.shippingAddress.line2?`, ${order.shippingAddress.line2}`:''}, {order.shippingAddress.city}, {order.shippingAddress.region} {order.shippingAddress.postalCode} · {order.shippingAddress.phone}</p></div>
      <div className="mt-4 divide-y divide-slate-100">{order.items.map((item)=><div key={item._id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-slate-500">Qty {item.quantity} · {money(item.unitPrice*item.quantity,order.currency)} · {label(item.fulfillmentStatus)}</p></div>{nextStep[item.fulfillmentStatus]&&<button disabled={working===`${order._id}:${item._id}`} onClick={()=>updateStatus(order,item,nextStep[item.fulfillmentStatus])} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{working===`${order._id}:${item._id}`?'Saving…':`Mark ${label(nextStep[item.fulfillmentStatus])}`}</button>}</div>)}</div>
    </article>)}</div>}
    {meta.pages>1&&<div className="flex items-center justify-center gap-4"><button disabled={page<=1||loading} onClick={()=>setPage((p)=>p-1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-600">Page {page} of {meta.pages}</span><button disabled={page>=meta.pages||loading} onClick={()=>setPage((p)=>p+1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </section>;
}
