
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Track, User, Comment, Playlist, Room, RoomMessage } from '../types';
import { TRANSLATIONS, Language } from '../constants';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";

interface UploadTrackData {
  title: string;
  description: string;
  genre: string;
  audioFile?: File; 
  existingAudioUrl?: string; 
  coverFile: File | null;
  existingCoverUrl?: string; 
  duration: number;
}

interface CreateRoomData {
  title: string;
  coverFile: File | null;
  trackId?: string;
}

interface StoreContextType {
  currentUser: User | null;
  tracks: Track[];
  myPlaylists: Playlist[]; 
  savedPlaylists: Playlist[];
  rooms: Room[];
  activeRoom: Room | null;
  isRoomMinimized: boolean;
  setActiveRoom: (room: Room | null) => void;
  setRoomMinimized: (v: boolean) => void;
  isLoading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
  uploadTrack: (data: UploadTrackData) => Promise<void>;
  uploadAlbum: (files: File[], commonData: { title: string, description: string, genre: string, coverFile: File | null }) => Promise<void>;
  generateTrackDescription: (title: string, genre: string) => Promise<string>;
  createPlaylist: (title: string) => Promise<void>;
  addToPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  fetchUserPlaylists: (userId: number) => Promise<Playlist[]>;
  fetchSavedPlaylists: (userId: number) => Promise<Playlist[]>;
  toggleSavePlaylist: (playlistId: string) => Promise<void>;
  fetchPlaylistTracks: (playlistId: string) => Promise<Track[]>;
  deleteTrack: (trackId: string) => Promise<void>;
  downloadTrack: (track: Track) => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  addComment: (trackId: string, text: string) => Promise<void>;
  recordListen: (trackId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  uploadImage: (file: File, bucket: string, path: string) => Promise<string>;
  fetchUserById: (userId: number) => Promise<User | null>;
  getChartTracks: (period: 'week' | 'month') => Promise<Track[]>;
  getLikedTracks: (userId: number) => Promise<Track[]>;
  getUserHistory: (userId: number) => Promise<Track[]>;
  createRoom: (data: CreateRoomData) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  fetchRooms: () => Promise<void>;
  sendRoomMessage: (roomId: string, message: Partial<RoomMessage>) => Promise<void>;
  updateRoomState: (roomId: string, updates: Partial<Room>) => Promise<void>;
  donateToRoom: () => Promise<boolean>;
}

interface VisualContextType {
  audioIntensity: number;
  setAudioIntensity: (v: number) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const VisualContext = createContext<VisualContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};

export const useVisuals = () => {
  const context = useContext(VisualContext);
  if (!context) throw new Error("useVisuals must be used within VisualProvider");
  return context;
};

const VisualProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [audioIntensity, setAudioIntensity] = useState(0);
  const value = useMemo(() => ({ audioIntensity, setAudioIntensity }), [audioIntensity]);
  return React.createElement(VisualContext.Provider, { value }, children);
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [isRoomMinimized, setRoomMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoadDone = useRef(false);
  
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('mori_language');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('mori_language', lang);
  };

  const t = useCallback((key: keyof typeof TRANSLATIONS['en']) => {
    return TRANSLATIONS[language][key] || key;
  }, [language]);

  const mapTracksData = useCallback((rawTracks: any[], userLikes: string[] = []): Track[] => {
      if (!rawTracks) return [];
      return rawTracks.map((trk: any) => {
          const likesCount = trk.track_likes?.[0]?.count ?? (trk.likes_count ?? trk.likes ?? 0);
          const commentsData = trk.comments || [];
          const playsCount = trk.plays ?? trk.play_count ?? 0;

          return {
              id: trk.id, 
              uploaderId: trk.uploader_id, 
              uploaderName: trk.profiles?.username || 'Mori Artist',
              uploaderAvatar: trk.profiles?.photo_url, 
              title: trk.title, 
              description: trk.description,
              genre: trk.genre, 
              coverUrl: trk.cover_url, 
              audioUrl: trk.audio_url, 
              duration: trk.duration || 0,
              createdAt: trk.created_at, 
              plays: playsCount, 
              likes: likesCount, 
              comments: Array.isArray(commentsData) ? commentsData.map((c: any) => ({
                id: c.id,
                userId: c.user_id,
                username: c.profiles?.username || 'User',
                avatar: c.profiles?.photo_url,
                text: c.text,
                createdAt: c.created_at
              })) : [],
              isLikedByCurrentUser: userLikes.includes(trk.id), 
              isVerifiedUploader: playsCount > 1000 
          };
      });
  }, []);

  const fetchTracks = useCallback(async (userId?: number) => {
    try {
      const { data: tracksData, error } = await supabase
        .from('tracks')
        .select(`
          *, 
          profiles:uploader_id(username, photo_url),
          track_likes(count),
          comments(id, text, created_at, user_id, profiles:user_id(username, photo_url))
        `)
        .order('created_at', { ascending: false })
        .limit(30);
      
      if (error) throw error;

      let userLikes: string[] = [];
      if (userId) {
        const { data: likes } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
        if (likes) userLikes = likes.map(l => l.track_id);
      }

      setTracks(mapTracksData(tracksData || [], userLikes));
    } catch (e: any) {
      console.error("Fetch tracks error:", e.message || e);
    }
  }, [mapTracksData]);

  const fetchRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, profiles:dj_id(username, photo_url)')
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      if (data && !error) {
        const mapped: Room[] = data.map((r: any) => ({
          id: r.id, title: r.title, djId: r.dj_id,
          djName: r.profiles?.username || 'DJ',
          djAvatar: r.profiles?.photo_url || '',
          coverUrl: r.cover_url, startTime: r.created_at,
          status: r.status, listeners: r.listeners_count || Math.floor(Math.random() * 5) + 1, 
          isMicActive: !!r.is_mic_active
        }));
        setRooms(mapped);
      }
    } catch (e: any) {}
  }, []);

  const fetchUserById = useCallback(async (userId: number): Promise<User | null> => {
    try {
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error || !profile) return null;

      const [
          { count: uploads }, 
          { data: playsData }, 
          { count: likesReceived }
      ] = await Promise.all([
          supabase.from('tracks').select('id', { count: 'exact', head: true }).eq('uploader_id', userId),
          supabase.from('tracks').select('plays').eq('uploader_id', userId),
          supabase.from('track_likes').select('track_id, tracks!inner(uploader_id)', { count: 'exact', head: true }).eq('tracks.uploader_id', userId)
      ]);

      const totalPlays = playsData?.reduce((acc, curr) => acc + (curr.plays || 0), 0) || 0;

      return {
          id: userId, username: profile.username, firstName: profile.first_name, lastName: profile.last_name,
          photoUrl: profile.photo_url, headerUrl: profile.header_url, bio: profile.bio, links: profile.links || {},
          stats: { uploads: uploads || 0, likesReceived: likesReceived || 0, totalPlays: totalPlays }, 
          isVerified: totalPlays > 5000
      };
    } catch (e) { return null; }
  }, []);

  const refreshUserContext = useCallback(async (userId: number) => {
    try {
      const [{ data: likesData }, { data: plData }] = await Promise.all([
        supabase.from('track_likes').select('track_id').eq('user_id', userId),
        supabase.from('playlists').select('*').eq('user_id', userId)
      ]);
      const userLikes = likesData?.map(l => l.track_id) || [];
      setTracks(prev => prev.map(trk => ({ ...trk, isLikedByCurrentUser: userLikes.includes(trk.id) })));
      if (plData) setMyPlaylists(plData.map(p => ({ id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at })));
      const { data: savedData } = await supabase.from('saved_playlists').select('playlists(*)').eq('user_id', userId);
      if (savedData) setSavedPlaylists(savedData.map((d: any) => d.playlists).filter(Boolean).map((p: any) => ({ id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at })));
    } catch (e) {}
  }, []);

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    try {
        const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
        if (trackData) await supabase.from('tracks').update({ plays: (trackData.plays || 0) + 1 }).eq('id', trackId);
        await supabase.from('listen_history').insert({ user_id: currentUser.id, track_id: trackId });
    } catch (e) {}
  };

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data!.path);
    return publicUrl;
  };

  const uploadTrack = async (data: UploadTrackData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let audioUrl = data.existingAudioUrl || '';
      let coverUrl = data.existingCoverUrl || '';
      if (data.audioFile) audioUrl = await uploadImage(data.audioFile, 'music', `tracks/${currentUser.id}/${Date.now()}_${data.audioFile.name}`);
      if (data.coverFile) coverUrl = await uploadImage(data.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_${data.coverFile.name}`);
      await supabase.from('tracks').insert({ uploader_id: currentUser.id, title: data.title, description: data.description, genre: data.genre, audio_url: audioUrl, cover_url: coverUrl, duration: data.duration });
      await fetchTracks(currentUser.id);
    } finally { setIsLoading(false); }
  };

  const uploadAlbum = async (files: File[], commonData: { title: string, description: string, genre: string, coverFile: File | null }) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let coverUrl = '';
      if (commonData.coverFile) coverUrl = await uploadImage(commonData.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_album`);
      for (const file of files) {
        const audioUrl = await uploadImage(file, 'music', `tracks/${currentUser.id}/${Date.now()}_${file.name}`);
        await supabase.from('tracks').insert({ uploader_id: currentUser.id, title: file.name.replace(/\.[^/.]+$/, ""), description: commonData.description, genre: commonData.genre, audio_url: audioUrl, cover_url: coverUrl, duration: 180 });
      }
      await fetchTracks(currentUser.id);
    } finally { setIsLoading(false); }
  };

  const deleteTrack = useCallback(async (trackId: string) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase.from('tracks').delete().eq('id', trackId).eq('uploader_id', currentUser.id);
      if (error) throw error;
      setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (e: any) {
      console.error("Delete track error:", e.message || e);
    }
  }, [currentUser]);

  const generateTrackDescription = async (title: string, genre: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a short, cool description for track "${title}" (${genre}). Max 150 chars.`,
        config: { temperature: 0.8 }
      });
      return response.text || '';
    } catch (error) { return ''; }
  };

  const toggleLike = async (trackId: string) => {
    if (!currentUser) return;
    const track = tracks.find(trk => trk.id === trackId);
    if (!track) return;
    const isLiked = track.isLikedByCurrentUser;
    setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, isLikedByCurrentUser: !isLiked, likes: isLiked ? Math.max(0, trk.likes - 1) : trk.likes + 1 } : trk));
    if (isLiked) await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
    else await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
  };

  const addComment = async (trackId: string, text: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('comments').insert({ track_id: trackId, user_id: currentUser.id, text }).select('*, profiles:user_id(username, photo_url)').single();
    if (!error && data) {
        const newComment: Comment = { id: data.id, userId: currentUser.id, username: currentUser.username, avatar: currentUser.photoUrl, text, createdAt: data.created_at };
        setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, comments: [newComment, ...(trk.comments || [])] } : trk));
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    try {
        const dbPayload: any = { ...updates };
        if (updates.firstName) dbPayload.first_name = updates.firstName;
        if (updates.lastName) dbPayload.last_name = updates.lastName;
        if (updates.photoUrl) dbPayload.photo_url = updates.photoUrl;
        if (updates.headerUrl) dbPayload.header_url = updates.headerUrl;
        if (updates.bio) dbPayload.bio = updates.bio;
        if (updates.links) dbPayload.links = updates.links;

        await supabase.from('profiles').upsert({ id: currentUser.id, ...dbPayload });
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (e) {}
  };

  const createRoom = async (data: CreateRoomData) => {
    if (!currentUser) return; setIsLoading(true);
    try {
      let coverUrl = data.coverFile ? await uploadImage(data.coverFile, 'music', `room_covers/${currentUser.id}/${Date.now()}`) : currentUser.photoUrl || '';
      const { data: ins, error } = await supabase.from('rooms').insert({ title: data.title, dj_id: currentUser.id, cover_url: coverUrl, status: 'live', track_id: data.trackId }).select('*, profiles:dj_id(username, photo_url)').single();
      if (!error && ins) { const nr: Room = { id: ins.id, title: ins.title, djId: ins.dj_id, djName: ins.profiles?.username || currentUser.username, djAvatar: ins.profiles?.photo_url || currentUser.photoUrl || '', coverUrl: ins.cover_url, startTime: ins.created_at, status: ins.status, listeners: 1, isMicActive: false }; setRooms(p => [nr, ...p]); setActiveRoom(nr); }
    } finally { setIsLoading(false); }
  };

  const deleteRoom = async (rid: string) => { await supabase.from('rooms').delete().eq('id', rid); if (activeRoom?.id === rid) setActiveRoom(null); await fetchRooms(); };

  useEffect(() => {
    if (isInitialLoadDone.current) return;
    isInitialLoadDone.current = true;
    const initApp = async () => {
        const tg = (window as any).Telegram?.WebApp;
        const tgUserId = tg?.initDataUnsafe?.user?.id;
        const tracksPromise = fetchTracks(tgUserId);
        const roomsPromise = fetchRooms();
        let authPromise = Promise.resolve();
        if (tgUserId) {
            authPromise = fetchUserById(tgUserId).then(async user => {
                if (user) { setCurrentUser(user); refreshUserContext(user.id); }
                else {
                    const tgUser = tg.initDataUnsafe.user;
                    try {
                        await supabase.from('profiles').insert({ id: tgUser.id, username: tgUser.username || `user_${tgUser.id}`, first_name: tgUser.first_name, last_name: tgUser.last_name, photo_url: tgUser.photo_url || '' });
                        const newUser = await fetchUserById(tgUser.id);
                        if (newUser) { setCurrentUser(newUser); refreshUserContext(newUser.id); }
                    } catch(e) {}
                }
            });
        }
        await Promise.allSettled([tracksPromise, roomsPromise]);
        setIsLoading(false);
        await authPromise;
    };
    initApp();
  }, [fetchTracks, fetchRooms, refreshUserContext, fetchUserById]);

  const value: StoreContextType = useMemo(() => ({
    currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, setActiveRoom, setRoomMinimized, isLoading, language, setLanguage, t,
    uploadTrack, uploadAlbum, generateTrackDescription, 
    createPlaylist: async (title) => { if (currentUser) await supabase.from('playlists').insert({ user_id: currentUser.id, title }); }, 
    addToPlaylist: async (tid, pid) => { await supabase.from('playlist_items').insert({ playlist_id: pid, track_id: tid }); },
    fetchUserPlaylists: async (uid) => { const { data } = await supabase.from('playlists').select('*').eq('user_id', uid); return (data || []).map((p: any) => ({ id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at })); },
    fetchSavedPlaylists: async (uid) => { const { data } = await supabase.from('saved_playlists').select('playlists(*)').eq('user_id', uid); return data?.map((d: any) => d.playlists).filter(Boolean).map((p: any) => ({ id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at })) || []; },
    toggleSavePlaylist: async (pid) => { if (!currentUser) return; const isSaved = savedPlaylists.some(p => p.id === pid); if (isSaved) await supabase.from('saved_playlists').delete().eq('user_id', currentUser.id).eq('playlist_id', pid); else await supabase.from('saved_playlists').insert({ user_id: currentUser.id, playlist_id: pid }); },
    fetchPlaylistTracks: async (pid) => { const { data } = await supabase.from('playlist_items').select('tracks(*, profiles:uploader_id(username, photo_url), track_likes(count))').eq('playlist_id', pid); return mapTracksData(data?.map((d: any) => d.tracks).filter(Boolean) || [], []); },
    deleteTrack, downloadTrack: async (track) => { const a = document.createElement('a'); a.href = track.audioUrl; a.download = `${track.title}.mp3`; a.click(); },
    toggleLike, addComment, recordListen, updateProfile, uploadImage, fetchUserById,
    getChartTracks: async () => { const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url), track_likes(count)').order('plays', { ascending: false }).limit(20); return mapTracksData(data || [], []); },
    getLikedTracks: async (uid) => { const { data: likes } = await supabase.from('track_likes').select('track_id').eq('user_id', uid); if (!likes?.length) return []; const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url), track_likes(count)').in('id', likes.map(l => l.track_id)); return mapTracksData(data || [], likes.map(l => l.track_id)); },
    getUserHistory: async (uid) => { const { data: hist } = await supabase.from('listen_history').select('track_id').eq('user_id', uid).order('played_at', { ascending: false }).limit(20); if (!hist?.length) return []; const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url), track_likes(count)').in('id', [...new Set(hist.map(h => h.track_id))]); return mapTracksData(data || [], []); },
    createRoom, deleteRoom, fetchRooms, 
    sendRoomMessage: async (rid, msg) => { await supabase.channel(`room:${rid}`).send({ type: 'broadcast', event: 'message', payload: msg }); },
    updateRoomState: async (rid, up) => { 
        const db: any = {}; 
        if (up.isMicActive !== undefined) db.is_mic_active = up.isMicActive; 
        if (up.currentTrack !== undefined) db.track_id = up.currentTrack?.id; 
        await supabase.from('rooms').update(db).eq('id', rid); 
        
        // Broadcast updates to all listeners
        await supabase.channel(`room:${rid}`).send({
            type: 'broadcast',
            event: 'room_sync',
            payload: up
        });
        
        if (activeRoom?.id === rid) setActiveRoom({ ...activeRoom, ...up }); 
    },
    donateToRoom: async () => true
  }), [currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, isLoading, language, t, mapTracksData, deleteTrack, fetchRooms, setActiveRoom]);

  return React.createElement(
    StoreContext.Provider,
    { value: value },
    React.createElement(VisualProvider, null, children)
  );
};
