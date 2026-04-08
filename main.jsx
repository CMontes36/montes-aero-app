import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, LayoutDashboard, Settings,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';

// --- FIREBASE CONFIG ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, addDoc, 
  updateDoc, deleteDoc, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "", 
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };

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
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0]
  });

  // Auth initialization
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;
    
    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubTrans = onSnapshot(transCol, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setLoading(false);
    });

    const settingsDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'categories');
    const unsubCats = onSnapshot(settingsDoc, (snap) => {
      if (snap.exists()) setCategories(snap.data().list || []);
    });

    return () => { unsubTrans(); unsubCats(); };
  }, [user]);

  // Logic & Calculations
  const filteredData = useMemo(() => {
    const now = new Date();
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      if (period === 'Este Mes') {
        return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      }
      return true;
    }).filter(t => (t.entity || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [transactions, period, searchTerm]);

  const totals = useMemo(() => {
    const ingresos = filteredData.filter(t => t.type === 'ingreso').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const gastos = filteredData.filter(t => t.type === 'gasto').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [filteredData]);

  const chartData = useMemo(() => [
    { name: 'Ingresos', valor: totals.ingresos || 0, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos || 0, color: '#f43f5e' }
  ], [totals]);

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
      setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) { console.error("Save error:", err); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Montes Aero Cloud</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 font-sans text-slate-900">
      {/* Header */}
      <nav className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-40">
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
            <Settings size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {/* Card Principal de Balance */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-2">
               <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Balance {period}</span>
               <button 
                onClick={() => setPeriod(period === 'Este Mes' ? 'Todo' : 'Este Mes')}
                className="text-[9px] font-black bg-white/10 px-3 py-1.5 rounded-full hover:bg-white/20 transition-colors uppercase border border-white/5"
               >
                 {period}
               </button>
            </div>
            <div className="text-4xl font-black mb-8 tracking-tighter">${totals.margen.toLocaleString()}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[9px] font-black text-emerald-400 uppercase block mb-1">Ingresos</span>
                <span className="text-xl font-bold">${totals.ingresos.toLocaleString()}</span>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                <span className="text-[9px] font-black text-rose-400 uppercase block mb-1">Gastos</span>
                <span className="text-xl font-bold">${totals.gastos.toLocaleString()}</span>
              </div>
            </div>
          </div>
          {/* Decoración visual */}
          <div className="absolute -right-10 -top-10 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
          <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
        </div>

        {/* CONTENEDOR DEL GRÁFICO - Asegurando visibilidad */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm relative group">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Análisis Visual</h3>
            <BarChart3 size={14} className="text-slate-300" />
          </div>
          
          <div className="h-56 w-full flex items-center justify-center">
            {totals.ingresos === 0 && totals.gastos === 0 ? (
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="bg-slate-50 p-4 rounded-full">
                  <AlertCircle size={20} className="text-slate-300" />
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Esperando datos...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: '800', fill: '#94a3b8'}} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fontWeight: '600', fill: '#cbd5e1'}}
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 12}} 
                    contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px'}}
                    itemStyle={{fontSize: '12px', fontWeight: 'bold'}}
                  />
                  <Bar dataKey="valor" radius={[12, 12, 12, 12]} barSize={50} animationDuration={1500}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Filtros y Buscador */}
        <div className="space-y-4">
          <div className="flex p-1.5 bg-slate-200/50 rounded-2xl">
            <button 
              onClick={() => setViewMode('ingresos')} 
              className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'ingresos' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              INGRESOS
            </button>
            <button 
              onClick={() => setViewMode('gastos')} 
              className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              GASTOS
            </button>
          </div>
          
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar cliente, factura o concepto..." 
              className="pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-xs w-full outline-none font-bold shadow-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-600 transition-all" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>

        {/* Listado de Transacciones */}
        <div className="space-y-3">
          {filteredData
            .filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
            .sort((a,b) => new Date(b.date) - new Date(a.date))
            .map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {t.type === 'ingreso' ? <ArrowUpRight size={22}/> : <ArrowDownRight size={22}/>}
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-600 transition-colors">{t.entity}</div>
                  <div className="text-[9px] text-slate-400 font-black uppercase mt-1 flex items-center gap-2 tracking-tighter">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">#{t.invoiceNum}</span>
                    <span>•</span>
                    <span className="opacity-70">{t.date}</span>
                    {t.category && (
                      <>
                        <span>•</span>
                        <span className="text-slate-500">{t.category}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className={`font-black text-base ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ${Number(t.amount).toLocaleString()}
                </div>
                <div className="flex gap-1 mt-2">
                  <button 
                    onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} 
                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} 
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredData.length === 0 && (
            <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-slate-100">
              <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={20} className="text-slate-200" />
              </div>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Sin movimientos</p>
            </div>
          )}
        </div>
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 flex justify-end pointer-events-none">
        <button 
          onClick={() => { setEditingId(null); setIsModalOpen(true); }} 
          className="pointer-events-auto w-16 h-16 bg-blue-600 text-white rounded-[1.8rem] shadow-2xl flex items-center justify-center border-4 border-white active:scale-90 hover:scale-105 hover:bg-blue-700 transition-all"
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Modal Settings */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-slate-800 text-[10px] uppercase tracking-widest italic">Gestionar Categorías</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white rounded-full"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                  placeholder="Nueva..." 
                  className="flex-1 px-4 py-3 bg-slate-100 rounded-xl text-xs font-bold outline-none border border-transparent focus:border-blue-200" 
                />
                <button 
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    const newList = [...categories, newCategoryName.trim()];
                    setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'categories'), { list: newList });
                    setNewCategoryName('');
                  }} 
                  className="bg-blue-600 text-white px-5 rounded-xl font-black text-sm"
                >
                  +
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {categories.map(c => (
                  <div key={c} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                    <span className="text-[10px] font-black text-slate-600 uppercase">{c}</span>
                    <button 
                      onClick={() => {
                        const newList = categories.filter(cat => cat !== c);
                        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'categories'), { list: newList });
                      }} 
                      className="text-slate-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-xl rounded-t-[3.5rem] p-10 animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${formData.type === 'ingreso' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500 animate-pulse'}`}></div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic tracking-tighter">
                  {editingId ? 'Editar' : 'Nuevo'} Registro
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-[1.8rem]">
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, type: 'ingreso'})} 
                  className={`py-4 rounded-[1.3rem] font-black text-[10px] tracking-[0.2em] transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                >
                  INGRESO
                </button>
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, type: 'gasto'})} 
                  className={`py-4 rounded-[1.3rem] font-black text-[10px] tracking-[0.2em] transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                >
                  GASTO
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Concepto o Cliente</label>
                  <input 
                    required 
                    placeholder="Ej: Mantenimiento Aeronave" 
                    className="w-full px-8 py-5 bg-slate-50 rounded-2xl text-sm font-bold outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" 
                    value={formData.entity} 
                    onChange={e => setFormData({...formData, entity: e.target.value})} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Factura #</label>
                    <input 
                      required 
                      placeholder="0001" 
                      className="w-full px-8 py-5 bg-slate-50 rounded-2xl text-sm font-black font-mono outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" 
                      value={formData.invoiceNum} 
                      onChange={e => setFormData({...formData, invoiceNum: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Monto ($)</label>
                    <input 
                      required 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      className="w-full px-8 py-5 bg-slate-50 rounded-2xl text-sm font-black outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" 
                      value={formData.amount} 
                      onChange={e => setFormData({...formData, amount: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Fecha</label>
                    <input 
                      required 
                      type="date" 
                      className="w-full px-8 py-5 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:border-blue-600 focus:bg-white border-2 border-transparent transition-all" 
                      value={formData.date} 
                      onChange={e => setFormData({...formData, date: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-4">Categoría</label>
                    <select 
                      className="w-full px-8 py-5 bg-slate-50 rounded-2xl text-sm font-bold outline-none appearance-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" 
                      value={formData.category} 
                      onChange={e => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="">Opcional...</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                className={`w-full py-6 rounded-3xl font-black text-white uppercase tracking-[0.25em] shadow-2xl mt-4 active:scale-95 transition-all flex items-center justify-center gap-3 ${formData.type === 'ingreso' ? 'bg-emerald-600 shadow-emerald-200' : 'bg-rose-600 shadow-rose-200'}`}
              >
                {editingId ? 'Actualizar Registro' : 'Confirmar Registro'}
                <ArrowUpRight size={20} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
