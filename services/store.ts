import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Track, User, Comment, Playlist, Concert } from '../types';
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

interface StoreContextType {
  currentUser: User | null;
  tracks: Track[];
  myPlaylists: Playlist[]; 
  savedPlaylists: Playlist[];
  concerts: Concert[];
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
  donateToConcert: (concertId: string, amount: number) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};

// StoreProvider implementation using React.createElement for compatibility with .ts extension
export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
  const [savedPlaylists, setSavedPlaylists] = useState<Playlist[]>([]);
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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

  const calculateBadges = (stats: { uploads: number, likesReceived: number, totalPlays: number }, isVerified?: boolean) => {
      const badges: string[] = [];
      if (isVerified) badges.push('verified');
      if (stats.uploads > 0) badges.push('creator');
      if (stats.likesReceived > 10) badges.push('star');
      if (stats.totalPlays > 50) badges.push('meloman'); 
      return badges;
  };

  const getUserStats = useCallback(async (userId: number) => {
      const { data: userTracks, error } = await supabase
        .from('tracks')
        .select('id, plays')
        .eq('uploader_id', userId);

      if (error || !userTracks) return { uploads: 0, totalPlays: 0, likesReceived: 0 };

      const uploads = userTracks.length;
      const totalPlays = userTracks.reduce((sum, trk) => sum + (trk.plays || 0), 0);
      const trackIds = userTracks.map(trk => trk.id);

      let likesReceived = 0;
      if (trackIds.length > 0) {
        const { count } = await supabase
          .from('track_likes')
          .select('*', { count: 'exact', head: true })
          .in('track_id', trackIds);
        likesReceived = count || 0;
      }

      return { uploads, totalPlays, likesReceived };
  }, []);

  const mapTracksData = useCallback(async (rawTracks: any[], currentUserId?: number): Promise<Track[]> => {
      if (!rawTracks || rawTracks.length === 0) return [];

      let userLikes: string[] = [];
      if (currentUserId) {
        const { data: likesData } = await supabase
          .from('track_likes')
          .select('track_id')
          .eq('user_id', currentUserId);
        
        if (likesData) userLikes = likesData.map(l => l.track_id);
      }

      return Promise.all(rawTracks.map(async (trk: any) => {
         let comments: Comment[] = [];
         let likesCount = 0;

         try {
             const { data: commentsData } = await supabase
                .from('comments')
                .select('*')
                .eq('track_id', trk.id)
                .order('created_at', { ascending: false })
                .limit(3);
             if (commentsData) comments = commentsData;

             const { count } = await supabase
                .from('track_likes')
                .select('*', { count: 'exact', head: true })
                .eq('track_id', trk.id);
             if (count !== null) likesCount = count;
         } catch (innerErr) {
             console.warn(`Error fetching details for track ${trk.id}`, innerErr);
         }

         return {
          id: trk.id,
          uploaderId: trk.uploader_id,
          uploaderName: trk.profiles?.username || 'Unknown',
          uploaderAvatar: trk.profiles?.photo_url,
          title: trk.title,
          description: trk.description,
          genre: trk.genre,
          coverUrl: trk.cover_url,
          audioUrl: trk.audio_url,
          duration: trk.duration,
          createdAt: trk.created_at,
          plays: trk.plays || 0,
          likes: likesCount,
          comments: comments,
          isLikedByCurrentUser: userLikes.includes(trk.id),
          isVerifiedUploader: (trk.plays || 0) > 1000 
        };
      }));
  }, []);

  const fetchTracks = useCallback(async (userId?: number) => {
    try {
      const { data: tracksData, error } = await supabase
        .from('tracks')
        .select(`
          *,
          profiles:uploader_id (
            username,
            photo_url
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = await mapTracksData(tracksData || [], userId);
      setTracks(mapped);
    } catch (e: any) {
      console.error("Error fetching tracks:", e);
      setTracks([]); 
    }
  }, [mapTracksData]);

  const fetchConcerts = useCallback(async () => {
    const mockConcerts: Concert[] = [
        {
            id: '1',
            title: 'Midnight Phonk Session',
            artistId: 101,
            artistName: 'Kordhell',
            artistAvatar: 'https://i.pravatar.cc/150?u=kordhell',
            coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop',
            startTime: new Date().toISOString(),
            status: 'live',
            viewers: 1240,
            donationsGoal: 50000,
            currentDonations: 12500,
            streamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-concert-of-a-dj-playing-music-at-a-club-42588-large.mp4' 
        },
        {
            id: '2',
            title: 'Album Release Party',
            artistId: 102,
            artistName: 'Mori Chill',
            artistAvatar: 'https://i.pravatar.cc/150?u=mori',
            coverUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=800&auto=format&fit=crop',
            startTime: new Date(Date.now() + 86400000).toISOString(),
            status: 'upcoming',
            viewers: 0
        }
    ];
    setConcerts(mockConcerts);
  }, []);

  // Use Gemini API to generate track descriptions based on title and genre.
  const generateTrackDescription = useCallback(async (title: string, genre: string): Promise<string> => {
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
          const prompt = `Write a short, engaging, and professional musical description for a track titled "${title}" in the genre of "${genre}". Use the language: ${language === 'ru' ? 'Russian' : 'English'}. Make it cool for a social music platform. Max 200 characters.`;
          
          const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt,
          });
          return response.text || '';
      } catch (err) {
          console.error("AI Description Error:", err);
          return '';
      }
  }, [language]);

  const uploadImage = async (file: File, bucket: string, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return publicUrl;
  };

  const uploadTrack = async (data: UploadTrackData) => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      let audioUrl = data.existingAudioUrl || '';
      let coverUrl = data.existingCoverUrl || '';

      if (data.audioFile) {
        audioUrl = await uploadImage(data.audioFile, 'music', `tracks/${currentUser.id}/${Date.now()}_${data.audioFile.name}`);
      }
      if (data.coverFile) {
        coverUrl = await uploadImage(data.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_${data.coverFile.name}`);
      }

      await supabase.from('tracks').insert({
        uploader_id: currentUser.id,
        title: data.title,
        description: data.description,
        genre: data.genre,
        audio_url: audioUrl,
        cover_url: coverUrl,
        duration: data.duration
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
      if (commonData.coverFile) {
        coverUrl = await uploadImage(commonData.coverFile, 'music', `covers/${currentUser.id}/${Date.now()}_album`);
      }

      for (const file of files) {
        const audioUrl = await uploadImage(file, 'music', `tracks/${currentUser.id}/${Date.now()}_${file.name}`);
        await supabase.from('tracks').insert({
          uploader_id: currentUser.id,
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: commonData.description,
          genre: commonData.genre,
          audio_url: audioUrl,
          cover_url: coverUrl,
          duration: 180
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
      id: p.id,
      userId: p.user_id,
      title: p.title,
      coverUrl: p.cover_url,
      createdAt: p.created_at
    }));
    if (userId === currentUser?.id) setMyPlaylists(mapped);
    return mapped;
  };

  const fetchSavedPlaylists = async (userId: number): Promise<Playlist[]> => {
    const { data } = await supabase.from('saved_playlists').select('playlists(*)').eq('user_id', userId);
    const mapped = data?.map((d: any) => {
        const p = d.playlists;
        if (!p) return null;
        return {
            id: p.id,
            userId: p.user_id,
            title: p.title,
            coverUrl: p.cover_url,
            createdAt: p.created_at
        };
    }).filter(Boolean) as Playlist[] || [];
    if (userId === currentUser?.id) setSavedPlaylists(mapped);
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
    if (isSaved) {
        await supabase.from('saved_playlists').delete().eq('user_id', currentUser.id).eq('playlist_id', playlistId);
    } else {
        await supabase.from('saved_playlists').insert({ user_id: currentUser.id, playlist_id: playlistId });
    }
    await fetchSavedPlaylists(currentUser.id);
  };

  const fetchPlaylistTracks = async (playlistId: string): Promise<Track[]> => {
    const { data } = await supabase.from('playlist_items').select('tracks(*, profiles:uploader_id(username, photo_url))').eq('playlist_id', playlistId);
    const raw = data?.map((d: any) => d.tracks).filter(Boolean) || [];
    return mapTracksData(raw, currentUser?.id);
  };

  const deleteTrack = async (trackId: string) => {
    await supabase.from('tracks').delete().eq('id', trackId);
    setTracks(prev => prev.filter(trk => trk.id !== trackId));
  };

  const downloadTrack = async (track: Track) => {
    const a = document.createElement('a');
    a.href = track.audioUrl;
    a.download = `${track.title}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleLike = async (trackId: string) => {
    if (!currentUser) return;
    const currentTrack = tracks.find(trk => trk.id === trackId);
    if (!currentTrack) return;
    
    const isLiked = currentTrack.isLikedByCurrentUser;
    if (isLiked) {
        await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
    } else {
        await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
    }
    setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, isLikedByCurrentUser: !isLiked, likes: isLiked ? trk.likes - 1 : trk.likes + 1 } : trk));
  };

  const addComment = async (trackId: string, text: string) => {
    if (!currentUser) return;
    const { data, error } = await supabase.from('comments').insert({
        track_id: trackId,
        user_id: currentUser.id,
        text
    }).select().single();
    
    if (!error && data) {
        const newComment: Comment = {
            id: data.id,
            userId: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.photoUrl,
            text,
            createdAt: data.created_at
        };
        setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, comments: [newComment, ...(trk.comments || [])] } : trk));
    }
  };

  const recordListen = async (trackId: string) => {
    if (!currentUser) return;
    try {
        setTracks(prev => prev.map(trk => trk.id === trackId ? { ...trk, plays: (trk.plays || 0) + 1 } : trk));
        await supabase.from('listen_history').insert({ user_id: currentUser.id, track_id: trackId });
        
        const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
        if (trackData) {
            await supabase.from('tracks').update({ plays: (trackData.plays || 0) + 1 }).eq('id', trackId);
        }
    } catch (err) {
        console.error("Failed to record listen:", err);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;
    const { error } = await supabase.from('profiles').upsert({
        id: currentUser.id,
        username: currentUser.username,
        first_name: updates.firstName,
        last_name: updates.lastName,
        bio: updates.bio,
        links: updates.links,
        photo_url: updates.photoUrl,
        header_url: updates.headerUrl
    });
    if (!error) setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const fetchUserById = async (userId: number): Promise<User | null> => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!profile) return null;
    const stats = await getUserStats(userId);
    return {
        id: userId,
        username: profile.username,
        firstName: profile.first_name,
        lastName: profile.last_name,
        photoUrl: profile.photo_url,
        headerUrl: profile.header_url,
        bio: profile.bio,
        links: profile.links || {},
        stats,
        badges: calculateBadges(stats, profile.is_verified),
        isVerified: profile.is_verified
    };
  };

  const getChartTracks = async (_period: 'week' | 'month'): Promise<Track[]> => {
    const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').order('plays', { ascending: false }).limit(20);
    return mapTracksData(data || [], currentUser?.id);
  };

  const getLikedTracks = async (userId: number): Promise<Track[]> => {
    const { data: likes } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
    if (!likes || likes.length === 0) return [];
    const ids = likes.map(l => l.track_id);
    const { data: trks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
    return mapTracksData(trks || [], currentUser?.id);
  };

  const getUserHistory = async (userId: number): Promise<Track[]> => {
    const { data: hist } = await supabase.from('listen_history').select('track_id').eq('user_id', userId).order('played_at', { ascending: false }).limit(20);
    if (!hist || hist.length === 0) return [];
    const ids = [...new Set(hist.map(h => h.track_id))];
    const { data: trks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
    return mapTracksData(trks || [], currentUser?.id);
  };

  const donateToConcert = async (_concertId: string, _amount: number): Promise<boolean> => {
    return new Promise(resolve => setTimeout(() => resolve(true), 1200));
  };

  const isInitialized = useRef(false);
  useEffect(() => {
    if (isInitialized.current) return;
    const init = async () => {
        setIsLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) await supabase.auth.signInAnonymously().catch(() => {});
            
            // @ts-ignore
            const tg = window.Telegram?.WebApp;
            if (tg?.initDataUnsafe?.user) {
                const tgUserId = tg.initDataUnsafe.user.id;
                const user = await fetchUserById(tgUserId);
                if (user) {
                    setCurrentUser(user);
                    await fetchUserPlaylists(user.id);
                    await fetchSavedPlaylists(user.id);
                } else {
                    const newProfile = {
                        id: tgUserId,
                        username: tg.initDataUnsafe.user.username || `user_${tgUserId}`,
                        first_name: tg.initDataUnsafe.user.first_name || '',
                        last_name: tg.initDataUnsafe.user.last_name || '',
                        photo_url: tg.initDataUnsafe.user.photo_url || ''
                    };
                    await supabase.from('profiles').insert(newProfile);
                    const newlyCreated = await fetchUserById(tgUserId);
                    setCurrentUser(newlyCreated);
                }
                await fetchTracks(tgUserId);
            } else {
                await fetchTracks();
            }
            await fetchConcerts();
        } catch (e) { console.error("Init Error", e); }
        finally { setIsLoading(false); isInitialized.current = true; }
    };
    init();
  }, []);

  // Use React.createElement because this is a .ts file and JSX syntax is not supported.
  return React.createElement(StoreContext.Provider, {
    value: {
      currentUser, tracks, myPlaylists, savedPlaylists, concerts, isLoading, language, setLanguage, t,
      uploadTrack, uploadAlbum, generateTrackDescription, createPlaylist, addToPlaylist, fetchUserPlaylists, fetchSavedPlaylists, toggleSavePlaylist,
      fetchPlaylistTracks, deleteTrack, downloadTrack, toggleLike, addComment, recordListen, updateProfile, uploadImage,
      fetchUserById, getChartTracks, getLikedTracks, getUserHistory, donateToConcert
    }
  }, children);
};