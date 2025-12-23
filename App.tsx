
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
import { Home, BarChart2, UploadCloud, User, Video, Mic, Zap, X } from './components/ui/Icons';

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

const MinimizedRoom: React.FC = () => {
    const { activeRoom, setRoomMinimized, deleteRoom, currentUser } = useStore();
    if (!activeRoom) return null;

    const isDJ = currentUser?.id === activeRoom.djId;

    return (
        <div 
          onClick={() => setRoomMinimized(false)}
          className="fixed bottom-[110px] left-4 right-4 z-[55] glass border border-sky-500/30 rounded-[2rem] p-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-5 duration-300"
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                    <img src={activeRoom.coverUrl || activeRoom.djAvatar} className="w-full h-full object-cover" alt=""/>
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-white text-[11px] font-black uppercase italic truncate">{activeRoom.title}</span>
                    <span className="text-sky-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 truncate">
                        {activeRoom.isMicActive && <Mic size={10} className="text-red-500 animate-pulse"/>}
                        {activeRoom.currentTrack ? `Streaming: ${activeRoom.currentTrack.title}` : 'Live DJ Set'}
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <Zap size={16} fill="currentColor" />
                </div>
                {isDJ && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteRoom(activeRoom.id); }}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

const MainLayout: React.FC = () => {
  const { tracks, activeRoom, isRoomMinimized } = useStore(); 
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

  // Sync AudioPlayer with Active Room if user is a listener
  useEffect(() => {
      if (activeRoom?.currentTrack) {
          setCurrentTrack(activeRoom.currentTrack);
      }
  }, [activeRoom?.currentTrack]);

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
        
        {/* Minimized Room PIP */}
        {activeRoom && isRoomMinimized && <MinimizedRoom />}
        
        {/* Full Room Overlay (if not minimized) */}
        {activeRoom && !isRoomMinimized && <Rooms />}

        {/* Regular Audio Player */}
        {!activeRoom && <AudioPlayer track={currentTrack} onClose={() => setCurrentTrack(null)} onOpenProfile={handleOpenProfile} onNext={handleNextTrack} onPrev={handlePrevTrack} />}
        
        {overlayView === 'none' && <Navigation activeTab={activeTab} onTabChange={handleTabChange} />}
      </main>
    </div>
  );
};

const App: React.FC = () => <StoreProvider><MainLayout /></StoreProvider>;
export default App;
