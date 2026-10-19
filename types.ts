export interface User {
  id: string; // e.g. SP-582910
  username: string;
  phone: string;
  password?: string;
  deviceId: string;
  deviceLabel: string;
  coins: number;
  remainingSeconds: number; // Time remaining in seconds
  createdAt: string;
  lastLoginAt: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
}

export interface TopupRequest {
  id: string;
  userId: string;
  username: string;
  phone: string;
  requestedCoins: number;
  paymentMethod: string;
  transactionNote: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
}

export interface CoinTransfer {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  amount: number;
  note?: string;
  timestamp: string;
}

export interface TimePackage {
  id: string;
  titleMm: string;
  titleEn: string;
  seconds: number;
  coinPrice: number;
  badge?: string;
}

export interface LargeDocSegmentRecord {
  partIndex: number;
  title: string;
  startPage: number;
  endPage: number;
  translatedText: string;
  charCount: number;
}

export interface TranslationRecord {
  id: string;
  userId: string;
  filename: string;
  fileType: string;
  docCategory: 'small' | 'large'; // 'small' = စာအုပ်အသေးများ, 'large' = စာအုပ်အကြီးများ
  charCount: number;
  pageCount?: number;
  translatedAt: string;
  originalTextPreview: string;
  translatedText: string;
  segments?: LargeDocSegmentRecord[]; // For large books (20-page parts)
  deleted?: boolean; // For soft delete and restore support
  deletedAt?: string;
}
