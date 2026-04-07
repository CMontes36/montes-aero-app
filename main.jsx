import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
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
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// NOTA: Estos son valores temporales. Para que guarde datos reales, 
// deberás reemplazarlos con tus credenciales de Firebase Console.
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

// Datos de ejemplo para que la app no se vea vacía si falla la conexión
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showChart, setShowChart] = useState(false);
  
  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' 
  });

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) { 
        console.warn("Usando modo demostración (sin Firebase)");
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
    
    // Timeout de seguridad: Si en 3 segundos no hay datos de Firebase, mostramos los de demo
    const timer = setTimeout(() => {
      if (transactions.length === 0) {
        setTransactions(demoData);
        setLoading(false);
      }
    }, 3000);

    const unsubTrans = onSnapshot(transCol, (snap) => {
      if (!snap.empty) {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      setLoading(false);
      clearTimeout(timer);
    }, (err) => {
      console.error("Firestore Error:", err);
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
    const payload = { ...formData, amount: parseFloat(formData.amount) || 0, updatedAt: new Date().toISOString() };
    
    if (!user) {
      // Modo local si no hay Firebase
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
    setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0], paymentDate: '' });
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <h1 className="text-sm font-black italic uppercase tracking-tighter text-slate-800">MONTES <span className="text-blue-600">AERO</span></h1>
      <p className="text-[10px] text-slate-400 mt-2 font-bold animate-pulse">CARGANDO SISTEMA...</p>
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
            <button onClick={() => setPeriod(period === 'Este Mes' ? 'Todo' : 'Este Mes')} className="px-3 py-1 bg-slate-50 border rounded-xl text-[9px] font-black uppercase flex items-center gap-1">
               {period}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-4">
        <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Balance General</span>
          <div className="text-3xl font-black mb-4">${totals.margen.toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <ArrowUpRight size={14}/>
              <span className="font-bold text-sm">${totals.ingresos.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-rose-400">
              <ArrowDownRight size={14}/>
              <span className="font-bold text-sm">${totals.gastos.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {showChart && (
          <div className="bg-white p-4 rounded-[2rem] border border-slate-100 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={50}>
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex p-1 bg-slate-200/50 rounded-xl">
          <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-2 rounded-lg font-black text-[9px] ${viewMode === 'ingresos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>INGRESOS</button>
          <button onClick={() => setViewMode('gastos')} className={`flex-1 py-2 rounded-lg font-black text-[9px] ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>GASTOS</button>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Buscar..." className="pl-9 pr-3 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] w-full outline-none font-bold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        <div className="space-y-3">
          {filteredData.filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto')).map(t => (
            <div key={t.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 flex justify-between items-center shadow-sm">
              <div>
                <div className="font-bold text-slate-800 text-xs">{t.entity}</div>
                <div className="text-[8px] text-slate-400 font-bold uppercase">Fecha: {t.date}</div>
              </div>
              <div className="text-right">
                <div className={`font-black text-xs ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>${t.amount.toLocaleString()}</div>
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="text-slate-300"><Pencil size={12} /></button>
                  <button onClick={() => {
                    if (user) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'transactions', t.id));
                    else setTransactions(transactions.filter(tr => tr.id !== t.id));
                  }} className="text-slate-300"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center z-50">
        <Plus size={28} />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-end justify-center">
          <div className="bg-white w-full rounded-t-[3rem] p-8 pb-12 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Registro</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-slate-100 rounded-full"><X size={22} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-3 rounded-xl font-black text-[9px] ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-3 rounded-xl font-black text-[9px] ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>
              <input required type="text" placeholder="Entidad" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-bold" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
              <div className="grid grid-cols-2 gap-3">
                <input required type="text" placeholder="Factura #" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-bold" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                <input required type="number" step="0.01" placeholder="Monto" className="w-full px-5 py-4 bg-slate-50 rounded-2xl text-xs font-black" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required type="date" className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <select className="w-full px-4 py-3 bg-slate-50 rounded-2xl text-xs font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                  <option value="">Categoría...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="submit" className={`w-full py-5 rounded-2xl font-black text-white uppercase mt-4 ${formData.type === 'ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>Guardar</button>
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
