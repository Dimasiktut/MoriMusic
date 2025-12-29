
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, useVisuals } from '../services/store';
import { Room, RoomMessage, Track } from '../types';
import { Users, Send, X, ArrowLeft, Loader2, Zap, Music, Plus, Image as ImageIcon, Mic, ListMusic, Play, Pause, Search, Clock, Headphones, Volume2 } from '../components/ui/Icons';
import AuraEffect from '../components/AuraEffect';
import { supabase } from '../services/supabase';

const Rooms: React.FC = () => {
  const { rooms, currentUser, createRoom, deleteRoom, sendRoomMessage, t, activeRoom, setActiveRoom, setRoomMinimized, updateRoomState, myPlaylists, fetchPlaylistTracks, tracks, fetchRoomById } = useStore();
  const { setAudioIntensity } = useVisuals();
  
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomTab, setRoomTab] = useState<'chat' | 'console'>('chat');
  
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomCover, setNewRoomCover] = useState<File | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [consoleTracks, setConsoleTracks] = useState<Track[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isJoined, setIsJoined] = useState(false); // New state to track if user clicked "Join"

  // Refs for audio handling
  const chatRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const roomAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingMicRef = useRef(false);

  // DJ ID check helper
  const isDJ = activeRoom && currentUser?.id === activeRoom.djId;

  // Robust Sync Function
  const syncPlayback = useCallback(async () => {
    if (!activeRoom?.currentTrack || !roomAudioRef.current) return;
    
    setIsSyncing(true);
    const audio = roomAudioRef.current;
    
    // Ensure correct source
    if (audio.src !== activeRoom.currentTrack.audioUrl) {
      audio.src = activeRoom.currentTrack.audioUrl;
      audio.load();
    }
    
    const performSeekAndPlay = async () => {
      // Seek to current DJ position
      const targetTime = activeRoom.currentProgress || 0;
      audio.currentTime = targetTime;
      
      if (activeRoom.isPlaying) {
        try {
          await audio.play();
          setIsSyncing(false);
        } catch (err) {
          console.warn("Autoplay blocked or playback failed", err);
          setIsSyncing(false);
        }
      } else {
        audio.pause();
        setIsSyncing(false);
      }
    };

    if (audio.readyState >= 3) { // Have enough data to play
      await performSeekAndPlay();
    } else {
      const onCanPlay = async () => {
        await performSeekAndPlay();
        audio.removeEventListener('canplay', onCanPlay);
      };
      audio.addEventListener('canplay', onCanPlay);
    }
  }, [activeRoom]);

  // Mandatory Join Handler (Bypasses Autoplay Policy)
  const handleJoinLive = async () => {
    setIsJoined(true);
    if (roomAudioRef.current) {
        // We trigger an empty play/pause to unlock audio context on mobile
        roomAudioRef.current.play().then(() => {
            roomAudioRef.current?.pause();
            syncPlayback();
        }).catch(() => {
            syncPlayback();
        });
    }
  };

  // 1. Supabase Realtime Subscription
  useEffect(() => {
    if (!activeRoom) {
      setMessages([]);
      setIsJoined(false);
      return;
    }

    const channel = supabase.channel(`room:${activeRoom.id}`);
    
    channel
      .on('broadcast', { event: 'message' }, (payload) => {
        setMessages(prev => [...prev, payload.payload as RoomMessage]);
      })
      .on('broadcast', { event: 'room_sync' }, (payload) => {
        const updates = payload.payload;
        setActiveRoom((prev: Room | null) => {
           if (!prev) return null;
           const newRoom = { ...prev, ...updates };
           
           // If we are a listener and have joined, apply updates
           if (roomAudioRef.current && !isDJ && isJoined) {
             const audio = roomAudioRef.current;
             
             if (updates.currentTrack) {
               audio.src = updates.currentTrack.audioUrl;
               audio.currentTime = updates.currentProgress || 0;
             } else if (updates.currentProgress !== undefined) {
               const diff = Math.abs(audio.currentTime - updates.currentProgress);
               // Sync if more than 2s difference
               if (diff > 2) audio.currentTime = updates.currentProgress;
             }

             if (updates.isPlaying === true) {
               audio.play().catch(() => {});
             } else if (updates.isPlaying === false) {
               audio.pause();
             }
           }
           
           return newRoom;
        });
      })
      .on('broadcast', { event: 'voice_chunk' }, (payload) => {
          if (!isDJ) {
              const base64 = payload.payload.chunk;
              const binary = atob(base64);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              micQueueRef.current.push(bytes.buffer);
              playNextMicChunk();
          }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeRoom?.id, isDJ, setActiveRoom, t, isJoined]);

  // 2. DJ Periodic State Update (Broadcasting progress MORE FREQUENTLY)
  useEffect(() => {
    if (!activeRoom || !isDJ || !roomAudioRef.current) return;
    
    const interval = setInterval(() => {
      if (roomAudioRef.current && activeRoom.isPlaying) {
        updateRoomState(activeRoom.id, { currentProgress: roomAudioRef.current.currentTime });
      }
    }, 3000); // sync every 3 seconds for better real-time feel
    
    return () => clearInterval(interval);
  }, [activeRoom?.id, activeRoom?.isPlaying, isDJ, updateRoomState]);

  // 3. DJ Console - Tracks Logic
  useEffect(() => {
      if (selectedPlaylistId) {
          fetchPlaylistTracks(selectedPlaylistId).then(setConsoleTracks);
      }
  }, [selectedPlaylistId, fetchPlaylistTracks]);

  const filteredGlobalTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(globalSearchQuery.toLowerCase()) || 
    t.uploaderName.toLowerCase().includes(globalSearchQuery.toLowerCase())
  ).slice(0, 15);

  const displayTracks = globalSearchQuery ? filteredGlobalTracks : consoleTracks;

  // 4. Mic Capture
  const startMicBroadcast = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          
          recorder.ondataavailable = async (e) => {
              if (e.data.size > 0 && activeRoom) {
                  const reader = new FileReader();
                  reader.readAsDataURL(e.data);
                  reader.onloadend = () => {
                      const base64 = (reader.result as string).split(',')[1];
                      supabase.channel(`room:${activeRoom.id}`).send({
                          type: 'broadcast',
                          event: 'voice_chunk',
                          payload: { chunk: base64 }
                      });
                  };
              }
          };
          recorder.start(1000); 
      } catch (err) {
          console.error("Mic access failed", err);
          setIsMicOn(false);
      }
  };

  const stopMicBroadcast = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
          mediaRecorderRef.current = null;
      }
  };

  useEffect(() => {
      if (isMicOn && activeRoom && isDJ) {
          startMicBroadcast();
      } else {
          stopMicBroadcast();
      }
      return () => stopMicBroadcast();
  }, [isMicOn, activeRoom?.id, isDJ]);

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
              source.onended = () => {
                  isPlayingMicRef.current = false;
                  playNextMicChunk();
              };
              source.start();
              setAudioIntensity(0.5 + Math.random() * 0.5);
          } catch (err) {
              isPlayingMicRef.current = false;
              playNextMicChunk();
          }
      }
  };

  const handleOpenRoom = async (room: Room) => {
      const freshRoom = await fetchRoomById(room.id);
      const roomToOpen = freshRoom || room;
      
      setActiveRoom(roomToOpen);
      setRoomMinimized(false);
      setMessages([
          { id: '1', userId: 0, username: 'System', text: `${t('concerts_welcome_msg')} ${roomToOpen.title}`, type: 'system', createdAt: new Date().toISOString() }
      ]);
      
      // For DJ, we skip the "Join" overlay as they already interacted
      if (currentUser?.id === roomToOpen.djId) {
          setIsJoined(true);
      }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoomTitle.trim()) return;
      setIsCreating(true);
      await createRoom({ title: newRoomTitle, coverFile: newRoomCover, trackId: selectedTrackId || undefined });
      setIsCreating(false);
      setShowCreateModal(false);
      setIsJoined(true); // Creator automatically joins
  };

  const handleEndSession = async () => {
      if (activeRoom && isDJ) {
          const tg = (window as any).Telegram?.WebApp;
          const confirmText = t('track_delete_confirm') || "End session?";
          if (tg) {
              tg.showConfirm(confirmText, async (confirmed: boolean) => {
                  if (confirmed) {
                      await deleteRoom(activeRoom.id);
                      setActiveRoom(null);
                      setRoomMinimized(false);
                  }
              });
          } else if (window.confirm(confirmText)) {
              await deleteRoom(activeRoom.id);
              setActiveRoom(null);
          }
      }
  };

  const toggleMic = () => {
      if (!activeRoom || !isDJ) return;
      const newState = !isMicOn;
      setIsMicOn(newState);
      updateRoomState(activeRoom.id, { isMicActive: newState });
      if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
  };

  const playInRoom = (track: Track) => {
      if (!activeRoom || !isDJ || !roomAudioRef.current) return;
      roomAudioRef.current.src = track.audioUrl;
      roomAudioRef.current.currentTime = 0;
      roomAudioRef.current.play();
      updateRoomState(activeRoom.id, { currentTrack: track, isPlaying: true, currentProgress: 0 });
      if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
  };

  const togglePlayback = () => {
      if (!activeRoom || !isDJ || !roomAudioRef.current) return;
      const newState = !activeRoom.isPlaying;
      if (newState) roomAudioRef.current.play();
      else roomAudioRef.current.pause();
      updateRoomState(activeRoom.id, { isPlaying: newState, currentProgress: roomAudioRef.current.currentTime });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || !currentUser || !activeRoom) return;
      const newMessage: RoomMessage = {
          id: Date.now().toString(),
          userId: currentUser.id,
          username: currentUser.username,
          text: inputText,
          type: 'text',
          createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMessage]);
      await sendRoomMessage(activeRoom.id, newMessage);
      setInputText('');
  };

  const myTracks = tracks.filter(t => t.uploaderId === currentUser?.id);

  if (!activeRoom) {
      return (
          <div className="p-5 pb-32 animate-in fade-in">
              <header className="flex justify-between items-start mb-8 mt-6">
                  <div>
                    <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">{t('concerts_title')}</h1>
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest mt-1">{t('concerts_subtitle')}</p>
                  </div>
                  <button onClick={() => setShowCreateModal(true)} className="p-3 bg-sky-500 text-black rounded-2xl shadow-lg shadow-sky-500/20 active:scale-95 transition-all"><Plus size={24} /></button>
              </header>

              <div className="space-y-6">
                  <h2 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]"/> {t('concerts_live_now')}
                  </h2>
                  <div className="grid gap-5">
                      {rooms.map(room => (
                          <div key={room.id} onClick={() => handleOpenRoom(room)} className="group relative aspect-[16/9] rounded-[2.5rem] overflow-hidden cursor-pointer border border-white/5 bg-zinc-900 shadow-2xl transition-all active:scale-[0.98]">
                              <img src={room.coverUrl || room.djAvatar} className="w-full h-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-105" alt=""/>
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                              <div className="absolute top-5 left-5 bg-sky-500 text-black text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-xl">LIVE</div>
                              <div className="absolute top-5 right-5 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-white/10"><Users size={12} /> {room.listeners}</div>
                              <div className="absolute bottom-6 left-6 right-6">
                                  <h3 className="text-white font-black text-xl uppercase italic tracking-tighter leading-none">{room.title}</h3>
                                  <div className="flex items-center gap-2 mt-3 opacity-80">
                                      <img src={room.djAvatar} className="w-6 h-6 rounded-full" alt=""/>
                                      <span className="text-zinc-300 text-[11px] font-black uppercase tracking-tight">{room.djName}</span>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {rooms.length === 0 && (
                          <div className="text-center py-20 bg-zinc-900/40 rounded-[2.5rem] border border-dashed border-white/5">
                              <Music size={32} className="mx-auto text-zinc-700 mb-4" />
                              <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest px-10">{t('concerts_empty')}</p>
                          </div>
                      )}
                  </div>
              </div>

              {showCreateModal && (
                  <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in">
                      <div className="bg-zinc-950 border border-white/10 rounded-[3rem] w-full max-w-md p-8 shadow-2xl relative">
                          <button onClick={() => setShowCreateModal(false)} className="absolute top-6 right-6 text-zinc-500 p-2"><X size={24}/></button>
                          <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8">{t('concerts_create')}</h2>
                          <form onSubmit={handleCreateRoom} className="space-y-6">
                              <div onClick={() => coverInputRef.current?.click()} className="aspect-video rounded-[2rem] bg-zinc-900 border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-sky-500/50">
                                  {previewCover ? <img src={previewCover} className="w-full h-full object-cover" alt=""/> : <><ImageIcon size={32} className="text-zinc-700 mb-2" /><span className="text-[10px] font-black uppercase text-zinc-500">{t('concerts_create_cover')}</span></>}
                                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewRoomCover(e.target.files[0]); setPreviewCover(URL.createObjectURL(e.target.files[0])); } }} />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">{t('concerts_create_title')}</label>
                                  <input required type="text" value={newRoomTitle} onChange={e => setNewRoomTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none focus:ring-1 focus:ring-sky-500" placeholder="Radio Name..." />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">{t('concerts_create_label_track')}</label>
                                  <select value={selectedTrackId} onChange={e => setSelectedTrackId(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none appearance-none focus:ring-1 focus:ring-sky-500">
                                      <option value="">{t('concerts_create_option_none')}</option>
                                      {myTracks.map(track => <option key={track.id} value={track.id}>{track.title}</option>)}
                                  </select>
                              </div>
                              <button type="submit" disabled={isCreating || !newRoomTitle} className="w-full bg-sky-500 text-black py-5 rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl shadow-sky-500/20 disabled:opacity-30 flex items-center justify-center gap-3">
                                  {isCreating ? <Loader2 className="animate-spin" size={20}/> : <><Zap size={20} fill="currentColor"/> {t('concerts_create_btn')}</>}
                              </button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in slide-in-from-bottom-full duration-500">
          <audio ref={roomAudioRef} className="hidden" crossOrigin="anonymous" preload="auto" />
          
          {/* CRITICAL: Mandatory Interaction Overlay for Listeners */}
          {!isJoined && !isDJ && (
              <div 
                className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in"
              >
                  <div className="w-28 h-28 bg-sky-500 rounded-full flex items-center justify-center text-black mb-8 shadow-[0_0_50px_rgba(56,189,248,0.5)] animate-pulse">
                      <Volume2 size={52} fill="currentColor" />
                  </div>
                  <h3 className="text-white text-3xl font-black uppercase italic tracking-tighter mb-4">Live Session</h3>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em] mb-10 leading-relaxed">
                    Synchronizing audio... <br/> Tap to enter the room
                  </p>
                  <button 
                    onClick={handleJoinLive}
                    className="w-full max-w-xs py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                      <Zap size={20} fill="currentColor" /> Listen Live
                  </button>
              </div>
          )}

          <div className="absolute top-0 left-0 right-0 z-20 p-5 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent">
              <button onClick={() => setRoomMinimized(true)} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10">
                  <ArrowLeft size={24} />
              </button>
              <div className="flex items-center gap-3">
                  <div className="bg-zinc-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">{t('concerts_viewers')}: {activeRoom.listeners}</span>
                  </div>
                  {isDJ && (
                      <button onClick={handleEndSession} className="p-3 bg-red-500/20 rounded-full text-red-500 border border-red-500/20">
                          <X size={24} />
                      </button>
                  )}
              </div>
          </div>

          <div className="w-full h-[40vh] relative flex-shrink-0 overflow-hidden bg-zinc-950">
               <AuraEffect vibe="phonk" />
               <img src={activeRoom.coverUrl || activeRoom.djAvatar} className="w-full h-full object-cover opacity-40 blur-sm" alt="" />
               <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
               <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between z-10">
                   <div>
                       <h2 className="text-white font-black text-2xl uppercase italic tracking-tighter leading-none mb-3">{activeRoom.title}</h2>
                       <div className="flex items-center gap-3">
                            <img src={activeRoom.djAvatar} className="w-10 h-10 rounded-full border-2 border-sky-400" alt=""/>
                            <div>
                                <span className="text-white font-black text-sm uppercase italic block">{activeRoom.djName}</span>
                                <span className="text-sky-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                                    {activeRoom.isMicActive && <Mic size={10} className="text-red-500 animate-pulse" />}
                                    {activeRoom.currentTrack ? `${t('concerts_on_air')}: ${activeRoom.currentTrack.title}` : 'LIVE DJ SET'}
                                </span>
                            </div>
                       </div>
                   </div>
                   
                   <div className="flex flex-col items-center gap-4">
                       {!isDJ && (
                           <button 
                             onClick={syncPlayback}
                             className={`p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/10 active:scale-95 transition-all flex items-center gap-2 ${isSyncing ? 'animate-pulse' : ''}`}
                           >
                               {isSyncing ? <Loader2 size={20} className="animate-spin" /> : <Clock size={20} />}
                               <span className="text-[10px] font-black uppercase">Sync</span>
                           </button>
                       )}
                       <div className={`w-12 h-12 rounded-full flex items-center justify-center text-black transition-all ${activeRoom.isMicActive ? 'bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-sky-500'}`}>
                           {activeRoom.isMicActive ? <Mic size={24} fill="currentColor" /> : <Zap size={24} fill="currentColor" />}
                       </div>
                   </div>
               </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col relative bg-black">
               <div className="flex border-b border-white/5 bg-zinc-950 px-5">
                   <button onClick={() => setRoomTab('chat')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] relative ${roomTab === 'chat' ? 'text-sky-400' : 'text-zinc-600'}`}>
                       {t('concerts_tab_chat')}
                       {roomTab === 'chat' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-t-full shadow-[0_-5px_15px_rgba(56,189,248,0.4)]" />}
                   </button>
                   {isDJ && (
                       <button onClick={() => setRoomTab('console')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] relative ${roomTab === 'console' ? 'text-sky-400' : 'text-zinc-600'}`}>
                           {t('concerts_tab_console')}
                           {roomTab === 'console' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-t-full shadow-[0_-5px_15px_rgba(56,189,248,0.4)]" />}
                       </button>
                   )}
               </div>

               {roomTab === 'chat' ? (
                   <div className="flex-1 flex flex-col overflow-hidden">
                       <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar" ref={chatRef}>
                           {messages.map((msg) => (
                               <div key={msg.id} className={`flex flex-col ${msg.type === 'system' ? 'items-center my-4' : 'items-start'}`}>
                                   {msg.type === 'system' ? <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-zinc-500 text-[9px] font-black uppercase tracking-widest">{msg.text}</div> : (
                                       <div className="bg-zinc-900/60 backdrop-blur-lg border border-white/5 rounded-[1.5rem] rounded-tl-none px-4 py-3 max-w-[85%] shadow-xl">
                                           <span className="text-sky-400 text-[10px] font-black uppercase block mb-1 tracking-widest italic">{msg.username}</span>
                                           <span className="text-zinc-200 text-sm font-medium leading-relaxed">{msg.text}</span>
                                       </div>
                                   )}
                               </div>
                           ))}
                       </div>
                       <div className="p-4 bg-zinc-950 border-t border-white/5 flex gap-3 items-center pb-safe">
                           <form onSubmit={handleSendMessage} className="flex-1 relative">
                               <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={t('concerts_chat_placeholder')} className="w-full bg-zinc-900 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-white text-sm font-bold focus:ring-1 focus:ring-sky-500 outline-none" />
                               <button type="submit" disabled={!inputText.trim()} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-sky-400 hover:text-white disabled:opacity-20 transition-all"><Send size={20} /></button>
                           </form>
                       </div>
                   </div>
               ) : (
                   <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-8 bg-zinc-950 no-scrollbar pb-32">
                        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-white font-black uppercase italic tracking-tighter text-xl">{t('concerts_mic_title')}</h3>
                                <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mt-1">{t('concerts_mic_desc')}</p>
                            </div>
                            <button onClick={toggleMic} className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${isMicOn ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]' : 'bg-zinc-800 text-zinc-500'}`}>
                                <Mic size={32} />
                            </button>
                        </div>

                        <div className="bg-zinc-900 border border-white/5 rounded-3xl p-6">
                            <h3 className="text-white font-black uppercase italic tracking-tighter text-lg mb-4 flex items-center gap-2"><Zap size={18} fill="currentColor"/> Controls</h3>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                   <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-1">On Air Track</p>
                                   <p className="text-white text-sm font-black uppercase truncate italic">{activeRoom.currentTrack?.title || 'None'}</p>
                                </div>
                                <button onClick={togglePlayback} disabled={!activeRoom.currentTrack} className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center disabled:opacity-30 active:scale-90 transition-all">
                                    {activeRoom.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1"/>}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2"><ListMusic size={14}/> Radio Library</h3>
                            <div className="relative">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                <input 
                                    type="text" 
                                    value={globalSearchQuery}
                                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                    placeholder="Global Search tracks..." 
                                    className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold focus:ring-1 focus:ring-sky-500 outline-none"
                                />
                            </div>

                            {!globalSearchQuery && (
                                <select value={selectedPlaylistId} onChange={e => setSelectedPlaylistId(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white font-black uppercase text-xs focus:ring-1 focus:ring-sky-500 outline-none">
                                    <option value="">{t('concerts_library_placeholder')}</option>
                                    {myPlaylists.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                </select>
                            )}

                            <div className="space-y-3">
                                {displayTracks.map(track => (
                                    <div key={track.id} onClick={() => playInRoom(track)} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${activeRoom.currentTrack?.id === track.id ? 'bg-sky-500/10 border-sky-500/30' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900'}`}>
                                        <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover" alt=""/>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white text-sm font-black uppercase truncate italic">{track.title}</h4>
                                            <p className="text-zinc-500 text-[10px] font-bold uppercase truncate">{track.uploaderName}</p>
                                        </div>
                                        <div className={`p-2 rounded-lg ${activeRoom.currentTrack?.id === track.id ? 'bg-sky-500 text-black' : 'bg-zinc-800 text-zinc-600'}`}>
                                            <Play size={16} fill="currentColor" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                   </div>
               )}
          </div>
      </div>
  );
};

export default Rooms;
