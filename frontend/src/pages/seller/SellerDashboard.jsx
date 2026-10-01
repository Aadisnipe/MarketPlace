import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import SellerOrders from './SellerOrders';
import ProductImage from '../../components/ProductImage';

const emptyForm = { name: '', description: '', category: '', brand: '', sku: '', price: '', compareAtPrice: '', stock: '', images: '', status: 'active' };
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100';

function money(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export default function SellerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState({ totalProducts: 0, activeProducts: 0, outOfStockProducts: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, categoriesRes, overviewRes] = await Promise.all([
        api.get(`/seller/products?limit=20&page=${page}${search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ''}`),
        api.get('/categories'),
        api.get('/seller/overview'),
      ]);
      setProducts(productsRes.data.data.products);
      setPagination(productsRes.data.meta || { page: 1, pages: 1, total: 0 });
      setCategories(categoriesRes.data.data.categories);
      setSummary(overviewRes.data.data.summary);
    } catch (err) {
      setError(err.message || 'Could not load seller dashboard.');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  function beginCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, category: categories[0]?._id || '' });
    setNotice('');
    setError('');
    setSection('products');
  }

  function beginEdit(product) {
    setEditingId(product._id);
    setForm({
      name: product.name || '', description: product.description || '', category: product.category?._id || product.category || '',
      brand: product.brand || '', sku: product.sku || '', price: String(product.price ?? ''),
      compareAtPrice: product.compareAtPrice == null ? '' : String(product.compareAtPrice), stock: String(product.stock ?? ''),
      images: (product.images || []).join('\n'), status: product.status,
    });
    setNotice('');
    setError('');
    setSection('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveProduct(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const payload = {
      ...form,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice === '' ? undefined : Number(form.compareAtPrice),
      stock: Number(form.stock),
      images: form.images.split(/[\n,]+/).map((url) => url.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      if (editingId) await api.patch(`/seller/products/${editingId}`, payload);
      else await api.post('/seller/products', payload);
      setNotice(editingId ? 'Product updated.' : 'Product created.');
      setEditingId(null);
      setForm({ ...emptyForm, category: categories[0]?._id || '' });
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Could not save product.');
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Archive “${product.name}”? It will no longer appear in the shop.`)) return;
    setError('');
    setNotice('');
    try {
      await api.delete(`/seller/products/${product._id}`);
      setNotice(`${product.name} archived.`);
      await loadDashboard();
    } catch (err) {
      setError(err.message || 'Could not archive product.');
    }
  }

  async function signOut() {
    await logout();
    navigate('/', { replace: true });
  }

  const filteredProducts = products;
  const stats = [
    { label: 'Total products', value: summary.totalProducts, note: 'Across your catalog' },
    { label: 'Active products', value: summary.activeProducts, note: 'Visible in the marketplace' },
    { label: 'Out of stock', value: summary.outOfStockProducts, note: 'Active items that need restocking' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 lg:flex">
      <aside className="bg-slate-950 text-white lg:flex lg:w-64 lg:flex-col">
        <div className="flex items-center justify-between px-5 py-5 lg:block"><Link to="/" className="text-lg font-bold">Market<span className="text-amber-300">place</span></Link><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200 lg:mt-4 lg:inline-block">Seller workspace</span></div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:mt-8 lg:flex-col lg:overflow-visible">
          {[['overview', 'Overview'], ['products', 'Products'], ['orders', 'Orders']].map(([key, label]) => <button key={key} onClick={() => { setSection(key); setError(''); setNotice(''); }} className={`whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium ${section === key ? 'bg-amber-400 text-slate-950' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{label}</button>)}
        </nav>
        <div className="hidden border-t border-white/10 p-5 lg:mt-auto lg:block"><p className="truncate text-sm font-medium">{user.name}</p><p className="mt-1 truncate text-xs text-slate-400">{user.email}</p><button onClick={signOut} className="mt-4 text-sm text-slate-300 hover:text-white">Sign out</button></div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-widest text-amber-800">Seller dashboard</p><h1 className="mt-1 text-xl font-bold">{section === 'overview' ? 'Overview' : section === 'orders' ? 'Order fulfillment' : 'Product management'}</h1></div><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span><button onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 lg:hidden">Sign out</button>{section !== 'orders'&&<button onClick={beginCreate} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">Add product</button>}</div></header>
        <div className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8">
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</div>}
          {notice && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</div>}

          {section === 'overview' && <>
            <div><h2 className="text-2xl font-bold">Your store at a glance</h2><p className="mt-1 text-sm text-slate-600">Manage your catalog and keep inventory up to date.</p></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{stats.map((stat) => <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-medium text-slate-500">{stat.label}</p><p className="mt-3 text-3xl font-bold">{loading ? '—' : stat.value}</p><p className="mt-2 text-xs text-slate-500">{stat.note}</p></article>)}</div>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Recently updated products</h3><p className="mt-1 text-sm text-slate-500">Your latest catalog changes.</p></div><button onClick={() => setSection('products')} className="text-sm font-semibold text-amber-800 hover:underline">View all products</button></div>
              {loading ? <p className="py-8 text-sm text-slate-500">Loading products…</p> : products.length === 0 ? <div className="py-10 text-center"><p className="font-medium">Your catalog is empty</p><p className="mt-1 text-sm text-slate-500">Add your first product to start building your store.</p><button onClick={beginCreate} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add your first product</button></div> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="pb-3 font-medium">Product</th><th className="pb-3 font-medium">Price</th><th className="pb-3 font-medium">Stock</th><th className="pb-3 font-medium">Status</th></tr></thead><tbody>{products.slice(0, 5).map((product) => <tr key={product._id} className="border-t border-slate-100"><td className="py-3 font-medium">{product.name}</td><td className="py-3">{money(product.price)}</td><td className="py-3">{product.stock}</td><td className="py-3"><StatusBadge status={product.status} /></td></tr>)}</tbody></table></div>}
            </section>
          </>}

          {section === 'products' && <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{editingId ? 'Edit product' : 'Add a product'}</h2><p className="mt-1 text-sm text-slate-500">Add clear details so shoppers know what you sell.</p></div>{editingId && <button onClick={() => { setEditingId(null); setForm(emptyForm); }} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Cancel</button>}</div>
              {categories.length === 0 && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">No active categories are available yet. Ask an administrator to add a category before listing products.</p>}
              <form onSubmit={saveProduct} className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">Product name<input className={inputClass} name="name" value={form.name} onChange={updateForm} required minLength={2} maxLength={160} /></label>
                <label className="text-sm font-medium">Category<select className={inputClass} name="category" value={form.category} onChange={updateForm} required disabled={!categories.length}><option value="">Choose a category</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
                <label className="text-sm font-medium">Price (INR)<input className={inputClass} type="number" name="price" value={form.price} onChange={updateForm} required min="0" step="0.01" /></label>
                <label className="text-sm font-medium">Compare at price (optional)<input className={inputClass} type="number" name="compareAtPrice" value={form.compareAtPrice} onChange={updateForm} min="0" step="0.01" /></label>
                <label className="text-sm font-medium">Stock quantity<input className={inputClass} type="number" name="stock" value={form.stock} onChange={updateForm} required min="0" step="1" /></label>
                <label className="text-sm font-medium">Brand<input className={inputClass} name="brand" value={form.brand} onChange={updateForm} maxLength={100} /></label>
                <label className="text-sm font-medium">SKU<input className={inputClass} name="sku" value={form.sku} onChange={updateForm} maxLength={64} /></label>
                <label className="text-sm font-medium">Listing status<select className={inputClass} name="status" value={form.status} onChange={updateForm}><option value="active">Active</option><option value="draft">Draft</option></select></label>
                <label className="text-sm font-medium md:col-span-2">Description<textarea className={inputClass} name="description" value={form.description} onChange={updateForm} required rows={4} maxLength={10000} /></label>
                <label className="text-sm font-medium md:col-span-2">Image URLs<textarea className={inputClass} name="images" value={form.images} onChange={updateForm} rows={2} placeholder="Paste up to 8 image URLs, one per line" /><span className="mt-1 block text-xs font-normal text-slate-500">Cloud image upload and previews will be added in the image storage phase.</span></label>
                <div className="flex flex-wrap gap-3 md:col-span-2"><button disabled={saving || !categories.length} className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}</button>{!editingId && <button type="button" onClick={() => setForm({ ...emptyForm, category: categories[0]?._id || '' })} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold hover:bg-slate-50">Clear form</button>}</div>
              </form>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Your products</h2><p className="mt-1 text-sm text-slate-500">Only you can edit or archive items in this list.</p></div><input aria-label="Search your products" className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64" placeholder="Search products…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
              {loading ? <p className="py-8 text-sm text-slate-500">Loading products…</p> : filteredProducts.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">{search ? 'No matching products.' : 'No products yet. Use the form above to add one.'}</p> : <><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="rounded-l-lg px-3 py-3 font-medium">Product</th><th className="px-3 py-3 font-medium">Category</th><th className="px-3 py-3 font-medium">Price</th><th className="px-3 py-3 font-medium">Stock</th><th className="px-3 py-3 font-medium">Status</th><th className="rounded-r-lg px-3 py-3 font-medium">Actions</th></tr></thead><tbody>{filteredProducts.map((product) => <tr key={product._id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3"><div className="flex items-center gap-3">{product.images?.[0] ? <ProductImage src={product.images[0]} alt="" className="h-10 w-10 rounded-lg bg-slate-100 object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-lg bg-amber-50 text-xs font-bold text-amber-800">{product.name.slice(0, 1).toUpperCase()}</div>}<span className="max-w-52 truncate font-medium">{product.name}</span></div></td><td className="px-3 py-3 text-slate-600">{product.category?.name || '—'}</td><td className="px-3 py-3">{money(product.price)}</td><td className="px-3 py-3">{product.stock}</td><td className="px-3 py-3"><StatusBadge status={product.status} /></td><td className="px-3 py-3"><div className="flex gap-3"><button onClick={() => beginEdit(product)} className="font-semibold text-amber-800 hover:underline">Edit</button>{product.status !== 'archived' && <button onClick={() => archiveProduct(product)} className="font-semibold text-slate-600 hover:text-red-700">Archive</button>}</div></td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between text-sm text-slate-500"><span>{pagination.total} product{pagination.total === 1 ? '' : 's'}</span><div className="flex items-center gap-2"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page} of {Math.max(1, pagination.pages)}</span><button disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button></div></div></>}
            </section>
          </>}
          {section === 'orders' && <SellerOrders />}
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = { active: 'bg-emerald-50 text-emerald-700', draft: 'bg-amber-50 text-amber-800', archived: 'bg-slate-100 text-slate-600' };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || styles.archived}`}>{status}</span>;
}
