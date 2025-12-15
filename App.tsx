import React, { useState } from 'react';
import { StoreProvider } from './services/store';
import { TabView, Track } from './types';
import Feed from './pages/Feed';
import Charts from './pages/Charts';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import SettingsPage from './pages/Settings';
import AudioPlayer from './components/AudioPlayer';
import { Home, BarChart2, UploadCloud, User } from './components/ui/Icons';

const Navigation: React.FC<{ activeTab: TabView; onTabChange: (tab: TabView) => void }> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'feed', icon: Home, label: 'Feed' },
    { id: 'charts', icon: BarChart2, label: 'Charts' },
    { id: 'upload', icon: UploadCloud, label: 'Upload' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  // Don't show navigation if we are in settings (optional, but cleaner if settings is a modal-like page)
  if (activeTab === 'settings') return null;

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
  const [activeTab, setActiveTab] = useState<TabView>('feed');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feed':
        return <Feed onPlayTrack={handlePlayTrack} />;
      case 'charts':
        return <Charts onPlayTrack={handlePlayTrack} />;
      case 'upload':
        return <Upload onUploadSuccess={() => setActiveTab('feed')} />;
      case 'profile':
        return <Profile onPlayTrack={handlePlayTrack} onEditProfile={() => setActiveTab('settings')} />;
      case 'settings':
        return <SettingsPage onBack={() => setActiveTab('profile')} />;
      default:
        return <Feed onPlayTrack={handlePlayTrack} />;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-violet-500/30">
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl shadow-black/50 overflow-hidden bg-zinc-950">
        {/* Content Area */}
        <div className="h-full overflow-y-auto custom-scrollbar">
            {renderContent()}
        </div>

        {/* Floating Player */}
        <AudioPlayer 
            track={currentTrack} 
            onClose={() => setCurrentTrack(null)} 
        />

        {/* Bottom Nav */}
        <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
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