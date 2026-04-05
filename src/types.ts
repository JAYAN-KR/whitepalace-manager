export type UserRole = 'superadmin' | 'admin' | 'owner';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  flatNumber?: string;
  phone?: string;
  createdAt: any;
  mustChangePassword?: boolean;
  isPending?: boolean;
  tempPassword?: string;
  hasNoEmail?: boolean;
}

export interface PaymentRecord {
  id: string;
  ownerUid: string;
  ownerName: string;
  flatNumber: string;
  amount: number;
  month: string;
  status: 'pending' | 'paid' | 'failed' | 'verifying' | 'PAID' | 'FAILED';
  paymentMethod?: string;
  transactionId?: string;
  razorpayOrderId?: string;
  proofImage?: string;
  verified?: boolean;
  verifiedAt?: any;
  verificationNote?: string;
  createdAt: any;
  paidAt?: any;
  isTest?: boolean;
  particulars?: string;
  source?: string;
  parentAccountId?: string;
  installmentIndex?: number;
  totalInstallments?: number;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorUid: string;
  createdAt: any;
}

export interface AccountEntry {
  id: string;
  date: any; // Firestore Timestamp
  particulars: string;
  income: number;
  expense: number;
  method: 'cash' | 'bank';
  isWithdrawal?: boolean;
  isOpeningBalance?: boolean;
  amount?: number; // Used for withdrawals/transfers/opening balances
  openingIncome?: number; // Historical income total
  openingExpense?: number; // Historical expense total
  runningCashBalance?: number;
  runningBankBalance?: number;
  forMonth?: string; // e.g., "JAN"
  forYear?: number; // e.g., 2026
  isAdvanceAllocation?: boolean;
  originalPaymentDate?: any; // Timestamp
  displayAmount?: number;
  parentAccountId?: string;
  installmentIndex?: number;
  totalInstallments?: number;
  flatNumber?: string;
  ownerUid?: string;
  ownerName?: string;
  createdAt: any;
}

export interface AppConfig {
  id: string;
  googleSheetsUrl?: string;
  lastSyncedAt?: any; // Timestamp
  updatedAt: any;
}
