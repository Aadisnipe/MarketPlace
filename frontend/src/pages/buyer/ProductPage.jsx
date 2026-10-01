import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import ProductImage from '../../components/ProductImage';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ReviewSection from './ReviewSection';

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function ProductPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [image, setImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    setProduct(null);
    setRelated([]);
    setRelatedLoading(false);
    api.get(`/products/${id}`)
      .then(({ data }) => {
        if (!current) return;
        const item = data.data.product;
        setProduct(item);
        setImage(0);
        if (item.category?._id) {
          setRelatedLoading(true);
          api.get(`/products?category=${item.category._id}&limit=5&sort=popular`)
            .then((results) => { if (current) setRelated(results.data.data.products.filter((entry) => entry._id !== item._id).slice(0, 4)); })
            .catch(() => { if (current) setRelated([]); })
            .finally(() => { if (current) setRelatedLoading(false); });
        } else {
          setRelated([]);
          setRelatedLoading(false);
        }
      })
      .catch((err) => { if (current) setError(err.message || 'Could not load product.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [id]);

  async function addToCart() {
    if (!user) return navigate('/login', { state: { from: { pathname: location.pathname } } });
    if (user.role !== 'buyer') return;
    setAdding(true);
    setError('');
    try {
      await api.post('/cart/items', { productId: product._id, quantity: 1 });
      setCartMessage('Added to your cart.');
      window.dispatchEvent(new Event('marketplace:cart-updated'));
    } catch (err) { setError(err.message || 'Could not add this item to your cart.'); }
    finally { setAdding(false); }
  }

  return <div className="min-h-screen bg-[#eaeded]"><StoreHeader /><main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <Link to="/shop" className="text-sm font-semibold text-[#9a4d00] hover:underline">← Back to shop</Link>
    {loading && <div role="status" aria-label="Loading product" className="mt-8 grid animate-pulse gap-8 md:grid-cols-2"><div className="aspect-square rounded-2xl bg-slate-200" /><div className="space-y-4"><div className="h-8 w-3/4 rounded bg-slate-200" /><div className="h-5 w-1/3 rounded bg-slate-200" /><div className="h-32 rounded bg-slate-100" /></div></div>}
    {error && !loading && <div className="mt-8 rounded-xl bg-red-50 p-5 text-red-800" role="alert">{error} <Link to="/shop" className="font-semibold underline">Return to shop</Link></div>}
    {product && !loading && <>
      <div className="mt-7 grid gap-8 md:grid-cols-2 md:gap-12">
        <section><div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">{product.images?.length ? <ProductImage src={product.images[image]} alt={product.name} className="h-full w-full object-contain" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-amber-50 to-slate-100 text-8xl font-bold text-[#b87935]">{product.name.slice(0, 1).toUpperCase()}</div>}</div>{product.images?.length > 1 && <div className="mt-3 flex gap-3 overflow-x-auto">{product.images.map((src, index) => <button key={src} onClick={() => setImage(index)} aria-label={`Show image ${index + 1}`} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${image === index ? 'border-[#f3a847]' : 'border-transparent'}`}><ProductImage src={src} alt="" className="h-full w-full object-contain" /></button>)}</div>}</section>
        <section className="py-1"><div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#9a4d00]"><span>{product.category?.name}</span>{product.brand && <><span className="text-slate-300">/</span><span>{product.brand}</span></>}</div><h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-950 sm:text-4xl">{product.name}</h1><div className="mt-3 flex items-center gap-2 text-sm"><span className="font-semibold text-amber-700">★ {Number(product.ratingAverage || 0).toFixed(1)}</span><span className="text-slate-500">({product.ratingCount || 0} reviews)</span></div>
          <div className="mt-6 flex items-baseline gap-3"><span className="text-3xl font-bold">{formatPrice(product.price)}</span>{product.compareAtPrice > product.price && <><span className="text-lg text-slate-400 line-through">{formatPrice(product.compareAtPrice)}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{Math.round((1 - product.price / product.compareAtPrice) * 100)}% off</span></>}</div>
          <p className={`mt-4 text-sm font-semibold ${product.stock > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{product.stock > 0 ? `${product.stock} available` : 'Currently out of stock'}</p>
          {user?.role === 'buyer' && <div className="mt-5 flex flex-wrap items-center gap-3"><button onClick={addToCart} disabled={adding || product.stock < 1} className="rounded-lg bg-[#ffd814] px-5 py-3 text-sm font-semibold text-[#0f1111] hover:bg-[#f7ca00] disabled:opacity-50">{adding ? 'Adding…' : product.stock > 0 ? 'Add to cart' : 'Out of stock'}</button>{cartMessage && <span role="status" className="text-sm font-medium text-emerald-700">{cartMessage} <Link to="/cart" className="underline">View cart</Link></span>}</div>}
          {!user && product.stock > 0 && <button onClick={addToCart} className="mt-5 rounded-lg bg-[#ffd814] px-5 py-3 text-sm font-semibold text-[#0f1111] hover:bg-[#f7ca00]">Sign in to add to cart</button>}
          <div className="my-6 h-px bg-slate-200" /><h2 className="font-semibold">About this product</h2><p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{product.description}</p>
          {product.seller && <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sold by</p><p className="mt-1 font-semibold text-slate-900">{product.seller.name}</p></div>}
        </section>
      </div>
      {(relatedLoading || related.length > 0) && <section aria-busy={relatedLoading} className="mt-16 border-t border-slate-200 pt-9"><div className="flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-widest text-[#9a4d00]">Keep exploring</p><h2 className="mt-2 text-2xl font-bold">More in {product.category?.name}</h2></div><Link to={`/shop?category=${product.category?.slug}`} className="text-sm font-semibold text-[#9a4d00] hover:underline">View all</Link></div>{relatedLoading ? <p role="status" className="mt-5 text-sm text-slate-500">Loading similar products…</p> : <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{related.map((item) => <Link key={item._id} to={`/products/${item._id}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="aspect-[4/3] bg-slate-100">{item.images?.[0] ? <ProductImage src={item.images[0]} alt={item.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center text-3xl font-bold text-[#b87935]">{item.name.slice(0, 1)}</div>}</div><div className="p-3"><p className="truncate text-sm font-semibold group-hover:text-[#9a4d00]">{item.name}</p><p className="mt-1 font-bold">{formatPrice(item.price)}</p></div></Link>)}</div>}</section>}
      <ReviewSection product={product} />
    </>}
  </main></div>;
}
