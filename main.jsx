import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, LogOut, LayoutDashboard
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// --- CONFIGURACIÓN DE FIREBASE ---
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, onSnapshot, addDoc, 
  updateDoc, deleteDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInAnonymously
} from 'firebase/auth';

// --- INYECCIÓN DE TAILWIND ---
if (!document.getElementById('tailwind-cdn')) {
  const tailwindScript = document.createElement('script');
  tailwindScript.id = 'tailwind-cdn';
  tailwindScript.src = "https://cdn.tailwindcss.com";
  document.head.appendChild(tailwindScript);
}

const firebaseConfig = (() => {
  try {
    return JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
  } catch (e) {
    return { apiKey: "temp" };
  }
})();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'montes-aero-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    date: new Date().toISOString().split('T')[0]
  });

  // Autenticación silenciosa
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Error en auth:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (mounted) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  // Carga de datos con manejo de errores para evitar bloqueos
  useEffect(() => {
    if (!user) return;
    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubTrans = onSnapshot(transCol, 
      (snap) => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (error) => {
        console.error("Error de Firestore:", error);
      }
    );
    return () => unsubTrans();
  }, [user]);

  const totals = useMemo(() => {
    const ingresos = transactions.filter(t => t.type === 'ingreso').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const gastos = transactions.filter(t => t.type === 'gasto').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [transactions]);

  const chartData = [
    { name: 'Ingresos', valor: totals.ingresos, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos, color: '#f43f5e' }
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user || !formData.entity || !formData.amount) return;
    
    const payload = { 
      ...formData, 
      amount: parseFloat(formData.amount), 
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
      setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', date: new Date().toISOString().split('T')[0] });
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Iniciando Montes Aero...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navbar */}
      <nav className="bg-white border-b sticky top-0 z-[40] px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <LayoutDashboard size={20} />
            </div>
            <h1 className="text-lg font-black italic uppercase tracking-tighter">MONTES <span className="text-blue-600">AERO</span></h1>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-6 space-y-8 pb-32">
        {/* Card de Balance */}
        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Balance General</p>
          <h2 className="text-4xl font-black tracking-tighter mb-8">${totals.margen.toLocaleString()}</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl">
              <p className="text-[9px] font-black text-emerald-400 uppercase mb-1">Ingresos</p>
              <p className="text-xl font-bold">${totals.ingresos.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl">
              <p className="text-[9px] font-black text-rose-400 uppercase mb-1">Gastos</p>
              <p className="text-xl font-bold">${totals.gastos.toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* Gráfico Simple */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900}} />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={40}>
                {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lista de Transacciones */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Actividad Reciente</h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'dashboard' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Todo</button>
              <button onClick={() => setViewMode('ingresos')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'ingresos' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Ingresos</button>
              <button onClick={() => setViewMode('gastos')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${viewMode === 'gastos' ? 'bg-white shadow-sm' : 'text-slate-400'}`}>Gastos</button>
            </div>
          </div>

          <div className="space-y-3">
            {transactions
              .filter(t => viewMode === 'dashboard' || t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map(t => (
                <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-50 flex justify-between items-center shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {t.type === 'ingreso' ? <ArrowUpRight size={18}/> : <ArrowDownRight size={18}/>}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{t.entity}</p>
                      <p className="text-[10px] font-medium text-slate-400">{t.invoiceNum} • {t.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className={`font-black ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      ${Number(t.amount).toLocaleString()}
                    </p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="p-1.5 text-slate-300 hover:text-blue-600"><Pencil size={14}/></button>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="p-1.5 text-slate-300 hover:text-rose-600"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </main>

      {/* Botón Flotante */}
      <button 
        onClick={() => { setEditingId(null); setIsModalOpen(true); }} 
        className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <Plus size={32} />
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase tracking-tight">Registro</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-600"><X size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>

              <input required placeholder="Cliente / Proveedor" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required placeholder="Factura #" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                <input required type="number" step="0.01" placeholder="Monto" className="w-full p-4 bg-slate-50 rounded-xl font-black outline-none" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <input required type="date" className="w-full p-4 bg-slate-50 rounded-xl font-bold outline-none" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />

              <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
                {editingId ? 'Guardar Cambios' : 'Registrar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Garantizamos el renderizado tras cargar la ventana
window.onload = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(<App />);
  }
};
