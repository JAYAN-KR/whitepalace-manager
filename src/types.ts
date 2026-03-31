export type UserRole = 'admin' | 'owner';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: UserRole;
  unitNumber?: string;
  createdAt: any;
  mustChangePassword?: boolean;
  isPending?: boolean;
  tempPassword?: string;
}

export interface PaymentRecord {
  id: string;
  ownerUid: string;
  ownerName: string;
  unitNumber: string;
  amount: number;
  month: string;
  status: 'pending' | 'paid' | 'failed' | 'verifying';
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
  createdAt: any;
}
