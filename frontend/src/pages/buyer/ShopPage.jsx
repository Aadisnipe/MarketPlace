import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import StoreHeader from '../../components/StoreHeader';
import ProductImage from '../../components/ProductImage';
import api from '../../services/api';

const initialFilters = { search: '', category: '', brand: '', minPrice: '', maxPrice: '', minRating: '', inStock: false, sort: 'newest' };

function formatPrice(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function ShopPage() {
  const [urlParams, setUrlParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    search: urlParams.get('search') || '',
    category: urlParams.get('category') || '',
    brand: urlParams.get('brand') || '',
    minPrice: urlParams.get('minPrice') || '',
    maxPrice: urlParams.get('maxPrice') || '',
    minRating: urlParams.get('minRating') || '',
    inStock: urlParams.get('inStock') === 'true',
    sort: urlParams.get('sort') || 'newest',
  }));
  const [submittedSearch, setSubmittedSearch] = useState(urlParams.get('search') || '');
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  // The department links and header search can change the URL without
  // remounting this route. Keep the visible controls and request in sync.
  useEffect(() => {
    const nextFilters = {
      ...initialFilters,
      search: urlParams.get('search') || '',
      category: urlParams.get('category') || '',
      brand: urlParams.get('brand') || '',
      minPrice: urlParams.get('minPrice') || '',
      maxPrice: urlParams.get('maxPrice') || '',
      minRating: urlParams.get('minRating') || '',
      inStock: urlParams.get('inStock') === 'true',
      sort: urlParams.get('sort') || 'newest',
    };
    setFilters(nextFilters);
    setSubmittedSearch(nextFilters.search);
    setPage(1);
  }, [urlParams]);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data.categories)).catch(() => setCategories([]));
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20', sort: filters.sort });
    if (submittedSearch) params.set('search', submittedSearch);
    for (const key of ['category', 'brand', 'minPrice', 'maxPrice', 'minRating']) if (filters[key]) params.set(key, filters[key]);
    if (filters.inStock) params.set('inStock', 'true');
    return params.toString();
  }, [page, filters, submittedSearch]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api.get(`/products?${queryString}`)
      .then(({ data }) => {
        if (!current) return;
        setProducts(data.data.products);
        setMeta(data.meta || { total: 0, pages: 0, limit: 20 });
      })
      .catch((err) => { if (current) setError(err.message || 'Could not load products.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [queryString, retryKey]);

  function updateFilter(event) {
    const { name, value, checked, type } = event.target;
    setFilters((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
    setPage(1);
  }

  function submitSearch(event) {
    event.preventDefault();
    setSubmittedSearch(filters.search.trim());
    const params = Object.fromEntries(Object.entries({
      search: filters.search.trim(), category: filters.category, brand: filters.brand,
      minPrice: filters.minPrice, maxPrice: filters.maxPrice, minRating: filters.minRating,
      inStock: filters.inStock ? 'true' : '', sort: filters.sort,
    }).filter(([, value]) => value));
    setUrlParams(params);
    setPage(1);
  }

  function resetFilters() {
    setFilters(initialFilters);
    setSubmittedSearch('');
    setUrlParams({});
    setPage(1);
  }

  return (
    <div className="min-h-screen bg-[#eaeded]">
      <StoreHeader />
      <main className="mx-auto max-w-[1500px] px-3 py-5 sm:px-5">
        <section className="mb-5 overflow-hidden rounded-md bg-gradient-to-r from-[#232f3e] via-[#34485e] to-[#526a7b] px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#febd69]">Marketplace finds</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Find something worth keeping.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">Discover useful goods from independent sellers, all in one place.</p>
        </section>
        <div className="grid items-start gap-4 lg:grid-cols-[245px_minmax(0,1fr)]">
          <aside className="h-fit rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Filters</h2><button onClick={resetFilters} className="text-xs font-semibold text-[#9a4d00] hover:underline">Clear all</button></div>
            <form onSubmit={submitSearch} className="mt-4 space-y-4">
              <label className="block text-sm font-medium">Search<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="search" value={filters.search} onChange={updateFilter} placeholder="What are you looking for?" /></label>
              <label className="block text-sm font-medium">Category<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="category" value={filters.category} onChange={updateFilter}><option value="">All categories</option>{categories.map((category) => <option value={category.slug} key={category._id}>{category.name}</option>)}</select></label>
              <label className="block text-sm font-medium">Brand<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="brand" value={filters.brand} onChange={updateFilter} placeholder="Any brand" /></label>
              <fieldset><legend className="text-sm font-medium">Price range (₹)</legend><div className="mt-2 grid grid-cols-2 gap-2"><label className="sr-only" htmlFor="minPrice">Minimum price</label><input id="minPrice" className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm" name="minPrice" type="number" min="0" value={filters.minPrice} onChange={updateFilter} placeholder="Min" /><label className="sr-only" htmlFor="maxPrice">Maximum price</label><input id="maxPrice" className="min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm" name="maxPrice" type="number" min="0" value={filters.maxPrice} onChange={updateFilter} placeholder="Max" /></div></fieldset>
              <label className="block text-sm font-medium">Minimum rating<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="minRating" value={filters.minRating} onChange={updateFilter}><option value="">Any rating</option><option value="4">4 stars & up</option><option value="3">3 stars & up</option><option value="2">2 stars & up</option><option value="1">1 star & up</option></select></label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inStock" checked={filters.inStock} onChange={updateFilter} className="h-4 w-4 rounded border-slate-300 text-[#9a4d00] focus:ring-amber-500" />In stock only</label>
              <button className="w-full rounded-lg bg-[#ffd814] px-4 py-2.5 text-sm font-semibold text-[#0f1111] hover:bg-[#f7ca00]">Search products</button>
            </form>
          </aside>

          <section aria-busy={loading}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-sm text-slate-600">{loading ? 'Loading products…' : <><strong className="text-slate-900">{meta.total}</strong> result{meta.total === 1 ? '' : 's'}{submittedSearch && <> for <strong className="text-slate-900">“{submittedSearch}”</strong></>}</>}</p><label className="flex items-center gap-2 text-sm text-slate-600">Sort by<select className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#f3a847] focus:outline-none focus:ring-2 focus:ring-amber-100" name="sort" value={filters.sort} onChange={updateFilter}><option value="newest">Newest</option><option value="popular">Most popular</option><option value="rating">Top rated</option><option value="price">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label></div>
            {error && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-800" role="alert"><span>{error}</span><button onClick={() => setRetryKey((key) => key + 1)} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-900 hover:bg-red-100">Try again</button></div>}
            {!loading && !error && products.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><h2 className="text-lg font-semibold">No products match those filters</h2><p className="mt-2 text-sm text-slate-600">Try changing the search or clearing a filter.</p><button onClick={resetFilters} className="mt-4 font-semibold text-[#9a4d00] hover:underline">Clear filters</button></div>}
            {loading && <div role="status" aria-label="Loading products" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />)}</div>}
            {!loading && products.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{products.map((product) => <ProductCard key={product._id} product={product} />)}</div>}
            {meta.pages > 1 && <div className="mt-8 flex items-center justify-center gap-4"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><span className="text-sm text-slate-600">Page {page} of {meta.pages}</span><button disabled={page >= meta.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div>}
          </section>
        </div>
      </main>
    </div>
  );
}

function ProductCard({ product }) {
  const discount = product.compareAtPrice > product.price ? Math.round((1 - product.price / product.compareAtPrice) * 100) : 0;
  return <Link to={`/products/${product._id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:border-slate-400 hover:shadow-md">
    <div className="relative aspect-[4/3] overflow-hidden bg-[#f7f8f8]">{discount > 0 && <span className="absolute left-0 top-3 z-10 bg-[#cc0c39] px-2.5 py-1 text-xs font-bold text-white">-{discount}%</span>}{product.images?.[0] ? <ProductImage src={product.images[0]} alt={product.name} className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-[#f8f4ec] to-[#eef1f1] text-5xl font-bold text-[#8091a1]">{product.name.slice(0, 1).toUpperCase()}</div>}</div>
    <div className="flex flex-1 flex-col p-4"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{product.brand || product.category?.name || 'Marketplace pick'}</p><h2 className="line-clamp-2 min-h-10 font-medium leading-5 text-[#0f1111] group-hover:text-[#b45309]">{product.name}</h2><div className="mt-2 flex items-center gap-1.5"><span aria-label={`${Number(product.ratingAverage || 0).toFixed(1)} out of 5 stars`} className="text-sm font-bold tracking-tight text-[#de7921]">★ {Number(product.ratingAverage || 0).toFixed(1)}</span><span className="text-xs text-slate-500">({product.ratingCount || 0})</span></div><div className="mt-3 flex flex-wrap items-baseline gap-2"><span className="text-xl font-bold tracking-tight text-[#0f1111]">{formatPrice(product.price)}</span>{product.compareAtPrice > product.price && <span className="text-xs text-slate-500">List: <span className="line-through">{formatPrice(product.compareAtPrice)}</span></span>}</div><p className={`mt-auto pt-3 text-xs font-medium ${product.stock > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{product.stock > 0 ? 'In stock · Free shipping' : 'Currently unavailable'}</p><span className="mt-3 inline-flex w-fit rounded-full bg-[#ffd814] px-4 py-1.5 text-xs font-semibold text-[#0f1111] transition group-hover:bg-[#f7ca00]">View product</span></div>
  </Link>;
}
