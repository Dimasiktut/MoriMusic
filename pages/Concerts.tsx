
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore, useVisuals } from '../services/store';
import { Room, RoomMessage, Track } from '../types';
import { Users, Send, X, ArrowLeft, Loader2, Zap, Music, Plus, Image as ImageIcon, Mic, ListMusic, Play, Pause, Search, Clock, Volume2 } from '../components/ui/Icons';
import AuraEffect from '../components/AuraEffect';
import { supabase } from '../services/supabase';

const Rooms: React.FC = () => {
  const { 
    rooms, currentUser, createRoom, deleteRoom, sendRoomMessage, t, 
    activeRoom, setActiveRoom, setRoomMinimized, updateRoomState, 
    myPlaylists, fetchPlaylistTracks, tracks, fetchRoomById 
  } = useStore();
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
  const [isJoined, setIsJoined] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const roomAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingMicRef = useRef(false);

  const isDJ = activeRoom && currentUser?.id === activeRoom.djId;

  // Manual Sync Logic
  const syncPlayback = useCallback(() => {
    if (!activeRoom?.currentTrack || !roomAudioRef.current) {
        setIsSyncing(false);
        return;
    }
    
    setIsSyncing(true);
    const audio = roomAudioRef.current;
    const targetSrc = activeRoom.currentTrack.audioUrl;
    
    const applySync = () => {
        const targetTime = activeRoom.currentProgress || 0;
        if (Math.abs(audio.currentTime - targetTime) > 2) {
            audio.currentTime = targetTime;
        }
        if (activeRoom.isPlaying) {
            audio.play().catch(() => {});
        } else {
            audio.pause();
        }
        setIsSyncing(false);
    };

    if (audio.src !== targetSrc) {
        audio.src = targetSrc;
        audio.load();
        audio.oncanplay = () => {
            applySync();
            audio.oncanplay = null;
        };
    } else {
        applySync();
    }
  }, [activeRoom]);

  // CRITICAL: Purely synchronous handler to unlock audio for Telegram WebApp
  const handleJoinLive = () => {
    const audio = roomAudioRef.current;
    if (!audio) return;
    
    setIsJoined(true);
    
    // 1. Initialize and resume Voice AudioContext immediately
    if (!micAudioContextRef.current) {
        micAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (micAudioContextRef.current.state === 'suspended') {
        micAudioContextRef.current.resume();
    }

    // 2. Setup radio stream
    if (activeRoom?.currentTrack) {
        audio.src = activeRoom.currentTrack.audioUrl;
        audio.load();
        
        audio.oncanplay = () => {
            audio.currentTime = activeRoom.currentProgress || 0;
            if (activeRoom.isPlaying !== false) {
                audio.play().catch(e => console.error("Radio play blocked", e));
            }
            audio.oncanplay = null;
        };
    } else {
        // Just unlock the tag if no track yet
        audio.play().then(() => audio.pause()).catch(() => {});
    }
  };

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
        
        if (roomAudioRef.current && !isDJ && isJoined) {
            const audio = roomAudioRef.current;
            if (updates.currentTrack) {
                audio.src = updates.currentTrack.audioUrl;
                audio.load();
                audio.oncanplay = () => {
                    audio.currentTime = updates.currentProgress || 0;
                    if (updates.isPlaying !== false) audio.play().catch(() => {});
                    audio.oncanplay = null;
                };
            } else {
                if (updates.currentProgress !== undefined) {
                    const diff = Math.abs(audio.currentTime - updates.currentProgress);
                    if (diff > 4) audio.currentTime = updates.currentProgress;
                }
                if (updates.isPlaying === true) audio.play().catch(() => {});
                else if (updates.isPlaying === false) audio.pause();
            }
        }

        setActiveRoom((prev: Room | null) => {
           if (!prev) return null;
           return { ...prev, ...updates };
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

  useEffect(() => {
    if (!activeRoom || !isDJ || !roomAudioRef.current) return;
    
    const interval = setInterval(() => {
      if (roomAudioRef.current && activeRoom.isPlaying) {
        updateRoomState(activeRoom.id, { 
            currentProgress: roomAudioRef.current.currentTime,
            isPlaying: !roomAudioRef.current.paused 
        });
      }
    }, 4000); 
    
    return () => clearInterval(interval);
  }, [activeRoom?.id, activeRoom?.isPlaying, isDJ, updateRoomState]);

  useEffect(() => {
      if (selectedPlaylistId) {
          fetchPlaylistTracks(selectedPlaylistId).then(setConsoleTracks);
      }
  }, [selectedPlaylistId, fetchPlaylistTracks]);

  const displayTracks = globalSearchQuery 
    ? tracks.filter(t => t.title.toLowerCase().includes(globalSearchQuery.toLowerCase())).slice(0, 15) 
    : consoleTracks;

  const startMicBroadcast = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;
          recorder.ondataavailable = (e) => {
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
          setIsMicOn(false);
      }
  };

  useEffect(() => {
      if (isMicOn && activeRoom && isDJ) startMicBroadcast();
      else if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(tr => tr.stop());
          mediaRecorderRef.current = null;
      }
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
              source.onended = () => { isPlayingMicRef.current = false; playNextMicChunk(); };
              source.start();
              setAudioIntensity(0.7);
          } catch (err) {
              isPlayingMicRef.current = false;
              playNextMicChunk();
          }
      }
  };

  const handleOpenRoom = async (room: Room) => {
      const roomToOpen = (await fetchRoomById(room.id)) || room;
      setActiveRoom(roomToOpen);
      setRoomMinimized(false);
      if (currentUser?.id === roomToOpen.djId) setIsJoined(true);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoomTitle.trim()) return;
      setIsCreating(true);
      await createRoom({ title: newRoomTitle, coverFile: newRoomCover, trackId: selectedTrackId || undefined });
      setIsCreating(false);
      setShowCreateModal(false);
      setIsJoined(true); 
  };

  const handleEndSession = async () => {
      if (activeRoom && isDJ && window.confirm(t('track_delete_confirm'))) {
          await deleteRoom(activeRoom.id);
          setActiveRoom(null);
      }
  };

  const toggleMic = () => {
      if (!activeRoom || !isDJ) return;
      const newState = !isMicOn;
      setIsMicOn(newState);
      updateRoomState(activeRoom.id, { isMicActive: newState });
  };

  const playInRoom = (track: Track) => {
      if (!activeRoom || !isDJ || !roomAudioRef.current) return;
      roomAudioRef.current.src = track.audioUrl;
      roomAudioRef.current.currentTime = 0;
      roomAudioRef.current.play().catch(() => {});
      updateRoomState(activeRoom.id, { currentTrack: track, isPlaying: true, currentProgress: 0 });
  };

  const togglePlayback = () => {
      if (!activeRoom || !isDJ || !roomAudioRef.current) return;
      const newState = !activeRoom.isPlaying;
      if (newState) roomAudioRef.current.play().catch(() => {});
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
                              <img src={room.coverUrl || room.djAvatar} className="w-full h-full object-cover opacity-50" alt=""/>
                              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                              <div className="absolute top-5 left-5 bg-sky-500 text-black text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest">LIVE</div>
                              <div className="absolute top-5 right-5 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-white/10"><Users size={12} /> {room.listeners}</div>
                              <div className="absolute bottom-6 left-6 right-6">
                                  <h3 className="text-white font-black text-xl uppercase italic tracking-tighter leading-none">{room.title}</h3>
                                  <div className="flex items-center gap-2 mt-3">
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
                              <div onClick={() => coverInputRef.current?.click()} className="aspect-video rounded-[2rem] bg-zinc-900 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer overflow-hidden">
                                  {previewCover ? <img src={previewCover} className="w-full h-full object-cover" alt=""/> : <><ImageIcon size={32} className="text-zinc-700 mb-2" /><span className="text-[10px] font-black uppercase text-zinc-500">{t('concerts_create_cover')}</span></>}
                                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) { setNewRoomCover(e.target.files[0]); setPreviewCover(URL.createObjectURL(e.target.files[0])); } }} />
                              </div>
                              <input required type="text" value={newRoomTitle} onChange={e => setNewRoomTitle(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white font-bold outline-none" placeholder="Room Title..." />
                              <div className="space-y-2">
                                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">{t('concerts_create_label_track')}</label>
                                  <select value={selectedTrackId} onChange={e => setSelectedTrackId(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black uppercase outline-none">
                                      <option value="">{t('concerts_create_option_none')}</option>
                                      {myTracks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
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
          
          {!isJoined && !isDJ && (
              <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
                  <div className="w-28 h-28 bg-sky-500 rounded-full flex items-center justify-center text-black mb-8 shadow-[0_0_50px_rgba(56,189,248,0.5)] animate-pulse">
                      <Volume2 size={52} fill="currentColor" />
                  </div>
                  <h3 className="text-white text-3xl font-black uppercase italic tracking-tighter mb-4">Join Live Radio</h3>
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-[0.2em] mb-10 leading-relaxed">
                    Connecting to the broadcast... <br/> Tap to enter
                  </p>
                  <button onClick={handleJoinLive} className="w-full max-w-xs py-5 bg-white text-black rounded-[2rem] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3">
                      <Play size={20} fill="currentColor" /> Enter Room
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
                      <span className="text-white text-[10px] font-black uppercase tracking-widest">{activeRoom.listeners} {t('concerts_viewers')}</span>
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
                                    {activeRoom.currentTrack ? `${t('concerts_on_air')}: ${activeRoom.currentTrack.title}` : 'LIVE STREAM'}
                                </span>
                            </div>
                       </div>
                   </div>
                   <div className="flex flex-col items-center gap-4">
                       {!isDJ && (
                           <button onClick={syncPlayback} className={`p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white border border-white/10 ${isSyncing ? 'animate-pulse' : ''}`}>
                               <Clock size={20} />
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
                            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] flex items-center gap-2"><ListMusic size={14}/> Library</h3>
                            <div className="space-y-4">
                                <div className="relative">
                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input type="text" value={globalSearchQuery} onChange={(e) => setGlobalSearchQuery(e.target.value)} placeholder="Search tracks..." className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-xs font-bold focus:ring-1 focus:ring-sky-500 outline-none"/>
                                </div>
                                {!globalSearchQuery && (
                                    <select value={selectedPlaylistId} onChange={e => setSelectedPlaylistId(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-xs font-black uppercase outline-none">
                                        <option value="">{t('concerts_library_placeholder')}</option>
                                        {myPlaylists.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                                    </select>
                                )}
                            </div>
                            <div className="space-y-3">
                                {displayTracks.map(track => (
                                    <div key={track.id} onClick={() => playInRoom(track)} className={`flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer ${activeRoom.currentTrack?.id === track.id ? 'bg-sky-500/10 border-sky-500/30' : 'bg-zinc-900/50 border-white/5 hover:bg-zinc-900'}`}>
                                        <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover" alt=""/>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-white text-sm font-black uppercase truncate italic">{track.title}</h4>
                                            <p className="text-zinc-500 text-[10px] font-bold truncate">{track.uploaderName}</p>
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
