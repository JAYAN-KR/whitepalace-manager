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
  ChevronLeft
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
import { UserProfile, PaymentRecord, Announcement, UserRole, AccountEntry } from './types';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
        
        <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
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
4. Maintenance Payments: Residents agree to pay maintenance dues as specified by the Apartment Association. Late payments may incur penalties as decided by the committee.
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
3. Cancellation: Residents cannot "cancel" a maintenance payment once it has been successfully processed.
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
4. Support: For any issues regarding access or delivery of service, please contact the administrator at jkrsanskrit@gmail.com.`
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
              Access Resident Portal
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
          <p className="text-neutral-500 leading-relaxed">Comprehensive tools for committee members to track dues and manage resident data efficiently.</p>
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
          <p className="text-xs text-neutral-500">Contact: jkrsanskrit@gmail.com</p>
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
        mustChangePassword: false
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'announcements' | 'legal' | 'accounts' | 'ledger'>('dashboard');
  const [showLegalPublic, setShowLegalPublic] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Real-time data
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);

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
          // Default to owner for new users unless it's the bootstrapped admin
          const isBootstrappedAdmin = firebaseUser.email === 'jkrsanskrit@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=random`,
            role: isBootstrappedAdmin ? 'superadmin' : 'owner',
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
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

    if (profile.role === 'admin' || profile.role === 'superadmin') {
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
    };
  }, [profile]);

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

  const isSuperAdmin = profile.role === 'superadmin' || profile.email === 'jkrsanskrit@gmail.com';
  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin' || profile.email === 'jkrsanskrit@gmail.com';
  const isOwner = profile.role === 'owner';

  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <div className="min-h-screen bg-neutral-950 flex flex-col md:flex-row">
      {profile?.mustChangePassword && user && <PasswordChangeOverlay user={user} />}
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-neutral-900 border-b md:border-r border-neutral-800 p-4 flex flex-col gap-2">
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
          {isAdmin && (
            <SidebarItem 
              active={activeTab === 'users'} 
              onClick={() => setActiveTab('users')}
              icon={<Users size={20} />}
              label="Residents"
              activeColor="emerald"
            />
          )}
          <SidebarItem 
            active={activeTab === 'announcements'} 
            onClick={() => setActiveTab('announcements')}
            icon={<Megaphone size={20} />}
            label="Announcements"
            activeColor="amber"
          />
          {isAdmin && (
            <SidebarItem 
              active={activeTab === 'accounts'} 
              onClick={() => setActiveTab('accounts')}
              icon={<Wallet size={20} />}
              label="Accounts"
              activeColor="rose"
            />
          )}
          {isAdmin && (
            <SidebarItem 
              active={activeTab === 'ledger'} 
              onClick={() => setActiveTab('ledger')}
              icon={<FileText size={20} />}
              label="Payment Report"
              activeColor="emerald"
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
            <p className="text-xs font-semibold text-neutral-300">jkrsanskrit@gmail.com</p>
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-screen bg-neutral-950">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-blue-400 uppercase">
            White Palace Appartment
          </h1>
          <div className="flex flex-col items-center gap-1">
            <p className="text-neutral-400 font-medium tracking-wide">Mamppilly Lane, Eroor PO</p>
            <p className="text-neutral-500 text-sm font-bold tracking-widest uppercase">Tripunithura-682306</p>
          </div>
          <div className="mt-6 h-1 w-24 bg-gradient-to-r from-indigo-500 to-blue-500 mx-auto rounded-full opacity-50" />
        </div>

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

          {activeTab === 'users' && isAdmin && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <UserManagement users={allUsers} currentUser={profile} isSuperAdmin={isSuperAdmin} />
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

          {activeTab === 'accounts' && isAdmin && (
            <motion.div 
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AccountsManagement accounts={accounts} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
            </motion.div>
          )}

          {activeTab === 'ledger' && isAdmin && (
            <motion.div 
              key="ledger"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PaymentReport accounts={accounts} payments={payments} residents={allUsers} />
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
        </AnimatePresence>
      </main>
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
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Resident</p>
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

          {payment.paidAt && (
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Payment Date</p>
              <p className="font-bold text-neutral-100">{format(payment.paidAt.toDate(), 'PPP p')}</p>
            </div>
          )}

          {payment.particulars && (
            <div className="bg-neutral-800/50 p-4 rounded-2xl border border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest mb-1">Notes</p>
              <p className="text-sm text-neutral-300 italic">"{payment.particulars}"</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-neutral-800/30 border-t border-neutral-800">
          <button 
            onClick={onClose}
            className="w-full py-4 bg-neutral-100 text-neutral-900 font-bold rounded-2xl hover:bg-white transition-all shadow-lg"
          >
            Close Details
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AdminDashboard({ stats, onViewHistory }: { stats: { users: UserProfile[], payments: PaymentRecord[], announcements: Announcement[], accounts: AccountEntry[] }, onViewHistory: () => void }) {
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const isOverdue = (monthKey: string) => {
    if (!monthKey) return false;
    const [year, month] = monthKey.split('-').map(Number);
    // Payment for month M is due by the 10th of month M+1
    const dueDate = new Date(year, month, 10); 
    return new Date() > dueDate;
  };

  // Calculate Total Income from filtered accounts (Ledger)
  const totalIncome = stats.accounts.reduce((acc, a) => acc + Number(a.income || 0), 0);
  
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        label="Total Residents" 
        value={stats.users.length.toString()} 
        icon={<Users size={20} />} 
        color="blue" 
      />
      <StatCard 
        label="Total Income" 
        value={`₹${totalIncome.toLocaleString()}`} 
        icon={<TrendingUp size={20} />} 
        color="green" 
      />
      <StatCard 
        label="Pending Dues" 
        value={`₹${pendingAmount.toLocaleString()}`} 
        icon={<AlertCircle size={20} />} 
        color="orange" 
      />

      <div className="md:col-span-2 bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm">
        <h3 className="text-lg font-bold text-neutral-100 mb-6">Revenue Overview</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
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
            <button 
              key={payment.id} 
              onClick={() => setSelectedPayment(payment)}
              className="w-full flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-2xl transition-all group text-left"
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                payment.status === 'paid' ? "bg-green-900/30 text-green-400" : "bg-orange-900/30 text-orange-400"
              )}>
                {payment.status === 'paid' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-100 truncate">{payment.ownerName}</p>
                <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-tight">Flat {payment.flatNumber} • ₹{payment.amount}</p>
              </div>
              <span className="text-[10px] font-black text-neutral-600 uppercase">{format(payment.createdAt?.toDate() || new Date(), 'MMM d')}</span>
            </button>
          ))}
          {stats.payments.length === 0 && (
            <p className="text-center py-8 text-neutral-600 font-medium italic">No recent activity.</p>
          )}
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
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
              <button 
                key={payment.id} 
                onClick={() => setSelectedPayment(payment)}
                className="w-full flex items-center justify-between p-4 bg-neutral-800/50 rounded-2xl border border-neutral-800/50 hover:bg-neutral-800 transition-all text-left"
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
                    <p className="font-bold text-neutral-100">{format(new Date(payment.month + '-01'), 'MMMM yyyy')}</p>
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

function QuickMaintenanceForm({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [date, setDate] = useState(new Date());
  const [amount, setAmount] = useState(1200);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owners, setOwners] = useState<any[]>([]);
  const [loadingResidents, setLoadingResidents] = useState(true);

  const getCurrentMonth = (d: Date) => {
    const prevDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return {
      month: MONTHS[prevDate.getMonth()],
      year: prevDate.getFullYear()
    };
  };

  useEffect(() => {
    const fetchResidents = async () => {
      setLoadingResidents(true);
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'owner'));
        const snapshot = await getDocs(q);
        const current = getCurrentMonth(date);
        const residents = snapshot.docs.map(doc => ({
          uid: doc.id,
          flatNumber: doc.data().flatNumber || doc.data().unitNumber || '?',
          displayName: doc.data().displayName || 'Unknown',
          selected: false,
          customAmount: 1200,
          date: date,
          months: 1,
          forMonth: current.month,
          forYear: current.year
        }));
        
        if (residents.length > 0) {
          setOwners(residents.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true, sensitivity: 'base' })));
        } else {
          // Fallback if no residents found in system yet
          const fallback = [
            { flatNumber: 'A1', displayName: 'Renjini' },
            { flatNumber: 'A2', displayName: 'Deepu' },
            { flatNumber: 'A3', displayName: 'Sudha Subramaniyan' },
            { flatNumber: 'B1', displayName: 'Anila Kuruvilla' },
            { flatNumber: 'B2', displayName: 'Suresh' },
            { flatNumber: 'B3', displayName: 'Prathap PV' },
            { flatNumber: 'C1', displayName: 'Jayalakshmi' },
            { flatNumber: 'C2', displayName: 'Sindhu' },
            { flatNumber: 'C3', displayName: 'Jayan KR' },
            { flatNumber: 'D2', displayName: 'Usha G Menon' },
            { flatNumber: 'D3', displayName: 'Prem Narayanan' },
            { flatNumber: 'E2', displayName: 'Balachandran' },
            { flatNumber: 'E3', displayName: 'Vidyashekhar' },
            { flatNumber: 'F1', displayName: 'MohanaKrishnan' },
            { flatNumber: 'F2', displayName: 'Sudha Dinaker' },
            { flatNumber: 'F3', displayName: 'Seema Sreekumar' }
          ].map(o => ({
            ...o,
            uid: '',
            selected: false,
            customAmount: 1200,
            date: new Date(),
            months: 1,
            forMonth: current.month,
            forYear: current.year
          }));
          setOwners(fallback);
        }
      } catch (err) {
        console.error("Error fetching residents:", err);
        toast.error("Failed to load residents.");
      } finally {
        setLoadingResidents(false);
      }
    };

    fetchResidents();
  }, []);

  const handleSyncFromResidents = async () => {
    setLoadingResidents(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'owner'));
      const snapshot = await getDocs(q);
      const current = getCurrentMonth(date);
      const residents = snapshot.docs.map(doc => ({
        uid: doc.id,
        flatNumber: doc.data().flatNumber || doc.data().unitNumber || '?',
        displayName: doc.data().displayName || 'Unknown',
        selected: false,
        customAmount: 1200,
        date: date,
        months: 1,
        forMonth: current.month,
        forYear: current.year
      }));
      if (residents.length > 0) {
        setOwners(residents.sort((a, b) => a.flatNumber.localeCompare(b.flatNumber, undefined, { numeric: true, sensitivity: 'base' })));
        toast.success("Resident list updated.");
      } else {
        toast.error("No residents found in system.");
      }
    } catch (err) {
      toast.error("Failed to sync residents.");
    } finally {
      setLoadingResidents(false);
    }
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

        const particulars = `${owner.flatNumber} ${owner.displayName} (${description})`;

        await addDoc(collection(db, 'accounts'), {
          date: Timestamp.fromDate(paymentDate),
          particulars: particulars,
          income: owner.customAmount,
          expense: 0,
          method: 'bank',
          isWithdrawal: false,
          isOpeningBalance: false,
          forMonth: endForMonth,
          forYear: endForYear,
          createdAt: serverTimestamp()
        });

        // 2. Create/Update PaymentRecord in 'payments' collection for resident dashboard
        for (let i = 0; i < owner.months; i++) {
          const currentForDate = new Date(owner.forYear, startMonthIdx + i, 1);
          const currentForMonth = MONTHS[currentForDate.getMonth()];
          const currentForYear = currentForDate.getFullYear();
          const monthKey = `${currentForYear}-${String(currentForDate.getMonth() + 1).padStart(2, '0')}`;

          // Check if a payment record already exists for this month/flat
          const q = query(
            collection(db, 'payments'), 
            where('ownerUid', '==', owner.uid),
            where('month', '==', monthKey)
          );
          
          // We can't use getDocs easily here without await, so we'll just add a new one or use a specific ID
          // To avoid duplicates, let's use a deterministic ID: ownerUid_monthKey
          const paymentId = `${owner.uid}_${monthKey}`;
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
            particulars: `Manual Entry: ${particulars}`
          }, { merge: true });

          // 3. Create shadow entries for future months (Advance Allocation) in 'accounts'
          // Only create shadow entries for months AFTER the payment month
          if (currentForDate > paymentMonthYear) {
            await addDoc(collection(db, 'accounts'), {
              date: null, // No date for shadow entries
              particulars: `${owner.flatNumber} ${owner.displayName} (From advance payment of ${MONTHS[paymentDate.getMonth()]})`,
              income: 0, // Doesn't affect balance
              displayAmount: monthlyAmount, // For UI display
              expense: 0,
              method: 'bank',
              isWithdrawal: false,
              isOpeningBalance: false,
              isAdvanceAllocation: true,
              originalPaymentDate: Timestamp.fromDate(paymentDate),
              forMonth: currentForMonth,
              forYear: currentForYear,
              createdAt: serverTimestamp()
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
        <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Resident List</h4>
        <button 
          onClick={handleSyncFromResidents}
          className="flex items-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <RefreshCw size={14} />
          Sync from Residents
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-2 no-scrollbar">
        {loadingResidents ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <RefreshCw className="text-indigo-500 animate-spin" size={24} />
            <p className="text-sm text-neutral-500 font-medium">Loading residents...</p>
          </div>
        ) : owners.map((owner, idx) => (
          <div key={idx} className={cn(
            "p-3 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center gap-4",
            owner.selected ? "bg-indigo-900/10 border-indigo-500/20" : "bg-neutral-800/30 border-neutral-700 opacity-40"
          )}>
            <div className="flex items-center gap-3 min-w-[180px]">
              <input 
                type="checkbox" 
                checked={owner.selected}
                onChange={() => {
                  const newOwners = [...owners];
                  newOwners[idx].selected = !newOwners[idx].selected;
                  setOwners(newOwners);
                }}
                className="w-5 h-5 rounded-lg bg-neutral-700 border-neutral-600 text-indigo-600 focus:ring-indigo-500"
              />
              <p className="text-sm font-bold text-neutral-100 truncate">{owner.flatNumber} {owner.displayName}</p>
            </div>
            
            <div className="flex-1 grid grid-cols-4 gap-2">
              <div className="relative">
                <input 
                  type="date" 
                  value={format(owner.date, 'yyyy-MM-dd')}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    newOwners[idx].date = new Date(e.target.value);
                    setOwners(newOwners);
                  }}
                  className="w-full px-2 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="relative flex gap-1 items-center">
                <select
                  value={owner.forMonth}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    newOwners[idx].forMonth = e.target.value;
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
                    newOwners[idx].forYear = Number(e.target.value);
                    setOwners(newOwners);
                  }}
                  className="w-12 px-1 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="relative">
                <select
                  value={owner.months}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    const newOwners = [...owners];
                    newOwners[idx].months = val;
                    // Auto-calculate amount based on months
                    newOwners[idx].customAmount = val * amount;
                    setOwners(newOwners);
                  }}
                  className="w-full px-2 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] text-neutral-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>1 Year</option>
                </select>
              </div>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-600 text-[10px]">₹</span>
                <input 
                  type="number"
                  value={owner.customAmount}
                  onChange={(e) => {
                    const newOwners = [...owners];
                    newOwners[idx].customAmount = Number(e.target.value);
                    setOwners(newOwners);
                  }}
                  className="w-full pl-5 pr-2 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-[10px] font-bold text-emerald-400 focus:ring-1 focus:ring-indigo-500 outline-none"
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

function StatCard({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) {
  const colorVariants: Record<string, string> = {
    "blue": "border-blue-900/30 bg-blue-950/10",
    "green": "border-green-900/30 bg-green-950/10",
    "orange": "border-orange-900/30 bg-orange-950/10",
    "indigo": "border-indigo-900/30 bg-indigo-950/10"
  };

  const iconColorVariants: Record<string, string> = {
    "blue": "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    "green": "bg-green-500/10 text-green-400 border border-green-500/20",
    "orange": "bg-orange-500/10 text-orange-400 border border-orange-500/20",
    "indigo": "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
  };

  return (
    <div className={cn("p-6 rounded-3xl border shadow-sm flex items-center gap-4 transition-all hover:shadow-lg hover:border-neutral-700", colorVariants[color] || "bg-neutral-900 border-neutral-800")}>
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm", iconColorVariants[color] || "bg-neutral-800 text-neutral-400")}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-black text-neutral-100">{value}</p>
      </div>
    </div>
  );
}

function UserManagement({ users, currentUser, isSuperAdmin }: { users: UserProfile[], currentUser: UserProfile, isSuperAdmin: boolean }) {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [flatNumber, setFlatNumber] = useState('');
  const [copying, setCopying] = useState(false);
  
  // Create User Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newFlat, setNewFlat] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('owner');
  const [hasNoEmail, setHasNoEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingUser, setDeletingUser] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
        createdAt: serverTimestamp(),
        mustChangePassword: true,
        hasNoEmail: hasNoEmail
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
      toast.success('Resident created successfully!');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create resident');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (uid: string, currentRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 
        flatNumber: flatNumber,
        role: currentRole // Keep role for now, or add role select if needed
      });
      setEditingUser(null);
      setFlatNumber('');
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const toggleRole = (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'owner' : 'admin';
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

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Resident Management</h2>
          <p className="text-sm text-neutral-500">Manage flat assignments and roles for all residents.</p>
        </div>
        
        {isSuperAdmin && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-900/20"
            >
              <Plus size={20} />
              Create Resident
            </button>

            <button 
              onClick={() => {
                toast.promise(new Promise(resolve => setTimeout(resolve, 800)), {
                  loading: 'Syncing residents...',
                  success: 'Resident list synced successfully',
                  error: 'Failed to sync residents',
                });
              }}
              className="px-4 py-3 bg-neutral-800 text-neutral-300 rounded-2xl font-bold flex items-center gap-2 hover:bg-neutral-700 transition-all border border-neutral-700"
            >
              <RefreshCw size={18} />
              Sync Residents
            </button>
            
            <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-800 shadow-sm flex items-center gap-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Invite Residents</span>
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
                <h3 className="text-xl font-bold text-neutral-100">Create New Resident Account</h3>
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
                        An internal email will be generated for this resident.
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
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Account Role</label>
                    <select 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    >
                      <option value="owner">Owner (Resident)</option>
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
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Resident</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Flat</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {sortedUsers.map(user => (
              <tr key={user.uid} className="hover:bg-neutral-800/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={user.photoURL} className="w-10 h-10 rounded-full border border-neutral-800" alt="" />
                    <div>
                      <p className="font-bold text-neutral-100">{user.displayName}</p>
                      <p className="text-xs text-neutral-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingUser?.uid === user.uid ? (
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
                      {user.role}
                    </button>
                </td>
                <td className="px-6 py-4 text-right">
                  {isSuperAdmin && (
                    editingUser?.uid === user.uid ? (
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
                          }} 
                          className="text-neutral-500 hover:text-neutral-100 transition-colors font-medium text-sm"
                        >
                          Edit Flat
                        </button>
                        {user.uid !== currentUser.uid && (
                          <button 
                            onClick={() => setDeletingUser(user)}
                            className="text-neutral-500 hover:text-red-400 transition-all p-2 hover:bg-red-900/20 rounded-lg group"
                            title="Delete Resident"
                          >
                            <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    )
                  )}
                </td>
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
            <h3 className="text-xl font-bold text-neutral-100 mb-2">Delete Resident</h3>
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
        {isSuperAdmin && (
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

function PaymentReport({ accounts, payments, residents }: { accounts: AccountEntry[], payments: PaymentRecord[], residents: UserProfile[] }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [hoveredCell, setHoveredCell] = useState<{ flat: string, month: number } | null>(null);
  
  const owners = useMemo(() => {
    return residents
      .filter(r => r.role === 'owner')
      .sort((a, b) => (a.flatNumber || '').localeCompare(b.flatNumber || '', undefined, { numeric: true, sensitivity: 'base' }));
  }, [residents]);

  const paymentMap = useMemo(() => {
    const map = new Map<string, Map<string, any>>(); // flat -> "YYYY-MM" -> data

    // 1. Process accounts (manual entries)
    accounts.forEach(acc => {
      if (acc.income === 0 && !acc.isAdvanceAllocation) return;
      if (acc.isOpeningBalance || acc.isWithdrawal) return;

      const particulars = acc.particulars;
      const match = particulars.match(/^([A-Z0-9]+)\s+(.*?)\s*\((.*?)\)$/);
      const flat = match ? match[1] : (acc.particulars.split(' ')[0] || 'N/A');
      
      if (!map.has(flat)) map.set(flat, new Map());
      const flatMap = map.get(flat)!;

      const dateObj = acc.date instanceof Date ? acc.date : acc.date?.toDate();
      
      if (acc.isAdvanceAllocation) {
        // Shadow entries explicitly have forMonth and forYear
        const monthIdx = MONTHS.indexOf(acc.forMonth || '');
        if (monthIdx !== -1) {
          const key = `${acc.forYear}-${String(monthIdx).padStart(2, '0')}`;
          flatMap.set(key, {
            amount: acc.displayAmount || 0,
            date: acc.originalPaymentDate?.toDate() || null,
            source: 'Manual (Advance)',
            particulars: acc.particulars,
            period: `${acc.forMonth} ${acc.forYear}`
          });
        }
      } else if (acc.income > 0) {
        // Main entries might cover multiple months. 
        // We need to figure out which months they cover.
        const description = match ? match[3] : '';
        if (description.includes(' to ')) {
          // Range payment: e.g. "JAN to MAR"
          const parts = description.replace('Advance: ', '').split(' to ');
          const fromMonth = parts[0].split(' ')[0];
          const toMonth = parts[1].split(' ')[0];
          const year = parseInt(parts[1].split(' ')[1]) || dateObj?.getFullYear() || selectedYear;
          
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
                  amount: monthlyAmount,
                  date: dateObj,
                  source: 'Manual',
                  particulars: acc.particulars,
                  period: description
                });
              }
            }
          }
        } else {
          // Single month payment
          const monthPart = description.split(' ')[0];
          const yearPart = parseInt(description.split(' ')[1]) || dateObj?.getFullYear() || selectedYear;
          const mIdx = MONTHS.indexOf(monthPart);
          if (mIdx !== -1) {
            const key = `${yearPart}-${String(mIdx).padStart(2, '0')}`;
            flatMap.set(key, {
              amount: acc.income,
              date: dateObj,
              source: 'Manual',
              particulars: acc.particulars,
              period: description
            });
          } else if (dateObj) {
            // Fallback to payment date if description parsing fails
            const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth()).padStart(2, '0')}`;
            if (!flatMap.has(key)) {
              flatMap.set(key, {
                amount: acc.income,
                date: dateObj,
                source: 'Manual',
                particulars: acc.particulars,
                period: description
              });
            }
          }
        }
      }
    });

    // 2. Process online payments
    payments.forEach(p => {
      if (p.status !== 'paid') return;
      const flat = p.flatNumber;
      if (!map.has(flat)) map.set(flat, new Map());
      const flatMap = map.get(flat)!;

      const [year, month] = p.month.split('-').map(Number);
      const key = `${year}-${String(month - 1).padStart(2, '0')}`;
      
      const dateObj = p.paidAt instanceof Date ? p.paidAt : p.paidAt?.toDate() || p.createdAt?.toDate();

      flatMap.set(key, {
        amount: p.amount,
        date: dateObj,
        source: 'Online',
        particulars: `Online Payment - Ref: ${p.transactionId || 'N/A'}`,
        period: format(new Date(p.month + '-01'), 'MMMM yyyy')
      });
    });

    return map;
  }, [accounts, payments, selectedYear]);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  // System start date: March 2026
  const SYSTEM_START_MONTH = 2; // March
  const SYSTEM_START_YEAR = 2026;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-100">Maintenance Ledger</h2>
          <p className="text-sm text-neutral-500">Track monthly payments for all residents.</p>
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
          
          <button 
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," 
                + "Resident,Flat," + MONTHS.join(",") + "\n"
                + owners.map(o => {
                  const flatMap = paymentMap.get(o.flatNumber || '') || new Map();
                  const row = MONTHS.map((_, i) => {
                    const key = `${selectedYear}-${String(i).padStart(2, '0')}`;
                    const isFuture = selectedYear > currentYear || (selectedYear === currentYear && i > currentMonth);
                    const isBeforeStart = selectedYear < SYSTEM_START_YEAR || (selectedYear === SYSTEM_START_YEAR && i < SYSTEM_START_MONTH);
                    
                    const dueDate = new Date(selectedYear, i + 1, 10);
                    const isOverdue = new Date() > dueDate;
                    
                    if (flatMap.has(key)) return "PAID";
                    if (isFuture || isBeforeStart || !isOverdue) return "-";
                    return "PENDING";
                  });
                  return `"${o.displayName}","${o.flatNumber}",` + row.join(",");
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

      <div className="bg-neutral-900 rounded-3xl border border-neutral-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-800/50">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest border-r border-neutral-700 sticky left-0 bg-neutral-900/95 backdrop-blur-sm z-20">Resident</th>
                {MONTHS.map((month, i) => (
                  <th key={month} className="px-2 py-4 text-[11px] font-black text-neutral-400 uppercase tracking-widest text-center border-r border-neutral-700 bg-neutral-800/30">
                    {month}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {owners.map((owner) => {
                const flat = owner.flatNumber || '';
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
                      const dueDate = new Date(selectedYear, i + 1, 10);
                      const isOverdue = new Date() > dueDate;
                      
                      // A month is pending only if it's NOT paid, NOT in the future, NOT before system start, and IS overdue
                      const isPending = !payment && !isFuture && !isBeforeStart && isOverdue;
                      
                      return (
                        <td 
                          key={i} 
                          className="p-1 border-r border-neutral-700 relative"
                          onMouseEnter={() => setHoveredCell({ flat, month: i })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div className={cn(
                            "w-full aspect-square rounded-lg flex items-center justify-center transition-all duration-300",
                            payment ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.1)]" : 
                            isPending ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.1)]" : 
                            "bg-neutral-800/40 text-neutral-600 border border-neutral-700/30"
                          )}>
                            {payment ? <Check size={16} strokeWidth={3} /> : isPending ? <AlertCircle size={16} /> : null}
                          </div>

                          <AnimatePresence>
                            {hoveredCell?.flat === flat && hoveredCell?.month === i && (
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
                                      payment ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                    )}>
                                      {payment ? 'PAID' : 'PENDING'}
                                    </span>
                                  </div>
                                  
                                  {payment ? (
                                    <>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-neutral-500">Amount</span>
                                        <span className="text-xs font-bold text-emerald-400">₹{payment.amount.toLocaleString()}</span>
                                      </div>
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
    </div>
  );
}

function AccountsManagement({ accounts, isAdmin, isSuperAdmin }: { accounts: AccountEntry[], isAdmin: boolean, isSuperAdmin: boolean }) {
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
      if (acc.isOpeningBalance) {
        // Opening balance is not counted as monthly income/expense
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
        const entryData = {
          particulars: newEntry.particulars,
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
          date: Timestamp.fromDate(newEntry.date as Date)
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
      await deleteDoc(doc(db, 'accounts', deletingId));
      setDeletingId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `accounts/${deletingId}`);
    }
  };

  const handleEditClick = (acc: AccountEntry) => {
    setEditingEntry(acc);
    setNewEntry({
      date: acc.date,
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sticky top-0 z-10 bg-neutral-950/80 backdrop-blur-md py-4 border-b border-neutral-700">
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Cash in Hand</p>
          <p className="text-2xl font-bold text-emerald-400">₹{balances.grand.cashInHand.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Cash in Bank</p>
          <p className="text-2xl font-bold text-blue-400">₹{balances.grand.cashInBank.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total Income</p>
          <p className="text-2xl font-bold text-indigo-400">₹{balances.grand.income.toLocaleString()}</p>
        </div>
        <div className="bg-neutral-900 p-4 rounded-2xl border border-neutral-700">
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Total Expense</p>
          <p className="text-2xl font-bold text-rose-400">₹{balances.grand.expense.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2 bg-neutral-900 p-1.5 rounded-2xl border border-neutral-700">
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

        <div className="flex flex-wrap gap-2 p-2 bg-neutral-900 rounded-2xl border border-neutral-700 overflow-x-auto no-scrollbar flex-1">
          {months.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                selectedMonth === index 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" 
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              )}
            >
              {month}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-700 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-neutral-100">{months[selectedMonth]} {selectedYear} Accounts</h3>
            <p className="text-sm text-neutral-500">Monthly income and expense tracking.</p>
          </div>
          {isSuperAdmin && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowQuickModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
              >
                <Zap size={18} />
                Post Maintenance
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20"
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
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-700">Date</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-700">Particulars</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-700">For Month</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-700 text-right">Income (₹)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest border-r border-neutral-700 text-right">Expense (₹)</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Running Balance</th>
                {isSuperAdmin && <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-20 text-center text-neutral-600 italic">
                    No transactions recorded for {months[selectedMonth]} {selectedYear}.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => (
                  <tr key={acc.id} className={cn(
                    "hover:bg-neutral-800/30 transition-colors",
                    acc.isAdvanceAllocation && "bg-yellow-900/5"
                  )}>
                    <td className="px-6 py-4 border-r border-neutral-700">
                      {!acc.isAdvanceAllocation && acc.date && (
                        <div className="flex items-center gap-2 text-neutral-300 font-medium">
                          <Calendar size={14} className="text-neutral-500" />
                          {format(acc.date, 'dd MMM yyyy')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-700">
                      <span className={cn(
                        "text-neutral-300",
                        acc.isAdvanceAllocation && "text-yellow-500/80 italic text-sm"
                      )}>
                        {acc.particulars}
                      </span>
                      {acc.method === 'bank' && !acc.isAdvanceAllocation && <span className="ml-2 text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded-full font-bold uppercase">Bank</span>}
                      {acc.isWithdrawal && <span className="ml-2 text-[10px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase">Withdrawal</span>}
                      {acc.isOpeningBalance && <span className="ml-2 text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Opening Balance</span>}
                    </td>
                    <td className="px-6 py-4 border-r border-neutral-700 text-center">
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
                                  {acc.forMonth} {acc.forYear}
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
                    <td className="px-6 py-4 border-r border-neutral-700 text-right font-bold">
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
                    <td className="px-6 py-4 border-r border-neutral-700 text-right font-bold text-rose-500">
                      {acc.expense > 0 ? `-₹${acc.expense.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-100">
                      <div className="flex flex-col items-end">
                        <span className="font-bold text-emerald-400">C: ₹{acc.runningCashBalance?.toLocaleString()}</span>
                        <span className="text-xs text-blue-400">B: ₹{acc.runningBankBalance?.toLocaleString()}</span>
                      </div>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {filteredAccounts.length > 0 && (
              <tfoot className="bg-neutral-800 font-bold border-t-2 border-neutral-600">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-right text-neutral-400 uppercase tracking-wider text-xs border-r border-neutral-700">Monthly Totals</td>
                  <td className="px-6 py-4 text-right text-emerald-400 border-r border-neutral-700">₹{monthlyTotals.income.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-rose-400 border-r border-neutral-700">₹{monthlyTotals.expense.toLocaleString()}</td>
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
              className="bg-neutral-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-neutral-100">Post Maintenance Receipts</h3>
                  <p className="text-sm text-neutral-500">Select residents to record their online maintenance payments manually.</p>
                </div>
                <button onClick={() => setShowQuickModal(false)} className="p-2 text-neutral-500 hover:text-neutral-300">
                  <X size={24} />
                </button>
              </div>

              <QuickMaintenanceForm 
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
                  onChange={(e) => setNewEntry({ ...newEntry, date: new Date(e.target.value) })}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
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
                  onClick={() => setNewEntry({ ...newEntry, isOpeningBalance: true, isWithdrawal: false, income: 0, expense: 0, particulars: newEntry.particulars || 'Opening Balance' })}
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
    </div>
  );
}
