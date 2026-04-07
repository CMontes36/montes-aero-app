import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, FileText, Search, X, Trash2, Pencil, Loader2,
  ArrowUpRight, ArrowDownRight, BarChart3, Download, LogOut, Lock, Mail,
  LayoutDashboard, List
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
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard', 'ingresos', 'gastos'
  const [transactions, setTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  
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

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Si no hay token, intentamos entrada anónima para no bloquear al usuario
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Error auth:", e);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const transCol = collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');
    const unsubTrans = onSnapshot(transCol, 
      (snap) => {
        setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      setAuthError('Credenciales incorrectas o error de conexión.');
    } finally {
      setIsAuthLoading(false);
    }
  };

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
      setFormData({ entity: '', invoiceNum: '', amount: '', type: 'ingreso', category: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando con Montes Aero...</p>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-24 h-24 bg-blue-600 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-200 rotate-3">
          <Lock className="text-white" size={40} />
        </div>
        <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-2">MONTES <span className="text-blue-600">AERO</span></h1>
        <p className="text-slate-400 font-bold text-sm mb-10">Inicia sesión para gestionar tus finanzas aéreas</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <input required type="email" placeholder="Correo electrónico" className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
          <input required type="password" placeholder="Contraseña" className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all" value={authPass} onChange={e => setAuthPass(e.target.value)} />
          {authError && <div className="p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl">{authError}</div>}
          <button disabled={isAuthLoading} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all">
            {isAuthLoading ? 'Cargando...' : (isRegistering ? 'Crear Cuenta' : 'Entrar al Sistema')}
          </button>
        </form>
        <button onClick={() => setIsRegistering(!isRegistering)} className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          {isRegistering ? '¿Ya tienes cuenta? Conéctate' : '¿No tienes acceso? Solicítalo aquí'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navbar Superior */}
      <nav className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-[40] px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
              <LayoutDashboard size={20} />
            </div>
            <h1 className="text-lg font-black italic uppercase tracking-tighter">MONTES <span className="text-blue-600">AERO</span></h1>
          </div>
          <button onClick={() => signOut(auth)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-rose-500 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-6 space-y-8 pb-32">
        {/* Resumen de Inicio */}
        <section className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[100px] -mr-32 -mt-32"></div>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Balance General</p>
          <h2 className="text-5xl font-black tracking-tighter mb-10">${totals.margen.toLocaleString()}</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
              <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <ArrowUpRight size={14}/> Total Ingresos
              </p>
              <p className="text-2xl font-black">${totals.ingresos.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                <ArrowDownRight size={14}/> Total Gastos
              </p>
              <p className="text-2xl font-black">${totals.gastos.toLocaleString()}</p>
            </div>
          </div>
        </section>

        {/* Gráfico de Rendimiento */}
        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-72">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 text-center">Comparativa de Flujo</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#94a3b8'}} />
              <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
              <Bar dataKey="valor" radius={[20, 20, 20, 20]} barSize={50}>
                {chartData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Listado de Actividad Reciente */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Actividad Reciente</h3>
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button onClick={() => setViewMode('dashboard')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'dashboard' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>TODOS</button>
              <button onClick={() => setViewMode('ingresos')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'ingresos' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'}`}>INGRESOS</button>
              <button onClick={() => setViewMode('gastos')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${viewMode === 'gastos' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-400'}`}>GASTOS</button>
            </div>
          </div>

          <div className="space-y-3">
            {transactions.filter(t => viewMode === 'dashboard' || t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto')).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sin registros que mostrar</p>
              </div>
            ) : (
              transactions
                .filter(t => viewMode === 'dashboard' || t.type === (viewMode === 'ingresos' ? 'ingreso' : 'gasto'))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map(t => (
                  <div key={t.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-50 flex justify-between items-center shadow-sm hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.type === 'ingreso' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'ingreso' ? <ArrowUpRight size={20}/> : <ArrowDownRight size={20}/>}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 tracking-tight">{t.entity}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Factura: {t.invoiceNum} • {t.date}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-6">
                      <p className={`font-black text-lg ${t.type === 'ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'ingreso' ? '+' : '-'}${Number(t.amount).toLocaleString()}
                      </p>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingId(t.id); setFormData(t); setIsModalOpen(true); }} className="p-2 text-slate-300 hover:text-blue-600"><Pencil size={16}/></button>
                        <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'transactions', t.id))} className="p-2 text-slate-300 hover:text-rose-600"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </main>

      {/* Botón de Acción Principal */}
      <button 
        onClick={() => { setEditingId(null); setIsModalOpen(true); }} 
        className="fixed bottom-10 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-10 w-20 h-20 bg-blue-600 text-white rounded-[2rem] shadow-2xl shadow-blue-200 flex items-center justify-center z-[50] hover:scale-110 active:scale-95 transition-all ring-8 ring-white"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      {/* Modal del Formulario Corregido */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[3rem] p-10 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-800">
                {editingId ? 'Editar Registro' : 'Nueva Operación'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-3xl">
                <button type="button" onClick={() => setFormData({...formData, type: 'ingreso'})} className={`py-4 rounded-2xl text-[11px] font-black tracking-widest transition-all ${formData.type === 'ingreso' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>INGRESO</button>
                <button type="button" onClick={() => setFormData({...formData, type: 'gasto'})} className={`py-4 rounded-2xl text-[11px] font-black tracking-widest transition-all ${formData.type === 'gasto' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}>GASTO</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Cliente o Proveedor</label>
                  <input required type="text" className="w-full px-8 py-5 bg-slate-50 rounded-3xl font-bold outline-none border-2 border-transparent focus:border-blue-100 focus:bg-white transition-all" value={formData.entity} onChange={e => setFormData({...formData, entity: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nº de Factura</label>
                    <input required type="text" className="w-full px-8 py-5 bg-slate-50 rounded-3xl font-bold outline-none focus:bg-white transition-all" value={formData.invoiceNum} onChange={e => setFormData({...formData, invoiceNum: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Monto Total</label>
                    <input required type="number" step="0.01" className="w-full px-8 py-5 bg-slate-50 rounded-3xl font-black outline-none focus:bg-white transition-all" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fecha</label>
                  <input required type="date" className="w-full px-8 py-5 bg-slate-50 rounded-3xl font-bold outline-none focus:bg-white transition-all" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>

              <button type="submit" className={`w-full py-6 rounded-[2rem] font-black text-white uppercase tracking-[0.3em] shadow-xl transition-all active:scale-95 ${formData.type === 'ingreso' ? 'bg-emerald-600 shadow-emerald-100' : 'bg-rose-600 shadow-rose-100'}`}>
                {editingId ? 'Actualizar Datos' : 'Registrar Ahora'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
