import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, LayoutDashboard, Settings
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';

// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, addDoc, 
  updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';

// NOTA: En GitHub/Vercel, Tailwind se carga desde el index.html que configuramos.

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
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(['Servicios', 'RRHH', 'Alquiler', 'Otros']); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showChart, setShowChart] = useState(true);
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' 
  });

  // Autenticación para GitHub/Vercel
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) { 
        console.error("Error de Auth:", error); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      }
    });
    return () => unsubscribe();
  }, []);

  // Carga de datos desde Firestore
  useEffect(() => {
    if (!user) return;
    
    // Usamos la ruta de "public data" para que sea compartido o "users" para privado
    // Para tu caso de uso personal, 'users' con tu UID es lo más seguro
    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubTrans = onSnapshot(transCol, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error cargando transacciones:", err);
      setLoading(false);
    });

    const settingsDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'categories');
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
      return true;
    }).filter(t => t.entity.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, period, searchTerm]);

  const totals = useMemo(() => {
    const filtered = transactions.filter(t => {
       const tDate = new Date(t.date);
       return tDate.getMonth() === new Date().getMonth();
    });
    const ingresos = filtered.filter(t => t.type === 'ingreso').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const gastos = filtered.filter(t => t.type === 'gasto').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [transactions]);

  const chartData = [
    { name: 'Ingresos', valor: totals.ingresos, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos, color: '#f43f5e' }
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    const payload = { 
      ...formData, 
      amount: parseFloat(formData.amount) || 0, 
      updatedAt: new Date().toISOString() 
    };

    try {
      const path = ['artifacts', appId, 'users', user.uid, 'transactions'];
      if (editingId) {
        await updateDoc(doc(db, ...path, editingId), payload);
      } else {
        await addDoc(collection(db, ...path), { ...payload, createdAt: new Date().toISOString() });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' });
    } catch (err) { console.error("Error al guardar:", err); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Montes Aero Cloud</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900">
      <nav className="bg-white border-b p-4 sticky top-0 z-40">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
              <LayoutDashboard size={18} />
            </div>
            <h1 className="text-sm font-black italic uppercase tracking-tighter text-slate-800">
              MONTES <span className="text-blue-600">AERO</span>
            </h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 shadow-sm active:scale-90 transition-all">
            <Settings size={16} />
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {/* Balance */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">Balance del Mes</span>
            <div className="text-4xl font-black mb-6 tracking-tighter">${totals.margen.toLocaleString()}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">Ingresos</span>
                <span className="text-xl font-bold">${totals.ingresos.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <span className="text-[9px] font-black text-rose-400 uppercase block mb-1">Gastos</span>
                <span className="text-xl font-bold">${totals.gastos.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>
        </div>

        {/* Gráfico */}
        {showChart && (
          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={45}>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabs */}
        <div className="space-y-4">
          <div className="flex p-1.5 bg-slate-200/50 rounded-2xl">
            <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'ingresos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>INGRESOS</button>
            <button onClick={() => setViewMode('gastos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>GASTOS</button>
          </div>
          
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar concepto o cliente..." className="pl-11 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-xs w-full outline-none font-bold shadow-sm focus:border-blue-600 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {/* Listado */}
        <div className="space-y-3">
          {filteredData
            .filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[1.8rem] border border-slate-100 flex justify-between items-center shadow-sm hover:border-blue-100 transition-all group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {t.type === 'ingreso' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm leading-tight">{t.entity}</div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 flex gap-2">
                    <span className="text-blue-600 font-black">#{t.invoiceNum}</span>
                    <span>•</span>
                    <span>{t.date}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className={`font-black text-base ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${Number(t.amount).toLocaleString()}
                </div>
                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Botón Añadir */}
      <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] shadow-2xl flex items-center justify-center z-50 border-4 border-white active:scale-90 hover:scale-105 transition-all">
        <Plus size={32} />
      </button>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end justify-center">
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-slate-800 uppercase italic">{editingId ? 'Editar' : 'Nuevo'} Registro</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-3.5 rounded-xl font-black text-[10px] tracking-[0.2em] transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-3.5 rounded-xl font-black text-[10px] tracking-[0.2em] transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>

              <div className="space-y-4">
                <input required placeholder="Cliente o Concepto" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border border-transparent focus:border-blue-600 transition-all" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Factura #" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-black font-mono outline-none border border-transparent focus:border-blue-600 transition-all" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                  <input required type="number" step="0.01" placeholder="Monto $" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-black outline-none border border-transparent focus:border-blue-600 transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input required type="date" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  <select className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none appearance-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Categoría...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-white uppercase tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all ${formData.type === 'ingreso' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}>
                {editingId ? 'Actualizar Datos' : 'Guardar en la Nube'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// PUNTO DE ENTRADA CRÍTICO PARA GITHUB/VERCEL
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
