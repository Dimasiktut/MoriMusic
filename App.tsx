
import React, { useState, useEffect, useRef } from 'react';
import { StoreProvider, useStore } from './services/store';
import { TabView, Track } from './types';
import Feed from './pages/Feed';
import Charts from './pages/Charts';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';
import AudioPlayer from './components/AudioPlayer';
import { Home, BarChart2, UploadCloud, User } from './components/ui/Icons';

const Navigation: React.FC<{ activeTab: TabView; onTabChange: (tab: TabView) => void }> = ({ activeTab, onTabChange }) => {
  const { t } = useStore();
  
  const tabs = [
    { id: 'feed', icon: Home, label: t('nav_feed') },
    { id: 'charts', icon: BarChart2, label: t('nav_charts') },
    { id: 'upload', icon: UploadCloud, label: t('nav_upload') },
    { id: 'profile', icon: User, label: t('nav_profile') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-3xl border-t border-white/10 pb-safe z-50">
      <div className="flex justify-around items-center h-20 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabView)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all duration-300 ${isActive ? 'text-sky-400 scale-105' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              <div className={`p-2 rounded-2xl transition-all ${isActive ? 'bg-sky-400/10 shadow-[0_0_20px_rgba(56,189,248,0.2)]' : ''}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter transition-all ${isActive ? 'opacity-100 text-sky-400' : 'opacity-80 text-zinc-300'}`}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const MainLayout: React.FC = () => {
  const { tracks, isLoading: storeLoading, t } = useStore(); 
  const [activeTab, setActiveTab] = useState<TabView>('feed');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [overlayView, setOverlayView] = useState<'none' | 'settings' | 'user_profile'>('none');
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [forceLoad, setForceLoad] = useState(false);
  const deepLinkProcessed = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceLoad(true);
    }, 2500); 
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const shouldShowBack = overlayView !== 'none';
    
    if (shouldShowBack) {
      tg.BackButton.show();
      const onBackClick = () => {
        setOverlayView('none');
        setViewingUserId(null);
      };
      tg.BackButton.onClick(onBackClick);
      return () => {
        tg.BackButton.offClick(onBackClick);
        tg.BackButton.hide();
      };
    } else {
      tg.BackButton.hide();
    }
  }, [overlayView]);
  
  useEffect(() => {
    if (tracks && tracks.length > 0 && !deepLinkProcessed.current) {
        const tg = (window as any).Telegram?.WebApp;
        const startParam = tg?.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('startapp');
        if (startParam && typeof startParam === 'string' && startParam.startsWith('track_')) {
            const trackId = startParam.replace('track_', '');
            const found = tracks.find(t => t.id === trackId);
            if (found) setCurrentTrack(found);
        }
        deepLinkProcessed.current = true;
    }
  }, [tracks]);

  const handlePlayTrack = (track: Track) => setCurrentTrack(track);

  const handleNextTrack = () => {
    if (!currentTrack || !tracks || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1) setCurrentTrack(tracks[(idx + 1) % tracks.length]);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || !tracks || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1) setCurrentTrack(tracks[(idx - 1 + tracks.length) % tracks.length]);
  };

  const handleOpenProfile = (userId: number) => {
    setViewingUserId(userId);
    setOverlayView('user_profile');
  };

  const handleTabChange = (tab: TabView) => {
    setOverlayView('none');
    setViewingUserId(null);
    setActiveTab(tab);
  };

  const renderContent = () => {
      if (overlayView === 'settings') return <SettingsPage onBack={() => setOverlayView('none')} />;
      if (overlayView === 'user_profile') return <Profile onPlayTrack={handlePlayTrack} onEditProfile={() => { }} onBack={() => setOverlayView('none')} targetUserId={viewingUserId} />;

      switch (activeTab) {
        case 'feed': return <Feed onPlayTrack={handlePlayTrack} onOpenProfile={handleOpenProfile} />;
        case 'charts': return <Charts onPlayTrack={handlePlayTrack} />;
        case 'upload': return <Upload onUploadSuccess={() => handleTabChange('feed')} />;
        case 'profile': return <Profile onPlayTrack={handlePlayTrack} onEditProfile={() => setOverlayView('settings')} />;
        default: return <Feed onPlayTrack={handlePlayTrack} onOpenProfile={handleOpenProfile} />;
      }
  };

  const isLoading = storeLoading && !forceLoad;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[999] overflow-hidden">
        {/* Neon Glow Sphere */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] bg-sky-500/10 blur-[80px] rounded-full animate-pulse duration-[2s]" />
        
        <div className="relative flex flex-col items-center animate-in zoom-in-95 fade-in duration-1000">
          <div className="flex flex-col items-center">
            <span className="text-zinc-600 text-[10px] font-black tracking-[0.4em] uppercase mb-2">Studio Presents</span>
            <div className="flex gap-4 items-center">
              <h1 className="text-6xl font-black text-white italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">MORI</h1>
              <h1 className="text-6xl font-black text-sky-400 italic tracking-tighter drop-shadow-[0_0_20px_rgba(56,189,248,0.4)]">MUSIC</h1>
            </div>
          </div>
          
          <div className="flex gap-1.5 h-8 items-end mt-12 mb-10">
            <div className="w-1.5 h-4 bg-sky-500 rounded-full animate-music-bar-1" />
            <div className="w-1.5 h-7 bg-sky-400 rounded-full animate-music-bar-2" />
            <div className="w-1.5 h-3 bg-sky-600 rounded-full animate-music-bar-3" />
            <div className="w-1.5 h-5 bg-sky-400 rounded-full animate-music-bar-1" style={{animationDelay: '0.2s'}} />
            <div className="w-1.5 h-8 bg-sky-500 rounded-full animate-music-bar-2" style={{animationDelay: '0.3s'}} />
            <div className="w-1.5 h-2 bg-sky-300 rounded-full animate-music-bar-3" style={{animationDelay: '0.1s'}} />
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-sky-500 animate-[loading-bar_2s_ease-in-out_infinite]" style={{ width: '30%' }} />
            </div>
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.6em] ml-[0.6em]">
              {t('app_initializing')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-sky-400/30">
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl overflow-hidden bg-black flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
            {renderContent()}
        </div>
        <AudioPlayer track={currentTrack} onClose={() => setCurrentTrack(null)} onOpenProfile={handleOpenProfile} onNext={handleNextTrack} onPrev={handlePrevTrack} />
        {overlayView === 'none' && <Navigation activeTab={activeTab} onTabChange={handleTabChange} />}
      </main>
    </div>
  );
};

const App: React.FC = () => <StoreProvider><MainLayout /></StoreProvider>;
export default App;
