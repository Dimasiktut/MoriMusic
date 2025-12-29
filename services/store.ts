
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Track, User, Playlist, Room, RoomMessage } from '../types';
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
  setActiveRoom: React.Dispatch<React.SetStateAction<Room | null>>;
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
  fetchRoomById: (roomId: string) => Promise<Room | null>;
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
  return React.createElement(VisualContext.Provider, { value: value }, children);
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists] = useState<Playlist[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [isRoomMinimized, setRoomMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialLoadDone = useRef(false);
  
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('mori_language');
      return (saved === 'en' || saved === 'ru') ? saved : 'ru';
    } catch (e) { return 'ru'; }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try { localStorage.setItem('mori_language', lang); } catch (e) {}
  };

  const t = useCallback((key: keyof typeof TRANSLATIONS['en']) => {
    return TRANSLATIONS[language][key] || key;
  }, [language]);

  const mapTracksData = useCallback((rawTracks: any[], userLikes: string[] = []): Track[] => {
      if (!rawTracks) return [];
      return rawTracks.map((trk: any) => {
          const likesCount = trk.track_likes?.[0]?.count ?? (trk.likes_count ?? trk.likes ?? 0);
          const playsCount = trk.plays ?? trk.play_count ?? 0;
          const commentsData = trk.comments || [];

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

  const fetchRooms = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select(`
          *, 
          profiles:dj_id(username, photo_url),
          tracks:track_id(*, profiles:uploader_id(username, photo_url), track_likes(count))
        `)
        .eq('status', 'live')
        .order('created_at', { ascending: false });

      if (data && !error) {
        const mapped: Room[] = data.map((r: any) => ({
          id: r.id, title: r.title, djId: r.dj_id,
          djName: r.profiles?.username || 'DJ',
          djAvatar: r.profiles?.photo_url || '',
          coverUrl: r.cover_url, startTime: r.created_at,
          status: r.status, listeners: r.listeners_count || 1, 
          isMicActive: !!r.is_mic_active, isPlaying: r.is_playing || false,
          currentProgress: r.current_progress || 0,
          currentTrack: r.tracks ? mapTracksData([r.tracks], [])[0] : undefined
        }));
        setRooms(mapped);
      }
    } catch (e) { console.error("Rooms fetch error", e); }
  }, [mapTracksData]);

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
    } catch (e) { console.error("Tracks fetch error", e); }
  }, [mapTracksData]);

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

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const createRoom = async (data: CreateRoomData) => {
    if (!currentUser) return;
    let coverUrl = '';
    if (data.coverFile) {
        coverUrl = await uploadImage(data.coverFile, 'music', `rooms/${currentUser.id}/${Date.now()}`);
    }

    const { data: roomData, error } = await supabase.from('rooms').insert({
        title: data.title,
        dj_id: currentUser.id,
        cover_url: coverUrl || currentUser.photoUrl,
        track_id: data.trackId,
        status: 'live'
    }).select().single();

    if (error) throw error;
    await fetchRooms();
    const newRoom = rooms.find(r => r.id === roomData.id);
    if (newRoom) setActiveRoom(newRoom);
  };

  const deleteRoom = async (roomId: string) => {
    const { error } = await supabase
        .from('rooms')
        .update({ status: 'ended' })
        .eq('id', roomId);
    
    if (!error) {
        setRooms(prev => prev.filter(r => r.id !== roomId));
        if (activeRoom?.id === roomId) setActiveRoom(null);
    }
  };

  const updateRoomState = async (roomId: string, updates: Partial<Room>) => {
    // Optimistic local update
    setActiveRoom(prev => prev && prev.id === roomId ? { ...prev, ...updates } : prev);
    
    // Broadcast to others via Supabase Realtime
    const channel = supabase.channel(`room_global:${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'room_sync',
      payload: updates
    });

    // Persistent update to DB (throttled/limited if needed)
    await supabase.from('rooms').update({
        is_playing: updates.isPlaying,
        current_progress: updates.currentProgress,
        track_id: updates.currentTrack?.id,
        is_mic_active: updates.isMicActive
    }).eq('id', roomId);
  };

  const sendRoomMessage = async (roomId: string, message: Partial<RoomMessage>) => {
    const channel = supabase.channel(`room_chat:${roomId}`);
    await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });
  };

  const fetchRoomById = async (roomId: string): Promise<Room | null> => {
    const { data, error } = await supabase
      .from('rooms')
      .select(`*, profiles:dj_id(username, photo_url), tracks:track_id(*, profiles:uploader_id(username, photo_url), track_likes(count))`)
      .eq('id', roomId)
      .maybeSingle();
    
    if (error || !data) return null;
    return {
        id: data.id, title: data.title, djId: data.dj_id,
        djName: data.profiles?.username || 'DJ',
        djAvatar: data.profiles?.photo_url || '',
        coverUrl: data.cover_url, startTime: data.created_at,
        status: data.status, listeners: data.listeners_count || 1, 
        isMicActive: !!data.is_mic_active, isPlaying: data.is_playing || false,
        currentProgress: data.current_progress || 0,
        currentTrack: data.tracks ? mapTracksData([data.tracks], [])[0] : undefined
    };
  };

  const toggleLike = async (trackId: string) => {
    if (!currentUser) return;
    const isLiked = tracks.find(t => t.id === trackId)?.isLikedByCurrentUser;
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, isLikedByCurrentUser: !isLiked, likes: t.likes + (isLiked ? -1 : 1) } : t));
    if (isLiked) {
      await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
    } else {
      await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
    }
  };

  const createPlaylist = async (title: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('playlists').insert({ user_id: currentUser.id, title }).select().single();
    if (!error && data) setMyPlaylists(prev => [{ id: data.id, userId: data.user_id, title: data.title, createdAt: data.created_at }, ...prev]);
  };

  const fetchUserPlaylists = useCallback(async (userId: number): Promise<Playlist[]> => {
    const { data, error } = await supabase.from('playlists').select('*').eq('user_id', userId);
    if (error) return [];
    return data.map(p => ({ id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at }));
  }, []);

  const fetchPlaylistTracks = useCallback(async (playlistId: string): Promise<Track[]> => {
    const { data, error } = await supabase.from('playlist_tracks').select('track_id, tracks(*, profiles:uploader_id(username, photo_url), track_likes(count))').eq('playlist_id', playlistId);
    if (error || !data) return [];
    return mapTracksData(data.map(d => d.tracks), []);
  }, [mapTracksData]);

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    await supabase.rpc('increment_play_count', { track_row_id: trackId });
    await supabase.from('user_history').upsert({ user_id: currentUser.id, track_id: trackId, played_at: new Date().toISOString() });
  };

  const generateTrackDescription = useCallback(async (title: string, genre: string): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a short musical description for track "${title}" in ${genre} genre. Max 150 chars.`,
      });
      return response.text || '';
    } catch { return ''; }
  }, []);

  const refreshUserContext = useCallback(async (userId: number) => {
    const [{ data: likesData }, plData] = await Promise.all([
      supabase.from('track_likes').select('track_id').eq('user_id', userId),
      fetchUserPlaylists(userId)
    ]);
    const userLikes = likesData?.map(l => l.track_id) || [];
    setTracks(prev => prev.map(trk => ({ ...trk, isLikedByCurrentUser: userLikes.includes(trk.id) })));
    if (plData) setMyPlaylists(plData);
  }, [fetchUserPlaylists]);

  useEffect(() => {
    if (isInitialLoadDone.current) return;
    isInitialLoadDone.current = true;
    const initApp = async () => {
        setIsLoading(true);
        const tg = (window as any).Telegram?.WebApp;
        const tgUserId = tg?.initDataUnsafe?.user?.id;
        await Promise.allSettled([fetchTracks(tgUserId), fetchRooms()]);
        if (tgUserId) {
            const user = await fetchUserById(tgUserId);
            if (user) { setCurrentUser(user); await refreshUserContext(user.id); }
        }
        setIsLoading(false);
    };
    initApp();
  }, [fetchTracks, fetchRooms, fetchUserById, refreshUserContext]);

  const value = useMemo(() => ({
    currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, setActiveRoom, setRoomMinimized, isLoading, language, setLanguage, t,
    uploadTrack: async () => {}, uploadAlbum: async () => {}, generateTrackDescription,
    createPlaylist, addToPlaylist: async () => {}, fetchUserPlaylists, fetchSavedPlaylists: async () => [], toggleSavePlaylist: async () => {}, fetchPlaylistTracks,
    deleteTrack: async () => {}, downloadTrack: async () => {}, toggleLike, addComment: async () => {}, recordListen, updateProfile: async () => {}, uploadImage,
    fetchUserById, getChartTracks: async () => [], getLikedTracks: async () => [], getUserHistory: async () => [], createRoom, deleteRoom, fetchRooms, fetchRoomById,
    sendRoomMessage, updateRoomState, donateToRoom: async () => true
  }), [currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, isLoading, language, t, fetchRooms, fetchUserById, generateTrackDescription, setActiveRoom, setRoomMinimized, toggleLike, recordListen, createRoom, deleteRoom, fetchRoomById, sendRoomMessage, updateRoomState, uploadImage, fetchPlaylistTracks, fetchUserPlaylists, createPlaylist]);

  return React.createElement(StoreContext.Provider, { value }, React.createElement(VisualProvider, null, children));
};
