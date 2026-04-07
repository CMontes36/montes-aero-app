import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, Calendar, X, Trash2, Pencil, Loader2,
  Settings, ArrowUpRight, ArrowDownRight, BarChart3, Download
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
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- INYECCIÓN DE TAILWIND (PARA VERCEL) ---
const tailwindScript = document.createElement('script');
tailwindScript.src = "https://cdn.tailwindcss.com";
document.head.appendChild(tailwindScript);

const firebaseConfig = {
  apiKey: "AIzaSy-Temporal-Key", 
  authDomain: "montes-aero.firebaseapp.com",
  projectId: "montes-aero",
  storageBucket: "montes-aero.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123def"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'montes-aero-v1';

const demoData = [
  { id: '1', entity: 'Ejemplo Ingreso', invoiceNum: '001', amount: 5000, type: 'ingreso', category: 'Servicios', date: new Date().toISOString().split('T')[0] },
  { id: '2', entity: 'Ejemplo Gasto', invoiceNum: '002', amount: 1200, type: 'gasto', category: 'Alquiler', date: new Date().toISOString().split('T')[0] }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('ingresos'); 
  const [period, setPeriod] = useState('Este Mes');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(['Servicios', 'RRHH', 'Alquiler', 'Otros']); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showChart, setShowChart] = useState(false);
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) { 
        setTransactions(demoData);
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const transCol = collection(db, 'artifacts', appId, 'public', 'data', 'transactions');
    
    const timer = setTimeout(() => {
      if (transactions.length === 0) {
        setTransactions(demoData);
        setLoading(false);
      }
    }, 2000);

    const unsubTrans = onSnapshot(transCol, (snap) => {
      if (!snap.empty) {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
      clearTimeout(timer);
    }, () => {
      setTransactions(demoData);
      setLoading(false);
    });

    const settingsDoc = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'categories');
    const unsubCats = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setCategories(snap.data().list || []);
    });

    return () => { unsubTrans(); unsubCats(); clearTimeout(timer); };
  }, [user]);

  const filteredData = useMemo(() => {
    const now = new Date();
    return (transactions || []).filter(t => {
      const tDate = new Date(t.date);
      if (period === 'Este Mes') return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      return true;
    }).filter(t => (t.entity || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, period, searchTerm]);

  const totals = useMemo(() => {
    const ingresos = filteredData.filter(t => t.type === 'ingreso').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const gastos = filteredData.filter(t => t.type === 'gasto').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [filteredData]);

  const chartData = useMemo(() => [
    { name: 'Ingresos', valor: totals.ingresos, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos, color: '#f43f5e' }
  ], [totals]);

  // --- FUNCIÓN PARA EXPORTAR ---
  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    // Encabezados
    const headers = ["Fecha", "Entidad", "Factura", "Monto", "Tipo", "Categoria"];
    
    // Cuerpo del CSV
    const rows = filteredData.map(t => [
      t.date,
      `"${t.entity}"`,
      `"${t.invoiceNum}"`,
      t.amount,
      t.type.toUpperCase(),
      t.category
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Montes_Aero_Reporte_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...formData, amount: parseFloat(formData.amount) || 0, updatedAt: new Date().toISOString() };
    
    if (!user || formData.entity === 'Ejemplo Ingreso') {
      const newTrans = editingId 
        ? transactions.map(t => t.id === editingId ? { ...payload, id: editingId } : t)
        : [...transactions, { ...payload, id: Date.now().toString() }];
      setTransactions(newTrans);
    } else {
      try {
        if (editingId) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', editingId), payload);
        else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'transactions'), { ...payload, createdAt: new Date().toISOString() });
      } catch (err) { console.error(err); }
    }
    
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0] });
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <h1 className="text-xl font-black italic uppercase tracking-tighter text-slate-800">MONTES <span className="text-blue-600">AERO</span></h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900">
      <header className="bg-white border-b p-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1.5 rounded-lg text-white shadow-lg shadow-blue-200"><FileText size={18} /></div>
            <h1 className="text-lg font-black italic uppercase tracking-tighter">MONTES <span className="text-blue-600">AERO</span></h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={exportToCSV}
              className="p-2.5 rounded-2xl border border-slate-100 bg-white text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              title="Exportar a CSV/Excel"
            >
              <Download size={18} />
            </button>
            <button onClick={() => setShowChart(!showChart)} className={`p-2.5 rounded-2xl border transition-all ${showChart ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-600' : 'bg-white text-slate-400 border-slate-100'}`}><BarChart3 size={18} /></button>
            <button onClick={() => setPeriod(period === 'Este Mes' ? 'Todo' : 'Este Mes')} className="px-4 py-1 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
               {period}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-5">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl group-hover:bg-blue-600/30 transition-all"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Balance General</span>
          <div className="text-4xl font-black mb-6 tracking-tight">${totals.margen.toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
            <div className="bg-white/5 p-3 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 text-emerald-400 mb-1">
                <ArrowUpRight size={16}/>
                <span className="font-black text-[9px] uppercase tracking-widest text-emerald-400/60">Ingresos</span>
              </div>
              <span className="font-black text-lg">${totals.ingresos.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl backdrop-blur-sm">
              <div className="flex items-center gap-2 text-rose-400 mb-1">
                <ArrowDownRight size={16}/>
                <span className="font-black text-[9px] uppercase tracking-widest text-rose-400/60">Gastos</span>
              </div>
              <span className="font-black text-lg">${totals.gastos.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {showChart && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 h-56 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <Tooltip cursor={{fill: 'transparent'}} content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-2 rounded-lg text-[10px] font-black">
                        {payload[0].value.toLocaleString()}
                      </div>
                    );
                  }
                  return null;
                }} />
                <Bar dataKey="valor" radius={[15, 15, 15, 15]} barSize={60}>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex p-1.5 bg-slate-100 rounded-2xl shadow-inner">
          <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'ingresos' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>INGRESOS</button>
          <button onClick={() => setViewMode('gastos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>GASTOS</button>
        </div>

        <div className="relative group">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input type="text" placeholder="Buscar cliente o factura..." className="pl-11 pr-5 py-4 bg-white border border-slate-100 rounded-2xl text-xs font-bold w-full outline-none focus:border-blue-600/30 focus:ring-4 focus:ring-blue-600/5 transition-all shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filteredData.filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto')).map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-md transition-all border-l-4 border-l-transparent hover:border-l-blue-600">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {t.type === 'ingreso' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <div>
                  <div className="font-black text-slate-800 text-sm tracking-tight">{t.entity}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Factura: {t.invoiceNum} • {t.date}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-black text-sm ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>${t.amount.toLocaleString()}</div>
                <div className="flex gap-3 mt-2 justify-end">
                  <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="text-slate-300 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                  <button onClick={() => {
                    if (user && formData.entity !== 'Ejemplo Ingreso') deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id));
                    else setTransactions(transactions.filter(tr => tr.id !== t.id));
                  }} className="text-slate-300 hover:text-rose-600 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          {filteredData.filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto')).length === 0 && (
            <div className="text-center py-10 opacity-30 font-black text-[10px] uppercase tracking-[0.3em]">Sin registros</div>
          )}
        </div>
      </main>

      <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-300 flex items-center justify-center z-50 hover:scale-110 active:scale-95 transition-all">
        <Plus size={32} strokeWidth={3} />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-end justify-center">
          <div className="bg-white w-full max-w-xl rounded-t-[3.5rem] p-10 pb-16 max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">{editingId ? 'Editar' : 'Nuevo'} Registro</h2>
                <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Completa los datos de la operación</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-3xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-4 rounded-2xl font-black text-[10px] tracking-widest transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-md' : 'text-slate-400'}`}>GASTO</button>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Nombre de la Entidad / Cliente</label>
                <input required type="text" placeholder="Ej: Aerolíneas Argentinas" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold focus:bg-white focus:border-blue-600 transition-all outline-none" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Número de Factura</label>
                  <input required type="text" placeholder="0001-..." className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-bold focus:bg-white focus:border-blue-600 transition-all outline-none" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Monto ($)</label>
                  <input required type="number" step="0.01" placeholder="0.00" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-sm font-black focus:bg-white focus:border-blue-600 transition-all outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Fecha de Emisión</label>
                  <input required type="date" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold focus:bg-white focus:border-blue-600 transition-all outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-4 tracking-widest">Categoría</label>
                  <select className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-xs font-bold focus:bg-white focus:border-blue-600 transition-all outline-none appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Seleccionar...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className={`w-full py-6 rounded-[2rem] font-black text-white uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 mt-6 ${formData.type === 'ingreso' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-rose-600 shadow-rose-200'}`}>
                {editingId ? 'Actualizar Registro' : 'Confirmar Registro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
