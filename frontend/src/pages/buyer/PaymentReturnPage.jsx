import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import api from '../../services/api';

function money(value,currency='INR'){return new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:2}).format(value||0);}

export default function PaymentReturnPage(){
  const [params]=useSearchParams();
  const location=useLocation();
  const orderId=params.get('order_id');
  const cancelled=location.pathname.endsWith('/cancel');
  const [order,setOrder]=useState(null);
  const [loading,setLoading]=useState(Boolean(orderId));
  const [paying,setPaying]=useState(false);
  const [error,setError]=useState('');
  const [refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{
    if(!orderId){setLoading(false);return;}
    let current=true;setLoading(true);setError('');
    (async()=>{
      try { await api.post(`/orders/${orderId}/payments/stripe/confirm`); } catch {}
      try {
        const {data}=await api.get(`/orders/${orderId}`);
        if(current)setOrder(data.data.order);
      } catch(err) {
        if(current)setError(err.message||'Could not load order status.');
      } finally {
        if(current)setLoading(false);
      }
    })();
    return()=>{current=false;};
  },[orderId,refreshKey]);
  async function retryPayment(){
    if(!orderId)return;setPaying(true);setError('');
    try{const {data}=await api.post(`/orders/${orderId}/payments/stripe`);window.location.assign(data.data.url);}
    catch(err){setError(err.message||'Could not reopen Stripe Checkout.');setPaying(false);}
  }
  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader/><main className="mx-auto max-w-2xl px-4 py-16"><div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm"><div className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-2xl ${order?.payment.status==='paid'?'bg-emerald-100 text-emerald-700':'bg-[#fff8e1] text-[#9a4d00]'}`}>{order?.payment.status==='paid'?'✓':'$'}</div><p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-[#9a4d00]">{cancelled?'Checkout paused':'Stripe Checkout'}</p><h1 className="mt-2 text-3xl font-bold">{loading?'Checking your order…':order?.payment.status==='paid'?'Payment confirmed':cancelled?'Payment not completed':'Payment confirmation pending'}</h1>{order&&<><p className="mt-3 text-sm leading-6 text-slate-600">Order <strong>{order.orderNumber}</strong> · {money(order.total,order.currency)}. {order.payment.status==='paid'?'Your payment has been confirmed.':cancelled?'Your order is still reserved. You can retry payment or cancel the order.':'Stripe is confirming your payment. You can refresh this status in a moment.'}</p><p className="mt-2 text-xs text-slate-500">Order status: <span className="capitalize">{order.status.replaceAll('_',' ')}</span> · Payment: <span className="capitalize">{order.payment.status}</span></p></>}{error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="mt-6 flex flex-wrap justify-center gap-3">{order&&order.payment.status!=='paid'&&order.status!=='cancelled'&&<button disabled={paying||loading} onClick={retryPayment} className="rounded-lg bg-[#ffd814] px-4 py-2.5 text-sm font-semibold text-[#0f1111] disabled:opacity-50">{paying?'Opening Stripe…':'Retry payment'}</button>}{orderId&&<button onClick={()=>setRefreshKey((k)=>k+1)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">Refresh status</button>}<Link to={orderId?`/orders/${orderId}`:'/orders'} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold">View order</Link></div></div></main></div>;
}
