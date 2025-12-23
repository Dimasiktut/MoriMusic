
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  audioIntensity: number;
  setAudioIntensity: (v: number) => void;
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

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
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
  const [audioIntensity, setAudioIntensity] = useState(0);
  
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

  const generateTrackDescription = async (title: string, genre: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a short, cool, and atmospheric description for a music track titled "${title}" in the ${genre} genre. Keep it under 150 characters. Use emojis.`,
        config: { temperature: 0.8 }
      });
      return response.text || '';
    } catch (error) {
      return '';
    }
  };

  const mapTracksData = useCallback(async (rawTracks: any[], currentUserId?: number): Promise<Track[]> => {
      if (!rawTracks || rawTracks.length === 0) return [];
      
      let userLikes: string[] = [];
      if (currentUserId) {
        try {
          const { data: likesData } = await supabase.from('track_likes').select('track_id').eq('user_id', currentUserId);
          if (likesData) userLikes = likesData.map(l => l.track_id);
        } catch (e) {}
      }

      return rawTracks.map((trk: any) => ({
          id: trk.id, uploaderId: trk.uploader_id, uploaderName: trk.profiles?.username || 'Unknown',
          uploaderAvatar: trk.profiles?.photo_url, title: trk.title, description: trk.description,
          genre: trk.genre, coverUrl: trk.cover_url, audioUrl: trk.audio_url, duration: trk.duration,
          createdAt: trk.created_at, plays: trk.plays || 0, likes: trk.likes_count || 0, 
          comments: [], 
          isLikedByCurrentUser: userLikes.includes(trk.id), isVerifiedUploader: (trk.plays || 0) > 1000 
      }));
  }, []);

  const fetchTracks = useCallback(async (userId?: number) => {
    try {
      const { data: tracksData, error } = await supabase
        .from('tracks')
        .select('*, profiles:uploader_id(username, photo_url)')
        .order('created_at', { ascending: false })
        .limit(40); // Limit initial load for mobile performance
      
      if (error) throw error;
      const mapped = await mapTracksData(tracksData || [], userId);
      setTracks(mapped);
    } catch (e) {
      console.error("Fetch tracks error:", e);
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
          status: r.status, listeners: Math.floor(Math.random() * 50) + 1, 
          isMicActive: r.is_mic_active || false
        }));
        setRooms(mapped);
      }
    } catch (e) {}
  }, []);

  // Update tracks with likes info once user is logged in
  const refreshUserContext = useCallback(async (userId: number) => {
    try {
      const { data: likesData } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
      const userLikes = likesData?.map(l => l.track_id) || [];
      
      setTracks(prev => prev.map(trk => ({
        ...trk,
        isLikedByCurrentUser: userLikes.includes(trk.id)
      })));

      // Fetch playlists in background
      fetchUserPlaylists(userId);
      fetchSavedPlaylists(userId);
    } catch (e) {}
  }, []);

  const createRoom = async (data: CreateRoomData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let coverUrl = '';
      if (data.coverFile) {
        coverUrl = await uploadImage(data.coverFile, 'music', `room_covers/${currentUser.id}/${Date.now()}`);
      }
      const { data: inserted, error } = await supabase.from('rooms').insert({
        title: data.title, dj_id: currentUser.id, cover_url: coverUrl, status: 'live', track_id: data.trackId
      }).select('*, profiles:dj_id(username, photo_url)').single();

      if (!error && inserted) {
          await fetchRooms();
          setActiveRoom({
              id: inserted.id, title: inserted.title, djId: inserted.dj_id,
              djName: inserted.profiles?.username || 'DJ',
              djAvatar: inserted.profiles?.photo_url || '',
              coverUrl: inserted.cover_url, startTime: inserted.created_at,
              status: inserted.status, listeners: 1, isMicActive: false
          });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateRoomState = async (roomId: string, updates: Partial<Room>) => {
      const dbPayload: any = {};
      if (updates.isMicActive !== undefined) dbPayload.is_mic_active = updates.isMicActive;
      if (updates.currentTrack !== undefined) dbPayload.track_id = updates.currentTrack?.id;
      await supabase.from('rooms').update(dbPayload).eq('id', roomId);
      if (activeRoom?.id === roomId) setActiveRoom({ ...activeRoom, ...updates });
  };

  const deleteRoom = async (roomId: string) => {
    await supabase.from('rooms').delete().eq('id', roomId);
    if (activeRoom?.id === roomId) setActiveRoom(null);
    await fetchRooms();
  };

  const sendRoomMessage = async (roomId: string, message: Partial<RoomMessage>) => {
    const channel = supabase.channel(`room:${roomId}`);
    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.send({ type: 'broadcast', event: 'message', payload: message });
      }
    });
  };

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data!.path);
    return publicUrl;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    await supabase.from('profiles').upsert({ id: currentUser.id, ...updates });
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const fetchUserById = async (userId: number): Promise<User | null> => {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!profile) return null;
      return {
          id: userId, username: profile.username, firstName: profile.first_name, lastName: profile.last_name,
          photoUrl: profile.photo_url, headerUrl: profile.header_url, bio: profile.bio, links: profile.links || {},
          stats: { uploads: 0, likesReceived: 0, totalPlays: 0 }, isVerified: profile.is_verified
      };
    } catch (e) { return null; }
  };

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
    if (trackData) await supabase.from('tracks').update({ plays: (trackData.plays || 0) + 1 }).eq('id', trackId);
  };

  const uploadTrack = async (data: UploadTrackData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let audioUrl = data.existingAudioUrl || '';
      let coverUrl = data.existingCoverUrl || '';
      if (data.audioFile) audioUrl = await uploadImage(data.audioFile, 'music', `tracks/${currentUser.id}/${Date.now()}_${data.audioFile.name}`);
      if (data.coverFile) coverUrl = await uploadImage(data.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_${data.coverFile.name}`);
      await supabase.from('tracks').insert({
        uploader_id: currentUser.id, title: data.title, description: data.description,
        genre: data.genre, audio_url: audioUrl, cover_url: coverUrl, duration: data.duration
      });
      await fetchTracks(currentUser.id);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadAlbum = async (files: File[], commonData: { title: string, description: string, genre: string, coverFile: File | null }) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let coverUrl = '';
      if (commonData.coverFile) coverUrl = await uploadImage(commonData.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_album`);
      for (const file of files) {
        const audioUrl = await uploadImage(file, 'music', `tracks/${currentUser.id}/${Date.now()}_${file.name}`);
        await supabase.from('tracks').insert({
          uploader_id: currentUser.id, title: file.name.replace(/\.[^/.]+$/, ""),
          description: commonData.description, genre: commonData.genre,
          audio_url: audioUrl, cover_url: coverUrl, duration: 180
        });
      }
      await fetchTracks(currentUser.id);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPlaylists = async (userId: number): Promise<Playlist[]> => {
    const { data } = await supabase.from('playlists').select('*').eq('user_id', userId);
    const mapped = (data || []).map((p: any) => ({
      id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at
    }));
    if (userId === currentUser?.id || !currentUser) setMyPlaylists(mapped);
    return mapped;
  };

  const fetchSavedPlaylists = async (userId: number): Promise<Playlist[]> => {
    const { data } = await supabase.from('saved_playlists').select('playlists(*)').eq('user_id', userId);
    const mapped = data?.map((d: any) => d.playlists).filter(Boolean).map((p: any) => ({
      id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at
    })) || [];
    if (userId === currentUser?.id || !currentUser) setSavedPlaylists(mapped);
    return mapped;
  };

  const createPlaylist = async (title: string) => {
    if (!currentUser) return;
    await supabase.from('playlists').insert({ user_id: currentUser.id, title });
    await fetchUserPlaylists(currentUser.id);
  };

  const addToPlaylist = async (trackId: string, playlistId: string) => {
    await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: trackId });
  };

  const toggleSavePlaylist = async (playlistId: string) => {
    if (!currentUser) return;
    const isSaved = savedPlaylists.some(p => p.id === playlistId);
    if (isSaved) await supabase.from('saved_playlists').delete().eq('user_id', currentUser.id).eq('playlist_id', playlistId);
    else await supabase.from('saved_playlists').insert({ user_id: currentUser.id, playlist_id: playlistId });
    await fetchSavedPlaylists(currentUser.id);
  };

  const fetchPlaylistTracks = async (playlistId: string): Promise<Track[]> => {
    const { data } = await supabase.from('playlist_items').select('tracks(*, profiles:uploader_id(username, photo_url))').eq('playlist_id', playlistId);
    return mapTracksData(data?.map((d: any) => d.tracks).filter(Boolean) || [], currentUser?.id);
  };

  const deleteTrack = async (trackId: string) => {
    await supabase.from('tracks').delete().eq('id', trackId);
    setTracks(prev => prev.filter(trk => trk.id !== trackId));
  };

  const downloadTrack = async (track: Track) => {
    const a = document.createElement('a');
    a.href = track.audioUrl;
    a.download = `${track.title}.mp3`;
    a.click();
  };

  const toggleLike = async (trackId: string) => {
    if (!currentUser) return;
    const currentTrack = tracks.find(trk => trk.id === trackId);
    if (!currentTrack) return;
    const isLiked = currentTrack.isLikedByCurrentUser;
    if (isLiked) await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
    else await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
    setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, isLikedByCurrentUser: !isLiked, likes: isLiked ? trk.likes - 1 : trk.likes + 1 } : trk));
  };

  const addComment = async (trackId: string, text: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('comments').insert({ track_id: trackId, user_id: currentUser.id, text }).select().single();
    if (!error && data) {
        const newComment: Comment = { id: data.id, userId: currentUser.id, username: currentUser.username, avatar: currentUser.photoUrl, text, createdAt: data.created_at };
        setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, comments: [newComment, ...(trk.comments || [])] } : trk));
    }
  };

  const getChartTracks = async (_period: 'week' | 'month'): Promise<Track[]> => {
    const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').order('plays', { ascending: false }).limit(20);
    return mapTracksData(data || [], currentUser?.id);
  };

  const getLikedTracks = async (userId: number): Promise<Track[]> => {
    const { data: likes } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
    if (!likes || likes.length === 0) return [];
    const { data: trks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', likes.map(l => l.track_id));
    return mapTracksData(trks || [], currentUser?.id);
  };

  const getUserHistory = async (userId: number): Promise<Track[]> => {
    const { data: hist } = await supabase.from('listen_history').select('track_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(20);
    if (!hist || hist.length === 0) return [];
    const { data: trks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', [...new Set(hist.map(h => h.track_id))]);
    return mapTracksData(trks || [], currentUser?.id);
  };

  useEffect(() => {
    let isMounted = true;
    
    const initApp = async () => {
        // Start essential data fetching immediately
        const tracksPromise = fetchTracks();
        const roomsPromise = fetchRooms();
        
        // Wait for basic content to be ready
        await Promise.allSettled([tracksPromise, roomsPromise]);
        if (isMounted) setIsLoading(false);

        // BACKGROUND: Handle Telegram and User Auth
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            const tgUser = tg.initDataUnsafe.user;
            let user = await fetchUserById(tgUser.id);
            
            if (!user) {
                try {
                    await supabase.from('profiles').insert({
                        id: tgUser.id, username: tgUser.username || `user_${tgUser.id}`,
                        first_name: tgUser.first_name, last_name: tgUser.last_name, photo_url: tgUser.photo_url || ''
                    });
                    user = await fetchUserById(tgUser.id);
                } catch(e) {}
            }

            if (user && isMounted) {
                setCurrentUser(user);
                refreshUserContext(user.id);
            }
        }
    };

    initApp();
    return () => { isMounted = false; };
  }, [fetchTracks, fetchRooms, refreshUserContext]);

  return React.createElement(StoreContext.Provider, {
    value: {
      currentUser, tracks, myPlaylists, savedPlaylists, rooms, activeRoom, isRoomMinimized, setActiveRoom, setRoomMinimized, isLoading, audioIntensity, setAudioIntensity, language, setLanguage, t,
      uploadTrack, uploadAlbum, generateTrackDescription,
      createPlaylist, addToPlaylist, fetchUserPlaylists, fetchSavedPlaylists, toggleSavePlaylist, fetchPlaylistTracks,
      deleteTrack, downloadTrack, toggleLike, addComment,
      recordListen, updateProfile, uploadImage, fetchUserById,
      getChartTracks, getLikedTracks, getUserHistory,
      createRoom, deleteRoom, fetchRooms, sendRoomMessage, updateRoomState, donateToRoom: async () => true
    }
  }, children);
};
