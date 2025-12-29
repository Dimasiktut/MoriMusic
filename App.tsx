
import React, { useState, useEffect, useRef } from 'react';
import { StoreProvider, useStore, useVisuals } from './services/store';
import { TabView, Track, Room } from './types';
import Feed from './pages/Feed';
import Charts from './pages/Charts';
import Upload from './pages/Upload';
import Profile from './pages/Profile';
import Rooms from './pages/Concerts';
import SettingsPage from './pages/Settings';
import AudioPlayer from './components/AudioPlayer';
import { Home, BarChart2, UploadCloud, User, Video, Mic, Zap, X, Volume2, Play } from './components/ui/Icons';
import { supabase } from './services/supabase';

// Global Player component that persists throughout the app session
const GlobalRoomPlayer: React.FC = () => {
    const { activeRoom, currentUser, updateRoomState, setActiveRoom } = useStore();
    const { setAudioIntensity } = useVisuals();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isJoined, setIsJoined] = useState(false);
    const micAudioContextRef = useRef<AudioContext | null>(null);
    const micQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingMicRef = useRef(false);
    const animationFrameRef = useRef<number>(0);

    const isDJ = activeRoom && currentUser?.id === activeRoom.djId;

    useEffect(() => {
        if (isDJ && !isJoined) {
            setIsJoined(true);
        }
    }, [isDJ, isJoined]);

    useEffect(() => {
        const updateIntensity = () => {
            if (activeRoom?.isPlaying && audioRef.current && !audioRef.current.paused) {
                const mockPulse = 0.4 + Math.random() * 0.6;
                setAudioIntensity(mockPulse);
                animationFrameRef.current = requestAnimationFrame(updateIntensity);
            } else {
                setAudioIntensity(0);
            }
        };

        if (activeRoom?.isPlaying) {
            updateIntensity();
        } else {
            setAudioIntensity(0);
            cancelAnimationFrame(animationFrameRef.current);
        }
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [activeRoom?.isPlaying, setAudioIntensity]);

    useEffect(() => {
        if (!activeRoom || !isDJ || !audioRef.current) return;
        const interval = setInterval(() => {
            if (audioRef.current && activeRoom.isPlaying && !audioRef.current.paused) {
                updateRoomState(activeRoom.id, { 
                    currentProgress: audioRef.current.currentTime,
                    isPlaying: true
                });
            }
        }, 4000);
        return () => clearInterval(interval);
    }, [activeRoom?.id, activeRoom?.isPlaying, isDJ, updateRoomState]);

    useEffect(() => {
        if (!activeRoom || !audioRef.current || !isJoined) return;
        
        const audio = audioRef.current;
        const roomTrack = activeRoom.currentTrack;

        if (roomTrack) {
            if (audio.src !== roomTrack.audioUrl) {
                audio.pause();
                audio.src = roomTrack.audioUrl;
                audio.load();
                
                if (activeRoom.isPlaying) {
                    audio.currentTime = activeRoom.currentProgress || 0;
                    audio.play().catch(e => console.warn("Global playback blocked:", e));
                }
            } else {
                if (activeRoom.isPlaying && audio.paused) {
                    audio.play().catch(() => {});
                } else if (!activeRoom.isPlaying && !audio.paused) {
                    audio.pause();
                }
                
                if (!isDJ && activeRoom.currentProgress !== undefined) {
                    const drift = Math.abs(audio.currentTime - activeRoom.currentProgress);
                    if (drift > 5) {
                        audio.currentTime = activeRoom.currentProgress;
                    }
                }
            }
        } else {
            audio.pause();
            audio.src = '';
        }
    }, [activeRoom?.currentTrack?.id, activeRoom?.isPlaying, isJoined, isDJ]);

    useEffect(() => {
        if (!activeRoom) {
            setIsJoined(false);
            return;
        }

        const channel = supabase.channel(`room_global:${activeRoom.id}`);
        channel
            .on('broadcast', { event: 'room_sync' }, (payload) => {
                const updates = payload.payload;
                if (!isDJ) {
                    setActiveRoom((prev: Room | null) => prev ? { ...prev, ...updates } : null);
                }
            })
            .on('broadcast', { event: 'voice_chunk' }, (payload) => {
                if (!isDJ && isJoined) {
                    const base64 = payload.payload.chunk;
                    const binary = atob(base64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    micQueueRef.current.push(bytes.buffer);
                    playNextMicChunk();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeRoom?.id, isDJ, isJoined, setActiveRoom]);

    const playNextMicChunk = async () => {
        if (isPlayingMicRef.current || micQueueRef.current.length === 0) return;
        isPlayingMicRef.current = true;
        if (!micAudioContextRef.current) micAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const chunk = micQueueRef.current.shift();
        if (chunk) {
            try {
                const buffer = await micAudioContextRef.current.decodeAudioData(chunk);
                const source = micAudioContextRef.current.createBufferSource();
                source.buffer = buffer;
                source.connect(micAudioContextRef.current.destination);
                source.onended = () => { isPlayingMicRef.current = false; playNextMicChunk(); };
                source.start();
                setAudioIntensity(0.7);
            } catch (err) {
                isPlayingMicRef.current = false;
                playNextMicChunk();
            }
        }
    };

    const handleJoin = () => {
        const audio = audioRef.current;
        if (!audio || !activeRoom) return;
        
        if (!micAudioContextRef.current) {
            micAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        micAudioContextRef.current.resume().catch(() => {});
        
        setIsJoined(true);
    };

    if (!activeRoom) return null;

    return (
        <>
            <audio ref={audioRef} className="hidden" playsInline crossOrigin="anonymous" />
            {!isJoined && !isDJ && (
                <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                    <div className="w-28 h-28 bg-sky-500 rounded-full flex items-center justify-center text-black mb-8 shadow-[0_0_50px_rgba(56,189,248,0.5)] animate-pulse">
                        <Volume2 size={52} fill="currentColor" />
                    </div>
                    <h3 className="text-white text-3xl font-black uppercase italic tracking-tighter mb-4">Enter Live Radio</h3>
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-10 leading-relaxed max-w-[200px]">
                        Synchronized audio broadcast. Tap to join the session.
                    </p>
                    <button onClick={handleJoin} className="w-full max-w-xs py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                        <Play size={20} fill="currentColor" /> Join Broadcast
                    </button>
                </div>
            )}
        </>
    );
};

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
    const { activeRoom, setRoomMinimized, deleteRoom, currentUser, t, setActiveRoom } = useStore();
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
                        {activeRoom.currentTrack ? `${t('concerts_streaming')}: ${activeRoom.currentTrack.title}` : 'Live DJ Set'}
                    </span>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-400">
                    <Zap size={16} fill="currentColor" />
                </div>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (isDJ) deleteRoom(activeRoom.id);
                    else setActiveRoom(null);
                  }}
                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                >
                    <X size={20} />
                </button>
            </div>
        </div>
    );
};

const MainLayout: React.FC = () => {
  const { currentUser, tracks, activeRoom, isRoomMinimized, isLoading: storeLoading, t, setActiveRoom } = useStore(); 
  const [activeTab, setActiveTab] = useState<TabView>('feed');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [overlayView, setOverlayView] = useState<'none' | 'settings' | 'user_profile'>('none');
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [forceLoad, setForceLoad] = useState(false);
  const deepLinkProcessed = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setForceLoad(true);
    }, 4500); // Increased safety timeout
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg) return;

    const shouldShowBack = overlayView !== 'none' || activeRoom !== null;
    
    if (shouldShowBack) {
      tg.BackButton.show();
      const onBackClick = () => {
        if (overlayView !== 'none') {
          setOverlayView('none');
          setViewingUserId(null);
        } else if (activeRoom && isRoomMinimized) {
          if (currentUser?.id !== activeRoom.djId) {
             setActiveRoom(null);
          } else {
             tg.showConfirm(t('track_delete_confirm') || "Close session?", (confirm: boolean) => {
                 if (confirm) setActiveRoom(null);
             });
          }
        }
      };
      tg.BackButton.onClick(onBackClick);
      return () => {
        tg.BackButton.offClick(onBackClick);
        tg.BackButton.hide();
      };
    } else {
      tg.BackButton.hide();
    }
  }, [overlayView, activeRoom, isRoomMinimized, setActiveRoom, t, currentUser]);
  
  useEffect(() => {
    if (tracks && tracks.length > 0 && !deepLinkProcessed.current) {
        const tg = (window as any).Telegram?.WebApp;
        // CORRECT: Look for start_param in TWA initData
        const startParam = tg?.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get('startapp');
        
        // ENSURE it is a string before calling startsWith
        if (typeof startParam === 'string' && startParam.startsWith('track_')) {
            const trackId = startParam.replace('track_', '');
            const found = tracks.find(t => t.id === trackId);
            if (found) setCurrentTrack(found);
        }
        deepLinkProcessed.current = true;
    }
  }, [tracks]);

  useEffect(() => {
      if (activeRoom?.currentTrack) {
          if (isRoomMinimized) setCurrentTrack(activeRoom.currentTrack);
          else setCurrentTrack(null);
      }
  }, [activeRoom?.currentTrack, isRoomMinimized]);

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
    try {
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
    } catch (e) {
      console.error("Layout Render Error:", e);
      return <div className="p-20 text-center text-red-500 font-bold uppercase tracking-widest">Layout Error</div>;
    }
  };

  const isLoading = storeLoading && !forceLoad;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 z-[999]">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-sky-500/20 border-t-sky-500 rounded-full animate-spin" />
          <Zap size={24} className="absolute inset-0 m-auto text-sky-400 animate-pulse" fill="currentColor" />
        </div>
        <p className="text-sky-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">{t('app_initializing')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-sky-400/30">
      <main className="max-w-md mx-auto min-h-screen relative shadow-2xl overflow-hidden bg-black flex flex-col">
        <GlobalRoomPlayer />
        <div className="flex-1 overflow-y-auto custom-scrollbar no-scrollbar">
            {renderContent()}
        </div>
        {activeRoom && isRoomMinimized && <MinimizedRoom />}
        {!activeRoom && <AudioPlayer track={currentTrack} onClose={() => setCurrentTrack(null)} onOpenProfile={handleOpenProfile} onNext={handleNextTrack} onPrev={handlePrevTrack} />}
        {overlayView === 'none' && <Navigation activeTab={activeTab} onTabChange={handleTabChange} />}
      </main>
    </div>
  );
};

const App: React.FC = () => <StoreProvider><MainLayout /></StoreProvider>;
export default App;
