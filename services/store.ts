
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
  // Removed setSavedPlaylists to fix TS6133
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

  const fetchUserPlaylists = useCallback(async (userId: number): Promise<Playlist[]> => {
    const { data, error } = await supabase.from('playlists').select('*').eq('user_id', userId);
    if (error) return [];
    return data.map(p => ({
      id: p.id,
      userId: p.user_id,
      title: p.title,
      coverUrl: p.cover_url,
      createdAt: p.created_at
    }));
  }, []);

  const toggleLike = async (trackId: string) => {
    if (!currentUser) return;
    const isLiked = tracks.find(t => t.id === trackId)?.isLikedByCurrentUser;
    
    // Optimistic Update
    setTracks(prev => prev.map(t => 
      t.id === trackId 
        ? { ...t, isLikedByCurrentUser: !isLiked, likes: t.likes + (isLiked ? -1 : 1) } 
        : t
    ));

    if (isLiked) {
      await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
    } else {
      await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
    }
  };

  const createPlaylist = async (title: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('playlists').insert({
      user_id: currentUser.id,
      title: title
    }).select().single();
    if (!error && data) {
      const newP: Playlist = { id: data.id, userId: data.user_id, title: data.title, createdAt: data.created_at };
      setMyPlaylists(prev => [newP, ...prev]);
    }
  };

  const addToPlaylist = async (trackId: string, playlistId: string) => {
    await supabase.from('playlist_tracks').upsert({
      playlist_id: playlistId,
      track_id: trackId
    });
  };

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    // Increment track play count
    await supabase.rpc('increment_play_count', { track_row_id: trackId });
    // Add to user history
    await supabase.from('user_history').upsert({
      user_id: currentUser.id,
      track_id: trackId,
      played_at: new Date().toISOString()
    });
  };

  const getUserHistory = useCallback(async (userId: number): Promise<Track[]> => {
    const { data, error } = await supabase
      .from('user_history')
      .select('*, tracks(*, profiles:uploader_id(username, photo_url), track_likes(count))')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .limit(20);
    
    if (error || !data) return [];
    const trackData = data.map(d => d.tracks).filter(Boolean);
    
    let userLikes: string[] = [];
    const { data: likes } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
    if (likes) userLikes = likes.map(l => l.track_id);
    
    return mapTracksData(trackData, userLikes);
  }, [mapTracksData]);

  const getLikedTracks = useCallback(async (userId: number): Promise<Track[]> => {
    const { data, error } = await supabase
      .from('track_likes')
      .select('track_id, tracks(*, profiles:uploader_id(username, photo_url), track_likes(count))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error || !data) return [];
    const trackData = data.map(d => d.tracks).filter(Boolean);
    return mapTracksData(trackData, [ ...trackData.map((t:any) => t.id) ]);
  }, [mapTracksData]);

  const refreshUserContext = useCallback(async (userId: number) => {
    try {
      // Corrected destructuring for plData which is a direct Playlist[] array
      const [{ data: likesData }, plData] = await Promise.all([
        supabase.from('track_likes').select('track_id').eq('user_id', userId),
        fetchUserPlaylists(userId)
      ]);
      const userLikes = likesData?.map(l => l.track_id) || [];
      setTracks(prev => prev.map(trk => ({ ...trk, isLikedByCurrentUser: userLikes.includes(trk.id) })));
      if (plData) setMyPlaylists(plData);
    } catch (e) {
      console.error("Refresh context error", e);
    }
  }, [fetchUserPlaylists]);

  const generateTrackDescription = useCallback(async (title: string, genre: string): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a short, cool, and engaging musical description for a track titled "${title}" in the ${genre} genre. Maximum 150 characters. No hashtags.`,
      });
      return response.text || '';
    } catch (error) {
      console.error("AI Generation error:", error);
      return '';
    }
  }, []);

  useEffect(() => {
    if (isInitialLoadDone.current) return;
    isInitialLoadDone.current = true;
    
    const safetyTimer = setTimeout(() => setIsLoading(false), 8000);

    const initApp = async () => {
        try {
            const tg = (window as any).Telegram?.WebApp;
            const tgUserId = tg?.initDataUnsafe?.user?.id;
            
            await Promise.allSettled([fetchTracks(tgUserId), fetchRooms()]);
            
            if (tgUserId) {
                const user = await fetchUserById(tgUserId);
                if (user) { 
                    setCurrentUser(user); 
                    await refreshUserContext(user.id); 
                } else {
                    const tgUser = tg.initDataUnsafe.user;
                    await supabase.from('profiles').upsert({ 
                        id: tgUser.id, 
                        username: tgUser.username || `user_${tgUser.id}`, 
                        first_name: tgUser.first_name || '', 
                        last_name: tgUser.last_name || '', 
                        photo_url: tgUser.photo_url || '' 
                    });
                    const newUser = await fetchUserById(tgUser.id);
                    if (newUser) { 
                        setCurrentUser(newUser); 
                        await refreshUserContext(newUser.id); 
                    }
                }
            }
        } catch (error) {
            console.error("Initialization error", error);
        } finally {
            clearTimeout(safetyTimer);
            setIsLoading(false);
        }
    };
    initApp();
  }, [fetchTracks, fetchRooms, fetchUserById, refreshUserContext]);

  const value = useMemo(() => ({
    currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, setActiveRoom, setRoomMinimized, isLoading, language, setLanguage, t,
    uploadTrack: async () => {}, uploadAlbum: async () => {}, generateTrackDescription,
    createPlaylist, addToPlaylist, fetchUserPlaylists, fetchSavedPlaylists: async () => [], toggleSavePlaylist: async () => {}, fetchPlaylistTracks: async () => [],
    deleteTrack: async () => {}, downloadTrack: async () => {}, toggleLike, addComment: async () => {}, recordListen, updateProfile: async () => {}, uploadImage: async () => '',
    fetchUserById, getChartTracks: async () => [], getLikedTracks, getUserHistory, createRoom: async () => {}, deleteRoom: async () => {}, fetchRooms, fetchRoomById: async () => null,
    sendRoomMessage: async () => {}, updateRoomState: async () => {}, donateToRoom: async () => true
  }), [currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, isLoading, language, t, fetchRooms, fetchUserById, generateTrackDescription, setActiveRoom, setRoomMinimized, toggleLike, recordListen, getLikedTracks, getUserHistory, fetchUserPlaylists]);

  return React.createElement(
    StoreContext.Provider,
    { value: value },
    React.createElement(VisualProvider, null, children)
  );
};
