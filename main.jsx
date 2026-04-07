import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, FileText, Search, Calendar, X, Trash2, Pencil, Loader2,
  Settings, ArrowUpRight, ArrowDownRight, BarChart3
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, addDoc, 
  updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'montes-aero-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('ingresos'); 
  const [period, setPeriod] = useState('Este Mes');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(['Servicios', 'RRHH', 'Alquiler', 'Otros']); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showChart, setShowChart] = useState(false);
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' 
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const transCol = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    const unsubTrans = onSnapshot(transCol, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'categories');
    const unsubCats = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setCategories(snap.data().list || []);
    });
    return () => { unsubTrans(); unsubCats(); };
  }, [user]);

  const filteredData = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (period === 'Este Mes') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      if (period === 'Últimos 3 Meses') {
        const limit = new Date(); limit.setMonth(now.getMonth() - 3);
        return tDate >= limit;
      }
      return true;
    }).filter(t => t.entity.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, period, searchTerm]);

  const totals = useMemo(() => {
    const ingresos = filteredData.filter(t => t.type === 'ingreso').reduce((a, b) => a + b.amount, 0);
    const gastos = filteredData.filter(t => t.type === 'gasto').reduce((a, b) => a + b.amount, 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [filteredData]);

  const chartData = useMemo(() => [
    { name: 'Ingresos', valor: totals.ingresos, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos, color: '#f43f5e' }
  ], [totals]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    const payload = { ...formData, amount: parseFloat(formData.amount) || 0, updatedAt: new Date().toISOString() };
    try {
      if (editingId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingId), payload);
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { ...payload, createdAt: new Date().toISOString() });
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' });
    } catch (err) { console.error(err); }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const newList = [...categories, newCategoryName.trim()];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'categories'), { list: newList });
    setNewCategoryName('');
  };

  const handleDeleteCategory = async (cat) => {
    const newList = categories.filter(c => c !== cat);
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'categories'), { list: newList });
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600 mb-2" />
      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Montes Aero</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900">
      <header className="bg-white border-b p-4 sticky top-0 z-40">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1 rounded-lg text-white"><FileText size={16} /></div>
            <h1 className="text-sm font-black italic uppercase tracking-tighter">MONTES <span className="text-blue-600">AERO</span></h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowChart(!showChart)} className={`p-2 rounded-xl border transition-colors ${showChart ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'}`}><BarChart3 size={14} /></button>
            <button onClick={() => setPeriod(period === 'Este Mes' ? 'Todo' : 'Este Mes')} className="px-3 py-1 bg-slate-50 border rounded-xl text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
               {period}
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-slate-50 border rounded-xl text-slate-400 shadow-sm"><Settings size={14} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        {/* Balance Card */}
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Balance General</span>
          <div className="text-3xl font-black mb-4">${totals.margen.toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400"><ArrowUpRight size={14}/></div>
              <div>
                <span className="text-[8px] font-black text-slate-500 uppercase block leading-none">Ingresos</span>
                <span className="text-emerald-400 font-bold text-sm">${totals.ingresos.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-rose-500/20 rounded-lg text-rose-400"><ArrowDownRight size={14}/></div>
              <div>
                <span className="text-[8px] font-black text-slate-500 uppercase block leading-none">Gastos</span>
                <span className="text-rose-400 font-bold text-sm">${totals.gastos.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Gráfico Opcional */}
        {showChart && (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={40}>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabs & Search */}
        <div className="space-y-3">
          <div className="flex p-1 bg-slate-200/50 rounded-xl">
            <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-2.5 rounded-lg font-black text-[9px] tracking-widest transition-all ${viewMode === 'ingresos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>INGRESOS</button>
            <button onClick={() => setViewMode('gastos')} className={`flex-1 py-2.5 rounded-lg font-black text-[9px] tracking-widest transition-all ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>GASTOS</button>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar por cliente o concepto..." className="pl-9 pr-3 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] w-full outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* List */}
        <div className="space-y-3">
          {filteredData
            .filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
            .map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 flex justify-between items-center shadow-sm active:bg-slate-50 transition-colors">
              <div className="space-y-1">
                <div className="font-bold text-slate-800 text-xs">{t.entity}</div>
                <div className="text-[8px] text-slate-400 font-bold uppercase flex gap-2">
                  <span>Fac: {t.date}</span>
                  <span className="text-blue-500">#{t.invoiceNum}</span>
                </div>
                {t.paymentDate && (
                  <div className="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full inline-block font-black uppercase">Cobrado: {t.paymentDate}</div>
                )}
              </div>
              <div className="text-right flex flex-col items-end">
                <div className={`font-black text-sm ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>${t.amount.toLocaleString()}</div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-500"><Pencil size={12} /></button>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id))} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50 border-4 border-white active:scale-90 transition-all">
        <Plus size={28} />
      </button>

      {/* Modal Settings (Categorías) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm animate-in zoom-in duration-200 shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-slate-800 text-[10px] uppercase tracking-widest italic">Categorías</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white rounded-full"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nueva..." className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-xs font-bold outline-none" />
                <button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 rounded-xl font-black text-xs">+</button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {categories.map(c => (
                  <div key={c} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-black text-slate-600 uppercase">{c}</span>
                    <button onClick={() => handleDeleteCategory(c)} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Transaction Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end justify-center">
          <div className="bg-white w-full rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto pb-12">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">{editingId ? 'Editar' : 'Nuevo'}<br/>Registro</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-slate-100 rounded-full"><X size={22} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-3 rounded-xl font-black text-[9px] tracking-widest ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-3 rounded-xl font-black text-[9px] tracking-widest ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Entidad / Concepto</label>
                  <input required type="text" placeholder="Ej: Pago Cliente X" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-bold outline-none" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Factura Nº</label>
                    <input required type="text" placeholder="0001" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-bold font-mono outline-none" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Monto $</label>
                    <input required type="number" step="0.01" placeholder="0.00" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-black outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Fecha Emisión</label>
                    <input required type="date" className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Categoría</label>
                    <select className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="">Elegir...</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {formData.type === 'ingreso' && (
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2 mb-1 block">Fecha Cobro Realizada (Opcional)</label>
                    <input type="date" className="w-full px-4 py-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl text-xs font-bold outline-none" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                  </div>
                )}
              </div>

              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-white uppercase tracking-widest shadow-xl mt-6 ${formData.type === 'ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                {editingId ? 'Confirmar Edición' : 'Guardar en la Nube'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Montes Aero</title>
    <script src="[https://cdn.tailwindcss.com](https://cdn.tailwindcss.com)"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.jsx"></script>
  </body>
</html>
