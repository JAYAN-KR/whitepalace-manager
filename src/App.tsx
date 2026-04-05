import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword,
  getAuth,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  deleteField,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { auth, db, config, functions } from './lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { cn } from './lib/utils';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Megaphone, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  User as UserIcon,
  Building2,
  TrendingUp,
  History,
  MessageCircle,
  ShieldCheck,
  FileText,
  Wallet,
  Zap,
  RefreshCw,
  Calendar,
  ArrowUpCircle,
  ArrowDownCircle,
  PlusCircle,
  Trash2,
  Edit2,
  Save,
  X,
  Search,
  Download,
  Check,
  ChevronLeft,
  ArrowLeft,
  Settings,
  Table,
  Loader2,
  Contact,
  Phone,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { Toaster, toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { UserProfile, PaymentRecord, Announcement, UserRole, AccountEntry, AppConfig } from './types';

declare global {
  interface Window {
    Razorpay: any;
  }
}

// --- Constants ---

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

// Fallback phone numbers for owners
const OWNER_PHONE_MAPPING: Record<string, string> = {
  'A1': '9847448093',
  'A2': '9901456049',
  'A3': '8939320997',
  'B1': '9811693806',
  'B2': '8879770820',
  'B3': '9446448010',
  'C1': '9849647835',
  'C2': '9846175556',
  'C3': '7012128339',
  'D2': '9746701449',
  'D3': '9567844666',
  'E2': '9995152729',
  'E3': '9074733075',
  'F1': '9495046489',
  'F2': '8939320997',
  'F3': '8095874799',
};

// Tenant details
const TENANT_MAPPING: Record<string, { name: string, phone: string }> = {
  'A2': { name: 'Suma', phone: '9526658082' },
  'C1': { name: 'Anas Manilal', phone: '9539830756' },
  'E2': { name: 'Praveen', phone: '6282733726' },
  'E3': { name: 'Samu', phone: '9496335097' },
  'F1': { name: 'Sankar Narayanan', phone: '9539883546' },
  'F2': { name: 'Supriya', phone: '9582834968' },
  'F3': { name: 'Kala', phone: '9745655356' },
};

const extractFlatNumber = (text: string) => {
  if (!text) return '';
  const match = text.match(/^([A-Z])\s*0*(\d+)/i);
  if (match) {
    return (match[1] + match[2]).toUpperCase();
  }
  return '';
};

const getTenantName = (text: string) => {
  const cleanFlat = extractFlatNumber(text);
  return TENANT_MAPPING[cleanFlat]?.name;
};

const normalizeFlat = (flat: string | undefined | null) => {
  if (!flat) return '';
  const clean = flat.toUpperCase().replace(/\s+/g, '');
  // Match a letter followed by optional zeros and then numbers (e.g., "A01" -> "A1")
  const match = clean.match(/^([A-Z])0*(\d+)$/);
  if (match) {
    return match[1] + match[2];
  }
  return clean;
};

const ALL_FLATS = [
  { flat: 'A1', name: 'Renjini' },
  { flat: 'A2', name: 'Deepu' },
  { flat: 'A3', name: 'Sudha Subramaniyan' },
  { flat: 'B1', name: 'Anila Kuruvilla' },
  { flat: 'B2', name: 'Suresh' },
  { flat: 'B3', name: 'Prathap PV' },
  { flat: 'C1', name: 'Jayalakshmi' },
  { flat: 'C2', name: 'Sindhu' },
  { flat: 'C3', name: 'Jayan KR' },
  { flat: 'D2', name: 'Usha G Menon' },
  { flat: 'D3', name: 'Prem Narayanan' },
  { flat: 'E2', name: 'Balachandran' },
  { flat: 'E3', name: 'Vidyashekhar' },
  { flat: 'F1', name: 'MohanaKrishnan' },
  { flat: 'F2', name: 'Sudha Dinaker' },
  { flat: 'F3', name: 'Seema Sreekumar' }
];

// --- Components ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) {
          errorMessage = `Firestore Error: ${parsed.error} during ${parsed.operationType} on ${parsed.path}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || String(this.state.error);
      }

      return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-red-900/30 p-8 rounded-3xl max-w-md w-full text-center space-y-4">
            <AlertCircle size={48} className="text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-neutral-100">Application Error</h2>
            <p className="text-neutral-400 text-sm">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-neutral-800 text-neutral-100 rounded-xl hover:bg-neutral-700 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
const LoadingScreen = () => (
  <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="w-12 h-12 border-4 border-neutral-800 border-t-indigo-500 rounded-full animate-spin" />
      <p className="text-neutral-500 font-medium animate-pulse">Loading WhitePalace...</p>
    </motion.div>
  </div>
);

const LoginScreen = ({ onShowLegal }: { onShowLegal: () => void }) => {
  const [loginMode, setLoginMode] = useState<'email' | 'flat'>('flat');
  const [email, setEmail] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let emailToUse = email;
      
      if (loginMode === 'flat') {
        // Find user by flat number
        const targetFlat = normalizeFlat(flatNumber);
        if (!targetFlat) throw new Error('Please enter a flat number');

        const allUsersSnap = await getDocs(collection(db, 'users'));
        const userDoc = allUsersSnap.docs.find(d => normalizeFlat(d.data().flatNumber) === targetFlat);
        
        if (!userDoc) {
          throw new Error('Flat number not found. Please contact admin.');
        }
        emailToUse = userDoc.data().email;
      }
      
      await signInWithEmailAndPassword(auth, emailToUse, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-neutral-900 p-8 rounded-3xl shadow-xl border border-neutral-800"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
            <Building2 size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-neutral-100 mb-2 tracking-tight">WhitePalace</h1>
        <p className="text-center text-neutral-500 mb-8">Manage your apartment maintenance and payments with ease.</p>
        
        {loginMode === 'flat' && (
          <div className="bg-indigo-900/20 border border-indigo-900/30 p-3 rounded-xl mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-indigo-300 leading-relaxed">
              Owners without an email can log in using their <strong>Flat Number</strong> and the password provided by the administrator.
            </p>
          </div>
        )}
        
        <div className="flex items-center gap-2 p-1 bg-neutral-800 rounded-xl mb-8">
          <button 
            onClick={() => setLoginMode('flat')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              loginMode === 'flat' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Flat Number
          </button>
          <button 
            onClick={() => setLoginMode('email')}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all",
              loginMode === 'email' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" : "text-neutral-500 hover:text-neutral-300"
            )}
          >
            Email Address
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 mb-6">
          {loginMode === 'flat' ? (
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Flat Number</label>
              <input 
                type="text" 
                required
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                placeholder="e.g. A101"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Email</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                placeholder="resident@example.com"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          
          {loginMode === 'email' && (
            <div className="text-right">
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-wider"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-neutral-900 px-2 text-neutral-500 font-bold">Or continue with</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full py-4 bg-neutral-800 border border-neutral-700 text-neutral-100 rounded-2xl font-semibold flex items-center justify-center gap-3 hover:bg-neutral-700 transition-all"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          Google
        </button>

        <div className="mt-8 text-center">
          <button 
            onClick={onShowLegal}
            className="text-xs font-bold text-neutral-500 hover:text-neutral-300 uppercase tracking-widest"
          >
            Legal & Policies
          </button>
        </div>
      </motion.div>
    </div>
  );
};

function PendingList({ payments }: { payments: PaymentRecord[] }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const today = new Date().getDate();
  
  const pendingData = useMemo(() => {
    const data: { flat: string, month: string, year: number, amount: number }[] = [];
    
    if (today > 10) {
      const SYSTEM_START_MONTH = 4;
      const SYSTEM_START_YEAR = 2025;
      const checkUntil = new Date(currentYear, currentMonth - 1, 1);
      
      ALL_FLATS.forEach(f => {
        const flat = normalizeFlat(f.flat);
        const flatPayments = payments.filter(p => normalizeFlat(p.flatNumber) === flat && p.status === 'paid');
        
        let iterDate = new Date(SYSTEM_START_YEAR, SYSTEM_START_MONTH, 1);
        while (iterDate <= checkUntil) {
          const monthKey = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}`;
          if (!flatPayments.some(p => p.month === monthKey)) {
            data.push({
              flat: f.flat,
              month: MONTHS[iterDate.getMonth()],
              year: iterDate.getFullYear(),
              amount: 1200
            });
          }
          iterDate.setMonth(iterDate.getMonth() + 1);
        }
      });
    }
    return data;
  }, [payments, currentMonth, currentYear, today]);

  const totalPending = pendingData.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Pending Dues List</h2>
          <p className="text-sm text-neutral-500">List of flats with outstanding maintenance payments.</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-2xl">
          <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Total Outstanding</p>
          <p className="text-xl font-black text-rose-500">₹{totalPending.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-800/50">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Flat Number</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Owner Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Pending Month</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {pendingData.map((p, i) => {
                const owner = ALL_FLATS.find(f => f.flat === p.flat)?.name;
                return (
                  <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-neutral-100">{p.flat}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-neutral-300">{owner}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">
                        {p.month} {p.year}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-neutral-100">₹{p.amount.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
              {pendingData.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500 font-medium">
                    No pending dues found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ config, onUpdateConfig, accounts }: { config: AppConfig | null, onUpdateConfig: (url: string, lastSyncedAt?: Date) => Promise<void>, accounts: AccountEntry[] }) {
  const [sheetsUrl, setSheetsUrl] = useState(config?.googleSheetsUrl || '');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdateConfig(sheetsUrl);
      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!config?.googleSheetsUrl) {
      toast.error("Please provide a Google Sheets Webhook URL first");
      return;
    }
    setSyncing(true);
    if (accounts.length === 0) {
      toast.error("No account data found to sync");
      setSyncing(false);
      return;
    }

    try {
      // Calculate summary stats
      const sorted = [...accounts]
        .filter(acc => !acc.isAdvanceAllocation && acc.date)
        .sort((a, b) => {
          const dateA = a.date instanceof Date ? a.date : a.date.toDate();
          const dateB = b.date instanceof Date ? b.date : b.date.toDate();
          return dateA.getTime() - dateB.getTime();
        });

      let currentCash = 0;
      let currentBank = 0;
      let grandIncome = 0;
      let grandExpense = 0;

      sorted.forEach(acc => {
        if (acc.isOpeningBalance) {
          if (acc.method === 'bank') {
            currentBank += Number(acc.amount || 0);
          } else {
            currentCash += Number(acc.amount || 0);
          }
          grandIncome += Number(acc.openingIncome || 0);
          grandExpense += Number(acc.openingExpense || 0);
        } else if (acc.isWithdrawal) {
          currentCash += Number(acc.amount || 0);
          currentBank -= Number(acc.amount || 0);
        } else {
          if (acc.method === 'bank') {
            currentBank += Number(acc.income || 0);
            currentBank -= Number(acc.expense || 0);
          } else {
            currentCash += Number(acc.income || 0);
            currentCash -= Number(acc.expense || 0);
          }
          grandIncome += Number(acc.income || 0);
          grandExpense += Number(acc.expense || 0);
        }
      });

      // Prepare data for sync - handle Firestore Timestamps correctly
      const data = accounts.map(acc => {
        let dateStr = 'N/A';
        if (acc.date) {
          const d = acc.date instanceof Date ? acc.date : acc.date.toDate();
          dateStr = d.toLocaleDateString('en-IN'); // Use Indian date format
        } else if (acc.isAdvanceAllocation) {
          dateStr = `${acc.forMonth} ${acc.forYear}`;
        }

        // For opening balances, use the specific opening fields if income/expense are 0
        const income = acc.isOpeningBalance ? (acc.openingIncome || 0) : (acc.income || 0);
        const expense = acc.isOpeningBalance ? (acc.openingExpense || 0) : (acc.expense || 0);

        return {
          id: acc.id, // Include ID for duplicate detection
          date: dateStr,
          particulars: acc.particulars || (acc.isOpeningBalance ? 'Opening Balance' : ''),
          income: income,
          expense: expense,
          method: acc.method || '',
          ownerName: acc.ownerName || '',
          flatNumber: acc.flatNumber || ''
        };
      });

      await fetch(config.googleSheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync_accounts',
          data: data,
          summary: {
            cashInHand: currentCash,
            cashInBank: currentBank,
            totalIncome: grandIncome,
            totalExpense: grandExpense
          }
        }),
      });

      // Update last sync time
      await onUpdateConfig(config.googleSheetsUrl, new Date());
      toast.success("Sync request sent to Google Sheets");
    } catch (error) {
      console.error("Sync failed:", error);
      toast.error("Failed to sync with Google Sheets");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-neutral-100">System Settings</h2>
        <p className="text-sm text-neutral-500">Configure external integrations and backups.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center text-green-500">
              <Table size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100">Google Sheets Backup</h3>
              <p className="text-xs text-neutral-500">Store account details in a Google Sheet for extra safety.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2 tracking-widest">Webhook URL (Google Apps Script)</label>
              <input 
                type="text" 
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm"
              />
              <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed">
                To use this, create a Google Sheet, go to Extensions &gt; Apps Script, paste the backup script, and deploy as a Web App.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-900/20"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Save URL
              </button>
              
              <button 
                onClick={handleSync}
                disabled={syncing || !config?.googleSheetsUrl}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-neutral-200 px-6 py-2.5 rounded-xl font-bold text-sm transition-all border border-neutral-700"
              >
                {syncing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                Sync All Accounts Now
              </button>
              
              {config?.lastSyncedAt && (
                <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Last synced: {format(config.lastSyncedAt instanceof Date ? config.lastSyncedAt : config.lastSyncedAt.toDate(), 'PPP p')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-neutral-900/50 rounded-3xl border border-neutral-800 p-6 border-dashed">
          <h4 className="text-sm font-bold text-neutral-300 mb-4">How to set up Google Sheets Backup:</h4>
          <ol className="text-xs text-neutral-500 space-y-3 list-decimal pl-4">
            <li>Create a new <strong>Google Sheet</strong>.</li>
            <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
            <li>Paste the following code into the editor:
              <pre className="mt-2 p-3 bg-neutral-950 rounded-lg text-indigo-400 overflow-x-auto font-mono text-[10px]">
{`function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheets()[0];
    var contents = e.postData.contents;
    var payload = JSON.parse(contents);
    
    if (payload.action === 'sync_accounts') {
      // 1. Update Summary at the top (always rows 1-5)
      if (payload.summary) {
        sheet.getRange(1, 1).setValue('SUMMARY STATISTICS').setFontWeight('bold').setFontSize(14).setFontColor('#1a73e8');
        
        var stats = [
          ['Cash in Hand', '₹' + payload.summary.cashInHand.toLocaleString()],
          ['Cash in Bank', '₹' + payload.summary.cashInBank.toLocaleString()],
          ['Total Income', '₹' + payload.summary.totalIncome.toLocaleString()],
          ['Total Expense', '₹' + payload.summary.totalExpense.toLocaleString()]
        ];
        
        var summaryRange = sheet.getRange(2, 1, 4, 2);
        summaryRange.setValues(stats);
        summaryRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
        sheet.getRange(2, 1, 4, 1).setFontWeight('bold').setBackground('#f8f9fa');
        sheet.getRange(2, 2, 4, 1).setHorizontalAlignment('right').setFontWeight('bold');
        sheet.getRange(4, 2).setFontColor('#0d9488'); // Income
        sheet.getRange(5, 2).setFontColor('#e11d48'); // Expense
      }
      
      // 2. Handle Data (Incremental Sync)
      var headerRow = 7;
      var headers = ['Date', 'Particulars', 'Income', 'Expense', 'Method', 'Owner', 'Flat', 'ID'];
      
      // Ensure headers exist
      if (sheet.getRange(headerRow, 1).getValue() !== 'Date') {
        sheet.getRange(headerRow, 1, 1, 8).setValues([headers])
             .setFontWeight('bold').setBackground('#444444').setFontColor('#ffffff')
             .setHorizontalAlignment('center').setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
        sheet.setColumnWidth(8, 1); // Hide ID column
      }
      
      if (payload.data && payload.data.length > 0) {
        // Get existing IDs from Column H (8)
        var lastRow = sheet.getLastRow();
        var existingIds = [];
        if (lastRow >= headerRow + 1) {
          existingIds = sheet.getRange(headerRow + 1, 8, lastRow - headerRow, 1).getValues().flat();
        }
        
        // Filter for new entries only
        var newRows = payload.data.filter(function(row) {
          return existingIds.indexOf(row.id) === -1;
        }).map(function(row) {
          return [
            row.date, 
            row.particulars, 
            row.income, 
            row.expense, 
            row.method, 
            row.ownerName, 
            row.flatNumber,
            row.id
          ];
        });
        
        if (newRows.length > 0) {
          var startRow = Math.max(lastRow + 1, headerRow + 1);
          var dataRange = sheet.getRange(startRow, 1, newRows.length, 8);
          dataRange.setValues(newRows);
        }
        
        // Apply borders and formatting to the ENTIRE data range (A to G)
        var finalLastRow = sheet.getLastRow();
        if (finalLastRow > headerRow) {
          var allDataRange = sheet.getRange(headerRow + 1, 1, finalLastRow - headerRow, 7);
          allDataRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
          allDataRange.setVerticalAlignment('middle');
          
          // Re-apply number formatting and colors to ensure everything is consistent
          sheet.getRange(headerRow + 1, 3, finalLastRow - headerRow, 1).setNumberFormat('#,##0').setFontColor('#0d9488').setFontWeight('bold');
          sheet.getRange(headerRow + 1, 4, finalLastRow - headerRow, 1).setNumberFormat('#,##0').setFontColor('#e11d48').setFontWeight('bold');
        }
        
        sheet.autoResizeColumns(1, 7);
      }
      
      return ContentService.createTextOutput(JSON.stringify({status: 'success', added: newRows ? newRows.length : 0}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({status: 'error', message: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`}
              </pre>
            </li>
            <li><strong>IMPORTANT:</strong> Click the <strong>"Save"</strong> icon, then click <strong>"Run"</strong> once to authorize the script. You will see a popup to grant permissions.</li>
            <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
            <li>Select <strong>Web App</strong>, set "Execute as" to <strong>Me</strong>, and "Who has access" to <strong>Anyone</strong>.
              <p className="mt-1 text-[9px] text-amber-500 font-medium italic">
                Note: "Anyone" is safe here because the URL is kept secret and only accessible to Admins within this app. The Google Sheet itself remains private to you.
              </p>
            </li>
            <li>Copy the <strong>Web App URL</strong> and paste it above.</li>
            <li className="text-amber-500 font-bold italic">If you update the code later, you MUST create a "New Deployment" for the changes to take effect.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function LegalSection({ onBack }: { onBack?: () => void }) {
  const [activeLegalTab, setActiveLegalTab] = useState<'terms' | 'privacy' | 'refund' | 'shipping'>('terms');

  const content = {
    terms: {
      title: "Terms of Service",
      updated: "March 26, 2026",
      body: `Welcome to WhitePalace. By using our application, you agree to the following terms:
      
1. Acceptance of Terms: By accessing or using WhitePalace, you agree to be bound by these Terms of Service.
2. Description of Service: WhitePalace provides a platform for apartment maintenance management and payment processing.
3. User Responsibilities: Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account.
4. Maintenance Payments: Owners agree to pay maintenance dues as specified by the Apartment Association. Late payments may incur penalties as decided by the committee.
5. Prohibited Conduct: Users may not use the service for any illegal or unauthorized purpose.
6. Termination: We reserve the right to terminate or suspend access to our service immediately, without prior notice, for any reason whatsoever.
7. Governing Law: These terms shall be governed by the laws of India.`
    },
    privacy: {
      title: "Privacy Policy",
      updated: "March 26, 2026",
      body: `Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information:

1. Information Collection: We collect information you provide directly to us, such as your name, email, flat number, and payment details.
2. Use of Information: We use your information to manage apartment maintenance, process payments, and send important announcements.
3. Data Security: We implement appropriate security measures to protect your personal information from unauthorized access or disclosure.
4. Third-Party Services: We use third-party services like Firebase for data storage and Razorpay for payment processing. These services have their own privacy policies.
5. Data Retention: We retain your information for as long as necessary to provide the services and comply with legal obligations.
6. Your Rights: You have the right to access, update, or delete your personal information at any time.`
    },
    refund: {
      title: "Refund & Cancellation Policy",
      updated: "March 26, 2026",
      body: `Our policy regarding refunds and cancellations for maintenance payments:

1. Maintenance Payments: Maintenance dues once paid are generally non-refundable as they are used for the ongoing upkeep of the apartment complex.
2. Duplicate Payments: In case of duplicate payments made due to technical errors, the extra amount will be adjusted against the next month's maintenance dues.
3. Cancellation: Owners cannot "cancel" a maintenance payment once it has been successfully processed.
4. Disputes: Any disputes regarding the amount charged should be raised with the Apartment Association Treasurer within 7 days of payment.
5. Processing Time: Approved adjustments or refunds (in exceptional cases) will be processed within 7-10 working days.`
    },
    shipping: {
      title: "Shipping & Delivery Policy",
      updated: "March 26, 2026",
      body: `Information regarding the delivery of our services:

1. Nature of Service: WhitePalace is a digital platform providing apartment management services. 
2. Delivery Method: No physical shipping is required. Access to the management system is provided instantly via the web application upon successful payment or account activation by the administrator.
3. Service Availability: The service is available 24/7, subject to planned maintenance or unforeseen technical issues.
4. Support: For any issues regarding access or delivery of service, please contact the administrator at whitepalaceapartment@gmail.com.`
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-neutral-100">Legal Information</h2>
          <p className="text-neutral-500">Terms, Privacy, and Refund policies for WhitePalace.</p>
        </div>
        {onBack && (
          <button 
            onClick={onBack}
            className="px-4 py-2 text-neutral-500 hover:text-neutral-100 font-bold transition-colors"
          >
            Back to Login
          </button>
        )}
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-sm overflow-hidden">
        <div className="flex border-b border-neutral-800">
          {(['terms', 'privacy', 'refund', 'shipping'] as const).map((tab) => {
            const tabColors: Record<string, string> = {
              terms: "text-indigo-400 border-indigo-400 bg-indigo-900/20",
              privacy: "text-emerald-400 border-emerald-400 bg-emerald-900/20",
              refund: "text-amber-400 border-amber-400 bg-amber-900/20",
              shipping: "text-blue-400 border-blue-400 bg-blue-900/20"
            };
            
            return (
              <button
                key={tab}
                onClick={() => setActiveLegalTab(tab)}
                className={cn(
                  "flex-1 py-4 text-[10px] md:text-sm font-bold uppercase tracking-wider transition-all border-b-2",
                  activeLegalTab === tab 
                    ? tabColors[tab]
                    : "text-neutral-500 hover:text-neutral-400 border-transparent"
                )}
              >
                {tab === 'terms' ? 'Terms' : tab === 'privacy' ? 'Privacy' : tab === 'refund' ? 'Refund' : 'Shipping'}
              </button>
            );
          })}
        </div>
        <div className="p-8 md:p-12">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-neutral-100 mb-2">{content[activeLegalTab].title}</h3>
            <p className="text-xs font-bold text-neutral-500 uppercase mb-8">Last Updated: {content[activeLegalTab].updated}</p>
            <div className="prose prose-invert prose-neutral max-w-none">
              <p className="text-neutral-400 leading-relaxed whitespace-pre-wrap">
                {content[activeLegalTab].body}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingPage({ onLogin, onShowLegal }: { onLogin: () => void, onShowLegal: () => void }) {
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <div className="bg-neutral-900 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white mb-8 shadow-xl shadow-indigo-900/40">
            <Building2 size={40} />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-neutral-100 mb-6 tracking-tight">
            WhitePalace
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed">
            The complete solution for modern apartment management at WhitePalace. Track maintenance, process payments, and stay connected with your community.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onLogin}
              className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
            >
              Access Owner Portal
            </button>
            <button 
              onClick={onShowLegal}
              className="px-8 py-4 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-2xl font-bold hover:bg-neutral-700 transition-all"
            >
              View Policies
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="w-12 h-12 bg-blue-900/20 text-blue-400 rounded-2xl flex items-center justify-center mb-6">
            <CreditCard size={24} />
          </div>
          <h3 className="text-xl font-bold text-neutral-100 mb-3">Easy Payments</h3>
          <p className="text-neutral-500 leading-relaxed">Secure online maintenance payments via UPI, Cards, and NetBanking through Razorpay.</p>
        </div>
        <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="w-12 h-12 bg-emerald-900/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
            <Megaphone size={24} />
          </div>
          <h3 className="text-xl font-bold text-neutral-100 mb-3">Announcements</h3>
          <p className="text-neutral-500 leading-relaxed">Stay updated with real-time notifications about society meetings and maintenance schedules.</p>
        </div>
        <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="w-12 h-12 bg-amber-900/20 text-amber-400 rounded-2xl flex items-center justify-center mb-6">
            <LayoutDashboard size={24} />
          </div>
          <h3 className="text-xl font-bold text-neutral-100 mb-3">Admin Dashboard</h3>
          <p className="text-neutral-500 leading-relaxed">Comprehensive tools for committee members to track dues and manage owner data efficiently.</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-neutral-800 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-800 rounded-xl flex items-center justify-center text-white">
            <Building2 size={16} />
          </div>
          <span className="font-bold text-neutral-100">WhitePalace</span>
        </div>
        <div className="flex flex-col items-center md:items-end gap-2">
          <div className="flex gap-8">
            <button onClick={onShowLegal} className="text-sm font-bold text-neutral-500 hover:text-neutral-100 uppercase tracking-widest transition-colors">Terms</button>
            <button onClick={onShowLegal} className="text-sm font-bold text-neutral-500 hover:text-neutral-100 uppercase tracking-widest transition-colors">Privacy</button>
            <button onClick={onShowLegal} className="text-sm font-bold text-neutral-500 hover:text-neutral-100 uppercase tracking-widest transition-colors">Refunds</button>
          </div>
          <p className="text-xs text-neutral-500">Contact: whitepalaceapartment@gmail.com</p>
        </div>
        <p className="text-sm text-neutral-500">© 2026 WhitePalace. All rights reserved.</p>
      </footer>
    </div>
  );
}

const PasswordChangeOverlay = ({ user }: { user: FirebaseUser }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(user, newPassword);
      await updateDoc(doc(db, 'users', user.uid), {
        mustChangePassword: false,
        tempPassword: deleteField() // Clear the temp password from Firestore
      });
      window.location.reload(); // Refresh to clear state
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-neutral-900 max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
      >
        <h2 className="text-2xl font-bold text-neutral-100 mb-2">Change Your Password</h2>
        <p className="text-neutral-500 mb-8">For security, you must set a new password before continuing.</p>
        
        <form onSubmit={handleUpdatePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">New Password</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Confirm New Password</label>
            <input 
              type="password" 
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
            />
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <button 
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'announcements' | 'legal' | 'accounts' | 'ledger' | 'settings' | 'directory' | 'pending'>('dashboard');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [showLegalPublic, setShowLegalPublic] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Real-time data
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch or create profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const profileData = userDoc.data() as UserProfile;
          setProfile(profileData);

          // Aggressive cleanup of test data if admin
          if (profileData.role === 'admin' || profileData.role === 'superadmin') {
            const cleanup = async () => {
              try {
                // Cleanup payments - fetch all and check manually to avoid type issues with 'where'
                const pSnap = await getDocs(collection(db, 'payments'));
                for (const d of pSnap.docs) {
                  const data = d.data();
                  const amt = Number(data.amount);
                  const isTest = data.ownerName?.toLowerCase().includes('test') || 
                                data.particulars?.toLowerCase().includes('test') ||
                                amt === 1300 || amt === 1301 || (amt > 1290 && amt < 1310);
                  if (isTest) {
                    await deleteDoc(d.ref);
                    console.log('Deleted test payment:', d.id, amt);
                  }
                }
                
                // Cleanup accounts
                const aSnap = await getDocs(collection(db, 'accounts'));
                for (const d of aSnap.docs) {
                  const data = d.data();
                  const income = Number(data.income || 0);
                  const isTest = data.particulars?.toLowerCase().includes('test') || 
                                income === 1300 || income === 1301 || (income > 1290 && income < 1310);
                  if (isTest) {
                    await deleteDoc(d.ref);
                    console.log('Deleted test account entry:', d.id, income);
                  }
                }
              } catch (err) {
                console.error('Cleanup error:', err);
              }
            };
            cleanup();
          }
        } else {
          // Check if this email is already registered in the system (added by admin)
          const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // User exists with this email but different UID (e.g. added via email/pass, now using Google)
            const existingDoc = querySnapshot.docs[0];
            const existingData = existingDoc.data() as UserProfile;
            
            // Update the existing document with the new UID or link them
            const updatedProfile = {
              ...existingData,
              uid: firebaseUser.uid,
              photoURL: firebaseUser.photoURL || existingData.photoURL,
              displayName: firebaseUser.displayName || existingData.displayName
            };
            
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile);
            // Optionally delete the old doc if the UID changed, but usually we just want to allow them in
            if (existingDoc.id !== firebaseUser.uid) {
              await deleteDoc(doc(db, 'users', existingDoc.id));
            }
            setProfile(updatedProfile);
          } else {
            // Default to owner for new users ONLY if it's the bootstrapped admin
            const isBootstrappedAdmin = firebaseUser.email === 'whitepalaceapartment@gmail.com';
            
            if (isBootstrappedAdmin) {
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                displayName: firebaseUser.displayName || 'Admin',
                photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'Admin')}&background=random`,
                role: 'superadmin',
                createdAt: serverTimestamp()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              setProfile(newProfile);
            } else {
              // UNAUTHORIZED USER
              toast.error("Unauthorized access. Please contact the administrator to add your email to the system.");
              await signOut(auth);
              setUser(null);
              setProfile(null);
            }
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!profile) return;

    const qAnnouncements = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubAnnouncements = onSnapshot(qAnnouncements, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    });

    const qAccounts = query(collection(db, 'accounts'), orderBy('date', 'asc'));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const allAccounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate() || new Date()
        } as unknown as AccountEntry;
      });
      
      // Filter out test accounts
      const filtered = allAccounts.filter(a => {
        const isTestPart = a.particulars?.toLowerCase().includes('test');
        const amt = Number(a.income || a.expense || a.amount || 0);
        // Explicitly exclude the test amounts that are causing issues
        const isTestAmount = amt === 1300 || amt === 1301 || (amt <= 10 && amt > 0);
        return !isTestPart && !isTestAmount;
      });
      setAccounts(filtered);
    });

    let unsubPayments = () => {};
    let unsubUsers = () => {};
    let unsubConfig = () => {};

    const isAdminUser = profile.role === 'admin' || 
      profile.role === 'superadmin' || 
      profile.email === 'whitepalaceapartment@gmail.com';

    if (isAdminUser || profile.role === 'owner') {
      const qPayments = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
      unsubPayments = onSnapshot(qPayments, (snapshot) => {
        const allPayments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord));
        // Filter out test payments:
        // 1. Exclude payments with "test" in particulars or owner name
        // 2. Exclude the specific test amounts 1300 and 1301 (3701 - 2400 = 1301)
        // 3. Exclude very small test amounts (like 1)
        const filtered = allPayments.filter(p => {
          const isTestName = p.ownerName?.toLowerCase().includes('test');
          const isTestPart = p.particulars?.toLowerCase().includes('test');
          const amt = Number(p.amount);
          const isTestAmount = amt === 1300 || amt === 1301 || amt <= 10;
          return !isTestName && !isTestPart && !isTestAmount;
        });
        setPayments(filtered);
      });

      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as UserProfile)));
      });

      if (isAdminUser) {
        unsubConfig = onSnapshot(doc(db, 'config', 'app'), (snapshot) => {
          if (snapshot.exists()) {
            setAppConfig({ id: snapshot.id, ...snapshot.data() } as AppConfig);
          }
        });
      }
    } else if (profile.flatNumber) {
      const qPayments = query(
        collection(db, 'payments'), 
        where('flatNumber', '==', profile.flatNumber),
        orderBy('createdAt', 'desc')
      );
      unsubPayments = onSnapshot(qPayments, (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord)));
      });
    }

    return () => {
      unsubAnnouncements();
      unsubAccounts();
      unsubPayments();
      unsubUsers();
      unsubConfig();
    };
  }, [profile]);

  const handleUpdateConfig = async (url: string, lastSyncedAt?: Date) => {
    try {
      const data: any = {
        googleSheetsUrl: url,
        updatedAt: serverTimestamp()
      };
      if (lastSyncedAt) {
        data.lastSyncedAt = lastSyncedAt;
      }
      await setDoc(doc(db, 'config', 'app'), data, { merge: true });
    } catch (error) {
      console.error("Failed to update config:", error);
      throw error;
    }
  };

  if (loading) return <LoadingScreen />;
  
  if (showLegalPublic) {
    return (
      <div className="min-h-screen bg-neutral-950 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <LegalSection onBack={() => setShowLegalPublic(false)} />
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    if (showLogin) {
      return <LoginScreen onShowLegal={() => setShowLegalPublic(true)} />;
    }
    return <LandingPage onLogin={() => setShowLogin(true)} onShowLegal={() => setShowLegalPublic(true)} />;
  }

  const isSuperAdmin = profile.role === 'superadmin' || 
    profile.email === 'whitepalaceapartment@gmail.com';
  const isAdmin = profile.role === 'admin' || 
    profile.role === 'superadmin' || 
    profile.email === 'whitepalaceapartment@gmail.com';
  const isOwner = profile.role === 'owner';

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-neutral-950 flex flex-col">
        {profile?.mustChangePassword && user && <PasswordChangeOverlay user={user} />}
        
        {/* Top Header - Full Width */}
        {(!isMobile || activeTab === 'dashboard') && (
          <>
            <header className={cn(
              "w-full text-center border-b border-neutral-800 bg-neutral-900/30 backdrop-blur-sm z-30",
              isMobile ? "py-4" : "py-8"
            )}>
              <h1 className={cn(
                "font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 uppercase",
                isMobile ? "text-2xl mb-1" : "text-4xl md:text-6xl mb-2"
              )}>
                White Palace Appartment
              </h1>
              <div className="flex flex-col items-center gap-1">
                <p className={cn("text-neutral-400 font-medium tracking-wide", isMobile ? "text-xs" : "text-base")}>Mamppilly Lane, Eroor PO</p>
                <p className={cn("text-neutral-500 font-bold tracking-widest uppercase", isMobile ? "text-[10px]" : "text-sm")}>Tripunithura-682306</p>
              </div>
              {!isMobile && <div className="mt-6 h-1 w-24 bg-gradient-to-r from-indigo-500 to-blue-500 mx-auto rounded-full opacity-50" />}
            </header>
            <PendingTicker users={allUsers} payments={payments} />
          </>
        )}

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Sidebar */}
          {(!isMobile || activeTab === 'dashboard') && (
            <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-r border-neutral-800 p-4 flex flex-col gap-2 overflow-y-auto">
              <div className="flex items-center gap-3 px-2 mb-8">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-900/50">
                  <Building2 size={20} />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-blue-400">WhitePalace</span>
              </div>

          <nav className="flex-1 flex flex-col gap-1">
            <SidebarItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard size={20} />}
              label="Dashboard"
              activeColor="indigo"
            />
            <SidebarItem 
              active={activeTab === 'directory'} 
              onClick={() => setActiveTab('directory')}
              icon={<BookOpen size={20} />}
              label="Directory"
              activeColor="blue"
            />
            <SidebarItem 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
              icon={<Users size={20} />}
              label="Owners"
              activeColor="emerald"
            />
            <SidebarItem 
              active={activeTab === 'announcements'} 
              onClick={() => setActiveTab('announcements')}
              icon={<Megaphone size={20} />}
              label="Announcements"
              activeColor="amber"
            />
            <SidebarItem 
              active={activeTab === 'accounts'} 
              onClick={() => setActiveTab('accounts')}
              icon={<Wallet size={20} />}
              label="Accounts"
              activeColor="rose"
            />
            <SidebarItem 
              active={activeTab === 'ledger'} 
              onClick={() => setActiveTab('ledger')}
              icon={<FileText size={20} />}
              label="Payment Report"
              activeColor="emerald"
            />
            {isAdmin && (
              <SidebarItem 
                active={activeTab === 'pending'} 
                onClick={() => setActiveTab('pending')}
                icon={<AlertCircle size={20} />}
                label="Pending List"
                activeColor="rose"
              />
            )}
            {isAdmin && (
              <SidebarItem 
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')}
                icon={<Settings size={20} />}
                label="Settings"
                activeColor="neutral"
              />
            )}
            <SidebarItem 
              active={activeTab === 'legal'} 
              onClick={() => setActiveTab('legal')}
              icon={<ShieldCheck size={20} />}
              label="Legal & Policies"
              activeColor="slate"
            />
          </nav>

          <div className="mt-auto pt-4 border-t border-neutral-800 flex flex-col gap-4">
            <div className="px-4 py-3 bg-neutral-800/50 rounded-xl border border-neutral-800">
              <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Contact Us</p>
              <p className="text-xs font-semibold text-neutral-300">whitepalaceapartment@gmail.com</p>
              <p className="text-[10px] text-neutral-500">WhitePalace Support</p>
            </div>
            <div className="flex items-center gap-3 px-2">
              <img src={profile.photoURL} className="w-10 h-10 rounded-full border border-neutral-800" alt="Avatar" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-neutral-100 truncate">{profile.displayName}</span>
                <span className="text-xs text-neutral-500 capitalize">{profile.role} {profile.flatNumber && `• ${profile.flatNumber}`}</span>
              </div>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="flex items-center gap-3 px-4 py-3 text-neutral-500 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </aside>
        )}

        {/* Main Content */}
        <main className={cn(
          "flex-1 overflow-y-auto bg-neutral-950",
          isMobile && activeTab !== 'dashboard' ? "p-0" : "p-4 md:p-8"
        )}>
          {isMobile && activeTab !== 'dashboard' && (
            <div className="sticky top-0 z-50 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 p-4 flex items-center gap-4">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 transition-colors"
              >
                <ArrowLeft size={24} />
              </button>
              <h2 className="text-lg font-bold text-white capitalize">{activeTab.replace('ledger', 'Payment Report')}</h2>
            </div>
          )}
          <div className={cn(isMobile && activeTab !== 'dashboard' ? "p-4" : "")}>
            <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-neutral-100">Welcome back, {profile.displayName.split(' ')[0]}</h2>
                  <p className="text-neutral-500">Here's what's happening in your apartment today.</p>
                </div>
                {!isAdmin && (
                  <div className="bg-neutral-900 px-6 py-3 rounded-2xl shadow-sm border border-neutral-800 flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Flat Number</span>
                      <span className="text-lg font-bold text-neutral-100">{profile.flatNumber || 'Not Assigned'}</span>
                    </div>
                  </div>
                )}
              </header>

              {isAdmin ? (
                <AdminDashboard 
                  stats={{ users: allUsers, payments, announcements, accounts }} 
                  onViewHistory={() => setActiveTab('ledger')}
                  setActiveTab={setActiveTab}
                />
              ) : (
                <OwnerDashboard 
                  stats={{ payments, announcements }} 
                  profile={profile} 
                  onViewHistory={() => setActiveTab('ledger')}
                />
              )}
            </motion.div>
          )}

          {activeTab === 'directory' && (
            <motion.div 
              key="directory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Directory users={allUsers} />
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <UserManagement users={allUsers} currentUser={profile} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
            </motion.div>
          )}

          {activeTab === 'announcements' && (
            <motion.div 
              key="announcements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AnnouncementManagement announcements={announcements} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} profile={profile} />
            </motion.div>
          )}

          {activeTab === 'accounts' && (
            <motion.div 
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AccountsManagement accounts={accounts} residents={allUsers} payments={payments} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div 
              key="ledger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PaymentReport accounts={accounts} payments={payments} residents={allUsers} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
            </motion.div>
          )}

          {activeTab === 'pending' && isAdmin && (
            <motion.div 
              key="pending"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PendingList payments={payments} />
            </motion.div>
          )}

          {activeTab === 'legal' && (
            <motion.div 
              key="legal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <LegalSection />
            </motion.div>
          )}

          {activeTab === 'settings' && isAdmin && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SettingsSection 
                config={appConfig} 
                onUpdateConfig={handleUpdateConfig} 
                accounts={accounts} 
              />
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
    </div>
    </ErrorBoundary>
  );
}

// --- Sub-Components ---

function SidebarItem({ active, onClick, icon, label, activeColor = 'neutral' }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, activeColor?: string }) {
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40",
    emerald: "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40",
    blue: "bg-blue-600 text-white shadow-lg shadow-blue-900/40",
    amber: "bg-amber-600 text-white shadow-lg shadow-amber-900/40",
    slate: "bg-neutral-700 text-white shadow-lg shadow-neutral-900/40",
    neutral: "bg-neutral-800 text-white shadow-lg shadow-neutral-950/40"
  };

  const iconBgMap: Record<string, string> = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    slate: "bg-neutral-600",
    neutral: "bg-neutral-700"
  };

  const hoverMap: Record<string, string> = {
    indigo: "hover:bg-indigo-500/10 hover:text-indigo-400",
    emerald: "hover:bg-emerald-500/10 hover:text-emerald-400",
    blue: "hover:bg-blue-500/10 hover:text-blue-400",
    amber: "hover:bg-amber-500/10 hover:text-amber-400",
    slate: "hover:bg-neutral-800 hover:text-neutral-200",
    neutral: "hover:bg-neutral-800 hover:text-neutral-200"
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium border border-transparent group",
        active 
          ? `${colorMap[activeColor]} shadow-lg` 
          : `text-neutral-500 ${hoverMap[activeColor]}`
      )}
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
        active ? iconBgMap[activeColor] : "bg-neutral-800 text-neutral-500 group-hover:bg-neutral-700 group-hover:shadow-sm"
      )}>
        {icon}
      </div>
      <span>{label}</span>
    </button>
  );
}

function PaymentDetailModal({ payment, onClose }: { payment: PaymentRecord, onClose: () => void }) {
  const handleDownloadReceipt = () => {
    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${payment.flatNumber} - ${payment.month}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .receipt-container { max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 50px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f3f4f6; padding-bottom: 30px; margin-bottom: 40px; }
            .header-left h1 { margin: 0; font-size: 28px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; }
            .header-left p { margin: 4px 0 0; color: #6b7280; font-size: 14px; font-weight: 500; }
            .header-right { text-align: right; }
            .header-right h2 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
            .header-right p { margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #111827; }
            
            .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
            .detail-item { }
            .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px; }
            .value { font-size: 15px; color: #111827; font-weight: 600; }
            
            .amount-card { background: #f9fafb; border: 1px solid #f3f4f6; padding: 32px; border-radius: 20px; text-align: center; margin-bottom: 40px; }
            .amount-label { font-size: 14px; color: #6b7280; font-weight: 500; margin-bottom: 8px; }
            .amount-value { font-size: 42px; font-weight: 800; color: #10b981; }
            
            .status-stamp { display: inline-block; border: 3px solid #10b981; color: #10b981; padding: 8px 24px; border-radius: 12px; font-size: 24px; font-weight: 800; text-transform: uppercase; transform: rotate(-12deg); margin-top: 10px; opacity: 0.8; }
            
            .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #f3f4f6; text-align: center; }
            .footer p { margin: 4px 0; font-size: 12px; color: #9ca3af; }
            .footer .org { font-weight: 700; color: #4b5563; margin-top: 12px; font-size: 13px; }
            
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; box-shadow: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="header-left">
                <h1>Whitepalace Apartment</h1>
                <p>Official Maintenance Receipt</p>
              </div>
              <div class="header-right">
                <h2>Receipt Number</h2>
                <p>#${payment.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            
            <div class="details-grid">
              <div class="detail-item">
                <div class="label">Owner Name</div>
                <div class="value">${payment.ownerName}</div>
              </div>
              <div class="detail-item">
                <div class="label">Flat Number</div>
                <div class="value">${payment.flatNumber}</div>
              </div>
              <div class="detail-item">
                <div class="label">Maintenance Month</div>
                <div class="value">${format(new Date(payment.month + '-01'), 'MMMM yyyy')}</div>
              </div>
              <div class="detail-item">
                <div class="label">Payment Date</div>
                <div class="value">${(payment as any).date ? format((payment as any).date, 'PPP p') : (payment.paidAt ? format(payment.paidAt.toDate(), 'PPP p') : 'N/A')}</div>
              </div>
              <div class="detail-item">
                <div class="label">Transaction ID</div>
                <div class="value">${payment.transactionId || 'N/A'}</div>
              </div>
              <div class="detail-item">
                <div class="label">Payment Method</div>
                <div class="value">${payment.paymentMethod || 'Online'}</div>
              </div>
            </div>

            <div class="amount-card">
              <div class="amount-label">Total Amount Received</div>
              <div class="amount-value">₹${payment.amount.toLocaleString()}</div>
              <div class="status-stamp">PAID</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated receipt and does not require a physical signature.</p>
              <p>Thank you for your timely maintenance payment.</p>
              <p class="org">Whitepalace Apartment Owners Association</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-neutral-100">Payment Details</h3>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-neutral-300 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest mb-1">Status</p>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase",
                payment.status === 'paid' ? "bg-green-900/30 text-green-400 border border-green-900/50" : 
                payment.status === 'verifying' ? "bg-blue-900/30 text-blue-400 border border-blue-900/50" :
                "bg-orange-900/30 text-orange-400 border border-orange-900/50"
              )}>
                {payment.status}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest mb-1">Amount</p>
              <p className="text-2xl font-black text-neutral-100">₹{payment.amount.toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Owner</p>
              <p className="font-bold text-neutral-100 truncate">{payment.ownerName}</p>
            </div>
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Flat Number</p>
              <p className="font-bold text-neutral-100">{payment.flatNumber}</p>
            </div>
          </div>

          <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Maintenance Month</p>
            <p className="font-bold text-neutral-100">{format(new Date(payment.month + '-01'), 'MMMM yyyy')}</p>
          </div>

          {((payment as any).date || payment.paidAt) && (
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Payment Date</p>
              <p className="font-bold text-neutral-100">
                {format((payment as any).date || payment.paidAt.toDate(), 'PPP p')}
              </p>
            </div>
          )}

          {payment.particulars && (
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Notes</p>
              <p className="text-sm text-neutral-300 italic">"{payment.particulars}"</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-neutral-800/30 border-t border-neutral-800 space-y-3">
          {payment.status === 'paid' && (
            <button 
              onClick={handleDownloadReceipt}
              className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Download size={20} />
              Download Receipt
            </button>
          )}
          <button 
            onClick={onClose}
            className="w-full py-4 bg-neutral-800 text-neutral-300 font-bold rounded-2xl hover:bg-neutral-700 transition-all"
          >
            Close Details
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ stats, onViewHistory, setActiveTab }: { stats: { users: UserProfile[], payments: PaymentRecord[], announcements: Announcement[], accounts: AccountEntry[] }, onViewHistory: () => void, setActiveTab: (tab: 'dashboard' | 'users' | 'announcements' | 'legal' | 'accounts' | 'ledger' | 'pending') => void }) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    const hasSeeded = localStorage.getItem('advance_payments_seeded_v3');
    if (!hasSeeded && auth.currentUser?.email === 'jkrsanskrit@gmail.com' && stats.users.length > 0) {
      const seedAdvancePayments = async () => {
        const advancePayments = [
          { flat: 'B 1', owner: 'ANILA KURUVILLA', months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'], year: 2026, amount: 1500 },
          { flat: 'C 1', owner: 'JAYALAKSHMI', months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY'], year: 2026, amount: 1500 },
          { flat: 'E 3', owner: 'VIDYASEKHAR', months: ['JAN', 'FEB', 'MAR'], year: 2026, amount: 1500 }
        ];

        try {
          for (const data of advancePayments) {
            const flat = normalizeFlat(data.flat);
            const resident = stats.users.find(u => normalizeFlat(u.flatNumber || '') === flat);
            
            if (!resident) continue;

            for (const month of data.months) {
              const existing = stats.accounts.find(a => 
                a.flatNumber === flat && 
                a.forMonth === month && 
                a.forYear === data.year &&
                a.isAdvanceAllocation
              );

              if (existing) continue;

              await addDoc(collection(db, 'accounts'), {
                particulars: `Advance Maintenance - ${data.owner}`,
                income: 0,
                expense: 0,
                method: 'bank',
                isWithdrawal: false,
                isOpeningBalance: false,
                isAdvanceAllocation: true,
                displayAmount: data.amount,
                amount: 0,
                forMonth: month,
                forYear: data.year,
                date: Timestamp.fromDate(new Date(data.year, MONTHS.indexOf(month), 1)),
                flatNumber: flat,
                ownerUid: resident.uid,
                ownerName: resident.displayName,
                createdAt: serverTimestamp()
              });
            }
          }
          localStorage.setItem('advance_payments_seeded_v3', 'true');
          toast.success('Advance payments recorded successfully!');
        } catch (err) {
          console.error('Error seeding advance payments:', err);
        }
      };
      seedAdvancePayments();
    }
  }, [auth.currentUser, stats.users, stats.accounts]);

  const isOverdue = (monthKey: string) => {
    if (!monthKey) return false;
    const [year, month] = monthKey.split('-').map(Number);
    // Payment for month M is due by the 10th of month M+1
    const dueDate = new Date(year, month, 11); 
    return new Date() > dueDate;
  };

  // Calculate stats from accounts
  const { cashInHand, cashInBank, totalIncome, totalExpense } = useMemo(() => {
    const sorted = [...stats.accounts]
      .filter(acc => !acc.isAdvanceAllocation && acc.date)
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : a.date.toDate();
        const dateB = b.date instanceof Date ? b.date : b.date.toDate();
        return dateA.getTime() - dateB.getTime();
      });

    let currentCash = 0;
    let currentBank = 0;
    let grandIncome = 0;
    let grandExpense = 0;

    sorted.forEach(acc => {
      if (acc.isOpeningBalance) {
        if (acc.method === 'bank') {
          currentBank += Number(acc.amount || 0);
        } else {
          currentCash += Number(acc.amount || 0);
        }
        grandIncome += Number(acc.openingIncome || 0);
        grandExpense += Number(acc.openingExpense || 0);
      } else if (acc.isWithdrawal) {
        currentCash += Number(acc.amount || 0);
        currentBank -= Number(acc.amount || 0);
      } else {
        if (acc.method === 'bank') {
          currentBank += Number(acc.income || 0);
          currentBank -= Number(acc.expense || 0);
        } else {
          currentCash += Number(acc.income || 0);
          currentCash -= Number(acc.expense || 0);
        }
        grandIncome += Number(acc.income || 0);
        grandExpense += Number(acc.expense || 0);
      }
    });

    return {
      cashInHand: currentCash,
      cashInBank: currentBank,
      totalIncome: grandIncome,
      totalExpense: grandExpense
    };
  }, [stats.accounts]);
  
  const earliestDate = stats.accounts.length > 0 
    ? format(stats.accounts[0].date, 'dd/MM/yyyy') 
    : '01/05/2025';
  
  const pendingAmount = stats.payments
    .filter(p => p.status === 'pending' && isOverdue(p.month))
    .reduce((acc, p) => acc + Number(p.amount), 0);
  
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    return months.map((month, index) => {
      const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      // Use accounts for chart data as well for consistency
      const monthIncome = stats.accounts
        .filter(a => {
          const d = a.date;
          return d.getMonth() === index && d.getFullYear() === currentYear;
        })
        .reduce((acc, a) => acc + Number(a.income || 0), 0);
        
      return {
        name: month,
        amount: monthIncome
      };
    });
  }, [stats.accounts]);

  const totalResidents = stats.users.length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
          label="Cash in Hand" 
          value={`₹${cashInHand.toLocaleString()}`} 
          color="green" 
        />
        <StatCard 
          label="Cash in Bank" 
          value={`₹${cashInBank.toLocaleString()}`} 
          color="blue" 
        />
        <StatCard 
          label="Total Income" 
          value={`₹${totalIncome.toLocaleString()}`} 
          color="indigo" 
          subtitle={`From ${earliestDate}`}
        />
        <StatCard 
          label="Total Expense" 
          value={`₹${totalExpense.toLocaleString()}`} 
          color="rose" 
          subtitle={`From ${earliestDate}`}
        />
        <StatCard 
          label="Pending Dues" 
          value={`₹${pendingAmount.toLocaleString()}`} 
          color="orange" 
          subtitle="Past 10th of month"
          icon={<AlertCircle size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-neutral-100">Revenue Overview</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                <span className="text-xs text-neutral-500 font-medium">Income</span>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} onClick={() => setActiveTab('accounts')} style={{ cursor: 'pointer' }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#737373' }} />
                <Tooltip 
                  cursor={{ fill: '#171717' }}
                  contentStyle={{ backgroundColor: '#171717', borderRadius: '12px', border: '1px solid #262626', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#f5f5f5' }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === new Date().getMonth() ? '#4f46e5' : '#404040'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-neutral-100">Recent Activity</h3>
            <button 
              onClick={onViewHistory}
              className="p-2 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all"
              title="View Full History"
            >
              <History size={18} />
            </button>
          </div>
          <div className="space-y-4">
                {stats.payments.slice(0, 4).map(payment => (
                  <div key={payment.id} className="flex items-center gap-2">
                    <button 
                      onClick={() => setSelectedPayment(payment)}
                      className="flex-1 flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-2xl transition-all group text-left"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                        payment.status === 'paid' ? "bg-green-900/30 text-green-400" : "bg-orange-900/30 text-orange-400"
                      )}>
                        {payment.status === 'paid' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-neutral-100 truncate">{payment.ownerName}</p>
                          {payment.particulars?.match(/\((.*?)\)/) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase tracking-tight">
                              {payment.particulars.match(/\((.*?)\)/)?.[1]}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-tight">Flat {payment.flatNumber} • ₹{payment.amount}</p>
                      </div>
                      <span className="text-[10px] font-black text-neutral-600 uppercase">{format(payment.createdAt?.toDate() || new Date(), 'MMM d')}</span>
                    </button>
                  </div>
                ))}
            {stats.payments.length === 0 && (
              <p className="text-center py-8 text-neutral-600 font-medium italic">No recent activity.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Owners</p>
              <p className="text-2xl font-black text-neutral-100">{totalResidents}</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('users')}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
          >
            Manage
          </button>
        </div>
        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Pending Dues</p>
              <p className="text-2xl font-black text-neutral-100">₹{pendingAmount.toLocaleString()}</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('ledger')}
            className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
          >
            View
          </button>
        </div>
      </div>

      {selectedPayment && (
        <PaymentDetailModal 
          payment={selectedPayment} 
          onClose={() => setSelectedPayment(null)} 
        />
      )}
    </div>
  );
}

function OwnerDashboard({ stats, profile, onViewHistory }: { stats: { payments: PaymentRecord[], announcements: Announcement[] }, profile: UserProfile, onViewHistory: () => void }) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const pendingPayments = stats.payments.filter(p => p.status === 'pending' || p.status === 'verifying');
  const totalPaid = stats.payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);

  const pendingDues = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const today = new Date().getDate();
    const pending: { month: string, year: number, amount: number }[] = [];

    if (today > 10 && profile.flatNumber) {
      const SYSTEM_START_MONTH = 4;
      const SYSTEM_START_YEAR = 2025;
      const checkUntil = new Date(currentYear, currentMonth - 1, 1);
      const flat = normalizeFlat(profile.flatNumber);
      const flatPayments = stats.payments.filter(p => normalizeFlat(p.flatNumber) === flat && p.status === 'paid');

      let iterDate = new Date(SYSTEM_START_YEAR, SYSTEM_START_MONTH, 1);
      while (iterDate <= checkUntil) {
        const monthKey = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}`;
        if (!flatPayments.some(p => p.month === monthKey)) {
          pending.push({
            month: MONTHS[iterDate.getMonth()],
            year: iterDate.getFullYear(),
            amount: 1200
          });
        }
        iterDate.setMonth(iterDate.getMonth() + 1);
      }
    }
    return pending;
  }, [stats.payments, profile.flatNumber]);

  const totalPendingAmount = pendingDues.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        {totalPendingAmount > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-rose-950/40 border-2 border-rose-500 p-6 rounded-3xl flex items-center justify-between gap-4 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-900/30 text-rose-400 rounded-2xl flex items-center justify-center animate-pulse">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-rose-100">Action Required: Pending Dues</h3>
                <p className="text-rose-400/80 font-medium">You have ₹{totalPendingAmount.toLocaleString()} outstanding for {pendingDues.length} month(s).</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {pendingDues.map((p, i) => (
                    <span key={i} className="text-[10px] bg-rose-900/40 text-rose-300 px-2 py-0.5 rounded-full font-bold border border-rose-800/50">
                      {p.month} {p.year}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {pendingPayments.length > 0 ? (
          <div className="bg-orange-950/20 border border-orange-900/30 p-6 rounded-3xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-900/30 text-orange-400 rounded-2xl flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-100">Pending Maintenance</h3>
                <p className="text-orange-400/80">You have {pendingPayments.length} pending payment{pendingPayments.length > 1 ? 's' : ''}.</p>
                <p className="text-xs text-orange-500/60 mt-1 italic">Please share your payment receipt in the WhatsApp group for verification.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-950/20 border border-green-900/30 p-6 rounded-3xl flex items-center gap-4">
            <div className="w-12 h-12 bg-green-900/30 text-green-400 rounded-2xl flex items-center justify-center">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-green-100">All Clear!</h3>
              <p className="text-green-400/80">Your maintenance payments are up to date.</p>
            </div>
          </div>
        )}

        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-neutral-100">Recent Payments</h3>
            <button 
              onClick={onViewHistory}
              className="p-2 text-neutral-500 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl transition-all"
              title="View All Payments"
            >
              <History size={20} />
            </button>
          </div>
          <div className="space-y-4">
            {stats.payments.slice(0, 4).map(payment => (
              <div key={payment.id} className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedPayment(payment)}
                  className="flex-1 flex items-center justify-between p-4 bg-neutral-800/50 rounded-2xl border border-neutral-800/50 hover:bg-neutral-800 transition-all text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      payment.status === 'paid' ? "bg-green-900/30 text-green-400" : 
                      payment.status === 'verifying' ? "bg-blue-900/30 text-blue-400" :
                      "bg-orange-900/30 text-orange-400"
                    )}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-neutral-100">{format(new Date(payment.month + '-01'), 'MMMM yyyy')}</p>
                        {payment.particulars?.match(/\((.*?)\)/) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 uppercase tracking-tight">
                            {payment.particulars.match(/\((.*?)\)/)?.[1]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">
                        {payment.status === 'paid' ? `Paid on ${format(payment.paidAt?.toDate() || new Date(), 'MMM d, yyyy')}` : 
                         payment.status === 'verifying' ? 'Verification Pending' :
                         'Awaiting payment'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-neutral-100">₹{payment.amount}</p>
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                      payment.status === 'paid' ? "bg-green-900/30 text-green-400" : 
                      payment.status === 'verifying' ? "bg-blue-900/30 text-blue-400" :
                      "bg-orange-900/30 text-orange-400"
                    )}>
                      {payment.status === 'verifying' ? 'Verifying' : payment.status}
                    </span>
                  </div>
                </button>
              </div>
            ))}
            {stats.payments.length === 0 && (
              <p className="text-center py-8 text-neutral-600 font-medium">No payment records found.</p>
            )}
          </div>
        </div>
      </div>

      {selectedPayment && (
        <PaymentDetailModal 
          payment={selectedPayment} 
          onClose={() => setSelectedPayment(null)} 
        />
      )}

      <div className="space-y-6">
        <div className="bg-neutral-800 p-6 rounded-3xl text-white shadow-xl border border-neutral-700">
          <h3 className="text-sm font-bold opacity-40 uppercase tracking-widest mb-4">Total Paid</h3>
          <p className="text-4xl font-bold mb-2 text-indigo-400">₹{totalPaid.toLocaleString()}</p>
          <p className="text-xs opacity-40">Cumulative maintenance paid since joining.</p>
        </div>

        <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm">
          <h3 className="text-lg font-bold text-neutral-100 mb-4">Latest Announcement</h3>
          {stats.announcements.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-bold text-neutral-200">{stats.announcements[0].title}</h4>
              <p className="text-sm text-neutral-500 line-clamp-3 leading-relaxed">{stats.announcements[0].content}</p>
              <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-wider">{format(stats.announcements[0].createdAt?.toDate() || new Date(), 'MMM d, yyyy')}</p>
            </div>
          ) : (
            <p className="text-sm text-neutral-600 font-medium">No announcements yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickMaintenanceForm({ onClose, onSuccess, residents, payments }: { onClose: () => void, onSuccess: () => void, residents: UserProfile[], payments: PaymentRecord[] }) {
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState(1200);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(true);
  const [isHistorical, setIsHistorical] = useState(false);

  const getCurrentMonth = (d: Date) => {
    const prevDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return {
      month: MONTHS[prevDate.getMonth()],
      year: prevDate.getFullYear()
    };
  };

  useEffect(() => {
    const current = getCurrentMonth(date);
        // Use provided residents if available, otherwise use fallback
    const dbResidents = residents
      .filter(r => r.flatNumber) // Only include those with a flat number
      .map(r => {
        const monthKey = `${current.year}-${String(MONTHS.indexOf(current.month) + 1).padStart(2, '0')}`;
        const alreadyPaid = payments.some(p => p.ownerUid === r.uid && p.month === monthKey && (p.status === 'paid' || p.status === 'PAID'));
        
        // Find next expected month
        const ownerPayments = payments
          .filter(p => p.ownerUid === r.uid && (p.status === 'paid' || p.status === 'PAID'))
          .sort((a, b) => b.month.localeCompare(a.month));
        
        let nextExpectedMonth = "";
        if (ownerPayments.length > 0) {
          const lastPaid = ownerPayments[0].month; // YYYY-MM
          const [year, month] = lastPaid.split('-').map(Number);
          const nextDate = new Date(year, month, 1); // month is 0-indexed in Date, but here it's 1-indexed month from string, so Date(year, month, 1) gives next month
          nextExpectedMonth = `${MONTHS[nextDate.getMonth()]} ${nextDate.getFullYear()}`;
        }

        return {
          uid: r.uid,
          flatNumber: r.flatNumber || '?',
          displayName: r.displayName || 'Unknown',
          selected: false,
          customAmount: 1200,
          date: date,
          months: 1,
          forMonth: current.month,
          forYear: current.year,
          alreadyPaid,
          nextExpectedMonth,
          allowMultiple: false,
          isBulk: false
        };
      });

    if (dbResidents.length > 0) {
      setOwners(dbResidents.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true, sensitivity: 'base' })));
    } else {
      // Fallback if no residents found in system yet
      const fallback = ALL_FLATS.map(f => ({
        flatNumber: f.flat,
        displayName: f.name,
        uid: '',
        selected: false,
        customAmount: 1200,
        date: new Date(),
        months: 1,
        forMonth: current.month,
        forYear: current.year,
        alreadyPaid: false,
        allowMultiple: false,
        isBulk: false
      }));
      setOwners(fallback);
    }
    setLoadingResidents(false);
  }, [residents, date, payments]);

  const handleSyncFromResidents = async () => {
    // This is now handled by the prop, but we can keep it for manual refresh if needed
    // or just show a toast that it's synced
    toast.success("Owner list is synced with the main list.");
  };

  const handlePost = async () => {
    const selectedOwners = owners.filter(o => o.selected);
    if (selectedOwners.length === 0) {
      setError("Please select at least one owner.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const alreadyPaidOwners = selectedOwners.filter(o => o.alreadyPaid && !o.allowMultiple);
      if (alreadyPaidOwners.length > 0) {
        setError(`Submission blocked: ${alreadyPaidOwners.map(o => `${o.flatNumber} (${o.forMonth})`).join(', ')} already have payments recorded for the selected month. Use 'MP' button if you explicitly want to allow multiple payments.`);
        setSaving(false);
        return;
      }

      for (const owner of selectedOwners) {
        const startMonthIdx = MONTHS.indexOf(owner.forMonth);
        const startForDate = new Date(owner.forYear, startMonthIdx, 1);
        const endForDate = new Date(owner.forYear, startMonthIdx + owner.months - 1, 1);
        const endForMonth = MONTHS[endForDate.getMonth()];
        const endForYear = endForDate.getFullYear();
        
        const paymentDate = owner.date;
        const paymentMonthYear = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), 1);
        
        const isAdvance = startForDate >= paymentMonthYear && owner.months > 1;
        const monthlyAmount = owner.customAmount / owner.months;

        // 1. Create the main entry on the payment date
        let description = "";
        if (isAdvance) {
          description = `Advance: ${owner.forMonth} to ${endForMonth}`;
        } else if (owner.months > 1) {
          description = `${owner.forMonth} to ${endForMonth}`;
        } else {
          description = `${endForMonth} ${endForYear}`;
        }

        const tenantName = getTenantName(owner.flatNumber);
        const particulars = `${owner.flatNumber} ${owner.displayName}${tenantName ? ` (Tenant: ${tenantName})` : ''} (${description})`;

        const mainDocRef = await addDoc(collection(db, 'accounts'), {
          date: Timestamp.fromDate(paymentDate),
          particulars: particulars,
          income: isHistorical ? 0 : owner.customAmount,
          expense: 0,
          method: 'bank',
          isWithdrawal: false,
          isOpeningBalance: false,
          isAdvanceAllocation: isHistorical,
          displayAmount: 0, // Use shadow entries for monthly maintenance display
          forMonth: isHistorical ? null : owner.forMonth,
          forYear: isHistorical ? null : owner.forYear,
          flatNumber: owner.flatNumber,
          ownerUid: owner.uid,
          ownerName: owner.displayName,
          createdAt: serverTimestamp()
        });
        const mainId = mainDocRef.id;

        // 2. Create/Update PaymentRecord in 'payments' collection for resident dashboard
        for (let i = 0; i < owner.months; i++) {
          const currentForDate = new Date(owner.forYear, startMonthIdx + i, 1);
          const currentForMonth = MONTHS[currentForDate.getMonth()];
          const currentForYear = currentForDate.getFullYear();
          const monthKey = `${currentForYear}-${String(currentForDate.getMonth() + 1).padStart(2, '0')}`;

          // Check if a payment record already exists for this month/flat
          const q = query(
            collection(db, 'payments'), 
            where('flatNumber', '==', owner.flatNumber),
            where('month', '==', monthKey)
          );
          
          // To avoid duplicates, use a deterministic ID: (uid or flat)_monthKey
          const identifier = owner.uid || normalizeFlat(owner.flatNumber);
          const paymentId = `${identifier}_${monthKey}`;
          await setDoc(doc(db, 'payments', paymentId), {
            ownerUid: owner.uid,
            ownerName: owner.displayName,
            flatNumber: owner.flatNumber,
            amount: monthlyAmount,
            month: monthKey,
            status: 'paid',
            paidAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            transactionId: `MANUAL_${Date.now()}`,
            particulars: `Manual Entry: ${particulars}`,
            parentAccountId: mainId,
            installmentIndex: i + 1,
            totalInstallments: owner.months
          }, { merge: true });

          // 3. Create shadow entries for future months (Advance Allocation) in 'accounts'
          // For historical payments, create shadow entries for ALL months to ensure they show in ledger without income impact
          if (isHistorical || currentForDate > paymentMonthYear) {
            const tenantName = getTenantName(owner.flatNumber);
            // Shift ledger month to the next month (e.g., March maintenance shows in April ledger)
            const ledgerDate = isHistorical 
              ? new Date(currentForDate.getFullYear(), currentForDate.getMonth() + 1, 1)
              : currentForDate;
            const ledgerMonth = MONTHS[ledgerDate.getMonth()];
            const ledgerYear = ledgerDate.getFullYear();

            await addDoc(collection(db, 'accounts'), {
              date: null, // No date for shadow entries
              particulars: `${owner.flatNumber} ${owner.displayName}${tenantName ? ` (Tenant: ${tenantName})` : ''} (${isHistorical ? 'Past Advance Adjustment' : `From advance payment of ${MONTHS[paymentDate.getMonth()]}`})`,
              income: 0, // Doesn't affect balance
              displayAmount: monthlyAmount, // For UI display
              expense: 0,
              method: 'bank',
              isWithdrawal: false,
              isOpeningBalance: false,
              isAdvanceAllocation: true,
              installmentIndex: i + 1,
              totalInstallments: owner.months,
              originalPaymentDate: Timestamp.fromDate(paymentDate),
              forMonth: ledgerMonth,
              forYear: ledgerYear,
              createdAt: serverTimestamp(),
              parentAccountId: mainId,
              ownerUid: owner.uid,
              ownerName: owner.displayName,
              flatNumber: owner.flatNumber
            });
          }
        }
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to post entries.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Owner List</h4>
        <button 
          onClick={handleSyncFromResidents}
          className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <RefreshCw size={14} />
          Sync from Owners
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-800/30 p-4 rounded-2xl border border-neutral-700">
        <div className="relative">
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Bulk Payment Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
            <input 
              type="date" 
              value={format(date, 'yyyy-MM-dd')}
              onClick={(e) => (e.currentTarget as any).showPicker?.()}
              onFocus={(e) => (e.currentTarget as any).showPicker?.()}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                setDate(newDate);
                const current = getCurrentMonth(newDate);
                // Update all owners' dates AND their default forMonth/forYear
                setOwners(owners.map(o => {
                  const monthKey = `${current.year}-${String(MONTHS.indexOf(current.month) + 1).padStart(2, '0')}`;
                  const alreadyPaid = payments.some(p => p.ownerUid === o.uid && p.month === monthKey && (p.status === 'paid' || p.status === 'PAID'));
                  return { 
                    ...o, 
                    date: newDate,
                    forMonth: current.month,
                    forYear: current.year,
                    alreadyPaid
                  };
                }));
              }}
              className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm cursor-pointer relative"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-amber-900/10 border border-amber-900/20 rounded-xl self-end">
          <input 
            type="checkbox"
            id="isHistoricalBulk"
            checked={isHistorical}
            onChange={(e) => setIsHistorical(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-amber-600 focus:ring-amber-500"
          />
          <label htmlFor="isHistoricalBulk" className="text-[10px] font-bold text-amber-500 uppercase cursor-pointer flex flex-col">
            <span>Past Advance / Historical Entry</span>
            <span className="text-[8px] opacity-60 normal-case">No income impact now. Use for Jan-June cleanup.</span>
          </label>
        </div>
      </div>

      {/* Header Row for alignment */}
      {!loadingResidents && owners.length > 0 && (
        <div className="px-3 pb-2 flex flex-col md:flex-row md:items-center gap-4 border-b border-neutral-800">
          <div className="min-w-[180px] pl-8">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Owner Name</span>
          </div>
          <div className="flex-1 grid grid-cols-[0.5fr_1fr_1.2fr_1fr_0.8fr_0.5fr] gap-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">BK</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">Date</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">For Month</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">Amount</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">Duration</span>
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">MP</span>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 no-scrollbar">
        {loadingResidents ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw className="text-indigo-500 animate-spin" size={24} />
            <p className="text-sm text-neutral-500 font-medium">Loading owners...</p>
          </div>
        ) : owners.map((owner, idx) => (
          <div key={idx} className={cn(
            "p-3 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center gap-4",
            owner.selected ? "bg-indigo-900/10 border-indigo-500/20" : "bg-neutral-800/30 border-neutral-700",
            (owner.alreadyPaid && !owner.allowMultiple) && "opacity-40 grayscale"
          )}>
            <div className={cn(
              "flex items-center gap-3 min-w-[180px]",
              (owner.alreadyPaid && !owner.allowMultiple) && "pointer-events-none"
            )}>
              <input 
                type="checkbox" 
                checked={owner.selected}
                disabled={owner.alreadyPaid && !owner.allowMultiple}
                onChange={() => {
                  const newOwners = [...owners];
                  newOwners[idx].selected = !newOwners[idx].selected;
                  setOwners(newOwners);
                }}
                className="w-5 h-5 rounded-lg bg-neutral-700 border-neutral-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <div className="flex flex-col">
                <p className="text-sm font-bold text-neutral-100 truncate">{owner.flatNumber} {owner.displayName}</p>
                {owner.alreadyPaid && (
                  <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                    <AlertCircle size={10} />
                    Already Paid
                  </span>
                )}
                {(() => {
                  const currentMonthKey = `${owner.forYear}-${String(MONTHS.indexOf(owner.forMonth) + 1).padStart(2, '0')}`;
                  const lastPaid = payments
                    .filter(p => p.ownerUid === owner.uid && (p.status === 'paid' || p.status === 'PAID'))
                    .sort((a, b) => b.month.localeCompare(a.month))[0]?.month;
                  
                  if (lastPaid && currentMonthKey > lastPaid) {
                    const [ly, lm] = lastPaid.split('-').map(Number);
                    const nextDate = new Date(ly, lm, 1);
                    const nextMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
                    
                    if (currentMonthKey > nextMonthKey) {
                      return (
                        <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                          <AlertTriangle size={10} />
                          Out of Order (Expected: {MONTHS[nextDate.getMonth()]} {nextDate.getFullYear()})
                        </span>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-[0.5fr_1fr_1.2fr_1fr_0.8fr_0.5fr] gap-2 items-center">
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const newOwners = [...owners];
                    newOwners[idx].isBulk = !newOwners[idx].isBulk;
                    if (!newOwners[idx].isBulk) {
                      newOwners[idx].customAmount = 1200;
                      newOwners[idx].months = 1;
                    }
                    setOwners(newOwners);
                  }}
                  className={cn(
                    "w-8 h-8 rounded-lg text-[10px] font-black transition-all border",
                    owner.isBulk 
                      ? "bg-amber-600 text-white border-amber-400 shadow-lg shadow-amber-900/20" 
                      : "bg-neutral-800 text-neutral-500 border-neutral-700 hover:border-neutral-600"
                  )}
                  title="Bulk Payment Mode"
                >
                  BK
                </button>
              </div>

              <div className={cn("relative", (owner.alreadyPaid && !owner.allowMultiple) && "pointer-events-none")}>
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" size={10} />
                <input 
                  type="date" 
                  value={format(owner.date, 'yyyy-MM-dd')}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  onFocus={(e) => (e.currentTarget as any).showPicker?.()}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    newOwners[idx].date = new Date(e.target.value);
                    setOwners(newOwners);
                  }}
                  className="w-full pl-6 pr-2 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer relative"
                />
              </div>
              <div className={cn("relative flex gap-1 items-center", (owner.alreadyPaid && !owner.allowMultiple) && "pointer-events-none")}>
                <select
                  value={owner.forMonth}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    const newMonth = e.target.value;
                    newOwners[idx].forMonth = newMonth;
                    
                    // Re-check paid status
                    const monthKey = `${newOwners[idx].forYear}-${String(MONTHS.indexOf(newMonth) + 1).padStart(2, '0')}`;
                    newOwners[idx].alreadyPaid = payments.some(p => p.ownerUid === owner.uid && p.month === monthKey && (p.status === 'paid' || p.status === 'PAID'));
                    
                    setOwners(newOwners);
                  }}
                  className="flex-1 min-w-[45px] px-1 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input 
                  type="number"
                  value={owner.forYear}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    const newYear = Number(e.target.value);
                    newOwners[idx].forYear = newYear;

                    // Re-check paid status
                    const monthKey = `${newYear}-${String(MONTHS.indexOf(newOwners[idx].forMonth) + 1).padStart(2, '0')}`;
                    newOwners[idx].alreadyPaid = payments.some(p => p.ownerUid === owner.uid && p.month === monthKey && (p.status === 'paid' || p.status === 'PAID'));

                    setOwners(newOwners);
                  }}
                  className="w-12 px-1 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className={cn("relative", (owner.alreadyPaid && !owner.allowMultiple) && "pointer-events-none")}>
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600 text-[10px]">₹</span>
                <input 
                  type="number"
                  value={owner.customAmount}
                  disabled={!owner.isBulk}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    const val = Number(e.target.value);
                    newOwners[idx].customAmount = val;
                    // Auto-calculate months based on amount (1200 per month)
                    newOwners[idx].months = Math.max(1, Math.floor(val / 1200));
                    setOwners(newOwners);
                  }}
                  className={cn(
                    "w-full pl-5 pr-2 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] font-bold focus:ring-1 focus:ring-indigo-500 outline-none",
                    owner.isBulk ? "text-emerald-400" : "text-neutral-500"
                  )}
                />
                {owner.isBulk && owner.customAmount !== owner.months * 1200 && (
                  <span className="absolute -top-4 left-0 text-[7px] text-amber-500 font-black whitespace-nowrap uppercase">
                    Mismatch (Exp: ₹{owner.months * 1200})
                  </span>
                )}
              </div>
              <div className="text-center">
                {owner.isBulk ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex items-center justify-center gap-1">
                      <input 
                        type="number"
                        min="1"
                        max="60"
                        value={owner.months}
                        onChange={(e) => {
                          const newOwners = [...owners];
                          const val = Math.max(1, Number(e.target.value));
                          newOwners[idx].months = val;
                          // Auto-update amount based on months (1200 per month)
                          newOwners[idx].customAmount = val * 1200;
                          setOwners(newOwners);
                        }}
                        className="w-10 px-1 py-1 bg-neutral-800/50 border border-neutral-700 rounded text-[10px] text-center font-bold text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                      <span className="text-[8px] font-bold text-neutral-500 uppercase">Mos</span>
                    </div>
                    {owner.months > 1 && (
                      <span className="text-[7px] text-neutral-500 font-bold uppercase whitespace-nowrap">
                        Until {MONTHS[(MONTHS.indexOf(owner.forMonth) + owner.months - 1) % 12]} {owner.forYear + Math.floor((MONTHS.indexOf(owner.forMonth) + owner.months - 1) / 12)}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-neutral-500 uppercase">
                    {owner.months} {owner.months === 1 ? 'Mo' : 'Mos'}
                  </span>
                )}
              </div>
              <div className="flex justify-center">
                <input 
                  type="checkbox"
                  checked={owner.allowMultiple}
                  onChange={() => {
                    const newOwners = [...owners];
                    newOwners[idx].allowMultiple = !newOwners[idx].allowMultiple;
                    setOwners(newOwners);
                  }}
                  className="w-4 h-4 rounded bg-neutral-800 border-neutral-700 text-indigo-600 focus:ring-indigo-500"
                  title="Allow Multiple Payment (MP)"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-rose-900/30 border border-rose-800 rounded-2xl text-rose-400 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-4">
        <button 
          onClick={onClose}
          className="flex-1 px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl font-bold transition-all"
        >
          Cancel
        </button>
        <button 
          onClick={handlePost}
          disabled={saving}
          className="flex-[2] px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save size={20} />
              Post {owners.filter(o => o.selected).length} Entries
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function PendingTicker({ users, payments }: { users: UserProfile[], payments: PaymentRecord[] }) {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const today = new Date().getDate();
  
  const pendingFlats = useMemo(() => {
    const pending: { flat: string, month: string, year: number }[] = [];
    
    // Check if we are past the 10th of the current month
    // If yes, we check for unpaid dues up to the PREVIOUS month
    if (today > 10) {
      const SYSTEM_START_MONTH = 4; // May (0-indexed)
      const SYSTEM_START_YEAR = 2025;
      
      // We check from system start up to the previous month
      const checkUntil = new Date(currentYear, currentMonth - 1, 1);
      
      ALL_FLATS.forEach(f => {
        const flat = normalizeFlat(f.flat);
        const flatPayments = payments.filter(p => normalizeFlat(p.flatNumber) === flat && p.status === 'paid');
        
        // Iterate from start to checkUntil
        let iterDate = new Date(SYSTEM_START_YEAR, SYSTEM_START_MONTH, 1);
        while (iterDate <= checkUntil) {
          const monthKey = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, '0')}`;
          const isPaid = flatPayments.some(p => p.month === monthKey);
          
          if (!isPaid) {
            pending.push({
              flat: f.flat,
              month: MONTHS[iterDate.getMonth()],
              year: iterDate.getFullYear()
            });
          }
          iterDate.setMonth(iterDate.getMonth() + 1);
        }
      });
    }
    return pending;
  }, [payments, currentMonth, currentYear, today]);

  return (
    <div className={cn(
      "py-4 overflow-hidden whitespace-nowrap relative border-y-2",
      pendingFlats.length > 0 ? "bg-rose-950/40 border-rose-900/50" : "bg-emerald-950/40 border-emerald-900/50"
    )}>
      <div className="flex animate-marquee items-center w-max">
        {[0, 1, 2].map((set) => (
          <div key={set} className="flex items-center gap-16 pr-16">
            {pendingFlats.length > 0 ? (
              <>
                <div className="flex items-center gap-4 text-rose-400 font-black text-lg uppercase tracking-widest">
                  <AlertCircle size={24} />
                  Pending Dues:
                </div>
                {pendingFlats.map((p, i) => (
                  <span key={i} className="text-neutral-100 text-lg font-bold">
                    Flat {p.flat} ({p.month} {p.year})
                  </span>
                ))}
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 text-emerald-400 font-black text-lg uppercase tracking-widest">
                  <CheckCircle2 size={24} />
                  All Maintenance Dues are Clear!
                </div>
                <span className="text-neutral-100 text-lg font-bold">Great job, everyone!</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function StatCard({ label, value, icon, color, subtitle }: { label: string, value: string, icon?: React.ReactNode, color: string, subtitle?: string }) {
  const colorVariants: Record<string, string> = {
    "blue": "border-blue-900/30 bg-blue-950/10",
    "green": "border-green-900/30 bg-green-950/10",
    "orange": "border-orange-900/30 bg-orange-950/10",
    "indigo": "border-indigo-900/30 bg-indigo-950/10",
    "rose": "border-rose-900/30 bg-rose-950/10"
  };

  const valueColorVariants: Record<string, string> = {
    "blue": "text-blue-400",
    "green": "text-green-400",
    "orange": "text-orange-400",
    "indigo": "text-indigo-400",
    "rose": "text-rose-400"
  };

  return (
    <div className={cn(
      "p-6 rounded-3xl border shadow-sm flex flex-col gap-2 transition-all hover:shadow-lg hover:border-neutral-700", 
      colorVariants[color] || "bg-neutral-900 border-neutral-800"
    )}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{label}</p>
        {icon && <div className="text-neutral-500">{icon}</div>}
      </div>
      <p className={cn("text-3xl font-black", valueColorVariants[color] || "text-neutral-100")}>{value}</p>
      {subtitle && <p className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest mt-1">{subtitle}</p>}
    </div>
  );
}

function Directory({ users }: { users: UserProfile[] }) {
  const committeeMembers = [
    { name: 'SINDHU V', role: 'PRESIDENT', phone: '9846175556' },
    { name: 'JAYAN K R', role: 'SECRETARY', phone: '7012128339' },
    { name: 'USHA G MENON', role: 'TREASURER', phone: '9746701449' }
  ];

  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.flatNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phone || '').includes(searchTerm)
  ).sort((a, b) => (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true }));

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-bold text-white mb-2">Apartment Directory</h2>
        <p className="text-neutral-500">Contact information for committee members, owners, and tenants.</p>
      </header>

      {/* Committee Members */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-indigo-400 flex items-center gap-2">
          <ShieldCheck size={20} />
          Committee Members
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {committeeMembers.map((member, idx) => (
            <div key={idx} className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-3xl hover:border-indigo-500/30 transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                  <UserIcon size={24} />
                </div>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {member.role}
                </span>
              </div>
              <h4 className="text-lg font-bold text-white mb-1">{member.name}</h4>
              <div className="flex items-center gap-2 text-neutral-400">
                <Phone size={14} />
                <a href={`tel:${member.phone}`} className="text-sm hover:text-indigo-400 transition-colors">
                  {member.phone}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Owner & Tenant List */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
            <Users size={20} />
            Owners & Tenants
          </h3>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
            <input 
              type="text"
              placeholder="Search by name, flat, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-neutral-900 border-b border-neutral-800">
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Flat</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Owner Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Owner Phone</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Tenant Details</th>
                  <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Email ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => {
                    const cleanFlat = (user.flatNumber || '')
                      .replace(/[^a-zA-Z0-9]/g, '')
                      .replace(/([a-zA-Z])0+/, '$1')
                      .toUpperCase();
                    
                    const ownerPhone = user.phone || OWNER_PHONE_MAPPING[cleanFlat] || 'N/A';
                    const tenant = TENANT_MAPPING[cleanFlat];

                    return (
                      <tr key={user.uid} className="hover:bg-neutral-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="text-xl font-black text-emerald-400 tracking-tight">
                            {user.flatNumber || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={user.photoURL} className="w-10 h-10 rounded-full border border-neutral-800 shadow-sm" alt="" />
                            <span className="text-lg font-bold text-neutral-100 group-hover:text-emerald-400 transition-colors">{user.displayName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-neutral-200">
                            <Phone size={14} className="text-neutral-500" />
                            <a href={`tel:${ownerPhone}`} className="text-base font-bold hover:text-emerald-400 transition-colors">
                              {ownerPhone}
                            </a>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {tenant ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider">{tenant.name}</span>
                              <div className="flex items-center gap-2 text-neutral-400">
                                <Phone size={12} className="text-neutral-600" />
                                <a href={`tel:${tenant.phone}`} className="text-xs font-semibold hover:text-indigo-400 transition-colors">
                                  {tenant.phone}
                                </a>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-neutral-600 italic">Self Occupied</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-neutral-400">
                            <FileText size={14} className="text-neutral-600" />
                            <span className="text-sm font-medium">{user.email}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                      No entries found matching your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function UserManagement({ users, currentUser, isSuperAdmin, isAdmin }: { users: UserProfile[], currentUser: UserProfile, isSuperAdmin: boolean, isAdmin: boolean }) {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [flatNumber, setFlatNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [copying, setCopying] = useState(false);
  
  // Create User Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newFlat, setNewFlat] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('owner');
  const [hasNoEmail, setHasNoEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [transferringUser, setTransferringUser] = useState<UserProfile | null>(null);
  const [transferName, setTransferName] = useState('');
  const [transferEmail, setTransferEmail] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferNoEmail, setTransferNoEmail] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [confirmingRoleChange, setConfirmingRoleChange] = useState<{ user: UserProfile, newRole: UserRole } | null>(null);

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const flatA = a.flatNumber || '';
      const flatB = b.flatNumber || '';
      // Natural sort for flat numbers (A1, A2, ..., F3)
      return flatA.localeCompare(flatB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [users]);

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    if (deletingUser.uid === currentUser.uid) {
      setDeletingUser(null);
      return;
    }
    
    setIsDeleting(true);
    try {
      console.log(`Attempting to delete user: ${deletingUser.uid}`);
      await deleteDoc(doc(db, 'users', deletingUser.uid));
      setDeletingUser(null);
    } catch (error) {
      console.error("Delete failed:", error);
      handleFirestoreError(error, OperationType.DELETE, `users/${deletingUser.uid}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      // 1. Create secondary app instance to create user without signing out admin
      const secondaryApp = initializeApp(config, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      // If no email, generate a placeholder
      const emailToUse = hasNoEmail ? `${newFlat.replace(/\s+/g, '').toLowerCase()}@whitepalace.internal` : newEmail;
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, newPassword);
      const uid = userCredential.user.uid;

      // 2. Create Firestore profile
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: emailToUse,
        displayName: newName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=random`,
        role: newRole,
        flatNumber: newFlat,
        phone: newPhone,
        createdAt: serverTimestamp(),
        mustChangePassword: true,
        hasNoEmail: hasNoEmail,
        tempPassword: newPassword // Store temp password for admin reference
      });

      // 3. Clean up secondary app
      await deleteApp(secondaryApp);

      setShowCreate(false);
      setNewEmail('');
      setNewName('');
      setNewFlat('');
      setNewPassword('');
      setNewRole('owner');
      setHasNoEmail(false);
      toast.success('Owner created successfully!');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create owner');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (uid: string, currentRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 
        displayName: editName,
        flatNumber: flatNumber,
        phone: editPhone,
        role: currentRole // Keep role for now, or add role select if needed
      });
      setEditingUser(null);
      setFlatNumber('');
      setEditName('');
      setEditPhone('');
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const toggleRole = (user: UserProfile) => {
    let newRole: UserRole = 'owner';
    if (user.role === 'owner') newRole = 'admin';
    else if (user.role === 'admin') newRole = 'superadmin';
    else if (user.role === 'superadmin') newRole = 'owner';
    
    setConfirmingRoleChange({ user, newRole });
  };

  const handleConfirmRoleChange = async () => {
    if (!confirmingRoleChange) return;
    const { user, newRole } = confirmingRoleChange;
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
      toast.success(`Role updated for ${user.displayName}`);
    } catch (error) {
      console.error("Role update failed:", error);
      toast.error("Failed to update role");
    } finally {
      setConfirmingRoleChange(null);
    }
  };

  const handleTransferOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringUser) return;
    setIsTransferring(true);
    try {
      const flat = transferringUser.flatNumber;
      if (!flat) throw new Error("User has no flat number");

      // 1. Create new user
      const secondaryApp = initializeApp(config, 'Transfer');
      const secondaryAuth = getAuth(secondaryApp);
      const emailToUse = transferNoEmail ? `${flat.replace(/\s+/g, '').toLowerCase()}@whitepalace.internal` : transferEmail;
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailToUse, transferPassword);
      const newUid = userCredential.user.uid;

      // 2. Create new Firestore profile
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        email: emailToUse,
        displayName: transferName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(transferName)}&background=random`,
        role: 'owner',
        flatNumber: flat,
        createdAt: serverTimestamp(),
        mustChangePassword: true,
        hasNoEmail: transferNoEmail,
        tempPassword: transferPassword
      });

      // 3. Delete old user profile
      await deleteDoc(doc(db, 'users', transferringUser.uid));

      // Note: Payments are linked by flatNumber, so they stay visible to the new owner.

      await deleteApp(secondaryApp);
      setTransferringUser(null);
      toast.success(`Ownership of ${flat} transferred to ${transferName}`);
    } catch (error: any) {
      console.error("Transfer failed:", error);
      toast.error(error.message || "Transfer failed");
    } finally {
      setIsTransferring(false);
    }
  };

  const copyLink = () => {
    const origin = window.location.origin.replace('-dev-', '-pre-');
    navigator.clipboard.writeText(origin);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Owner Management</h2>
          <p className="text-sm text-neutral-500">Manage flat assignments and roles for all owners.</p>
        </div>
        
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-900/20"
            >
              <Plus size={20} />
              Create Owner
            </button>

            {isSuperAdmin && (
              <>
                <button 
                  onClick={() => {
                    toast.promise(new Promise(resolve => setTimeout(resolve, 800)), {
                      loading: 'Syncing owners...',
                      success: 'Owner list synced successfully',
                      error: 'Failed to sync owners',
                    });
                  }}
                  className="px-4 py-3 bg-neutral-800 text-neutral-300 rounded-2xl font-bold flex items-center gap-2 hover:bg-neutral-700 transition-all border border-neutral-700"
                >
                  <RefreshCw size={18} />
                  Sync Owners
                </button>
                
                <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-sm flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Invite Owners</span>
                    <span className="text-xs font-mono text-neutral-400 truncate max-w-[150px]">{window.location.origin}</span>
                  </div>
                  <button 
                    onClick={copyLink}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                      copying ? "bg-green-900/30 text-green-400" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    )}
                  >
                    {copying ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-neutral-100">Create New Owner Account</h3>
                <button onClick={() => setShowCreate(false)} className="text-neutral-500 hover:text-neutral-300">
                  <AlertCircle size={24} className="rotate-45" />
                </button>
              </div>
              
              <form onSubmit={handleCreateResident} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-neutral-500 uppercase">Email Address</label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={hasNoEmail}
                          onChange={(e) => setHasNoEmail(e.target.checked)}
                          className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-bold text-neutral-500 group-hover:text-neutral-400 transition-colors uppercase tracking-wider">No Email</span>
                      </label>
                    </div>
                    <input 
                      type="email" 
                      required={!hasNoEmail}
                      disabled={hasNoEmail}
                      value={hasNoEmail ? `${newFlat.replace(/\s+/g, '').toLowerCase()}@whitepalace.internal` : newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={cn(
                        "w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600 transition-all",
                        hasNoEmail && "opacity-50 cursor-not-allowed"
                      )}
                      placeholder={hasNoEmail ? "Auto-generated internal email" : "john@example.com"}
                    />
                    {hasNoEmail && (
                      <p className="mt-1.5 text-[10px] text-neutral-500 italic">
                        An internal email will be generated for this owner.
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Flat Number</label>
                    <input 
                      type="text" 
                      required
                      value={newFlat}
                      onChange={(e) => setNewFlat(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                      placeholder="A-101"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Temporary Password</label>
                    <input 
                      type="text" 
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                      placeholder="Set a temporary password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Phone Number</label>
                    <input 
                      type="tel" 
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                      placeholder="9847448093"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Account Role</label>
                    <select 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin (Staff)</option>
                    </select>
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center justify-between pt-4 border-t border-neutral-800">
                  {createError && <p className="text-sm text-red-400 font-medium">{createError}</p>}
                  <div className="flex items-center gap-3 ml-auto">
                    <button 
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="px-6 py-3 text-neutral-500 font-bold hover:text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={creating}
                      className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                    >
                      {creating ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-800/50 border-b border-neutral-800">
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Owner</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Flat</th>
              {isAdmin && <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Login Credentials</th>}
              {isSuperAdmin && <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>}
              {isAdmin && <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {sortedUsers.map(user => (
              <tr key={user.uid} className="hover:bg-neutral-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL} className="w-10 h-10 rounded-full border border-neutral-800" alt="" />
                    <div>
                      {isAdmin && editingUser?.uid === user.uid ? (
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            value={editName} 
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Full Name"
                            className="w-full px-3 py-1 bg-neutral-800 border-neutral-700 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                          />
                          <input 
                            type="tel" 
                            value={editPhone} 
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="Phone Number"
                            className="w-full px-3 py-1 bg-neutral-800 border-neutral-700 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                          />
                        </div>
                      ) : (
                        <div>
                          <p className="font-bold text-neutral-100">{user.displayName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Phone size={10} className="text-emerald-500" />
                            <p className="text-[10px] text-emerald-500 font-bold tracking-wider">{user.phone || OWNER_PHONE_MAPPING[extractFlatNumber(user.flatNumber || '')] || 'No Phone'}</p>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-neutral-500 truncate max-w-[150px]">{user.email}</p>
                    </div>
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">ID:</span>
                        <span className="text-xs font-mono text-neutral-300">{user.flatNumber || 'N/A'}</span>
                      </div>
                      {user.tempPassword && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Pass:</span>
                          <span className="text-xs font-mono text-neutral-300">{user.tempPassword}</span>
                        </div>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4">
                  {isAdmin && editingUser?.uid === user.uid ? (
                    <input 
                      type="text" 
                      value={flatNumber} 
                      onChange={(e) => setFlatNumber(e.target.value)}
                      placeholder="Flat #"
                      className="w-24 px-3 py-1 bg-neutral-800 border-neutral-700 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    />
                  ) : (
                    <span className={cn(
                      "font-medium",
                      user.flatNumber ? "text-neutral-300" : "text-red-400 italic text-sm"
                    )}>
                      {user.flatNumber || 'Unassigned'}
                    </span>
                  )}
                </td>
                {isSuperAdmin && (
                  <td className="px-6 py-4">
                      <button 
                        onClick={() => isSuperAdmin && toggleRole(user)}
                        disabled={!isSuperAdmin}
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-1 rounded-md transition-all",
                          isSuperAdmin ? "hover:opacity-80 cursor-pointer" : "cursor-default",
                          user.role === 'superadmin' ? "bg-amber-900/30 text-amber-400 border border-amber-900/50" :
                          user.role === 'admin' ? "bg-indigo-900/30 text-indigo-400 border border-indigo-900/50" : 
                          "bg-neutral-800 text-neutral-400 border border-neutral-700"
                        )}
                      >
                        {user.role === 'superadmin' ? 'Super Admin' : user.role}
                      </button>
                  </td>
                )}
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    {editingUser?.uid === user.uid ? (
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleUpdateUser(user.uid, user.role)} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm">Save</button>
                        <button onClick={() => setEditingUser(null)} className="text-neutral-500 hover:text-neutral-400 font-bold text-sm">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-4">
                        <button 
                          onClick={() => {
                            setEditingUser(user);
                            setFlatNumber(user.flatNumber || '');
                            setEditName(user.displayName || '');
                            setEditPhone(user.phone || '');
                          }} 
                          className="text-neutral-500 hover:text-neutral-100 transition-colors font-medium text-sm"
                        >
                          Edit Profile
                        </button>
                        <button 
                          onClick={() => {
                            setTransferName('');
                            setTransferEmail('');
                            setTransferPassword('');
                            setTransferNoEmail(user.hasNoEmail || false);
                            setTransferringUser(user);
                          }}
                          className="text-emerald-500 hover:text-emerald-400 transition-colors font-medium text-sm"
                        >
                          Transfer
                        </button>
                        {isSuperAdmin && user.uid !== currentUser.uid && (
                          <button 
                            onClick={() => setDeletingUser(user)}
                            className="text-neutral-500 hover:text-red-400 transition-all p-2 hover:bg-red-900/20 rounded-lg group"
                            title="Delete Owner"
                          >
                            <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingUser && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-sm p-8 rounded-3xl shadow-2xl border border-neutral-800 text-center"
          >
            <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-neutral-100 mb-2">Delete Owner</h3>
            <p className="text-neutral-500 mb-8">
              Are you sure you want to delete <span className="text-neutral-200 font-bold">{deletingUser.displayName}</span>? 
              This action cannot be undone and will remove all their profile data.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingUser(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteUser}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {transferringUser && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-md w-full bg-neutral-900 p-8 rounded-3xl shadow-2xl border border-neutral-800"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-500">
                  <RefreshCw size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-neutral-100">Transfer Ownership</h3>
                  <p className="text-xs text-neutral-500">Flat {transferringUser.flatNumber}</p>
                </div>
              </div>

              <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
                This will create a new account for the new owner of <strong>Flat {transferringUser.flatNumber}</strong>. 
                The previous owner's account will be removed, but the payment history will remain linked to the flat.
              </p>

              <form onSubmit={handleTransferOwnership} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">New Owner Name</label>
                  <input 
                    type="text" 
                    required
                    value={transferName}
                    onChange={(e) => setTransferName(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-neutral-500 uppercase">New Email Address</label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={transferNoEmail}
                        onChange={(e) => setTransferNoEmail(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-700 bg-neutral-800 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">No Email</span>
                    </label>
                  </div>
                  <input 
                    type="email" 
                    required={!transferNoEmail}
                    disabled={transferNoEmail}
                    value={transferNoEmail ? `${transferringUser.flatNumber?.replace(/\s+/g, '').toLowerCase()}@whitepalace.internal` : transferEmail}
                    onChange={(e) => setTransferEmail(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600 transition-all",
                      transferNoEmail && "opacity-50 cursor-not-allowed"
                    )}
                    placeholder={transferNoEmail ? "Auto-generated internal email" : "jane@example.com"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">New Temporary Password</label>
                  <input 
                    type="text" 
                    required
                    value={transferPassword}
                    onChange={(e) => setTransferPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    placeholder="Set a temporary password"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setTransferringUser(null)}
                    className="flex-1 py-3 text-neutral-500 font-bold hover:text-neutral-300"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isTransferring}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isTransferring ? 'Transferring...' : 'Confirm Transfer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmingRoleChange && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 w-full max-w-sm p-8 rounded-3xl shadow-2xl border border-neutral-800 text-center"
            >
              <div className="w-16 h-16 bg-amber-900/30 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-100 mb-2">Confirm Role Change</h3>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to change <span className="text-neutral-200 font-bold">{confirmingRoleChange.user.displayName}</span>'s role to <span className="text-amber-500 font-bold uppercase">{confirmingRoleChange.newRole}</span>?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmingRoleChange(null)}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmRoleChange}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-900/20"
                >
                  Change Role
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


function AnnouncementManagement({ announcements, isAdmin, isSuperAdmin, profile }: { announcements: Announcement[], isAdmin: boolean, isSuperAdmin: boolean, profile: UserProfile }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [confirmingDeletion, setConfirmingDeletion] = useState<string | null>(null);

  const handlePost = async () => {
    try {
      await addDoc(collection(db, 'announcements'), {
        title,
        content,
        authorUid: profile.uid,
        createdAt: serverTimestamp()
      });
      setShowAddModal(false);
      setTitle('');
      setContent('');
      toast.success("Announcement posted");
    } catch (error) {
      console.error("Post failed:", error);
      toast.error("Failed to post announcement");
    }
  };

  const handleDelete = (id: string) => {
    setConfirmingDeletion(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmingDeletion) return;
    try {
      await deleteDoc(doc(db, 'announcements', confirmingDeletion));
      toast.success("Announcement deleted");
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete announcement");
    } finally {
      setConfirmingDeletion(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-100">Announcements</h2>
        {isAdmin && (
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
          >
            <Plus size={20} />
            Post New
          </button>
        )}
      </div>

      <div className="space-y-4">
        {announcements.map(ann => (
          <div key={ann.id} className="bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-sm relative group">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {format(ann.createdAt?.toDate() || new Date(), 'MMMM d, yyyy')}
              </span>
              {isSuperAdmin && (
                <button 
                  onClick={() => handleDelete(ann.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all"
                >
                  Delete
                </button>
              )}
            </div>
            <h3 className="text-xl font-bold text-neutral-100 mb-3">{ann.title}</h3>
            <p className="text-neutral-400 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
          </div>
        ))}
        {announcements.length === 0 && (
          <div className="text-center py-20 bg-neutral-900 rounded-3xl border border-dashed border-neutral-800">
            <Megaphone className="mx-auto text-neutral-800 mb-4" size={48} />
            <p className="text-neutral-500 font-medium">No announcements yet.</p>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <h3 className="text-2xl font-bold text-neutral-100 mb-6">Post New Announcement</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Important update about..."
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Content</label>
                <textarea 
                  rows={6}
                  value={content} 
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your message here..."
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-neutral-100 placeholder:text-neutral-600"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 text-neutral-500 font-bold hover:bg-neutral-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handlePost}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all"
              >
                Post Announcement
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {confirmingDeletion && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 w-full max-w-sm p-8 rounded-3xl shadow-2xl border border-neutral-800 text-center"
            >
              <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-neutral-100 mb-2">Delete Announcement</h3>
              <p className="text-neutral-500 mb-8">
                Are you sure you want to delete this announcement? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmingDeletion(null)}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentReport({ accounts, payments, residents, isAdmin, isSuperAdmin }: { accounts: AccountEntry[], payments: PaymentRecord[], residents: UserProfile[], isAdmin: boolean, isSuperAdmin: boolean }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredCell, setHoveredCell] = useState<{ flat: string, month: number } | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  
  const owners = useMemo(() => {
    if (!residents || residents.length === 0) {
      return ALL_FLATS.map(f => ({
        uid: `temp-${f.flat}`,
        displayName: f.name.toUpperCase(),
        flatNumber: f.flat,
        role: 'owner' as UserRole
      }));
    }

    // Create a map of registered owners by flat number
    const registeredOwners = new Map(
      residents
        .filter(r => r.role === 'owner')
        .map(r => [normalizeFlat(r.flatNumber), r])
    );

    // Merge with master list of flats
    return ALL_FLATS.map(f => {
      const registered = registeredOwners.get(normalizeFlat(f.flat));
      return {
        uid: registered?.uid || `temp-${f.flat}`,
        displayName: (registered?.displayName || f.name).toUpperCase(),
        flatNumber: f.flat,
        role: 'owner' as UserRole
      };
    });
  }, [residents]);

  const VALID_FLATS = useMemo(() => new Set(ALL_FLATS.map(f => normalizeFlat(f.flat))), []);

  const paymentMap = useMemo(() => {
    const map = new Map<string, Map<string, any>>(); // flat -> "YYYY-MM" -> data

    // 0. Create a map of account dates for quick lookup
    const accountDates = new Map();
    accounts.forEach(acc => {
      const d = acc.date instanceof Date ? acc.date : acc.date?.toDate();
      if (d) accountDates.set(acc.id, d);
      // Also store originalPaymentDate for shadow entries
      const od = acc.originalPaymentDate instanceof Date ? acc.originalPaymentDate : acc.originalPaymentDate?.toDate();
      if (od) accountDates.set(acc.id, od);
    });

    // 1. Process accounts (manual entries)
    accounts.forEach(acc => {
      if (acc.income === 0 && !acc.isAdvanceAllocation) return;
      if (acc.isOpeningBalance || acc.isWithdrawal) return;

      const particulars = acc.particulars || '';
      
      let flat = normalizeFlat(acc.flatNumber) || 'N/A';
      let description = '';

      if (flat === 'N/A' || !VALID_FLATS.has(flat)) {
        // Try to parse from particulars
        const match = particulars.match(/^([A-Z]\s\d+)\s+(.*?)\s*\((.*?)\)$/i) || 
                      particulars.match(/^([A-Z]\d+)\s+(.*?)\s*\((.*?)\)$/i) ||
                      particulars.match(/^([A-Z0-9]+)\s+(.*?)\s*\((.*?)\)$/i);
        
        if (match) {
          flat = normalizeFlat(match[1]);
          description = match[3];
        } else {
          // Fallback: Try to find any flat number from ALL_FLATS in the particulars
          const foundFlat = ALL_FLATS.find(f => 
            particulars.startsWith(f.flat) ||
            particulars.includes(` ${f.flat} `)
          );
          
          if (foundFlat) {
            flat = normalizeFlat(foundFlat.flat);
          } else {
            // Check if the first word is a valid flat
            const firstWord = normalizeFlat(particulars.split(' ')[0]);
            if (VALID_FLATS.has(firstWord)) {
              flat = firstWord;
            } else {
              flat = 'N/A';
            }
          }
          
          // Try to extract description from parentheses if present
          const parenMatch = particulars.match(/\((.*?)\)/);
          description = parenMatch ? parenMatch[1] : particulars;
        }
      } else {
        // Use explicit flatNumber and extract description from particulars
        const parenMatch = particulars.match(/\((.*?)\)/);
        description = parenMatch ? parenMatch[1] : particulars;
      }
      
      // Final check for valid flat
      if (!VALID_FLATS.has(flat)) return;
      
      // Only include if it's likely a maintenance payment
      const isMaintenance = 
        acc.isAdvanceAllocation || 
        particulars.toLowerCase().includes('maintenance') || 
        MONTHS.some(m => particulars.toUpperCase().includes(m)) ||
        description.toLowerCase().includes('maintenance');

      if (!isMaintenance && acc.income > 0) return;

      if (!map.has(flat)) map.set(flat, new Map());
      const flatMap = map.get(flat)!;

      const dateObj = acc.date instanceof Date ? acc.date : acc.date?.toDate();
      
      if (acc.isAdvanceAllocation) {
        // Shadow entries explicitly have forMonth and forYear
        const monthIdx = MONTHS.indexOf(acc.forMonth || '');
        if (monthIdx !== -1) {
          const key = `${acc.forYear}-${String(monthIdx).padStart(2, '0')}`;
          flatMap.set(key, {
            id: acc.id,
            amount: acc.displayAmount || 0,
            date: acc.originalPaymentDate?.toDate() || null,
            source: 'Manual (Advance)',
            particulars: acc.particulars,
            period: `${acc.forMonth} ${acc.forYear}`,
            collection: 'accounts',
            parentAccountId: acc.parentAccountId,
            installmentIndex: acc.installmentIndex,
            totalInstallments: acc.totalInstallments
          });
        }
      } else if (acc.income > 0) {
        // Main entries might cover multiple months. 
        if (description.includes(' to ')) {
          // Range payment: e.g. "JAN to MAR"
          const parts = description.replace('Advance: ', '').split(' to ');
          const fromMonth = parts[0].trim().split(' ')[0];
          const toMonth = parts[1].trim().split(' ')[0];
          const year = parseInt(parts[1].trim().split(' ')[1]) || dateObj?.getFullYear() || selectedYear;
          
          const startIdx = MONTHS.indexOf(fromMonth);
          const endIdx = MONTHS.indexOf(toMonth);
          
          if (startIdx !== -1 && endIdx !== -1) {
            const count = (endIdx - startIdx + 12) % 12 + 1;
            const monthlyAmount = acc.income / count;
            for (let i = 0; i < count; i++) {
              const mIdx = (startIdx + i) % 12;
              const mYear = year + Math.floor((startIdx + i) / 12);
              const key = `${mYear}-${String(mIdx).padStart(2, '0')}`;
              // Only set if not already set by a shadow entry (to avoid double counting)
              if (!flatMap.has(key)) {
                flatMap.set(key, {
                  id: acc.id,
                  amount: monthlyAmount,
                  date: dateObj,
                  source: 'Manual',
                  particulars: acc.particulars,
                  period: description,
                  collection: 'accounts'
                });
              }
            }
          }
        } else {
          // Single month payment
          const descParts = description.trim().split(' ');
          const monthPart = descParts[0];
          const yearPart = parseInt(descParts[1]) || dateObj?.getFullYear() || selectedYear;
          const mIdx = MONTHS.indexOf(monthPart);
          if (mIdx !== -1) {
            const key = `${yearPart}-${String(mIdx).padStart(2, '0')}`;
            flatMap.set(key, {
              id: acc.id,
              amount: acc.income,
              date: dateObj,
              source: 'Manual',
              particulars: acc.particulars,
              period: description,
              collection: 'accounts'
            });
          } else if (dateObj) {
            // Fallback to payment date if description parsing fails
            const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, '0')}`;
            if (!flatMap.has(key)) {
              flatMap.set(key, {
                id: acc.id,
                amount: acc.income,
                date: dateObj,
                source: 'Manual',
                particulars: acc.particulars,
                period: description,
                collection: 'accounts'
              });
            }
          }
        }
      }
    });

    // 2. Process online payments
    payments.forEach(p => {
      if (p.status !== 'paid' && p.status !== 'PAID') return;
      const flat = normalizeFlat(p.flatNumber);
      if (!map.has(flat)) map.set(flat, new Map());
      const flatMap = map.get(flat)!;

      const [year, month] = p.month.split('-').map(Number);
      const key = `${year}-${String(month - 1).padStart(2, '0')}`;
      
      const dateObjFromAccount = p.parentAccountId ? accountDates.get(p.parentAccountId) : null;
      const dateObj = dateObjFromAccount || (p.paidAt instanceof Date ? p.paidAt : p.paidAt?.toDate() || p.createdAt?.toDate());

      flatMap.set(key, {
        id: p.id,
        amount: p.amount,
        date: dateObj,
        source: p.source || 'Online',
        particulars: p.particulars || `Online Payment - Ref: ${p.transactionId || 'N/A'}`,
        period: format(new Date(p.month + '-01'), 'MMMM yyyy'),
        collection: 'payments',
        parentAccountId: p.parentAccountId,
        installmentIndex: p.installmentIndex,
        totalInstallments: p.totalInstallments
      });
    });

    return map;
  }, [accounts, payments, selectedYear]);

  const handleDeletePayment = async () => {
    if (!selectedPayment || !selectedPayment.id) return;
    setDeletingPayment(true);
    try {
      // 1. Determine primary record to delete
      const primaryId = selectedPayment.id;
      const primaryCollection = selectedPayment.collection || (selectedPayment.source === 'Online' ? 'payments' : 'accounts');
      
      // 2. Find linked records
      let linkedAccountId = null;
      let linkedPaymentId = null;
      
      if (primaryCollection === 'payments') {
        linkedPaymentId = primaryId;
        linkedAccountId = selectedPayment.parentAccountId;
      } else {
        linkedAccountId = primaryId;
        // Search for linked payment
        const qP = query(collection(db, 'payments'), where('parentAccountId', '==', primaryId));
        const pSnap = await getDocs(qP);
        if (!pSnap.empty) linkedPaymentId = pSnap.docs[0].id;
      }

      // 3. Perform deletions
      if (linkedAccountId) {
        await deleteDoc(doc(db, 'accounts', linkedAccountId));
        // Delete shadow entries
        const qS = query(collection(db, 'accounts'), where('parentAccountId', '==', linkedAccountId));
        const sSnap = await getDocs(qS);
        for (const d of sSnap.docs) await deleteDoc(doc(db, 'accounts', d.id));
      }
      
      if (linkedPaymentId) {
        await deleteDoc(doc(db, 'payments', linkedPaymentId));
      }

      // 4. Fallback: if it was a manual entry without parentAccountId linkage
      if (primaryCollection === 'accounts' && primaryId !== linkedAccountId) {
        await deleteDoc(doc(db, 'accounts', primaryId));
      } else if (primaryCollection === 'payments' && primaryId !== linkedPaymentId) {
        await deleteDoc(doc(db, 'payments', primaryId));
      }

      toast.success("Payment record and associated entries deleted");
      setSelectedPayment(null);
    } catch (err) {
      console.error("Error deleting record:", err);
      handleFirestoreError(err, OperationType.DELETE, `records/${selectedPayment.id}`);
    } finally {
      setDeletingPayment(false);
    }
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // System start date: March 2026
  const SYSTEM_START_MONTH = 2; // March
  const SYSTEM_START_YEAR = 2026;

  const handleDownloadReceipt = () => {
    if (!selectedPayment) return;
    const owner = residents.find(r => normalizeFlat(r.flatNumber) === normalizeFlat(selectedPayment.flat));
    const ownerName = (owner?.displayName || selectedPayment.flat).toUpperCase();

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${selectedPayment.flat} - ${selectedPayment.monthName} ${selectedPayment.year}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .receipt-container { max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 50px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f3f4f6; padding-bottom: 30px; margin-bottom: 40px; }
            .header-left h1 { margin: 0; font-size: 28px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; }
            .header-left p { margin: 4px 0 0; color: #6b7280; font-size: 14px; font-weight: 500; }
            .header-right { text-align: right; }
            .header-right h2 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
            .header-right p { margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #111827; }
            
            .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
            .detail-item { }
            .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px; }
            .value { font-size: 15px; color: #111827; font-weight: 600; }
            
            .amount-card { background: #f9fafb; border: 1px solid #f3f4f6; padding: 32px; border-radius: 20px; text-align: center; margin-bottom: 40px; }
            .amount-label { font-size: 14px; color: #6b7280; font-weight: 500; margin-bottom: 8px; }
            .amount-value { font-size: 42px; font-weight: 800; color: #10b981; }
            
            .status-stamp { display: inline-block; border: 3px solid #10b981; color: #10b981; padding: 8px 24px; border-radius: 12px; font-size: 24px; font-weight: 800; text-transform: uppercase; transform: rotate(-12deg); margin-top: 10px; opacity: 0.8; }
            
            .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #f3f4f6; text-align: center; }
            .footer p { margin: 4px 0; font-size: 12px; color: #9ca3af; }
            .footer .org { font-weight: 700; color: #4b5563; margin-top: 12px; font-size: 13px; }
            
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; box-shadow: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="header-left">
                <h1>Whitepalace Apartment</h1>
                <p>Official Maintenance Receipt</p>
              </div>
              <div class="header-right">
                <h2>Receipt Number</h2>
                <p>#${selectedPayment.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            
            <div class="details-grid">
              <div class="detail-item">
                <div class="label">Owner Name</div>
                <div class="value">${ownerName}</div>
              </div>
              <div class="detail-item">
                <div class="label">Flat Number</div>
                <div class="value">${selectedPayment.flat}</div>
              </div>
              <div class="detail-item">
                <div class="label">Maintenance Month</div>
                <div class="value">${selectedPayment.monthName} ${selectedPayment.year}</div>
              </div>
              <div class="detail-item">
                <div class="label">Payment Date</div>
                <div class="value">${selectedPayment.date ? format(selectedPayment.date, 'PPP p') : 'N/A'}</div>
              </div>
              <div class="detail-item">
                <div class="label">Source</div>
                <div class="value">${selectedPayment.source}</div>
              </div>
              <div class="detail-item">
                <div class="label">Particulars</div>
                <div class="value">${selectedPayment.particulars || 'N/A'}</div>
              </div>
            </div>

            <div class="amount-card">
              <div class="amount-label">Total Amount Received</div>
              <div class="amount-value">₹${selectedPayment.amount.toLocaleString()}</div>
              <div class="status-stamp">PAID</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated receipt and does not require a physical signature.</p>
              <p>Thank you for your timely maintenance payment.</p>
              <p class="org">Whitepalace Apartment Owners Association</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Maintenance Ledger</h2>
          <p className="text-sm text-neutral-500">Track monthly payments for all owners.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button 
              onClick={() => setSelectedYear(prev => prev - 1)}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-black text-neutral-200 px-2">{selectedYear}</span>
            <button 
              onClick={() => setSelectedYear(prev => prev + 1)}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-xl font-bold text-sm transition-all border border-neutral-700"
            >
              <RefreshCw size={18} />
              Refresh Data
            </button>
            <button 
              onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," 
                + "Owner,Flat," + MONTHS.join(",") + "\n"
                + owners.map(o => {
                  const flatMap = paymentMap.get(normalizeFlat(o.flatNumber) || '') || new Map();
                  const row = MONTHS.map((_, i) => {
                    const key = `${selectedYear}-${String(i).padStart(2, '0')}`;
                    const isFuture = selectedYear > currentYear || (selectedYear === currentYear && i > currentMonth);
                    const isBeforeStart = selectedYear < SYSTEM_START_YEAR || (selectedYear === SYSTEM_START_YEAR && i < SYSTEM_START_MONTH);
                    
                    const dueDate = new Date(selectedYear, i + 1, 11);
                    const isOverdue = new Date() > dueDate;
                    
                    if (flatMap.has(key)) return "PAID";
                    if (isFuture || isBeforeStart || !isOverdue) return "-";
                    return "PENDING";
                  });
                  return `"${o.displayName.toUpperCase()}","${o.flatNumber}",` + row.join(",");
                }).join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `maintenance_report_${selectedYear}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-xl font-bold text-sm transition-all border border-neutral-700"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>
    </div>

    <div className="bg-neutral-900 rounded-3xl border border-neutral-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-800/50">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-r border-neutral-700 sticky left-0 bg-neutral-900/95 backdrop-blur-sm z-20">Owner</th>
                {MONTHS.map((month, i) => (
                  <th key={month} className="px-2 py-4 text-[11px] font-black text-neutral-400 uppercase tracking-widest text-center border-r border-neutral-700 bg-neutral-800/30">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {owners.map((owner) => {
                const flat = normalizeFlat(owner.flatNumber || '');
                const flatMap = paymentMap.get(flat) || new Map();
                
                return (
                  <tr key={owner.uid} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-6 py-4 border-r border-neutral-700 sticky left-0 bg-neutral-900/95 backdrop-blur-sm z-10 group-hover:bg-neutral-800/50 transition-colors">
                      <p className="text-sm font-bold text-neutral-100 truncate max-w-[200px]">{owner.displayName} ({flat})</p>
                    </td>
                    {MONTHS.map((_, i) => {
                      const key = `${selectedYear}-${String(i).padStart(2, '0')}`;
                      const payment = flatMap.get(key);
                      const isFuture = selectedYear > currentYear || (selectedYear === currentYear && i > currentMonth);
                      const isBeforeStart = selectedYear < SYSTEM_START_YEAR || (selectedYear === SYSTEM_START_YEAR && i < SYSTEM_START_MONTH);
                      
                      // Payment for month M is due by the 10th of month M+1
                      const dueDate = new Date(selectedYear, i + 1, 11);
                      const isOverdue = new Date() > dueDate;
                      
                      // A month is pending only if it's NOT paid, NOT in the future, NOT before system start, and IS overdue
                      const isPending = !payment && !isFuture && !isBeforeStart && isOverdue;
                      
                      return (
                        <td 
                          key={i} 
                          className={cn(
                            "p-1 border-r border-neutral-700 relative",
                            payment && "cursor-pointer"
                          )}
                          onMouseEnter={() => setHoveredCell({ flat, month: i })}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => {
                            if (payment) {
                              setSelectedPayment({ ...payment, flat, monthName: MONTHS[i], year: selectedYear });
                            }
                          }}
                        >
                          <div className={cn(
                            "w-full aspect-square rounded-lg flex items-center justify-center transition-all duration-300",
                            payment ? (
                              payment.totalInstallments && payment.totalInstallments > 1 ? 
                              "bg-amber-500/20 text-amber-400 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                              "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                            ) : 
                            isPending ? "bg-rose-500/20 text-rose-400 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)] animate-pulse" : 
                            "bg-neutral-800/40 text-neutral-600 border border-neutral-700/30"
                          )}>
                            {payment ? <Check size={16} strokeWidth={3} /> : isPending ? <X size={16} strokeWidth={3} className="text-rose-500" /> : null}
                          </div>

                          <AnimatePresence>
                            {hoveredCell?.flat === flat && hoveredCell?.month === i && (payment || isPending) && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                className={cn(
                                  "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-3 rounded-xl shadow-2xl z-50 pointer-events-none border",
                                  payment ? "bg-neutral-900 border-emerald-500/30" : "bg-neutral-900 border-rose-500/30"
                                )}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{MONTHS[i]} {selectedYear}</span>
                                    <span className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded",
                                      payment ? (
                                        payment.totalInstallments && payment.totalInstallments > 1 ? 
                                        "bg-amber-500/20 text-amber-400" : 
                                        "bg-emerald-500/20 text-emerald-400"
                                      ) : "bg-rose-500/20 text-rose-400"
                                    )}>
                                      {payment ? (
                                        payment.installmentIndex ? `${payment.installmentIndex}/${payment.totalInstallments}` : 'PAID'
                                      ) : 'PENDING'}
                                    </span>
                                  </div>
                                  
                                  {payment ? (
                                    <>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-neutral-500">Amount</span>
                                        <span className="text-xs font-bold text-emerald-400">₹{payment.amount.toLocaleString()}</span>
                                      </div>
                                      {payment.particulars?.match(/\((.*?)\)/) && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] text-neutral-500">Tenant</span>
                                          <span className="text-xs font-bold text-indigo-400 uppercase">{payment.particulars.match(/\((.*?)\)/)?.[1]}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-neutral-500">Date</span>
                                        <span className="text-xs text-neutral-300">{payment.date ? format(payment.date, 'dd MMM yyyy') : 'N/A'}</span>
                                      </div>
                                      {payment.period && (
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] text-neutral-500">Period</span>
                                          <span className="text-[10px] font-bold text-indigo-400 uppercase">{payment.period}</span>
                                        </div>
                                      )}
                                      <div className="pt-1 border-t border-neutral-800">
                                        <p className="text-[9px] text-neutral-500 leading-tight italic">{payment.particulars}</p>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="py-1">
                                      <p className="text-xs text-rose-400 font-medium">Payment is overdue for this month.</p>
                                    </div>
                                  )}
                                </div>
                                <div className={cn(
                                  "absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent",
                                  payment ? "border-t-neutral-900" : "border-t-neutral-900"
                                )} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {selectedPayment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-neutral-700 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Payment Details</h3>
                <button onClick={() => setSelectedPayment(null)} className="text-neutral-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Owner</p>
                    <p className="text-sm font-bold text-white">{selectedPayment.flat}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Period</p>
                    <p className="text-sm font-bold text-white">{selectedPayment.monthName} {selectedPayment.year}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Amount</p>
                    <p className="text-sm font-bold text-emerald-400">₹{selectedPayment.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source</p>
                    <p className="text-sm font-bold text-indigo-400">{selectedPayment.source}</p>
                  </div>
                </div>
                {selectedPayment.date && (
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Paid On</p>
                    <p className="text-sm font-bold text-white">
                      {selectedPayment.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                )}
                {selectedPayment.particulars && (
                  <div>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Particulars</p>
                    <p className="text-sm text-neutral-300 italic">{selectedPayment.particulars}</p>
                  </div>
                )}
                
                <div className="pt-4 border-t border-neutral-800 space-y-3">
                  <button
                    onClick={handleDownloadReceipt}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                  >
                    <Download size={18} />
                    Download Receipt
                  </button>

                  {isSuperAdmin ? (
                    <>
                      <p className="text-xs text-neutral-500 mb-4">
                        Deleting this record will remove the green tick from the Payment Report. This action cannot be undone.
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setSelectedPayment(null)}
                          className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeletePayment}
                          disabled={deletingPayment}
                          className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50"
                        >
                          {deletingPayment ? 'Deleting...' : 'Delete Record'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedPayment(null)}
                      className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-bold transition-all"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountsManagement({ accounts, residents, payments, isAdmin, isSuperAdmin }: { accounts: AccountEntry[], residents: UserProfile[], payments: PaymentRecord[], isAdmin: boolean, isSuperAdmin: boolean }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearsList = [];
    for (let i = currentYear - 2; i <= currentYear + 5; i++) {
      yearsList.push(i);
    }
    return yearsList;
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AccountEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState<Partial<AccountEntry> & { openingCash?: number, openingBank?: number, openingIncome?: number, openingExpense?: number }>({
    date: new Date(),
    particulars: '',
    income: 0,
    expense: 0,
    method: 'bank',
    forMonth: MONTHS[new Date().getMonth()],
    forYear: new Date().getFullYear()
  });

  const months = MONTHS;

  const handleDownloadReceipt = (acc: AccountEntry) => {
    const flat = extractFlatNumber(acc.particulars);
    // Use stored ownerName if available, otherwise fall back to current resident (for old records)
    const owner = residents.find(r => {
      const rFlat = extractFlatNumber(r.flatNumber || '');
      return rFlat === flat;
    });
    const tenantName = getTenantName(acc.particulars);
    const ownerName = acc.ownerName || owner?.displayName || flat;
    const residentName = tenantName ? `${ownerName} (Tenant: ${tenantName})` : ownerName;
    const dateObj = acc.date instanceof Date ? acc.date : acc.date?.toDate();

    const receiptHtml = `
      <html>
        <head>
          <title>Receipt - ${flat} - ${acc.forMonth} ${acc.forYear}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.5; }
            .receipt-container { max-width: 700px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 50px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f3f4f6; padding-bottom: 30px; margin-bottom: 40px; }
            .header-left h1 { margin: 0; font-size: 28px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; }
            .header-left p { margin: 4px 0 0; color: #6b7280; font-size: 14px; font-weight: 500; }
            .header-right { text-align: right; }
            .header-right h2 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; }
            .header-right p { margin: 4px 0 0; font-size: 18px; font-weight: 700; color: #111827; }
            
            .details-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
            .detail-item { }
            .label { font-size: 11px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 6px; }
            .value { font-size: 15px; color: #111827; font-weight: 600; }
            
            .amount-card { background: #f9fafb; border: 1px solid #f3f4f6; padding: 32px; border-radius: 20px; text-align: center; margin-bottom: 40px; }
            .amount-label { font-size: 14px; color: #6b7280; font-weight: 500; margin-bottom: 8px; }
            .amount-value { font-size: 42px; font-weight: 800; color: #10b981; }
            
            .status-stamp { display: inline-block; border: 3px solid #10b981; color: #10b981; padding: 8px 24px; border-radius: 12px; font-size: 24px; font-weight: 800; text-transform: uppercase; transform: rotate(-12deg); margin-top: 10px; opacity: 0.8; }
            
            .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #f3f4f6; text-align: center; }
            .footer p { margin: 4px 0; font-size: 12px; color: #9ca3af; }
            .footer .org { font-weight: 700; color: #4b5563; margin-top: 12px; font-size: 13px; }
            
            @media print {
              body { padding: 0; }
              .receipt-container { border: none; box-shadow: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="header">
              <div class="header-left">
                <h1>Whitepalace Apartment</h1>
                <p>Official Maintenance Receipt</p>
              </div>
              <div class="header-right">
                <h2>Receipt Number</h2>
                <p>#${acc.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            
            <div class="details-grid">
              <div class="detail-item">
                <div class="label">Owner Name</div>
                <div class="value">${residentName}</div>
              </div>
              <div class="detail-item">
                <div class="label">Flat Number</div>
                <div class="value">${flat}</div>
              </div>
              <div class="detail-item">
                <div class="label">Maintenance Month</div>
                <div class="value">${(() => {
                  if (acc.isAdvanceAllocation) {
                    const d = new Date(acc.forYear || 0, MONTHS.indexOf(acc.forMonth || '') - 1, 1);
                    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
                  }
                  return `${acc.forMonth} ${acc.forYear}`;
                })()}</div>
              </div>
              <div class="detail-item">
                <div class="label">Payment Date</div>
                <div class="value">${dateObj ? format(dateObj, 'PPP p') : 'N/A'}</div>
              </div>
              <div class="detail-item">
                <div class="label">Source</div>
                <div class="value">Manual Entry</div>
              </div>
              <div class="detail-item">
                <div class="label">Particulars</div>
                <div class="value">${acc.particulars || 'N/A'}</div>
              </div>
            </div>

            <div class="amount-card">
              <div class="amount-label">Total Amount Received</div>
              <div class="amount-value">₹${(acc.income || acc.amount || 0).toLocaleString()}</div>
              <div class="status-stamp">PAID</div>
            </div>

            <div class="footer">
              <p>This is a computer-generated receipt and does not require a physical signature.</p>
              <p>Thank you for your timely maintenance payment.</p>
              <p class="org">Whitepalace Apartment Owners Association</p>
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  const balances = useMemo(() => {
    const sortedAll = [...accounts]
      .filter(acc => !acc.isAdvanceAllocation && acc.date) // Only actual transactions affect balance
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : a.date.toDate();
        const dateB = b.date instanceof Date ? b.date : b.date.toDate();
        return dateA.getTime() - dateB.getTime();
      });
    const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

    let currentCash = 0;
    let currentBank = 0;
    let grandIncome = 0;
    let grandExpense = 0;

    const accountsWithRunning = sortedAll.map(acc => {
      if (acc.isOpeningBalance) {
        if (acc.method === 'bank') {
          currentBank += acc.amount || 0;
        } else {
          currentCash += acc.amount || 0;
        }
        grandIncome += acc.openingIncome || 0;
        grandExpense += acc.openingExpense || 0;
      } else if (acc.isWithdrawal) {
        currentCash += acc.amount || 0;
        currentBank -= acc.amount || 0;
      } else {
        if (acc.method === 'bank') {
          currentBank += acc.income;
          currentBank -= acc.expense;
        } else {
          currentCash += acc.income;
          currentCash -= acc.expense;
        }
        grandIncome += acc.income;
        grandExpense += acc.expense;
      }
      return { 
        ...acc, 
        runningCashBalance: currentCash, 
        runningBankBalance: currentBank 
      };
    });

    const monthEndEntry = [...accountsWithRunning].reverse().find(acc => acc.date <= lastDayOfMonth);
    const monthEnd = monthEndEntry 
      ? { cashInHand: monthEndEntry.runningCashBalance, cashInBank: monthEndEntry.runningBankBalance } 
      : { cashInHand: 0, cashInBank: 0 };

    return { 
      accountsWithRunning,
      monthEnd,
      grand: { 
        income: grandIncome, 
        expense: grandExpense, 
        cashInHand: currentCash, 
        cashInBank: currentBank 
      }
    };
  }, [accounts, selectedMonth, selectedYear]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      // For actual transactions, check their date
      if (!acc.isAdvanceAllocation && acc.date) {
        const date = acc.date instanceof Date ? acc.date : acc.date.toDate();
        return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
      }
      // For advance allocations, check their forMonth/forYear
      if (acc.isAdvanceAllocation) {
        const monthIdx = MONTHS.indexOf(acc.forMonth || '');
        return monthIdx === selectedMonth && acc.forYear === selectedYear;
      }
      return false;
    }).sort((a, b) => {
      // Sort by date if available, otherwise put at the end of the day?
      // Actually, shadow entries have no date, so they can just be at the bottom.
      if (a.isAdvanceAllocation && !b.isAdvanceAllocation) return 1;
      if (!a.isAdvanceAllocation && b.isAdvanceAllocation) return -1;
      if (a.isAdvanceAllocation && b.isAdvanceAllocation) return 0;
      
      const dateA = a.date instanceof Date ? a.date : a.date.toDate();
      const dateB = b.date instanceof Date ? b.date : b.date.toDate();
      return dateA.getTime() - dateB.getTime();
    }).map(acc => {
      // Attach running balances from the pre-calculated balances.accountsWithRunning
      const match = balances.accountsWithRunning.find(b => b.id === acc.id);
      if (match) {
        return {
          ...acc,
          runningCashBalance: match.runningCashBalance,
          runningBankBalance: match.runningBankBalance
        };
      }
      // If no match (e.g. shadow entry), use the last available balance
      // We need to find the latest balance BEFORE or ON this month
      return {
        ...acc,
        runningCashBalance: balances.monthEnd.cashInHand,
        runningBankBalance: balances.monthEnd.cashInBank
      };
    });
  }, [accounts, balances, selectedMonth, selectedYear]);

  const monthlyTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredAccounts.forEach(acc => {
      if (acc.isOpeningBalance || acc.isAdvanceAllocation) {
        // Opening balance and advance allocations are not counted as monthly income/expense
        return;
      }
      if (acc.isWithdrawal) {
        income += acc.amount || 0;
      } else {
        income += acc.income;
        expense += acc.expense;
      }
    });
    return { income, expense };
  }, [filteredAccounts]);

  const handleAddEntry = async () => {
    if (!newEntry.particulars || !newEntry.date) {
      setError("Please provide both particulars and a date.");
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const isWithdrawal = newEntry.particulars?.toLowerCase().includes('withdraw') || newEntry.isWithdrawal;
      const isCheque = newEntry.particulars?.toLowerCase().includes('cheque');
      const isOpeningBalance = newEntry.isOpeningBalance;
      
      if (isOpeningBalance && !editingEntry) {
        // Handle multiple opening balances (Cash and/or Bank)
        const entries = [];
        
        // Only add historical totals to the first entry to avoid duplication
        const openingIncome = newEntry.openingIncome || 0;
        const openingExpense = newEntry.openingExpense || 0;

        if (newEntry.openingCash && newEntry.openingCash > 0) {
          entries.push({
            particulars: newEntry.particulars || 'Opening Balance (Cash)',
            income: 0,
            expense: 0,
            method: 'cash',
            isWithdrawal: false,
            isOpeningBalance: true,
            amount: newEntry.openingCash,
            openingIncome: openingIncome, // Add historical income here
            openingExpense: openingExpense, // Add historical expense here
            date: Timestamp.fromDate(newEntry.date as Date),
            createdAt: serverTimestamp()
          });
        }
        if (newEntry.openingBank && newEntry.openingBank > 0) {
          entries.push({
            particulars: newEntry.particulars || 'Opening Balance (Bank)',
            income: 0,
            expense: 0,
            method: 'bank',
            isWithdrawal: false,
            isOpeningBalance: true,
            amount: newEntry.openingBank,
            // If we already added totals to cash, don't add them here
            openingIncome: entries.length === 0 ? openingIncome : 0,
            openingExpense: entries.length === 0 ? openingExpense : 0,
            date: Timestamp.fromDate(newEntry.date as Date),
            createdAt: serverTimestamp()
          });
        }

        if (entries.length === 0 && (openingIncome > 0 || openingExpense > 0)) {
          // If only historical totals are provided, create a dummy entry
          entries.push({
            particulars: newEntry.particulars || 'Opening Totals',
            income: 0,
            expense: 0,
            method: 'bank',
            isWithdrawal: false,
            isOpeningBalance: true,
            amount: 0,
            openingIncome: openingIncome,
            openingExpense: openingExpense,
            date: Timestamp.fromDate(newEntry.date as Date),
            createdAt: serverTimestamp()
          });
        }

        if (entries.length === 0) {
          setError('Please enter at least one opening balance amount.');
          setSaving(false);
          return;
        }

        for (const entry of entries) {
          await addDoc(collection(db, 'accounts'), entry);
        }
      } else {
        const flat = extractFlatNumber(newEntry.particulars || '');
        const owner = residents.find(r => extractFlatNumber(r.flatNumber || '') === flat);
        const tenantName = getTenantName(newEntry.particulars || '');
        
        // Auto-append tenant name if it's a maintenance-like entry and tenant exists
        let finalParticulars = newEntry.particulars;
        if (tenantName && !finalParticulars?.includes(`Tenant: ${tenantName}`)) {
          finalParticulars = `${finalParticulars} (Tenant: ${tenantName})`;
        }

        const entryData = {
          particulars: finalParticulars,
          income: (isWithdrawal || isOpeningBalance) ? 0 : (newEntry.income || 0),
          expense: (isWithdrawal || isOpeningBalance) ? 0 : (newEntry.expense || 0),
          method: isCheque ? 'bank' : newEntry.method || 'cash',
          isWithdrawal: !!isWithdrawal,
          isOpeningBalance: !!isOpeningBalance,
          amount: (isWithdrawal || isOpeningBalance) ? (newEntry.amount || newEntry.income || newEntry.expense || 0) : 0,
          openingIncome: newEntry.openingIncome || 0,
          openingExpense: newEntry.openingExpense || 0,
          forMonth: newEntry.forMonth || null,
          forYear: newEntry.forYear || null,
          date: newEntry.date instanceof Date ? Timestamp.fromDate(newEntry.date) : newEntry.date as Timestamp,
          flatNumber: flat,
          ownerUid: owner?.uid,
          ownerName: owner?.displayName
        };

        if (editingEntry) {
          await updateDoc(doc(db, 'accounts', editingEntry.id), entryData);
        } else {
          await addDoc(collection(db, 'accounts'), {
            ...entryData,
            createdAt: serverTimestamp()
          });
        }
      }

      setShowAddModal(false);
      setEditingEntry(null);
      setNewEntry({
        date: new Date(),
        particulars: '',
        income: 0,
        expense: 0,
        method: 'bank',
        isWithdrawal: false,
        isOpeningBalance: false,
        amount: 0,
        openingCash: 0,
        openingBank: 0,
        openingIncome: 0,
        openingExpense: 0,
        forMonth: MONTHS[new Date().getMonth()],
        forYear: new Date().getFullYear()
      });
    } catch (err: any) {
      const errorMessage = err.message || "An unexpected error occurred.";
      setError(errorMessage);
      console.error("Error saving entry:", err);
      try {
        handleFirestoreError(err, editingEntry ? OperationType.UPDATE : OperationType.CREATE, editingEntry ? `accounts/${editingEntry.id}` : 'accounts');
      } catch (e) {}
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingId) return;
    try {
      // 1. Get the entry to check if it has associated records
      const entryRef = doc(db, 'accounts', deletingId);
      const entrySnap = await getDoc(entryRef);
      
      if (entrySnap.exists()) {
        const data = entrySnap.data();
        let flat = data.flatNumber || data.particulars?.split(' ')[0];
        let ownerUid = data.ownerUid;

        // If ownerUid is missing, try to find it from residents list by matching flat and name
        if (!ownerUid && data.particulars) {
          const parts = data.particulars.split(' (')[0].split(' ');
          // Try to find a resident that matches the flat and name in particulars
          const resident = residents.find(r => 
            data.particulars.startsWith(r.flatNumber || '') && 
            data.particulars.includes(r.displayName)
          );
          if (resident) {
            ownerUid = resident.uid;
            flat = resident.flatNumber;
          }
        }
        
        // 2. Delete associated shadow entries in 'accounts' using parentAccountId
        const qShadow = query(collection(db, 'accounts'), where('parentAccountId', '==', deletingId));
        const shadowSnap = await getDocs(qShadow);
        for (const d of shadowSnap.docs) {
          await deleteDoc(doc(db, 'accounts', d.id));
        }

        // 3. Delete associated payment records in 'payments' using parentAccountId
        const qPayments = query(collection(db, 'payments'), where('parentAccountId', '==', deletingId));
        const paymentsSnap = await getDocs(qPayments);
        for (const d of paymentsSnap.docs) {
          await deleteDoc(doc(db, 'payments', d.id));
        }

        // 4. Heuristic for older entries or shadow entries without parentAccountId
        if (data.isAdvanceAllocation || (data.income > 0 && !data.isOpeningBalance && !data.isWithdrawal)) {
          const monthToUse = data.forMonth;
          const yearToUse = data.forYear;

          if (monthToUse && yearToUse) {
            const monthIdx = MONTHS.indexOf(monthToUse);
            if (monthIdx !== -1) {
              const monthKey = `${yearToUse}-${String(monthIdx + 1).padStart(2, '0')}`;
              
              // Try to find the payment record by deterministic ID
              if (ownerUid) {
                const detId = `${ownerUid}_${monthKey}`;
                await deleteDoc(doc(db, 'payments', detId));
              }
              
              // Also query by flat and month just in case
              const qP = query(collection(db, 'payments'), 
                where('flatNumber', '==', flat || ''), 
                where('month', '==', monthKey)
              );
              
              const pSnap = await getDocs(qP);
              for (const d of pSnap.docs) {
                const pData = d.data() as any;
                // Only delete if it's a manual entry or linked to this account
                if (pData.source === 'Manual' || pData.parentAccountId === deletingId || pData.ownerUid === ownerUid) {
                  await deleteDoc(doc(db, 'payments', d.id));
                }
              }
            }
          }
          
          // Additional cleanup for main entries
          if (data.income > 0 && !data.isAdvanceAllocation) {
            const qPExtra = query(collection(db, 'payments'), where('particulars', '==', `Manual Entry: ${data.particulars}`));
            const pSnapExtra = await getDocs(qPExtra);
            for (const d of pSnapExtra.docs) {
              await deleteDoc(doc(db, 'payments', d.id));
            }

            // Also try to find shadow entries if they don't have parentAccountId
            if (flat) {
              const qS = query(collection(db, 'accounts'), where('isAdvanceAllocation', '==', true));
              const sSnap = await getDocs(qS);
              for (const d of sSnap.docs) {
                const sData = d.data() as any;
                const sFlat = sData.flatNumber || sData.particulars?.split(' (')[0]?.split(' ').slice(0, 2).join(' ');
                
                if ((sData.flatNumber === flat || sData.particulars.startsWith(flat)) && sData.originalPaymentDate) {
                  const sDate = sData.originalPaymentDate instanceof Date ? sData.originalPaymentDate : sData.originalPaymentDate.toDate();
                  const dDate = data.date instanceof Date ? data.date : data.date?.toDate();
                  if (dDate && sDate.getTime() === dDate.getTime()) {
                    await deleteDoc(doc(db, 'accounts', d.id));
                  }
                }
              }
            }
          }
        }
      }

      await deleteDoc(entryRef);
      setDeletingId(null);
      toast.success("Transaction and all associated records deleted");
    } catch (err) {
      console.error("Error deleting entry:", err);
      handleFirestoreError(err, OperationType.DELETE, `accounts/${deletingId}`);
    }
  };

  const handleEditClick = (acc: AccountEntry) => {
    setEditingEntry(acc);
    const accDate = acc.date instanceof Date ? acc.date : (acc.date as any).toDate();
    setNewEntry({
      date: accDate,
      particulars: acc.particulars,
      income: acc.income,
      expense: acc.expense,
      method: acc.method,
      isWithdrawal: acc.isWithdrawal,
      isOpeningBalance: acc.isOpeningBalance,
      amount: acc.amount,
      openingCash: acc.method === 'cash' ? acc.amount : 0,
      openingBank: acc.method === 'bank' ? acc.amount : 0,
      openingIncome: acc.openingIncome || 0,
      openingExpense: acc.openingExpense || 0,
      forMonth: acc.forMonth || '',
      forYear: acc.forYear || new Date().getFullYear()
    });
    setShowAddModal(true);
  };

  const openingBalances = useMemo(() => {
    return accounts.filter(acc => acc.isOpeningBalance).sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : a.date.toDate();
      const dateB = b.date instanceof Date ? b.date : b.date.toDate();
      return dateB.getTime() - dateA.getTime();
    });
  }, [accounts]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sticky top-0 z-10 bg-neutral-950 pt-1 pb-4 border-b border-neutral-600">
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-600 shadow-sm">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Cash in Hand</p>
          <p className="text-2xl font-bold text-emerald-400">₹{balances.grand.cashInHand.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-600 shadow-sm">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Cash in Bank</p>
          <p className="text-2xl font-bold text-blue-400">₹{balances.grand.cashInBank.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-600 shadow-sm">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total Income</p>
            <p className="text-2xl font-bold text-indigo-400">₹{balances.grand.income.toLocaleString()}</p>
            <p className="text-[8px] text-neutral-500 font-bold uppercase mt-1">From 01/05/2025</p>
          </div>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-600 shadow-sm">
          <div className="flex flex-col">
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total Expense</p>
            <p className="text-2xl font-bold text-rose-400">₹{balances.grand.expense.toLocaleString()}</p>
            <p className="text-[8px] text-neutral-500 font-bold uppercase mt-1">From 01/05/2025</p>
          </div>
        </div>
      </div>

      {/* Solid rectangle box below tabs */}
      <div className="h-4 bg-neutral-900 rounded-xl border border-neutral-600 shadow-inner" />

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-600">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-neutral-800 text-white px-4 py-2 rounded-xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2 p-2 bg-neutral-900 rounded-2xl border border-neutral-600 overflow-x-auto no-scrollbar flex-1">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border border-transparent",
                selectedMonth === index 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 border-indigo-400" 
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 hover:border-neutral-700"
              )}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-600 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-600 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-neutral-100">{months[selectedMonth]} {selectedYear} Accounts</h3>
            <p className="text-sm text-neutral-500">Monthly income and expense tracking.</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button 
                  onClick={() => setShowOpeningModal(true)}
                  className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-xl font-bold transition-all border border-neutral-700"
                  title="View all opening balances to fix duplicates"
                >
                  <History size={18} />
                  Opening Balances
                </button>
              )}
              <button 
                onClick={() => setShowQuickModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20 border border-emerald-500"
              >
                <FileText size={18} />
                Post Maintenance
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20 border border-indigo-500"
              >
                <Plus size={18} />
                Add Entry
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-800/50">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-600">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-600">Particulars</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-600">For Month</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-600 text-right">Income (₹)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-600 text-right">Expense (₹)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Running Balance</th>
                {isSuperAdmin && <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-600">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 7 : 6} className="px-6 py-20 text-center text-neutral-600 italic">
                    No transactions recorded for {months[selectedMonth]} {selectedYear}.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className={cn(
                    "hover:bg-neutral-800/30 transition-colors",
                    acc.isAdvanceAllocation && "bg-yellow-900/5"
                  )}>
                    <td className="px-6 py-4 border-r border-neutral-600">
                      {!acc.isAdvanceAllocation && acc.date && (
                        <div className="flex items-center gap-2 text-neutral-300 font-medium">
                          <Calendar size={14} className="text-neutral-500" />
                          {format(acc.date, 'dd MMM yyyy')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-600">
                      <span className={cn(
                        "text-neutral-300",
                        acc.isAdvanceAllocation && "text-yellow-500/80 italic text-sm"
                      )}>
                        {(() => {
                          const tenantName = getTenantName(acc.particulars);
                          if (tenantName && !acc.particulars.includes(`Tenant: ${tenantName}`)) {
                            // If it's a maintenance entry (has flat number) but missing tenant name, append it
                            if (acc.income > 0 || acc.isAdvanceAllocation) {
                              return `${acc.particulars} (Tenant: ${tenantName})`;
                            }
                          }
                          return acc.particulars;
                        })()}
                      </span>
                      {acc.method === 'bank' && !acc.isAdvanceAllocation && <span className="ml-2 text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase">Bank</span>}
                      {acc.isWithdrawal && <span className="ml-2 text-[10px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">Withdrawal</span>}
                      {acc.isOpeningBalance && <span className="ml-2 text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Opening Balance</span>}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-600 text-center">
                      {acc.forMonth ? (
                        <div className="flex flex-col items-center gap-1">
                          {!acc.isAdvanceAllocation && (
                            <span className="text-[8px] uppercase text-neutral-500 font-bold tracking-widest">Paid up to</span>
                          )}
                          {(() => {
                            const forMonthIdx = MONTHS.indexOf(acc.forMonth);
                            const forDate = new Date(acc.forYear || 0, forMonthIdx, 1);
                            
                            let isRed = false;
                            if (!acc.isAdvanceAllocation && acc.date) {
                              const pDate = acc.date instanceof Date ? acc.date : acc.date.toDate();
                              const paymentMonthDate = new Date(pDate.getFullYear(), pDate.getMonth(), 1);
                              
                              // User's rule: Payment in Month X is for Month X-1.
                              // So if forDate < (paymentMonthDate - 1 month), it's a past due.
                              const expectedForDate = new Date(paymentMonthDate);
                              expectedForDate.setMonth(expectedForDate.getMonth() - 1);
                              
                              isRed = forDate < expectedForDate;
                            }

                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn(
                                  "text-[10px] px-2 py-1 rounded-lg font-bold transition-all",
                                  isRed 
                                    ? "bg-rose-600 text-white shadow-lg shadow-rose-900/20 scale-110" 
                                    : "bg-neutral-800 text-neutral-400"
                                )}>
                                  {(() => {
                                    if (acc.isAdvanceAllocation) {
                                      const d = new Date(acc.forYear || 0, MONTHS.indexOf(acc.forMonth) - 1, 1);
                                      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
                                    }
                                    return `${acc.forMonth} ${acc.forYear}`;
                                  })()}
                                </span>
                                {isRed && (
                                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-tighter animate-pulse">
                                    Dues Pending
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-600 text-right font-bold">
                      {acc.isAdvanceAllocation ? (
                        <span className="text-yellow-500">₹{acc.displayAmount?.toLocaleString()}</span>
                      ) : acc.isOpeningBalance ? (
                        <span className="flex flex-col items-end text-emerald-500">
                          <span>₹{acc.amount?.toLocaleString()}</span>
                          <span className="text-[8px] uppercase tracking-tighter opacity-70 font-normal">Initial</span>
                        </span>
                      ) : acc.isWithdrawal ? (
                        <span className="flex flex-col items-end text-emerald-500">
                          <span>+₹{acc.amount?.toLocaleString()}</span>
                          <span className="text-[8px] uppercase tracking-tighter opacity-70 font-normal">From Bank</span>
                        </span>
                      ) : acc.income > 0 ? (
                        <span className="text-emerald-500">+₹{acc.income.toLocaleString()}</span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-600 text-right font-bold text-rose-500">
                      {acc.expense > 0 ? `-₹${acc.expense.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-100">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-400">C: ₹{acc.runningCashBalance?.toLocaleString()}</span>
                        <span className="text-xs text-blue-400">B: ₹{acc.runningBankBalance?.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {acc.forMonth && (acc.income > 0 || acc.amount > 0) && (
                            <button 
                              onClick={() => handleDownloadReceipt(acc)}
                              className="p-2 text-neutral-600 hover:text-emerald-400 transition-colors"
                              title="Download Receipt"
                            >
                              <Download size={16} />
                            </button>
                          )}
                          {isSuperAdmin && (
                            <>
                              <button 
                                onClick={() => handleEditClick(acc)}
                                className="p-2 text-neutral-600 hover:text-indigo-400 transition-colors"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => setDeletingId(acc.id)}
                                className="p-2 text-neutral-600 hover:text-rose-400 transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredAccounts.length > 0 && (
              <tfoot className="bg-neutral-800 font-bold border-t-2 border-neutral-600">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-right text-neutral-400 uppercase tracking-wider text-xs border-r border-neutral-600">Monthly Totals</td>
                  <td className="px-6 py-4 border-r border-neutral-600 text-center">-</td>
                  <td className="px-6 py-4 text-right text-emerald-400 border-r border-neutral-600">₹{monthlyTotals.income.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-rose-400 border-r border-neutral-600">₹{monthlyTotals.expense.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-white">₹{balances.monthEnd.cashInHand.toLocaleString()}</td>
                  {isSuperAdmin && <td></td>}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showQuickModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-100">Post Maintenance Receipts</h3>
                  <p className="text-sm text-neutral-500">Select owners to record their online maintenance payments manually.</p>
                </div>
                <button onClick={() => setShowQuickModal(false)} className="p-2 text-neutral-500 hover:text-neutral-300">
                  <X size={24} />
                </button>
              </div>

              <QuickMaintenanceForm 
                residents={residents}
                payments={payments}
                onClose={() => setShowQuickModal(false)} 
                onSuccess={() => {
                  setShowQuickModal(false);
                  toast.success("Maintenance posted successfully!");
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-neutral-100">{editingEntry ? 'Edit Transaction' : 'Add Transaction'}</h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                  setNewEntry({
                    date: new Date(),
                    particulars: '',
                    income: 0,
                    expense: 0,
                    method: 'cash',
                    forMonth: MONTHS[new Date().getMonth()],
                    forYear: new Date().getFullYear()
                  });
                }} 
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-900/30 border border-rose-800 rounded-xl text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Date</label>
                <input 
                  type="date" 
                  value={format(newEntry.date as Date, 'yyyy-MM-dd')}
                  onClick={(e) => (e.currentTarget as any).showPicker?.()}
                  onFocus={(e) => (e.currentTarget as any).showPicker?.()}
                  onChange={(e) => setNewEntry({ ...newEntry, date: new Date(e.target.value) })}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 cursor-pointer relative"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Particulars</label>
                <input 
                  type="text" 
                  value={newEntry.particulars}
                  onChange={(e) => setNewEntry({ ...newEntry, particulars: e.target.value })}
                  placeholder="e.g., KSEB Bill, Maintenance, etc."
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">For Month</label>
                  <select 
                    value={newEntry.forMonth}
                    onChange={(e) => setNewEntry({ ...newEntry, forMonth: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                  >
                    <option value="">None</option>
                    {MONTHS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">For Year</label>
                  <select 
                    value={newEntry.forYear}
                    onChange={(e) => setNewEntry({ ...newEntry, forYear: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Income (₹)</label>
                  <input 
                    type="number" 
                    value={newEntry.income}
                    disabled={newEntry.isWithdrawal || newEntry.isOpeningBalance}
                    onChange={(e) => setNewEntry({ ...newEntry, income: Number(e.target.value), expense: 0 })}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-emerald-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Expense (₹)</label>
                  <input 
                    type="number" 
                    value={newEntry.expense}
                    disabled={newEntry.isWithdrawal || newEntry.isOpeningBalance}
                    onChange={(e) => setNewEntry({ ...newEntry, expense: Number(e.target.value), income: 0 })}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-rose-400 font-bold disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNewEntry({ ...newEntry, method: 'cash', isWithdrawal: false, isOpeningBalance: false })}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-[10px] transition-all border uppercase tracking-wider",
                    newEntry.method === 'cash' && !newEntry.isWithdrawal && !newEntry.isOpeningBalance
                      ? "bg-neutral-100 text-neutral-900 border-neutral-100"
                      : "text-neutral-500 border-neutral-800 hover:border-neutral-700"
                  )}
                >
                  Cash
                </button>
                <button
                  onClick={() => setNewEntry({ ...newEntry, method: 'bank', isWithdrawal: false, isOpeningBalance: false })}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-[10px] transition-all border uppercase tracking-wider",
                    newEntry.method === 'bank' && !newEntry.isWithdrawal && !newEntry.isOpeningBalance
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-neutral-500 border-neutral-800 hover:border-neutral-700"
                  )}
                >
                  Bank
                </button>
                <button
                  onClick={() => setNewEntry({ ...newEntry, isWithdrawal: true, isOpeningBalance: false, method: 'bank', income: 0, expense: 0, amount: newEntry.amount || newEntry.income || newEntry.expense || 0 })}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-[10px] transition-all border uppercase tracking-wider",
                    newEntry.isWithdrawal
                      ? "bg-amber-600 text-white border-amber-600"
                      : "text-neutral-500 border-neutral-800 hover:border-neutral-700"
                  )}
                >
                  Withdrawal
                </button>
                <button
                  onClick={() => setNewEntry({ 
                    ...newEntry, 
                    isOpeningBalance: true, 
                    isWithdrawal: false, 
                    income: 0, 
                    expense: 0, 
                    particulars: newEntry.particulars || 'Opening Balance',
                    openingIncome: newEntry.openingIncome || 333990,
                    openingExpense: newEntry.openingExpense || 280850,
                    date: new Date(2025, 4, 1) // Default to 1/5/2025
                  })}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold text-[10px] transition-all border uppercase tracking-wider",
                    newEntry.isOpeningBalance
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "text-neutral-500 border-neutral-800 hover:border-neutral-700"
                  )}
                >
                  Opening
                </button>
              </div>

              {newEntry.isOpeningBalance ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Cash Balance (₹)</label>
                      <input 
                        type="number" 
                        value={newEntry.openingCash}
                        onChange={(e) => setNewEntry({ ...newEntry, openingCash: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-emerald-400 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Bank Balance (₹)</label>
                      <input 
                        type="number" 
                        value={newEntry.openingBank}
                        onChange={(e) => setNewEntry({ ...newEntry, openingBank: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-blue-400 font-bold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Grand Total Income (₹)</label>
                      <input 
                        type="number" 
                        value={newEntry.openingIncome}
                        onChange={(e) => setNewEntry({ ...newEntry, openingIncome: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-emerald-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Grand Total Expense (₹)</label>
                      <input 
                        type="number" 
                        value={newEntry.openingExpense}
                        onChange={(e) => setNewEntry({ ...newEntry, openingExpense: Number(e.target.value) })}
                        className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-rose-500 font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500 italic">
                    * Use these fields to set your historical totals from before using this app.
                  </p>
                </div>
              ) : newEntry.isWithdrawal && (
                <div>
                  <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Withdrawal Amount (₹)</label>
                  <input 
                    type="number" 
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({ ...newEntry, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-emerald-400 font-bold"
                  />
                </div>
              )}
            </div>

            <button 
              onClick={handleAddEntry}
              disabled={saving}
              className="w-full mt-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  Save Transaction
                </>
              )}
            </button>
          </motion.div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-sm max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800 text-center"
          >
            <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-neutral-100 mb-2">Confirm Delete</h3>
            <p className="text-neutral-500 mb-8">Are you sure you want to delete this transaction? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteEntry}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-900/20"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showOpeningModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-neutral-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-2xl font-bold text-neutral-100">Opening Balances</h3>
                <p className="text-neutral-500">Manage your initial system balances and historical totals.</p>
              </div>
              <button 
                onClick={() => setShowOpeningModal(false)} 
                className="text-neutral-500 hover:text-neutral-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {openingBalances.length === 0 ? (
                <div className="p-12 text-center text-neutral-600 italic border-2 border-dashed border-neutral-800 rounded-2xl">
                  No opening balances found.
                </div>
              ) : (
                <div className="space-y-3">
                  {openingBalances.map(acc => (
                    <div key={acc.id} className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-700 flex items-center justify-between group">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-neutral-200">{acc.particulars}</span>
                          <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">
                            {acc.method}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-neutral-500 font-medium">
                          <span>Date: {format(acc.date instanceof Date ? acc.date : acc.date.toDate(), 'dd/MM/yyyy')}</span>
                          <span className="text-emerald-500">Amount: ₹{acc.amount.toLocaleString()}</span>
                          {acc.openingIncome > 0 && <span className="text-indigo-400">Income: ₹{acc.openingIncome.toLocaleString()}</span>}
                          {acc.openingExpense > 0 && <span className="text-rose-400">Expense: ₹{acc.openingExpense.toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            handleEditClick(acc);
                            setShowOpeningModal(false);
                          }}
                          className="p-2 text-neutral-500 hover:text-indigo-400"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => setDeletingId(acc.id)}
                          className="p-2 text-neutral-500 hover:text-rose-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-neutral-800">
              <button 
                onClick={() => {
                  setShowOpeningModal(false);
                  setShowAddModal(true);
                  setNewEntry({
                    ...newEntry,
                    isOpeningBalance: true,
                    particulars: 'Opening Balance',
                    openingIncome: 333990,
                    openingExpense: 280850,
                    date: new Date(2025, 4, 1)
                  });
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
              >
                Add New Opening Balance
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
