import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, Download, LogOut, Lock, Mail
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
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';

// --- INYECCIÓN DE TAILWIND ---
if (!document.getElementById('tailwind-cdn')) {
  const tailwindScript = document.createElement('script');
  tailwindScript.id = 'tailwind-cdn';
  tailwindScript.src = "https://cdn.tailwindcss.com";
  document.head.appendChild(tailwindScript);
}

// Manejo seguro de configuración global
const firebaseConfig = (() => {
  try {
    return JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
  } catch (e) {
    return {};
  }
})();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'montes-aero-v1';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('ingresos'); 
  const [transactions, setTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showChart, setShowChart] = useState(false);
  
  // Auth states
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [formData, setFormData] = useState({ 
    entity: '', invoiceNum: '', amount: '', type: 'ingreso', 
    category: '', date: new Date().toISOString().split('T')[0]
  });

  // Inicialización de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (e) {
        console.error("Error auth:", e);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Carga de datos
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    
    const unsubTrans = onSnapshot(transCol, 
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTransactions(data);
      },
      (error) => console.error("Firestore Error:", error)
    );

    return () => unsubTrans();
  }, [user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, authEmail, authPass);
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPass);
      }
    } catch (err) {
      setAuthError('Error: Revisa tus credenciales.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const filteredData = useMemo(() => {
    return (transactions || []).filter(t => 
      (t.entity || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transactions, searchTerm]);

  const totals = useMemo(() => {
    const ingresos = filteredData.filter(t => t.type === 'ingreso').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    const gastos = filteredData.filter(t => t.type === 'gasto').reduce((a, b) => a + (Number(b.amount) || 0), 0);
    return { ingresos, gastos, margen: ingresos - gastos };
  }, [filteredData]);

  const chartData = useMemo(() => [
    { name: 'Ingresos', valor: totals.ingresos, color: '#10b981' },
    { name: 'Gastos', valor: totals.gastos, color: '#f43f5e' }
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
    } catch (err) { 
      console.error("Save Error:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-blue-600" size={32} />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
          <div className="bg-slate-900 w-16 h-16 rounded-2xl text-white flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-800">
            MONTES <span className="text-blue-600">AERO</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Acceso Seguro</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <input required type="email" placeholder="Email" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
          <input required type="password" placeholder="Contraseña" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500" value={authPass} onChange={e => setAuthPass(e.target.value)} />
          {authError && <p className="text-rose-500 text-[10px] font-bold text-center uppercase">{authError}</p>}
          <button disabled={isAuthLoading} type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
            {isAuthLoading ? '...' : (isRegistering ? 'Registrar' : 'Entrar')}
          </button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} className="w-full text-center mt-6 text-[10px] font-black text-slate-400 uppercase">
          {isRegistering ? '¿Ya tienes cuenta? Ingresa' : '¿No tienes cuenta? Registrate'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 font-sans text-slate-900">
      <header className="bg-white border-b p-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-black italic uppercase tracking-tighter">MONTES <span className="text-blue-600">AERO</span></h1>
          <div className="flex gap-2">
            <button onClick={() => setShowChart(!showChart)} className={`p-2.5 rounded-2xl border transition-all ${showChart ? 'bg-blue-600 text-white' : 'bg-white text-slate-400'}`}><BarChart3 size={18} /></button>
            <button onClick={handleLogout} className="p-2.5 rounded-2xl border border-slate-100 bg-white text-rose-600"><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-5">
        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] block mb-2">Balance Neto</span>
          <div className="text-4xl font-black mb-6 tracking-tight">${totals.margen.toLocaleString()}</div>
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
            <div className="bg-white/5 p-3 rounded-2xl">
              <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase mb-1"><ArrowUpRight size={14}/> Ingresos</div>
              <span className="font-black text-lg">${totals.ingresos.toLocaleString()}</span>
            </div>
            <div className="bg-white/5 p-3 rounded-2xl">
              <div className="flex items-center gap-2 text-rose-400 text-[9px] font-black uppercase mb-1"><ArrowDownRight size={14}/> Gastos</div>
              <span className="font-black text-lg">${totals.gastos.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {showChart && (
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 h-56 shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" hide />
                <Tooltip />
                <Bar dataKey="valor" radius={[10, 10, 10, 10]} barSize={50}>
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button onClick={() => setViewMode('ingresos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest ${viewMode === 'ingresos' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>INGRESOS</button>
          <button onClick={() => setViewMode('gastos')} className={`flex-1 py-3 rounded-xl font-black text-[10px] tracking-widest ${viewMode === 'gastos' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTOS</button>
        </div>

        <div className="space-y-3">
          {filteredData.filter(t => t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto')).map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm">
              <div>
                <div className="font-black text-slate-800 text-sm">{t.entity}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">Fact: {t.invoiceNum} • {t.date}</div>
              </div>
              <div className="text-right">
                <div className={`font-black text-sm ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>${Number(t.amount).toLocaleString()}</div>
                <div className="flex gap-3 mt-1 justify-end opacity-30 hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="text-slate-400 hover:text-blue-600"><Pencil size={12} /></button>
                  <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="text-slate-400 hover:text-rose-600"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-2xl shadow-2xl flex items-center justify-center z-50">
        <Plus size={32} strokeWidth={3} />
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-end justify-center">
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] p-10 pb-16 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-800 uppercase italic">Nuevo Registro</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-100 rounded-2xl text-slate-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-3 rounded-xl font-black text-[10px] ${formData.type === 'ingreso' ? 'bg-white text-emerald-600' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-3 rounded-xl font-black text-[10px] ${formData.type === 'gasto' ? 'bg-white text-rose-600' : 'text-slate-400'}`}>GASTO</button>
              </div>
              <input required placeholder="Entidad" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
              <input required placeholder="Factura" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
              <input required type="number" placeholder="Monto" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              <input required type="date" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest">Guardar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
