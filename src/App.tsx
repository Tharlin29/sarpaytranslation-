import React, { useState, useEffect } from 'react';
import { User } from './types';
import {
  getCurrentUser,
  setCurrentUser,
  logout,
  updateLocalUserSeconds,
} from './services/firebase';
import { AuthView } from './components/AuthView';
import { NotificationBar } from './components/NotificationBar';
import { SideMenu } from './components/SideMenu';
import { FileTranslator } from './components/FileTranslator';
import { CoinTransferModal } from './components/CoinTransferModal';
import { BuyTimeModal } from './components/BuyTimeModal';
import { TopupRequestModal } from './components/TopupRequestModal';
import { AdminPanel } from './components/AdminPanel';
import { TimeExpiredLock } from './components/TimeExpiredLock';
import { LargeDocStudio } from './components/LargeDocStudio';
import { DocumentSegment } from './utils/fileExtractor';

export default function App() {
  const [currentUser, setUser] = useState<User | null>(() => getCurrentUser());
  const [view, setView] = useState<'app' | 'admin' | 'large-doc-studio'>(() => {
    const u = getCurrentUser();
    return u?.role === 'admin' ? 'admin' : 'app';
  });

  // Large document studio state
  const [largeDocData, setLargeDocData] = useState<{
    fileName: string;
    originalText: string;
    charCount: number;
    segments: DocumentSegment[];
  } | null>(null);

  // Modal states
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isBuyTimeModalOpen, setIsBuyTimeModalOpen] = useState(false);
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);

  // Sync session changes
  const handleAuthSuccess = (user: User, isAdmin: boolean) => {
    setUser(user);
    if (isAdmin || user.role === 'admin') {
      setView('admin');
    } else {
      setView('app');
    }
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    setIsSideMenuOpen(false);
    setIsTransferModalOpen(false);
    setIsBuyTimeModalOpen(false);
    setIsTopupModalOpen(false);
    setLargeDocData(null);
    setView('app');
  };

  // Live countdown timer for active user
  useEffect(() => {
    if (!currentUser || currentUser.role === 'admin') return;

    const timer = setInterval(() => {
      setUser((prev) => {
        if (!prev) return null;
        if (prev.remainingSeconds <= 0) {
          return { ...prev, remainingSeconds: 0 };
        }
        const updatedSecs = Math.max(0, prev.remainingSeconds - 1);
        updateLocalUserSeconds(prev.id, updatedSecs);
        return { ...prev, remainingSeconds: updatedSecs };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentUser?.id, currentUser?.role]);

  // If user is not logged in, render Registration / Login View
  if (!currentUser) {
    return <AuthView onSuccess={handleAuthSuccess} />;
  }

  // If Admin view is active
  if (view === 'admin') {
    return (
      <AdminPanel
        onBackToApp={() => setView('app')}
        onLogout={handleLogout}
      />
    );
  }

  // If Large Document Studio view is active (New Page for 20-page segmented translation)
  if (view === 'large-doc-studio' && largeDocData) {
    return (
      <LargeDocStudio
        currentUser={currentUser}
        fileName={largeDocData.fileName}
        originalText={largeDocData.originalText}
        charCount={largeDocData.charCount}
        segments={largeDocData.segments}
        onBack={() => setView('app')}
        onOpenBuyTime={() => setIsBuyTimeModalOpen(true)}
      />
    );
  }

  const isTimeExpired = (currentUser.remainingSeconds || 0) <= 0 && currentUser.role !== 'admin';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 1. Notification Bar (Noti bar) at the very top of Preview page */}
      <NotificationBar
        currentUser={currentUser}
        onOpenSideMenu={() => setIsSideMenuOpen(true)}
        onOpenTransferModal={() => setIsTransferModalOpen(true)}
        onOpenBuyTimeModal={() => setIsBuyTimeModalOpen(true)}
        onOpenTopupModal={() => setIsTopupModalOpen(true)}
        onLogout={handleLogout}
        onOpenAdminPanel={() => setView('admin')}
      />

      {/* 2. Main Workspace: PDF / Word File Translation Section directly below Noti Bar */}
      <main className="flex-1 pb-16">
        <FileTranslator
          currentUser={currentUser}
          onOpenBuyTime={() => setIsBuyTimeModalOpen(true)}
          onOpenLargeDocStudio={(data) => {
            setLargeDocData(data);
            setView('large-doc-studio');
          }}
        />
      </main>

      {/* 3. Side Menu Drawer (Opened when clicking User Profile Logo) */}
      <SideMenu
        currentUser={currentUser}
        isOpen={isSideMenuOpen}
        onClose={() => setIsSideMenuOpen(false)}
        onOpenTransfer={() => setIsTransferModalOpen(true)}
        onOpenBuyTime={() => setIsBuyTimeModalOpen(true)}
        onOpenTopup={() => setIsTopupModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* 4. Modals */}
      <CoinTransferModal
        currentUser={currentUser}
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={(newBal) => {
          setUser((prev) => (prev ? { ...prev, coins: newBal } : null));
        }}
      />

      <BuyTimeModal
        currentUser={currentUser}
        isOpen={isBuyTimeModalOpen}
        onClose={() => setIsBuyTimeModalOpen(false)}
        onSuccess={(updatedUser) => {
          setUser(updatedUser);
        }}
        onRequestTopup={() => setIsTopupModalOpen(true)}
      />

      <TopupRequestModal
        currentUser={currentUser}
        isOpen={isTopupModalOpen}
        onClose={() => setIsTopupModalOpen(false)}
        onSuccess={() => {}}
      />

      {/* 5. Time Expired Lock Screen (Enforcing app stoppage when timer runs out) */}
      {isTimeExpired && (
        <TimeExpiredLock
          currentUser={currentUser}
          onOpenBuyTime={() => setIsBuyTimeModalOpen(true)}
          onOpenTopup={() => setIsTopupModalOpen(true)}
          onLogout={handleLogout}
          onTimePurchased={(updatedUser) => {
            setUser(updatedUser);
            setIsBuyTimeModalOpen(false);
          }}
        />
      )}
    </div>
  );
    }
