
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment, Playlist, Concert } from '../types';
import { INITIAL_USER, TRANSLATIONS, Language, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from '../constants';
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

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [, setMyPlaylists] = useState<Playlist[]>([]);
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
      const totalPlays = userTracks.reduce((sum, t) => sum + t.plays, 0);
      const trackIds = userTracks.map(t => t.id);

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

      return Promise.all(rawTracks.map(async (t: any) => {
         let comments: Comment[] = [];
         let likesCount = 0;

         try {
             const { data: commentsData } = await supabase
                .from('comments')
                .select('*')
                .eq('track_id', t.id)
                .order('created_at', { ascending: false })
                .limit(3);
             if (commentsData) comments = commentsData;

             const { count } = await supabase
                .from('track_likes')
                .select('*', { count: 'exact', head: true })
                .eq('track_id', t.id);
             if (count !== null) likesCount = count;
         } catch (innerErr) {
             console.warn(`Error fetching details for track ${t.id}`, innerErr);
         }

         return {
          id: t.id,
          uploaderId: t.uploader_id,
          uploaderName: t.profiles?.username || 'Unknown',
          uploaderAvatar: t.profiles?.photo_url,
          title: t.title,
          description: t.description,
          genre: t.genre,
          coverUrl: t.cover_url,
          audioUrl: t.audio_url,
          duration: t.duration,
          createdAt: t.created_at,
          plays: t.plays,
          likes: likesCount,
          comments: comments,
          isLikedByCurrentUser: userLikes.includes(t.id),
          isVerifiedUploader: t.plays > 1000 
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

  const generateTrackDescription = useCallback(async (title: string, genre: string): Promise<string> => {
      try {
          const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || '' });
          const prompt = `Write a short, engaging, and professional musical description for a track titled "${title}" in the genre of "${genre}". Use the language: ${language === 'ru' ? 'Russian' : 'English'}. Make it cool for a social music platform. Max 200 characters.`;
          
          const response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt
          });
          
          return response.text || "";
      } catch (e) {
          console.error("AI Generation failed:", e);
          return "";
      }
  }, [language]);

  const donateToConcert = useCallback(async (concertId: string, amount: number): Promise<boolean> => {
      console.log(`Processing donation of ${amount} stars for concert ${concertId}`);
      return new Promise((resolve) => {
          setTimeout(() => {
              setConcerts(prev => prev.map(c => {
                  if (c.id === concertId) {
                      return { ...c, currentDonations: (c.currentDonations || 0) + amount };
                  }
                  return c;
              }));
              resolve(true);
          }, 1500);
      });
  }, []);

  const fetchUserPlaylists = useCallback(async (userId: number): Promise<Playlist[]> => {
      try {
          const { data } = await supabase.from('playlists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
          return (data as any[] || []).map((item) => ({
              id: item.id, userId: item.user_id, title: item.title, coverUrl: item.cover_url, createdAt: item.created_at, trackCount: 0 
          }));
      } catch (e) { return []; }
  }, []);

  const fetchSavedPlaylists = useCallback(async (userId: number): Promise<Playlist[]> => {
      try {
          const { data } = await supabase.from('saved_playlists').select('playlist_id, playlists:playlist_id(*)').eq('user_id', userId);
          return (data as any[] || []).map((item) => {
              const p = item.playlists;
              return p ? { id: p.id, userId: p.user_id, title: p.title, coverUrl: p.cover_url, createdAt: p.created_at, trackCount: 0 } : null;
          }).filter(Boolean) as Playlist[];
      } catch (e) { return []; }
  }, []);

  const fetchPlaylistTracks = useCallback(async (playlistId: string): Promise<Track[]> => {
      try {
          const { data } = await supabase.from('playlist_items').select(`added_at, tracks:track_id (*, profiles:uploader_id (username, photo_url))`).eq('playlist_id', playlistId).order('added_at', { ascending: false });
          const rawTracks = (data as any[] || []).map((item) => item.tracks).filter(Boolean);
          return await mapTracksData(rawTracks, currentUser?.id);
      } catch (e) { return []; }
  }, [currentUser, mapTracksData]);

  const createPlaylist = useCallback(async (title: string) => {
      if(!currentUser) return;
      await supabase.from('playlists').insert({ user_id: currentUser.id, title: title, cover_url: null });
      const updated = await fetchUserPlaylists(currentUser.id);
      setMyPlaylists(updated);
  }, [currentUser, fetchUserPlaylists]);

  const toggleSavePlaylist = useCallback(async (playlistId: string) => {
      if (!currentUser) return;
      const isAlreadySaved = savedPlaylists.some(p => p.id === playlistId);
      if (isAlreadySaved) {
          await supabase.from('saved_playlists').delete().eq('user_id', currentUser.id).eq('playlist_id', playlistId);
          setSavedPlaylists(prev => prev.filter(p => p.id !== playlistId));
      } else {
          await supabase.from('saved_playlists').insert({ user_id: currentUser.id, playlist_id: playlistId });
          const updated = await fetchSavedPlaylists(currentUser.id);
          setSavedPlaylists(updated);
      }
  }, [currentUser, savedPlaylists, fetchSavedPlaylists]);

  const addToPlaylist = useCallback(async (trackId: string, playlistId: string) => {
      if(!currentUser) return;
      await supabase.from('playlist_items').insert({ playlist_id: playlistId, track_id: trackId });
  }, [currentUser]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) await supabase.auth.signInAnonymously().catch(() => {});

        // @ts-ignore
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        let userId = 0;
        
        if (tgUser) {
          userId = tgUser.id;
          
          let { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          
          if (!profile) {
              const newProfile = {
                  id: userId,
                  username: tgUser.username || `user_${userId}`,
                  first_name: tgUser.first_name || '',
                  last_name: tgUser.last_name || '',
                  photo_url: tgUser.photo_url || '',
                  bio: '',
                  links: {}
              };
              
              const { error: insertError } = await supabase.from('profiles').insert(newProfile);
              if (!insertError) {
                  // @ts-ignore
                  profile = newProfile;
              } else {
                  console.error("Failed to create profile:", insertError);
              }
          }

          if (profile) {
            const stats = await getUserStats(profile.id);
            
            setCurrentUser({
              id: profile.id, 
              username: profile.username, 
              firstName: profile.first_name, 
              lastName: profile.last_name, 
              photoUrl: profile.photo_url, 
              headerUrl: profile.header_url, 
              bio: profile.bio, 
              links: profile.links || {}, 
              stats: stats, 
              badges: calculateBadges(stats, profile.isVerified)
            });
            setMyPlaylists(await fetchUserPlaylists(userId));
            setSavedPlaylists(await fetchSavedPlaylists(userId));
          } else {
             setCurrentUser({ ...INITIAL_USER, id: userId, username: tgUser.username || `user_${userId}`, firstName: tgUser.first_name, photoUrl: tgUser.photo_url });
          }
        }
        await fetchTracks(userId);
        await fetchConcerts();
        // @ts-ignore
        window.Telegram?.WebApp?.expand();
        // @ts-ignore
        window.Telegram?.WebApp?.ready();
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    initApp();
  }, [fetchTracks, fetchUserPlaylists, fetchSavedPlaylists, fetchConcerts, getUserStats]);

  const uploadImage = useCallback(async (file: File, bucket: string, path: string): Promise<string> => {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
  }, []);

  const _uploadFileToStorage = async (file: File, folder: string): Promise<string> => {
      const fileExt = file.name.split('.').pop() || 'bin';
      const randomId = Math.random().toString(36).substring(2, 9);
      const safeName = `${Date.now()}_${randomId}.${fileExt}`;
      const filePath = `${folder}/${safeName}`;
      const { error } = await supabase.storage.from('music').upload(filePath, file, { upsert: true });
      if (error) throw new Error(`Storage error`);
      const { data } = supabase.storage.from('music').getPublicUrl(filePath);
      return data.publicUrl;
  };
  
  const _insertTrackToDb = async (trackData: any) => { 
      const { error } = await supabase.from('tracks').insert(trackData); 
      if (error) {
          console.error("DB Insert Error:", error);
          throw error;
      }
  };

  const checkGroupMembership = useCallback(async (userId: number): Promise<boolean> => { 
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
          console.error("Telegram Bot Token or Chat ID is missing in constants.ts");
          return false;
      }

      console.log(`Checking membership for ${userId} in ${TELEGRAM_CHAT_ID}...`);

      try {
          const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${TELEGRAM_CHAT_ID}&user_id=${userId}&_=${Date.now()}`;
          const response = await fetch(url, { cache: 'no-store' }); 
          const data = await response.json();

          if (!data.ok) {
              console.error("Telegram API Error:", data.description);
              return false;
          }

          const status = data.result?.status;
          const validStatuses = ['creator', 'administrator', 'member'];
          if (validStatuses.includes(status)) return true;
          if (status === 'restricted' && data.result.is_member) return true;

          return false;
      } catch (e) {
          console.error("Membership check failed (Network/CORS):", e);
          return false; 
      }
  }, []);

  const uploadTrack = useCallback(async (data: UploadTrackData) => {
    if (!currentUser) return;
    
    const isMember = await checkGroupMembership(currentUser.id);
    if (!isMember) {
        alert(t('upload_sub_required'));
        return;
    }

    setIsLoading(true);
    try {
        const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).maybeSingle();
        if (!existingProfile) {
            await supabase.from('profiles').insert({
                id: currentUser.id,
                username: currentUser.username,
                first_name: currentUser.firstName,
                last_name: currentUser.lastName,
                photo_url: currentUser.photoUrl,
                bio: currentUser.bio || '',
                links: currentUser.links || {}
            });
        }

        let audioUrl = data.existingAudioUrl || '';
        if (data.audioFile && !audioUrl) audioUrl = await _uploadFileToStorage(data.audioFile, `audio/${currentUser.id}`);
        let coverUrl = data.existingCoverUrl || 'https://picsum.photos/400/400?random=default';
        if (data.coverFile && !data.existingCoverUrl) coverUrl = await _uploadFileToStorage(data.coverFile, `covers/${currentUser.id}`);
        
        await _insertTrackToDb({ 
            uploader_id: currentUser.id, 
            title: data.title, 
            description: data.description, 
            genre: data.genre, 
            audio_url: audioUrl, 
            cover_url: coverUrl, 
            duration: Math.round(data.duration) 
        });
        
        await fetchTracks(currentUser.id);
    } catch (e) {
        console.error("Upload failed", e);
        alert("Upload failed.");
    } finally { 
        setIsLoading(false); 
    }
  }, [currentUser, fetchTracks, checkGroupMembership, t]);

  const uploadAlbum = useCallback(async (files: File[], commonData: any) => {
    if (!currentUser) return;

    const isMember = await checkGroupMembership(currentUser.id);
    if (!isMember) {
        alert(t('upload_sub_required'));
        return;
    }

    setIsLoading(true);
    try {
        const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', currentUser.id).maybeSingle();
        if (!existingProfile) {
            await supabase.from('profiles').insert({
                id: currentUser.id,
                username: currentUser.username,
                first_name: currentUser.firstName,
                last_name: currentUser.lastName,
                photo_url: currentUser.photoUrl,
                bio: currentUser.bio || '',
                links: currentUser.links || {}
            });
        }

        let commonCoverUrl: string | undefined = undefined;
        if (commonData.coverFile) commonCoverUrl = await _uploadFileToStorage(commonData.coverFile, `covers/${currentUser.id}`);
        for (const file of files) {
            const audioUrl = await _uploadFileToStorage(file, `audio/${currentUser.id}`);
            await _insertTrackToDb({ 
                uploader_id: currentUser.id, 
                title: file.name.replace(/\.[^/.]+$/, ""), 
                description: commonData.description, 
                genre: commonData.genre, 
                audio_url: audioUrl, 
                cover_url: commonCoverUrl || 'https://picsum.photos/400/400', 
                duration: 180 
            });
        }
        await fetchTracks(currentUser.id);
    } catch (e) {
        console.error("Album upload failed", e);
        alert("Upload failed.");
    } finally { 
        setIsLoading(false); 
    }
  }, [currentUser, fetchTracks, checkGroupMembership, t]);

  const deleteTrack = useCallback(async (trackId: string) => {
    try {
        await Promise.all([ supabase.from('comments').delete().eq('track_id', trackId), supabase.from('track_likes').delete().eq('track_id', trackId), supabase.from('listen_history').delete().eq('track_id', trackId), supabase.from('playlist_items').delete().eq('track_id', trackId) ]);
        await supabase.from('tracks').delete().eq('id', trackId);
        setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (e) {}
  }, []);

  const downloadTrack = useCallback(async (track: Track) => { 
      const link = document.createElement('a');
      link.href = track.audioUrl;
      link.download = `${track.title}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }, []);

  const toggleLike = useCallback(async (trackId: string) => { 
      if (!currentUser) return;
      setTracks(prev => prev.map(t => {
          if (t.id === trackId) {
             return { ...t, likes: t.isLikedByCurrentUser ? t.likes - 1 : t.likes + 1, isLikedByCurrentUser: !t.isLikedByCurrentUser };
          }
          return t;
      }));
      const { data } = await supabase.from('track_likes').select('*').eq('user_id', currentUser.id).eq('track_id', trackId).maybeSingle();
      if (data) {
          await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
      } else {
          await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
      }
  }, [currentUser]);

  const addComment = useCallback(async (trackId: string, text: string) => { 
      if (!currentUser) return;
      const { data, error } = await supabase.from('comments').insert({
          track_id: trackId,
          user_id: currentUser.id,
          text: text
      }).select().single();
      
      if (!error && data) {
          const newComment: Comment = {
             id: data.id,
             userId: currentUser.id,
             username: currentUser.username,
             avatar: currentUser.photoUrl,
             text: text,
             createdAt: data.created_at
          };
          setTracks(prev => prev.map(t => t.id === trackId ? { ...t, comments: [newComment, ...(t.comments || [])] } : t));
      }
  }, [currentUser]);

  const recordListen = useCallback(async (trackId: string) => { 
      if (!currentUser) return;
      await supabase.from('listen_history').insert({ user_id: currentUser.id, track_id: trackId });
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, plays: t.plays + 1 } : t));
  }, [currentUser]);

  const updateProfile = useCallback(async (updates: Partial<User>) => { 
      if (!currentUser) return;
      const { error } = await supabase.from('profiles').update({
          first_name: updates.firstName,
          last_name: updates.lastName,
          bio: updates.bio,
          photo_url: updates.photoUrl,
          header_url: updates.headerUrl,
          links: updates.links
      }).eq('id', currentUser.id);

      if (!error) {
          setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
  }, [currentUser]);

  const fetchUserById = useCallback(async (userId: number): Promise<User | null> => { 
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) {
          const stats = await getUserStats(data.id);
          return {
              id: data.id,
              username: data.username,
              firstName: data.first_name,
              lastName: data.last_name,
              photoUrl: data.photo_url,
              headerUrl: data.header_url,
              bio: data.bio,
              links: data.links || {},
              stats: stats,
              badges: calculateBadges(stats, data.isVerified)
          };
      }
      return null; 
  }, [getUserStats]);

  const getChartTracks = useCallback(async (_period: 'week' | 'month'): Promise<Track[]> => { 
      const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').order('plays', { ascending: false }).limit(20);
      return mapTracksData(data || [], currentUser?.id);
  }, [currentUser, mapTracksData]);

  const getLikedTracks = useCallback(async (userId: number): Promise<Track[]> => {
      const { data } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
      if(!data) return [];
      const ids = data.map(i => i.track_id);
      const { data: tracks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
      return mapTracksData(tracks || [], currentUser?.id);
  }, [currentUser, mapTracksData]);

  const getUserHistory = useCallback(async (userId: number): Promise<Track[]> => {
      const { data } = await supabase.from('listen_history').select('track_id').eq('user_id', userId).order('played_at', {ascending:false}).limit(20);
      if(!data) return [];
      const ids = [...new Set(data.map(i => i.track_id))];
      const { data: tracks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
      return mapTracksData(tracks || [], currentUser?.id);
  }, [currentUser, mapTracksData]);

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        currentUser, tracks, myPlaylists: [], savedPlaylists, concerts, isLoading, language, setLanguage, t,
        uploadTrack, uploadAlbum, createPlaylist, addToPlaylist, fetchUserPlaylists, fetchSavedPlaylists, toggleSavePlaylist,
        fetchPlaylistTracks, deleteTrack, downloadTrack, toggleLike, addComment, recordListen, updateProfile, uploadImage,
        fetchUserById, getChartTracks, getLikedTracks, getUserHistory, donateToConcert, generateTrackDescription
      }
    },
    children
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
};
