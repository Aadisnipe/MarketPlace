import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ReviewSection({ product }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ ratingAverage: product.ratingAverage || 0, ratingCount: product.ratingCount || 0 });
  const [eligibility, setEligibility] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [form, setForm] = useState({ rating: 5, title: '', body: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadReviews = useCallback(async () => {
    const { data } = await api.get(`/reviews/products/${product._id}?page=${page}&limit=10`);
    setReviews(data.data.reviews);
    setSummary({ ratingAverage: data.data.ratingAverage || 0, ratingCount: data.data.ratingCount || 0 });
    setPages(data.meta?.pages || 1);
  }, [product._id, page]);

  const loadEligibility = useCallback(async () => {
    if (user?.role !== 'buyer') { setEligibility(null); return; }
    try {
      const { data } = await api.get(`/reviews/eligibility/${product._id}`);
      setEligibility(data.data);
      if (data.data.review) setForm({ rating: data.data.review.rating, title: data.data.review.title || '', body: data.data.review.body || '' });
    } catch { setEligibility({ eligible: false, review: null }); }
  }, [product._id, user?.role]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    loadReviews().catch((err) => { if (current) setError(err.message || 'Could not load reviews.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [loadReviews]);

  useEffect(() => { loadEligibility(); }, [loadEligibility]);

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      if (eligibility?.review) await api.patch(`/reviews/${eligibility.review._id}`, { ...form, rating: Number(form.rating) });
      else await api.post('/reviews', { productId: product._id, orderId: eligibility?.orderId, ...form, rating: Number(form.rating) });
      setMessage(eligibility?.review ? 'Review updated.' : 'Review submitted.');
      await Promise.all([loadReviews(), loadEligibility()]);
    } catch (err) { setError(err.message || 'Could not save review.'); }
    finally { setSaving(false); }
  }

  async function removeReview() {
    if (!eligibility?.review) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await api.delete(`/reviews/${eligibility.review._id}`);
      setForm({ rating: 5, title: '', body: '' });
      setMessage('Review deleted.');
      await Promise.all([loadReviews(), loadEligibility()]);
    } catch (err) { setError(err.message || 'Could not delete review.'); }
    finally { setSaving(false); }
  }

  const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-[#f3a847] focus:outline-none focus:ring-2 focus:ring-amber-100';
  return <section className="mt-16 border-t border-slate-200 pt-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#9a4d00]">Customer feedback</p><h2 className="mt-2 text-2xl font-bold">Reviews</h2></div><p className="text-sm text-slate-600"><span className="font-bold text-amber-700">★ {Number(summary.ratingAverage).toFixed(1)}</span> · {summary.ratingCount} review{summary.ratingCount===1?'':'s'}</p></div>
    {error&&<p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message&&<p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {user?.role==='buyer'&&<div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">{eligibility?.review?'Your review':eligibility?.eligible?'Write a review':'Verified buyer reviews'}</h3>
      {eligibility?.eligible||eligibility?.review?<form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Rating<select className={input} name="rating" value={form.rating} onChange={update}><option value={5}>5 — Excellent</option><option value={4}>4 — Good</option><option value={3}>3 — Average</option><option value={2}>2 — Below average</option><option value={1}>1 — Poor</option></select></label><label className="text-sm font-medium">Title (optional)<input className={input} name="title" value={form.title} onChange={update} maxLength={120} /></label><label className="text-sm font-medium sm:col-span-2">Your review<textarea className={input} name="body" value={form.body} onChange={update} required minLength={5} maxLength={3000} rows={4} /></label><div className="flex gap-3 sm:col-span-2"><button disabled={saving} className="rounded-lg bg-[#ffd814] px-4 py-2.5 text-sm font-semibold text-[#0f1111] disabled:opacity-50">{saving?'Saving…':eligibility.review?'Save changes':'Submit review'}</button>{eligibility.review&&<button type="button" disabled={saving} onClick={removeReview} className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-50">Delete review</button>}</div></form>:<p className="mt-2 text-sm text-slate-600">You can review this product after it has been delivered to you.</p>}
    </div>}
    {loading?<p className="mt-6 text-sm text-slate-500">Loading reviews…</p>:reviews.length===0?<p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No reviews yet. Be the first to share your experience after purchase.</p>:<div className="mt-5 space-y-3">{reviews.map((review)=><article key={review._id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-semibold">{review.buyer?.name||'Buyer'} <span className="ml-1 text-xs font-normal text-emerald-700">Verified purchase</span></div>{review.title&&<h3 className="mt-1 font-medium">{review.title}</h3>}</div><span className="text-sm font-semibold text-amber-700">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{review.body}</p><p className="mt-3 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p></article>)}</div>}
    {pages>1&&<div className="mt-5 flex items-center justify-center gap-4"><button disabled={page<=1} onClick={()=>setPage((p)=>p-1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-slate-500">Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>setPage((p)=>p+1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-40">Next</button></div>}
  </section>;
}
