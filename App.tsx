
import React, { useState, useEffect, useRef } from 'react';
import { StoreProvider, useStore } from './services/store';
import { TabView, Track } from './types';
import Feed from './pages/Feed';
import Charts from './pages/Charts';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Concerts from './pages/Concerts'; // Import Concerts Page
import SettingsPage from './pages/Settings';
import AudioPlayer from './components/AudioPlayer';
import { Home, BarChart2, UploadCloud, User, Video } from './components/ui/Icons'; // Import Video icon

const Navigation: React.FC<{ activeTab: TabView; onTabChange: (tab: TabView) => void }> = ({ activeTab, onTabChange }) => {
  const { t } = useStore();
  
  const tabs = [
    { id: 'feed', icon: Home, label: t('nav_feed') },
    { id: 'charts', icon: BarChart2, label: t('nav_charts') },
    { id: 'concerts', icon: Video, label: t('nav_concerts') }, // New Tab
    { id: 'upload', icon: UploadCloud, label: t('nav_upload') },
    { id: 'profile', icon: User, label: t('nav_profile') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-lg border-t border-white/5 pb-safe z-50">
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabView)}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-all active:scale-90 ${isActive ? 'text-violet-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
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
        // @ts-ignore
        const tgParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
        const urlParams = new URLSearchParams(window.location.search);
        const webParam = urlParams.get('startapp');
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const hashParam = hashParams.get('tgWebAppStartParam');

        const startParam = tgParam || webParam || hashParam;

        if (startParam && startParam.startsWith('track_')) {
            const trackId = startParam.replace('track_', '');
            const found = tracks.find(t => t.id === trackId);
            if (found) {
                setCurrentTrack(found);
            }
        }
        deepLinkProcessed.current = true;
    }
  }, [tracks]);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
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
    if (overlayView === 'settings') {
        return <SettingsPage onBack={() => setOverlayView('none')} />;
    }
    
    if (overlayView === 'user_profile') {
        return (
            <Profile 
                onPlayTrack={handlePlayTrack} 
                onEditProfile={() => { }}
                onBack={() => { setOverlayView('none'); setViewingUserId(null); }}
                targetUserId={viewingUserId}
            />
        );
    }

    switch (activeTab) {
      case 'feed':
        return <Feed onPlayTrack={handlePlayTrack} onOpenProfile={handleOpenProfile} />;
      case 'charts':
        return <Charts onPlayTrack={handlePlayTrack} />;
      case 'concerts': // New Route
        return <Concerts />;
      case 'upload':
        return <Upload onUploadSuccess={() => handleTabChange('feed')} />;
      case 'profile':
        return <Profile onPlayTrack={handlePlayTrack} onEditProfile={() => setOverlayView('settings')} />;
      default:
        return <Feed onPlayTrack={handlePlayTrack} onOpenProfile={handleOpenProfile} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-violet-500/30">
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-black/50 overflow-hidden bg-zinc-950">
        <div className="h-full overflow-y-auto custom-scrollbar">
            {renderContent()}
        </div>

        <AudioPlayer 
            track={currentTrack} 
            onClose={() => setCurrentTrack(null)} 
            onOpenProfile={handleOpenProfile}
        />

        {overlayView === 'none' && (
            <Navigation activeTab={activeTab} onTabChange={handleTabChange} />
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <StoreProvider>
      <MainLayout />
    </StoreProvider>
  );
};

export default App;
