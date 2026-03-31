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
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
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

1. Information Collection: We collect information you provide directly to us, such as your name, email, unit number, and payment details.
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'payments' | 'announcements' | 'legal' | 'accounts'>('dashboard');
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
          setProfile(userDoc.data() as UserProfile);
        } else {
          // Default to owner for new users unless it's the bootstrapped admin
          const isBootstrappedAdmin = firebaseUser.email === 'jkrsanskrit@gmail.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=random`,
            role: isBootstrappedAdmin ? 'admin' : 'owner',
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
      setAccounts(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate() || new Date()
        } as unknown as AccountEntry;
      }));
    });

    let unsubPayments = () => {};
    let unsubUsers = () => {};

    if (profile.role === 'admin') {
      const qPayments = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
      unsubPayments = onSnapshot(qPayments, (snapshot) => {
        setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentRecord)));
      });

      const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      unsubUsers = onSnapshot(qUsers, (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as UserProfile)));
      });
    } else {
      const qPayments = query(
        collection(db, 'payments'), 
        where('ownerUid', '==', profile.uid),
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

  const isAdmin = profile.role === 'admin';

  return (
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
            active={activeTab === 'payments'} 
            onClick={() => setActiveTab('payments')}
            icon={<CreditCard size={20} />}
            label="Payments"
            activeColor="blue"
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
            <p className="text-[10px] text-neutral-500">AptManager Support</p>
          </div>
          <div className="flex items-center gap-3 px-2">
            <img src={profile.photoURL} className="w-10 h-10 rounded-full border border-neutral-800" alt="Avatar" />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-neutral-100 truncate">{profile.displayName}</span>
              <span className="text-xs text-neutral-500 capitalize">{profile.role} {profile.unitNumber && `• ${profile.unitNumber}`}</span>
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
                      <span className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Unit Number</span>
                      <span className="text-lg font-bold text-neutral-100">{profile.unitNumber || 'Not Assigned'}</span>
                    </div>
                  </div>
                )}
              </header>

              {isAdmin ? (
                <AdminDashboard stats={{ users: allUsers, payments, announcements }} />
              ) : (
                <OwnerDashboard 
                  stats={{ payments, announcements }} 
                  profile={profile} 
                  onPayNow={() => setActiveTab('payments')} 
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
              <UserManagement users={allUsers} />
            </motion.div>
          )}

          {activeTab === 'payments' && (
            <motion.div 
              key="payments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PaymentManagement payments={payments} isAdmin={isAdmin} profile={profile} residents={allUsers} />
            </motion.div>
          )}

          {activeTab === 'announcements' && (
            <motion.div 
              key="announcements"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AnnouncementManagement announcements={announcements} isAdmin={isAdmin} profile={profile} />
            </motion.div>
          )}

          {activeTab === 'accounts' && (
            <motion.div 
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AccountsManagement accounts={accounts} isAdmin={isAdmin} />
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

function AdminDashboard({ stats }: { stats: { users: UserProfile[], payments: PaymentRecord[], announcements: Announcement[] } }) {
  const totalCollected = stats.payments.filter(p => p.status === 'paid').reduce((acc, p) => acc + p.amount, 0);
  const pendingAmount = stats.payments.filter(p => p.status === 'pending').reduce((acc, p) => acc + p.amount, 0);
  
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    return months.map((month, index) => {
      const monthStr = `${currentYear}-${String(index + 1).padStart(2, '0')}`;
      const monthPayments = stats.payments.filter(p => p.month === monthStr && p.status === 'paid');
      return {
        name: month,
        amount: monthPayments.reduce((acc, p) => acc + p.amount, 0)
      };
    });
  }, [stats.payments]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <StatCard 
        label="Total Residents" 
        value={stats.users.length.toString()} 
        icon={<Users size={20} />} 
        color="blue" 
      />
      <StatCard 
        label="Collected This Year" 
        value={`₹${totalCollected.toLocaleString()}`} 
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
          <History size={18} className="text-neutral-500" />
        </div>
        <div className="space-y-4">
          {stats.payments.slice(0, 5).map(payment => (
            <div key={payment.id} className="flex items-center gap-3 p-3 hover:bg-neutral-800 rounded-2xl transition-all group">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
                payment.status === 'paid' ? "bg-green-900/30 text-green-400" : "bg-orange-900/30 text-orange-400"
              )}>
                {payment.status === 'paid' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-100 truncate">{payment.ownerName}</p>
                <p className="text-[11px] font-medium text-neutral-500 uppercase tracking-tight">Unit {payment.unitNumber} • ₹{payment.amount}</p>
              </div>
              <span className="text-[10px] font-black text-neutral-600 uppercase">{format(payment.createdAt?.toDate() || new Date(), 'MMM d')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnerDashboard({ stats, profile, onPayNow }: { stats: { payments: PaymentRecord[], announcements: Announcement[] }, profile: UserProfile, onPayNow: () => void }) {
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
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button 
                onClick={onPayNow}
                className="px-6 py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-colors shadow-lg shadow-orange-900/20"
              >
                Pay Now
              </button>
              <button 
                onClick={onPayNow}
                className="text-xs font-bold text-orange-400 hover:text-orange-300 underline"
              >
                Already paid? Submit proof
              </button>
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
            <History size={20} className="text-neutral-500" />
          </div>
          <div className="space-y-4">
            {stats.payments.slice(0, 5).map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-2xl border border-neutral-800/50">
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
              </div>
            ))}
            {stats.payments.length === 0 && (
              <p className="text-center py-8 text-neutral-600 font-medium">No payment records found.</p>
            )}
          </div>
        </div>
      </div>

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

  const getPreviousMonth = (d: Date) => {
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return {
      month: MONTHS[prev.getMonth()],
      year: prev.getFullYear()
    };
  };

  const initialOwners = [
    { unit: 'A1', name: 'Renjini' },
    { unit: 'A2', name: 'Deepu' },
    { unit: 'A3', name: 'Sudha Subramaniyan' },
    { unit: 'B1', name: 'Anila Kuruvilla' },
    { unit: 'B2', name: 'Suresh' },
    { unit: 'B3', name: 'Prathap PV' },
    { unit: 'C1', name: 'Jayalakshmi' },
    { unit: 'C2', name: 'Sindhu' },
    { unit: 'C3', name: 'Jayan KR' },
    { unit: 'D2', name: 'Usha G Menon' },
    { unit: 'D3', name: 'Prem Narayanan' },
    { unit: 'E2', name: 'Balachandran' },
    { unit: 'E3', name: 'Vidyashekhar' },
    { unit: 'F1', name: 'MohanaKrishnan' },
    { unit: 'F2', name: 'Sudha Dinaker' },
    { unit: 'F3', name: 'Seema Sreekumar' }
  ].map(o => {
    const prev = getPreviousMonth(new Date());
    return { 
      ...o, 
      selected: false, 
      customAmount: 1200, 
      date: new Date(), 
      months: 1,
      forMonth: prev.month,
      forYear: prev.year
    };
  });

  const [owners, setOwners] = useState(initialOwners);

  const handleSyncFromResidents = () => {
    onSnapshot(query(collection(db, 'users'), where('role', '==', 'owner')), (snapshot) => {
      const prev = getPreviousMonth(date);
      const residents = snapshot.docs.map(doc => ({
        unit: doc.data().unitNumber || '?',
        name: doc.data().displayName || 'Unknown',
        selected: false,
        customAmount: 1200,
        date: date,
        months: 1,
        forMonth: prev.month,
        forYear: prev.year
      }));
      if (residents.length > 0) {
        setOwners(residents);
      } else {
        alert("No residents found in User Management. Using default list.");
      }
    });
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

        const particulars = `${owner.unit} ${owner.name} (${description})`;

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

        // 2. Create shadow entries for future months (Advance Allocation)
        for (let i = 0; i < owner.months; i++) {
          const currentForDate = new Date(owner.forYear, startMonthIdx + i, 1);
          
          // Only create shadow entries for months AFTER the payment month
          if (currentForDate > paymentMonthYear) {
            const currentForMonth = MONTHS[currentForDate.getMonth()];
            const currentForYear = currentForDate.getFullYear();
            
            await addDoc(collection(db, 'accounts'), {
              date: null, // No date for shadow entries
              particulars: `${owner.unit} ${owner.name} (From advance payment of ${MONTHS[paymentDate.getMonth()]})`,
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-800/30 p-4 rounded-2xl border border-neutral-700">
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Bulk Payment Date</label>
          <input 
            type="date" 
            value={format(date, 'yyyy-MM-dd')}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              setDate(newDate);
              setOwners(owners.map(o => ({ ...o, date: newDate })));
            }}
            className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Bulk For Month/Year</label>
          <div className="grid grid-cols-2 gap-2">
            <select 
              value={owners[0]?.forMonth || MONTHS[new Date().getMonth()]}
              onChange={(e) => {
                const val = e.target.value;
                setOwners(owners.map(o => ({ ...o, forMonth: val })));
              }}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input 
              type="number" 
              value={owners[0]?.forYear || new Date().getFullYear()}
              onChange={(e) => {
                const val = Number(e.target.value);
                setOwners(owners.map(o => ({ ...o, forYear: val })));
              }}
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-2">Bulk Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-bold text-sm">₹</span>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAmount(val);
                setOwners(owners.map(o => ({ ...o, customAmount: val * o.months })));
              }}
              className="w-full pl-8 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 text-sm"
            />
          </div>
        </div>
      </div>

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
        {owners.map((owner, idx) => (
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
              <p className="text-sm font-bold text-neutral-100 truncate">{owner.unit} {owner.name}</p>
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

function UserManagement({ users }: { users: UserProfile[] }) {
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [unitNumber, setUnitNumber] = useState('');
  const [copying, setCopying] = useState(false);
  
  // Create User Form State
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreateResident = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    try {
      // 1. Create secondary app instance to create user without signing out admin
      const secondaryApp = initializeApp(config, 'Secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newEmail, newPassword);
      const uid = userCredential.user.uid;

      // 2. Create Firestore profile
      await setDoc(doc(db, 'users', uid), {
        uid,
        email: newEmail,
        displayName: newName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=random`,
        role: 'owner',
        unitNumber: newUnit,
        createdAt: serverTimestamp(),
        mustChangePassword: true
      });

      // 3. Clean up secondary app
      await deleteApp(secondaryApp);

      setShowCreate(false);
      setNewEmail('');
      setNewName('');
      setNewUnit('');
      setNewPassword('');
      alert('Resident created successfully! They can now log in with the credentials you provided.');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create resident');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (uid: string, currentRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { 
        unitNumber,
        role: currentRole // Keep role for now, or add role select if needed
      });
      setEditingUser(null);
      setUnitNumber('');
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const toggleRole = async (user: UserProfile) => {
    const newRole = user.role === 'admin' ? 'owner' : 'admin';
    if (window.confirm(`Change ${user.displayName}'s role to ${newRole}?`)) {
      await updateDoc(doc(db, 'users', user.uid), { role: newRole });
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
          <p className="text-sm text-neutral-500">Manage unit assignments and roles for all residents.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg shadow-emerald-900/20"
          >
            <Plus size={20} />
            Create Resident
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
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100 placeholder:text-neutral-600"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Unit Number</label>
                    <input 
                      type="text" 
                      required
                      value={newUnit}
                      onChange={(e) => setNewUnit(e.target.value)}
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
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Unit</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {users.map(user => (
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
                      value={unitNumber} 
                      onChange={(e) => setUnitNumber(e.target.value)}
                      placeholder="Unit #"
                      className="w-24 px-3 py-1 bg-neutral-800 border-neutral-700 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                    />
                  ) : (
                    <span className={cn(
                      "font-medium",
                      user.unitNumber ? "text-neutral-300" : "text-red-400 italic text-sm"
                    )}>
                      {user.unitNumber || 'Unassigned'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleRole(user)}
                      className={cn(
                        "text-[10px] font-bold uppercase px-2 py-1 rounded-md transition-all hover:opacity-80",
                        user.role === 'admin' ? "bg-indigo-900/30 text-indigo-400 border border-indigo-900/50" : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                      )}
                    >
                      {user.role}
                    </button>
                </td>
                <td className="px-6 py-4 text-right">
                  {editingUser?.uid === user.uid ? (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => handleUpdateUser(user.uid, user.role)} className="text-emerald-400 hover:text-emerald-300 font-bold text-sm">Save</button>
                      <button onClick={() => setEditingUser(null)} className="text-neutral-500 hover:text-neutral-400 font-bold text-sm">Cancel</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingUser(user);
                        setUnitNumber(user.unitNumber || '');
                      }} 
                      className="text-neutral-500 hover:text-neutral-100 transition-colors font-medium text-sm"
                    >
                      Edit Unit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentManagement({ payments, isAdmin, profile, residents }: { payments: PaymentRecord[], isAdmin: boolean, profile: UserProfile, residents: UserProfile[] }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showProofModal, setShowProofModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [amount, setAmount] = useState('1200');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [targetUnit, setTargetUnit] = useState('all');

  const BANK_DETAILS = {
    account: '7922646832',
    ifsc: 'IDIB000T171',
    name: 'Mrs SINDHU JAYAN',
    upiId: 'sindhujayanc3@oksbi',
    phone: '917012128339' // Corrected WhatsApp number
  };

  const handleGeneratePayments = async () => {
    try {
      const targets = targetUnit === 'all' ? residents.filter(r => r.role === 'owner') : residents.filter(r => r.unitNumber === targetUnit);
      
      for (const res of targets) {
        await addDoc(collection(db, 'payments'), {
          ownerUid: res.uid,
          ownerName: res.displayName,
          unitNumber: res.unitNumber || 'N/A',
          amount: Number(amount),
          month,
          status: 'pending',
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
    } catch (error) {
      console.error("Generation failed:", error);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        status: 'paid',
        verified: true,
        verifiedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Approval failed:", error);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (window.confirm("Reject this payment? The resident will need to submit proof again.")) {
      try {
        await updateDoc(doc(db, 'payments', paymentId), {
          status: 'pending',
          transactionId: null,
          proofImage: null,
          verified: false
        });
      } catch (error) {
        console.error("Rejection failed:", error);
      }
    }
  };

  const handlePayClick = (payment: PaymentRecord) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  const confirmPayment = async (method: 'upload' | 'whatsapp') => {
    if (!selectedPayment) return;
    
    if (method === 'upload' && !screenshot) {
      alert('Please upload a screenshot first.');
      return;
    }

    try {
      await updateDoc(doc(db, 'payments', selectedPayment.id), {
        status: 'verifying',
        paidAt: serverTimestamp(),
        paymentMethod: method === 'whatsapp' ? 'WhatsApp Verification' : 'Direct Upload',
        proofImage: screenshot || null,
        verified: false,
        verificationNote: method === 'whatsapp' ? 'Resident sent receipt via WhatsApp' : 'Resident uploaded screenshot'
      });
      setShowProofModal(false);
      setShowPaymentModal(false);
      setSelectedPayment(null);
      setScreenshot(null);
    } catch (error) {
      console.error("Payment confirmation failed:", error);
    }
  };

  const sendWhatsAppReceipt = () => {
    if (!selectedPayment) return;
    const message = `Hi, I have completed the maintenance payment of ₹${selectedPayment.amount} for Unit ${selectedPayment.unitNumber} (${selectedPayment.month}). Attaching the receipt below.`;
    window.open(`https://wa.me/${BANK_DETAILS.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getUpiUrl = (payment: PaymentRecord) => {
    const ref = `APT-${payment.unitNumber}-${payment.month.replace('-', '')}`.toUpperCase();
    return `upi://pay?pa=${BANK_DETAILS.upiId}&pn=${encodeURIComponent(BANK_DETAILS.name)}&am=${payment.amount}&cu=INR&tn=${encodeURIComponent(ref)}`;
  };

  const getReferenceNote = (payment: PaymentRecord) => {
    return `APT-${payment.unitNumber}-${payment.month.replace('-', '')}`.toUpperCase();
  };

  const handlePaytmPayment = async (payment: PaymentRecord) => {
    try {
      const initiatePaytm = httpsCallable(functions, 'initiatePaytmPayment');
      const result = await initiatePaytm({
        paymentId: payment.id,
        amount: payment.amount
      });

      const { mid, orderId, checksum, txnAmount, callbackUrl } = result.data as any;

      // Paytm requires a form submission to initiate the payment
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction?mid=${mid}&orderId=${orderId}`;
      form.name = 'paytmForm';

      const params = {
        mid,
        orderId,
        txnToken: checksum, // In newer APIs, this is the txnToken
      };

      // Note: For the standard redirection flow, you might need a different approach 
      // depending on the Paytm SDK version. This is a simplified example.
      // Most modern integrations use the JS Checkout or a direct POST.
      
      // For this example, we'll use a hidden form to POST to Paytm
      const paytmUrl = `https://securegw-stage.paytm.in/order/process`;
      form.action = paytmUrl;

      const fields = {
        MID: mid,
        ORDER_ID: orderId,
        TXN_AMOUNT: txnAmount,
        CUST_ID: auth.currentUser?.uid || 'GUEST',
        WEBSITE: 'WEBSTAGING',
        CALLBACK_URL: callbackUrl,
        CHECKSUMHASH: checksum,
        INDUSTRY_TYPE_ID: 'Retail',
        CHANNEL_ID: 'WEB'
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value as string;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error: any) {
      console.error('Paytm Initiation Error:', error);
      alert('Failed to initiate Paytm payment. Please try again.');
    }
  };

  const handleRazorpayPayment = async (payment: PaymentRecord) => {
    try {
      const response = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payment.amount,
          currency: 'INR',
          receipt: payment.id
        })
      });

      if (!response.ok) throw new Error('Failed to create Razorpay order');
      const order = await response.json();

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: "AptManager",
        description: `Maintenance Payment - ${payment.month}`,
        order_id: order.id,
        handler: async function (response: any) {
          try {
            await updateDoc(doc(db, 'payments', payment.id), {
              status: 'paid',
              paidAt: serverTimestamp(),
              paymentMethod: 'Razorpay',
              transactionId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              verified: true
            });
            alert('Payment Successful!');
            setShowPaymentModal(false);
          } catch (err) {
            console.error('Failed to update payment status:', err);
            alert('Payment was successful but failed to update app status. Please contact Admin.');
          }
        },
        prefill: {
          name: profile.displayName,
          email: profile.email,
        },
        theme: {
          color: "#171717"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (error) {
      console.error('Razorpay error:', error);
      alert('Failed to initialize Razorpay. Please use UPI instead.');
    }
  };

  const createTestPayment = async () => {
    try {
      const testId = `test-${Date.now()}`;
      await setDoc(doc(db, 'payments', testId), {
        id: testId,
        ownerUid: profile.uid,
        ownerName: profile.displayName || 'Test User',
        unitNumber: profile.unitNumber || 'TEST-01',
        amount: 1200,
        month: format(new Date(), 'yyyy-MM'),
        status: 'pending',
        createdAt: serverTimestamp(),
        isTest: true
      });
      alert('Test payment created! You can now see it in the list and test the "Pay Now" button.');
    } catch (error) {
      console.error("Failed to create test payment:", error);
      alert('Failed to create test payment. Please check console.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-neutral-100">Maintenance Payments</h2>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <>
              <button 
                onClick={createTestPayment}
                className="flex items-center gap-2 px-6 py-3 bg-blue-900/20 text-blue-400 rounded-2xl font-bold hover:bg-blue-900/30 transition-all border border-blue-800/50"
              >
                <CreditCard size={20} />
                Create Test Payment
              </button>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
              >
                <Plus size={20} />
                Generate Bills
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {payments.map(payment => (
          <div key={payment.id} className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center",
                payment.status === 'paid' ? "bg-green-900/20 text-green-400" : 
                payment.status === 'verifying' ? "bg-blue-900/20 text-blue-400" :
                "bg-orange-900/20 text-orange-400"
              )}>
                <CreditCard size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-neutral-100">
                  {format(new Date(payment.month + '-01'), 'MMMM yyyy')}
                </h3>
                <p className="text-sm text-neutral-500">
                  {isAdmin ? `Resident: ${payment.ownerName} (Unit ${payment.unitNumber})` : `Maintenance Charge for Unit ${payment.unitNumber}`}
                </p>
                {payment.status === 'verifying' && (
                  <p className="text-xs font-bold text-blue-400 mt-1 flex items-center gap-1">
                    <Clock size={12} /> Verification Pending
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-8">
              <div className="text-right">
                <p className="text-2xl font-bold text-neutral-100">₹{payment.amount}</p>
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-1 rounded-md",
                  payment.status === 'paid' ? "bg-green-900/30 text-green-400" : 
                  payment.status === 'verifying' ? "bg-blue-900/30 text-blue-400" :
                  "bg-orange-900/30 text-orange-400"
                )}>
                  {payment.status === 'verifying' ? 'Verifying' : payment.status}
                </span>
              </div>
              
              {(payment.status === 'pending' && (!isAdmin || payment.isTest)) && (
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => handlePayClick(payment)}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-colors"
                  >
                    Pay Now
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedPayment(payment);
                      setShowProofModal(true);
                    }}
                    className="text-xs font-bold text-neutral-500 hover:text-neutral-400 underline"
                  >
                    Already paid? Submit proof
                  </button>
                </div>
              )}

              {isAdmin && payment.status === 'verifying' && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleApprovePayment(payment.id)}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleRejectPayment(payment.id)}
                    className="px-4 py-2 bg-red-900/20 text-red-400 rounded-xl font-bold text-xs hover:bg-red-900/30 border border-red-800/50"
                  >
                    Reject
                  </button>
                </div>
              )}

              {(payment.status === 'paid' || payment.status === 'verifying') && (
                <div className="hidden md:block text-right border-l border-neutral-800 pl-8">
                  {payment.proofImage ? (
                    <button 
                      onClick={() => window.open(payment.proofImage!, '_blank')}
                      className="flex flex-col items-end group"
                    >
                      <p className="text-[10px] font-bold text-neutral-500 uppercase group-hover:text-indigo-400 transition-colors">Payment Proof</p>
                      <div className="w-12 h-12 bg-neutral-800 rounded-lg mt-1 overflow-hidden border border-neutral-700 group-hover:border-indigo-500/50 transition-all">
                        <img src={payment.proofImage} className="w-full h-full object-cover" alt="Proof" />
                      </div>
                      <span className="text-[10px] text-indigo-400 underline font-bold mt-1">View Full Receipt</span>
                    </button>
                  ) : (
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-neutral-500 uppercase">Transaction ID</p>
                      <p className="text-xs font-mono text-neutral-400">{payment.transactionId || 'N/A'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {payments.length === 0 && (
          <div className="text-center py-20 bg-neutral-900 rounded-3xl border border-dashed border-neutral-800">
            <CreditCard className="mx-auto text-neutral-800 mb-4" size={48} />
            <p className="text-neutral-500 font-medium">No payment records found.</p>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPayment && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-400">
                <CreditCard size={32} />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-neutral-100 mb-2">Complete Payment</h3>
            <p className="text-neutral-500 mb-6 text-sm">Scan the QR code or click the button to pay ₹{selectedPayment.amount} via UPI / Google Pay.</p>
            
            <div className="bg-neutral-800/50 p-6 rounded-2xl mb-6 flex flex-col items-center border border-neutral-800">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiUrl(selectedPayment))}`} 
                alt="UPI QR Code"
                className="w-48 h-48 mb-4 border-4 border-neutral-700 rounded-lg shadow-sm"
              />
              <div className="text-center">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Transaction Note</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-mono font-bold text-blue-400">{getReferenceNote(selectedPayment)}</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(getReferenceNote(selectedPayment!));
                      alert('Note copied! Paste this in the GPay "Add a note" field.');
                    }}
                    className="text-[10px] font-bold text-neutral-500 hover:text-neutral-400 underline"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => handlePaytmPayment(selectedPayment)}
                className="w-full py-4 bg-[#00baf2] text-white rounded-2xl font-bold hover:bg-[#0099cc] transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
              >
                <CreditCard size={20} />
                Pay via Paytm (UPI)
              </button>

              <button 
                onClick={() => handleRazorpayPayment(selectedPayment)}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
              >
                <CreditCard size={20} />
                Pay via Razorpay (Instant)
              </button>
              
              <div className="relative py-4">
                <div className="w-full border-t border-neutral-800"></div>
                <div className="relative flex justify-center text-xs uppercase -mt-2">
                  <span className="bg-neutral-900 px-2 text-neutral-500 font-bold">Or use Direct UPI</span>
                </div>
              </div>

              <a 
                href={getUpiUrl(selectedPayment)}
                className="block w-full py-4 bg-indigo-600 text-white rounded-2xl text-center font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20"
              >
                Pay via UPI App
              </a>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(BANK_DETAILS.upiId);
                    alert('UPI ID Copied!');
                  }}
                  className="py-3 bg-neutral-800 text-neutral-300 rounded-2xl font-bold text-xs hover:bg-neutral-700 transition-all border border-neutral-700"
                >
                  Copy UPI ID
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPayment!.amount.toString());
                    alert('Amount Copied!');
                  }}
                  className="py-3 bg-neutral-800 text-neutral-300 rounded-2xl font-bold text-xs hover:bg-neutral-700 transition-all border border-neutral-700"
                >
                  Copy Amount
                </button>
              </div>
              <button 
                onClick={() => setShowProofModal(true)}
                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
              >
                I have completed the payment
              </button>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-3 text-neutral-500 font-bold hover:text-neutral-400"
              >
                Cancel
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-900/20 rounded-2xl text-left border border-blue-800/50">
              <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">How it works:</p>
              <p className="text-[11px] text-blue-300 leading-relaxed">
                The <strong>Transaction Note</strong> above is unique to you. When you pay, this note appears in the Admin's bank statement. This allows the Admin to verify your payment instantly even without a screenshot!
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-neutral-800 text-left">
              <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Bank Details</p>
              <div className="text-sm text-neutral-400 space-y-1">
                <p>Account: <span className="font-mono">{BANK_DETAILS.account}</span></p>
                <p>IFSC: <span className="font-mono">{BANK_DETAILS.ifsc}</span></p>
                <p>Name: <span className="font-medium">{BANK_DETAILS.name}</span></p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Proof of Payment Modal */}
      {showProofModal && selectedPayment && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <h3 className="text-2xl font-bold text-neutral-100 mb-2">Submit Payment Proof</h3>
            <p className="text-sm text-neutral-500 mb-6">Enter the transaction details to update the Admin dashboard.</p>
            
            <div className="space-y-6">
              <div className="bg-green-900/20 p-5 rounded-2xl border border-green-800/50">
                <p className="text-sm font-bold text-green-400 mb-2">Option 1: Share via WhatsApp (Recommended)</p>
                <p className="text-[11px] text-green-300 mb-4 leading-relaxed">
                  In Google Pay, click the <strong>Share</strong> icon on the payment screen and send the receipt to the Admin. Then click the button below to notify the app.
                </p>
                <button 
                  onClick={sendWhatsAppReceipt}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 transition-all"
                >
                  <MessageCircle size={20} />
                  Open Admin WhatsApp
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-neutral-900 px-2 text-neutral-500 font-bold">OR</span>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-bold text-neutral-100 mb-2 text-center">Option 2: Upload Receipt File</p>
                <p className="text-[11px] text-neutral-500 mb-4 text-center leading-relaxed">
                  If you saved the receipt to your phone gallery, upload it here.
                </p>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="screenshot-upload"
                  />
                  <label 
                    htmlFor="screenshot-upload"
                    className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-neutral-800 rounded-3xl cursor-pointer hover:bg-neutral-800/50 transition-all overflow-hidden"
                  >
                    {screenshot ? (
                      <img src={screenshot} className="h-full w-full object-contain bg-neutral-800" alt="Preview" />
                    ) : (
                      <>
                        <Plus className="text-neutral-500 mb-1" size={24} />
                        <span className="text-xs text-neutral-500 font-bold">Tap to select file</span>
                      </>
                    )}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowProofModal(false)}
                className="flex-1 py-3 text-neutral-500 font-bold hover:bg-neutral-800 rounded-xl transition-colors"
              >
                Back
              </button>
              <button 
                onClick={() => confirmPayment(screenshot ? 'upload' : 'whatsapp')}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all"
              >
                I have sent it
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-8 rounded-3xl shadow-2xl border border-neutral-800"
          >
            <h3 className="text-2xl font-bold text-neutral-100 mb-6">Generate Maintenance Bills</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Amount (₹)</label>
                <input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Billing Month</label>
                <input 
                  type="month" 
                  value={month} 
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase mb-2">Target Units</label>
                <select 
                  value={targetUnit} 
                  onChange={(e) => setTargetUnit(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-neutral-100"
                >
                  <option value="all">All Residents</option>
                  {residents.filter(r => r.unitNumber).map(r => (
                    <option key={r.uid} value={r.unitNumber}>Unit {r.unitNumber} ({r.displayName})</option>
                  ))}
                </select>
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
                onClick={handleGeneratePayments}
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all"
              >
                Generate
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AnnouncementManagement({ announcements, isAdmin, profile }: { announcements: Announcement[], isAdmin: boolean, profile: UserProfile }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

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
    } catch (error) {
      console.error("Post failed:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Delete this announcement?")) {
      await deleteDoc(doc(db, 'announcements', id));
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
              {isAdmin && (
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
    </div>
  );
}

function AccountsManagement({ accounts, isAdmin }: { accounts: AccountEntry[], isAdmin: boolean }) {
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
    forMonth: MONTHS[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1],
    forYear: new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()
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
        forMonth: MONTHS[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1],
        forYear: new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()
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
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowQuickModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
              >
                <Zap size={18} />
                Quick Maintenance
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
                {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Actions</th>}
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
                    {isAdmin && (
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
                  {isAdmin && <td></td>}
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
                  <h3 className="text-2xl font-bold text-neutral-100">Quick Maintenance Entry</h3>
                  <p className="text-sm text-neutral-500">Post monthly maintenance for all owners at once.</p>
                </div>
                <button onClick={() => setShowQuickModal(false)} className="p-2 text-neutral-500 hover:text-neutral-300">
                  <X size={24} />
                </button>
              </div>

              <QuickMaintenanceForm 
                onClose={() => setShowQuickModal(false)} 
                onSuccess={() => {
                  setShowQuickModal(false);
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
                    method: 'cash'
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
