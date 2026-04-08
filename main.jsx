import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, LayoutDashboard, Settings,
  TrendingUp, CreditCard, Calendar, User
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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'montes-aero-pro';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('ingresos'); 
  const [period, setPeriod] = useState('Este Mes');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(['Mantenimiento', 'Combustible', 'Tasas', 'Personal', 'Seguros']); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0]
  });

  // Autenticación
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

  // Sincronización Firestore
  useEffect(() => {
    if (!user) return;
    
    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubTrans = onSnapshot(transCol, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubTrans();
  }, [user]);

  // Lógica de datos
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
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900 overflow-x-hidden">
      {/* Navbar Superior */}
      <nav className="bg-white/80 backdrop-blur-md border-b p-4 sticky top-0 z-40">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
              <TrendingUp size={18} />
            </div>
            <h1 className="text-sm font-black italic uppercase tracking-tighter text-slate-800">
              MONTES <span className="text-blue-600">AERO</span>
            </h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400">
            <Settings size={18} />
          </button>
        </div>
      </nav>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {activeTab === 'dashboard' ? (
          <>
            {/* Tarjeta de Balance Estilo Glassmorphism */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                   <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Balance Disponible</span>
                   <button 
                    onClick={() => setPeriod(period === 'Este Mes' ? 'Todo' : 'Este Mes')}
                    className="text-[9px] font-black bg-white/10 px-3 py-1.5 rounded-full uppercase border border-white/5"
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
              <div className="absolute -right-10 -top-10 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl"></div>
            </div>

            {/* Gráfico Analítico */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm h-64">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comparativa</h3>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: '800', fill: '#94a3b8'}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={40}>
                      {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Accesos Directos */}
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => { setViewMode('ingresos'); setActiveTab('list'); }} className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 text-left group active:scale-95 transition-all">
                  <div className="bg-emerald-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-200"><ArrowUpRight size={20}/></div>
                  <div className="font-black text-emerald-900 text-xs uppercase tracking-tighter">Ver Ingresos</div>
               </button>
               <button onClick={() => { setViewMode('gastos'); setActiveTab('list'); }} className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 text-left group active:scale-95 transition-all">
                  <div className="bg-rose-500 text-white w-10 h-10 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-rose-200"><ArrowDownRight size={20}/></div>
                  <div className="font-black text-rose-900 text-xs uppercase tracking-tighter">Ver Gastos</div>
               </button>
            </div>
          </>
        ) : activeTab === 'list' ? (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex p-1.5 bg-slate-200/50 rounded-2xl">
              <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'ingresos' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>INGRESOS</button>
              <button onClick={() => setViewMode('gastos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest transition-all ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>GASTOS</button>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por cliente o factura..." 
                className="pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-xs w-full outline-none font-bold" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>

            <div className="space-y-3">
              {filteredData
                .filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
                .sort((a,b) => new Date(b.date) - new Date(a.date))
                .map(t => (
                <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'ingreso' ? <ArrowUpRight size={22}/> : <ArrowDownRight size={22}/>}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm leading-tight">{t.entity}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase mt-1 flex items-center gap-2">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600">#{t.invoiceNum}</span>
                        <span>{t.date}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className={`font-black text-base ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>${Number(t.amount).toLocaleString()}</div>
                    <div className="flex gap-1 mt-2">
                      <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600"><Pencil size={14} /></button>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
             <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300"><User size={48} /></div>
             <div>
               <p className="font-black text-slate-800 uppercase text-xs tracking-widest">Sesión de Usuario</p>
               <p className="text-[10px] text-slate-400 font-mono mt-1">{user?.uid}</p>
             </div>
             <div className="bg-white p-6 rounded-3xl border border-slate-100 w-full">
                <div className="flex justify-between items-center py-3 border-b border-slate-50">
                   <span className="text-[10px] font-black text-slate-400 uppercase">Estado</span>
                   <span className="text-[10px] font-black text-emerald-500 uppercase">Conectado</span>
                </div>
                <div className="flex justify-between items-center py-3">
                   <span className="text-[10px] font-black text-slate-400 uppercase">App ID</span>
                   <span className="text-[10px] font-black text-slate-800">{appId}</span>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Navegación Inferior (Floating) */}
      <div className="fixed bottom-6 left-0 right-0 z-50 px-6">
        <div className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] p-2 flex items-center justify-between shadow-2xl border border-white/10 relative">
          <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-blue-400' : 'text-slate-500'}`}>
            <LayoutDashboard size={20} />
            <span className="text-[8px] font-black uppercase">Home</span>
          </button>
          
          <div className="flex-1 flex justify-center -mt-12">
            <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="w-16 h-16 bg-blue-600 text-white rounded-[1.8rem] shadow-2xl flex items-center justify-center border-4 border-[#F8FAFC] active:scale-90 transition-all">
              <Plus size={28} />
            </button>
          </div>

          <button onClick={() => setActiveTab('list')} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all ${activeTab === 'list' ? 'text-blue-400' : 'text-slate-500'}`}>
            <FileText size={20} />
            <span className="text-[8px] font-black uppercase">Movimientos</span>
          </button>
        </div>
      </div>

      {/* Modal Formulario */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-end justify-center" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-500 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">
                {editingId ? 'Editar' : 'Nuevo'} Registro
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`flex-1 py-3 rounded-xl font-black text-[9px] tracking-widest transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`flex-1 py-3 rounded-xl font-black text-[9px] tracking-widest transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Entidad / Cliente</label>
                  <input required placeholder="Nombre..." className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Factura #</label>
                    <input required placeholder="000" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-black outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Monto ($)</label>
                    <input required type="number" step="0.01" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-black outline-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Fecha</label>
                    <input required type="date" className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none focus:border-blue-600 focus:bg-white border-2 border-transparent transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 mb-1 block">Categoría</label>
                    <select className="w-full px-6 py-4 bg-slate-50 rounded-2xl text-sm font-bold outline-none appearance-none border-2 border-transparent focus:border-blue-600 focus:bg-white transition-all" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                      <option value="">Seleccionar...</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <button type="submit" className={`w-full py-5 rounded-[1.8rem] font-black text-white uppercase tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all ${formData.type === 'ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                {editingId ? 'Actualizar' : 'Confirmar'}
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

export default App;
