
import React, { useState, useEffect, useRef } from 'react';
import { StoreProvider, useStore } from './services/store';
import { TabView, Track } from './types';
import Feed from './pages/Feed';
import Charts from './pages/Charts';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Rooms from './pages/Concerts';
import SettingsPage from './pages/Settings';
import AudioPlayer from './components/AudioPlayer';
import { Home, BarChart2, UploadCloud, User, Video } from './components/ui/Icons';

const Navigation: React.FC<{ activeTab: TabView; onTabChange: (tab: TabView) => void }> = ({ activeTab, onTabChange }) => {
  const { t } = useStore();
  
  const tabs = [
    { id: 'feed', icon: Home, label: t('nav_feed') },
    { id: 'charts', icon: BarChart2, label: t('nav_charts') },
    { id: 'rooms', icon: Video, label: t('nav_concerts') },
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
  const { tracks } = useStore(); 
  const [activeTab, setActiveTab] = useState<TabView>('feed');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [overlayView, setOverlayView] = useState<'none' | 'settings' | 'user_profile'>('none');
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const deepLinkProcessed = useRef(false);
  
  useEffect(() => {
    if (tracks.length > 0 && !deepLinkProcessed.current) {
        const tgParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
        const startParam = tgParam || new URLSearchParams(window.location.search).get('startapp');

        if (startParam && startParam.startsWith('track_')) {
            const trackId = startParam.replace('track_', '');
            const found = tracks.find(t => t.id === trackId);
            if (found) setCurrentTrack(found);
        }
        deepLinkProcessed.current = true;
    }
  }, [tracks]);

  const handlePlayTrack = (track: Track) => setCurrentTrack(track);

  const handleNextTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
    const idx = tracks.findIndex(t => t.id === currentTrack.id);
    if (idx !== -1) setCurrentTrack(tracks[(idx + 1) % tracks.length]);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
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
      case 'rooms': return <Rooms />;
      case 'upload': return <Upload onUploadSuccess={() => handleTabChange('feed')} />;
      case 'profile': return <Profile onPlayTrack={handlePlayTrack} onEditProfile={() => setOverlayView('settings')} />;
      default: return <Feed onPlayTrack={handlePlayTrack} onOpenProfile={handleOpenProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-sky-400/30">
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl overflow-hidden bg-black">
        <div className="h-full overflow-y-auto custom-scrollbar no-scrollbar">
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
