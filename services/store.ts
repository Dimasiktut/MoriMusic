
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Track, User, Playlist, Room, RoomMessage } from '../types';
import { TRANSLATIONS, Language } from '../constants';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";

interface UploadTrackData {
  title: string;
  description: string;
  lyrics?: string; // Added lyrics
  genre: string;
  audioFile?: File; 
  existingAudioUrl?: string; 
  coverFile: File | null;
  existingCoverUrl?: string; 
  duration: number;
}

interface StoreContextType {
  currentUser: User | null;
  tracks: Track[];
  rooms: Room[]; // Added rooms
  myPlaylists: Playlist[]; 
  savedPlaylists: Playlist[];
  isLoading: boolean;
  language: Language;
  activeRoom: Room | null; // Added activeRoom
  setActiveRoom: (room: Room | null) => void; // Added setActiveRoom
  setRoomMinimized: (v: boolean) => void; // Added setRoomMinimized
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
  uploadTrack: (data: UploadTrackData) => Promise<void>;
  uploadAlbum: (files: File[], commonData: { title: string, description: string, genre: string, coverFile: File | null }) => Promise<void>;
  generateTrackDescription: (title: string, genre: string) => Promise<string>;
  createPlaylist: (title: string) => Promise<void>;
  addToPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  toggleSavePlaylist: (playlistId: string) => Promise<void>;
  fetchUserPlaylists: (userId: number) => Promise<Playlist[]>;
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
  // Missing Room methods
  createRoom: (data: { title: string, coverFile: File | null, trackId?: string }) => Promise<void>;
  deleteRoom: (id: string) => Promise<void>;
  sendRoomMessage: (roomId: string, message: RoomMessage) => Promise<void>;
  updateRoomState: (roomId: string, updates: Partial<Room>) => Promise<void>;
  fetchRoomById: (id: string) => Promise<Room | null>;
  // Missing AI Search
  aiMoodSearch: (prompt: string) => Promise<Track[]>;
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [isRoomMinimized, setRoomMinimized] = useState(false);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
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
              lyrics: trk.lyrics, // Map lyrics
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
        .limit(100);
      
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
    // Mock room fetch as rooms might be ephemeral in supabase real-time
    // In a real app, you'd fetch from a 'rooms' table
    return [];
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

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadTrack = async (data: UploadTrackData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let audioUrl = data.existingAudioUrl || '';
      if (data.audioFile) {
          const path = `tracks/${currentUser.id}/${Date.now()}_${data.audioFile.name}`;
          const { error: uploadError } = await supabase.storage.from('music').upload(path, data.audioFile);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('music').getPublicUrl(path);
          audioUrl = urlData.publicUrl;
      }

      let coverUrl = data.existingCoverUrl || '';
      if (data.coverFile) {
          const path = `covers/${currentUser.id}/${Date.now()}_${data.coverFile.name}`;
          coverUrl = await uploadImage(data.coverFile, 'music', path);
      }

      const { error } = await supabase.from('tracks').insert({
          uploader_id: currentUser.id,
          title: data.title,
          description: data.description,
          lyrics: data.lyrics, // Save lyrics
          genre: data.genre,
          audio_url: audioUrl,
          cover_url: coverUrl,
          duration: data.duration,
          plays: 0
      });
      if (error) throw error;
      await fetchTracks(currentUser.id);
    } catch (e) {
        console.error("Upload error", e);
    } finally {
        setIsLoading(false);
    }
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

  const toggleSavePlaylist = async (playlistId: string) => {
    if (!currentUser) return;
    const isSaved = savedPlaylists.some(p => p.id === playlistId);
    if (isSaved) {
      await supabase.from('saved_playlists').delete().eq('user_id', currentUser.id).eq('playlist_id', playlistId);
      setSavedPlaylists(prev => prev.filter(p => p.id !== playlistId));
    } else {
      await supabase.from('saved_playlists').insert({ user_id: currentUser.id, playlist_id: playlistId });
      const { data } = await supabase.from('playlists').select('*').eq('id', playlistId).single();
      if (data) setSavedPlaylists(prev => [...prev, { id: data.id, userId: data.user_id, title: data.title, coverUrl: data.cover_url, createdAt: data.created_at }]);
    }
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

  // Added AI Mood Search implementation
  const aiMoodSearch = useCallback(async (prompt: string): Promise<Track[]> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Pass limited track metadata to AI to pick relevant ones
      const trackMeta = tracks.map(t => ({ id: t.id, title: t.title, genre: t.genre, desc: t.description })).slice(0, 50);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Given this track list: ${JSON.stringify(trackMeta)}. 
        Pick tracks that best match this vibe: "${prompt}". 
        Return ONLY a JSON array of matching track IDs.`,
        config: { responseMimeType: "application/json" }
      });
      
      const matchedIds: string[] = JSON.parse(response.text || '[]');
      return tracks.filter(t => matchedIds.includes(t.id));
    } catch { return []; }
  }, [tracks]);

  // Mock implementation for Rooms (usually handled via real-time DB)
  const createRoom = async (data: { title: string, coverFile: File | null, trackId?: string }) => {
    if (!currentUser) return;
    const newRoom: Room = {
      id: Date.now().toString(),
      djId: currentUser.id,
      djName: currentUser.username,
      djAvatar: currentUser.photoUrl,
      title: data.title,
      listeners: 1,
      isPlaying: !!data.trackId,
      currentTrack: data.trackId ? tracks.find(t => t.id === data.trackId) : undefined
    };
    setRooms(prev => [newRoom, ...prev]);
    setActiveRoom(newRoom);
  };

  const deleteRoom = async (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
    if (activeRoom?.id === id) setActiveRoom(null);
  };

  const sendRoomMessage = async (roomId: string, message: RoomMessage) => {
    // Usually handled via broadcast
  };

  const updateRoomState = async (roomId: string, updates: Partial<Room>) => {
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, ...updates } : r));
    if (activeRoom?.id === roomId) setActiveRoom({ ...activeRoom, ...updates });
  };

  const fetchRoomById = async (id: string) => rooms.find(r => r.id === id) || null;

  const refreshUserContext = useCallback(async (userId: number) => {
    const [{ data: likesData }, plData] = await Promise.all([
      supabase.from('track_likes').select('track_id').eq('user_id', userId),
      fetchUserPlaylists(userId)
    ]);
    const userLikes = likesData?.map(l => l.track_id) || [];
    setTracks(prev => prev.map(trk => ({ ...trk, isLikedByCurrentUser: userLikes.includes(trk.id) })));
    if (plData) setMyPlaylists(plData);
  }, [fetchUserPlaylists]);

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const { error } = await supabase.from('profiles').update({
        first_name: updates.firstName,
        last_name: updates.lastName,
        bio: updates.bio,
        photo_url: updates.photoUrl,
        header_url: updates.headerUrl,
        links: updates.links
    }).eq('id', currentUser.id);
    if (error) throw error;
    const refreshed = await fetchUserById(currentUser.id);
    if (refreshed) setCurrentUser(refreshed);
  };

  const downloadTrack = async (track: Track) => {
    try {
        const response = await fetch(track.audioUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${track.uploaderName} - ${track.title}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Download failed", e);
    }
  };

  useEffect(() => {
    if (isInitialLoadDone.current) return;
    isInitialLoadDone.current = true;
    const initApp = async () => {
        setIsLoading(true);
        const tg = (window as any).Telegram?.WebApp;
        const tgUserId = tg?.initDataUnsafe?.user?.id;
        await fetchTracks(tgUserId);
        await fetchRooms();
        if (tgUserId) {
            const user = await fetchUserById(tgUserId);
            if (user) { setCurrentUser(user); await refreshUserContext(user.id); }
        }
        setIsLoading(false);
    };
    initApp();
  }, [fetchTracks, fetchRooms, fetchUserById, refreshUserContext]);

  const value = useMemo(() => ({
    currentUser, tracks, rooms, myPlaylists, savedPlaylists, isLoading, language, setLanguage, t,
    activeRoom, setActiveRoom, setRoomMinimized,
    uploadTrack, uploadAlbum: async () => {}, generateTrackDescription,
    createPlaylist, addToPlaylist: async () => {}, toggleSavePlaylist, fetchUserPlaylists, fetchPlaylistTracks,
    deleteTrack: async () => {}, downloadTrack, toggleLike, addComment: async () => {}, recordListen, updateProfile, uploadImage,
    fetchUserById, getChartTracks: async () => [], getLikedTracks: async () => [], getUserHistory: async () => [],
    createRoom, deleteRoom, sendRoomMessage, updateRoomState, fetchRoomById, aiMoodSearch
  }), [currentUser, tracks, rooms, myPlaylists, savedPlaylists, isLoading, language, t, activeRoom, setActiveRoom, setRoomMinimized, fetchUserById, generateTrackDescription, toggleLike, recordListen, uploadImage, fetchPlaylistTracks, fetchUserPlaylists, createPlaylist, toggleSavePlaylist, uploadTrack, updateProfile, downloadTrack, createRoom, deleteRoom, sendRoomMessage, updateRoomState, fetchRoomById, aiMoodSearch]);

  return React.createElement(StoreContext.Provider, { value }, React.createElement(VisualProvider, null, children));
};
