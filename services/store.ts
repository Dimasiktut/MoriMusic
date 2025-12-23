
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  sendRoomMessage: (roomId: string, text: string) => Promise<void>;
  // Fix: Added missing donateToRoom to StoreContextType interface
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

  // Fix: Implemented generateTrackDescription using Gemini API
  const generateTrackDescription = async (title: string, genre: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a short, cool, and atmospheric description for a music track titled "${title}" in the ${genre} genre. Keep it under 150 characters. Use emojis.`,
        config: {
          temperature: 0.8,
        }
      });
      return response.text || '';
    } catch (error) {
      console.error("AI generation failed", error);
      return '';
    }
  };

  const mapTracksData = useCallback(async (rawTracks: any[], currentUserId?: number): Promise<Track[]> => {
      if (!rawTracks || rawTracks.length === 0) return [];
      let userLikes: string[] = [];
      if (currentUserId) {
        const { data: likesData } = await supabase.from('track_likes').select('track_id').eq('user_id', currentUserId);
        if (likesData) userLikes = likesData.map(l => l.track_id);
      }
      return Promise.all(rawTracks.map(async (trk: any) => {
         let comments: Comment[] = [];
         let likesCount = 0;
         try {
             const { data: commentsData } = await supabase.from('comments').select('*').eq('track_id', trk.id).order('created_at', { ascending: false }).limit(3);
             if (commentsData) comments = commentsData;
             const { count } = await supabase.from('track_likes').select('*', { count: 'exact', head: true }).eq('track_id', trk.id);
             if (count !== null) likesCount = count;
         } catch (e) {}
         return {
          id: trk.id, uploaderId: trk.uploader_id, uploaderName: trk.profiles?.username || 'Unknown',
          uploaderAvatar: trk.profiles?.photo_url, title: trk.title, description: trk.description,
          genre: trk.genre, coverUrl: trk.cover_url, audioUrl: trk.audio_url, duration: trk.duration,
          createdAt: trk.created_at, plays: trk.plays || 0, likes: likesCount, comments,
          isLikedByCurrentUser: userLikes.includes(trk.id), isVerifiedUploader: (trk.plays || 0) > 1000 
        };
      }));
  }, []);

  const fetchTracks = useCallback(async (userId?: number) => {
    const { data: tracksData } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').order('created_at', { ascending: false });
    const mapped = await mapTracksData(tracksData || [], userId);
    setTracks(mapped);
  }, [mapTracksData]);

  const fetchRooms = useCallback(async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('*, profiles:dj_id(username, photo_url), tracks(*)')
      .eq('status', 'live')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped: Room[] = data.map((r: any) => ({
        id: r.id,
        title: r.title,
        djId: r.dj_id,
        djName: r.profiles?.username || 'DJ',
        djAvatar: r.profiles?.photo_url || '',
        coverUrl: r.cover_url,
        startTime: r.created_at,
        status: r.status,
        listeners: Math.floor(Math.random() * 50), // Simulation
        currentTrack: r.tracks ? {
          id: r.tracks.id,
          title: r.tracks.title,
          audioUrl: r.tracks.audio_url,
          coverUrl: r.tracks.cover_url,
          uploaderName: r.profiles?.username || 'DJ',
          uploaderId: r.dj_id
        } as any : undefined
      }));
      setRooms(mapped);
    }
  }, []);

  const createRoom = async (data: CreateRoomData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let coverUrl = '';
      if (data.coverFile) {
        coverUrl = await uploadImage(data.coverFile, 'music', `room_covers/${currentUser.id}/${Date.now()}`);
      }
      
      const { error } = await supabase.from('rooms').insert({
        title: data.title,
        dj_id: currentUser.id,
        cover_url: coverUrl,
        track_id: data.trackId,
        status: 'live'
      });

      if (!error) await fetchRooms();
    } finally {
      setIsLoading(false);
    }
  };

  const deleteRoom = async (roomId: string) => {
    await supabase.from('rooms').delete().eq('id', roomId);
    await fetchRooms();
  };

  const sendRoomMessage = async (roomId: string, text: string) => {
    console.log(`Sending to ${roomId}: ${text}`);
  };

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data!.path);
    return publicUrl;
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    await supabase.from('profiles').upsert({ id: currentUser.id, ...updates });
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const fetchUserById = async (userId: number): Promise<User | null> => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) return null;
    return {
        id: userId, username: profile.username, firstName: profile.first_name, lastName: profile.last_name,
        photoUrl: profile.photo_url, headerUrl: profile.header_url, bio: profile.bio, links: profile.links || {},
        stats: { uploads: 0, likesReceived: 0, totalPlays: 0 }, isVerified: profile.is_verified
    };
  };

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
    if (trackData) {
        await supabase.from('tracks').update({ plays: (trackData.plays || 0) + 1 }).eq('id', trackId);
    }
  };

  useEffect(() => {
    const init = async () => {
        setIsLoading(true);
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            const user = await fetchUserById(tg.initDataUnsafe.user.id);
            if (user) setCurrentUser(user);
        }
        await fetchTracks();
        await fetchRooms();
        setIsLoading(false);
    };
    init();
  }, [fetchTracks, fetchRooms]);

  return React.createElement(StoreContext.Provider, {
    value: {
      currentUser, tracks, myPlaylists, savedPlaylists, rooms, isLoading, audioIntensity, setAudioIntensity, language, setLanguage, t,
      uploadTrack: async () => {}, uploadAlbum: async () => {}, generateTrackDescription,
      createPlaylist: async () => {}, addToPlaylist: async () => {}, fetchUserPlaylists: async () => [],
      fetchSavedPlaylists: async () => [], toggleSavePlaylist: async () => {}, fetchPlaylistTracks: async () => [],
      deleteTrack: async () => {}, downloadTrack: async () => {}, toggleLike: async () => {}, addComment: async () => {},
      recordListen, updateProfile, uploadImage, fetchUserById,
      getChartTracks: async () => [], getLikedTracks: async () => [], getUserHistory: async () => [],
      createRoom, deleteRoom, fetchRooms, sendRoomMessage, donateToRoom: async () => true
    }
  }, children);
};
