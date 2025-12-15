import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment, Playlist } from '../types';
import { INITIAL_USER, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_LINK, TRANSLATIONS, Language } from '../constants';
import { supabase } from './supabase';

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
  isLoading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
  uploadTrack: (data: UploadTrackData) => Promise<void>;
  uploadAlbum: (files: File[], commonData: { description: string, genre: string, coverFile: File | null }) => Promise<void>;
  createPlaylist: (title: string) => Promise<void>;
  addToPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  fetchUserPlaylists: (userId: number) => Promise<Playlist[]>;
  deleteTrack: (trackId: string) => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  addComment: (trackId: string, text: string) => Promise<void>;
  recordListen: (trackId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  uploadImage: (file: File, bucket: string, path: string) => Promise<string>;
  fetchUserById: (userId: number) => Promise<User | null>;
  getChartTracks: (period: 'week' | 'month') => Promise<Track[]>;
  getLikedTracks: (userId: number) => Promise<Track[]>;
  getUserHistory: (userId: number) => Promise<Track[]>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [myPlaylists, setMyPlaylists] = useState<Playlist[]>([]);
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

  // Helper to map DB track to UI Track
  const mapTracksData = async (rawTracks: any[], currentUserId?: number): Promise<Track[]> => {
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
             // Fetch simplified comments
             const { data: commentsData } = await supabase
                .from('comments')
                .select('*')
                .eq('track_id', t.id)
                .order('created_at', { ascending: false })
                .limit(3);
             if (commentsData) comments = commentsData;

             // Fetch simplified likes
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
  };

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
  }, []);

  const fetchUserPlaylists = useCallback(async (userId: number): Promise<Playlist[]> => {
      try {
          const { data, error } = await supabase
            .from('playlists')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          
          if(error) throw error;
          
          return data.map((p: any) => ({
              id: p.id,
              userId: p.user_id,
              title: p.title,
              coverUrl: p.cover_url,
              createdAt: p.created_at,
              trackCount: 0 
          }));
      } catch (e) {
          console.warn("Fetch playlists error (table might not exist yet)", e);
          return [];
      }
  }, []);

  const createPlaylist = useCallback(async (title: string) => {
      if(!currentUser) return;
      try {
          const { error } = await supabase.from('playlists').insert({
              user_id: currentUser.id,
              title: title,
              cover_url: null 
          });
          if(error) throw error;
          
          // Refresh local playlists
          const updated = await fetchUserPlaylists(currentUser.id);
          setMyPlaylists(updated);
      } catch (e) {
          console.error("Create playlist error", e);
          alert("Failed to create playlist. Database table might be missing.");
      }
  }, [currentUser, fetchUserPlaylists]);

  const addToPlaylist = useCallback(async (trackId: string, playlistId: string) => {
      if(!currentUser) return;
      try {
          const { error } = await supabase.from('playlist_items').insert({
              playlist_id: playlistId,
              track_id: trackId
          });
          if (error && error.code !== '23505') { // Ignore unique violation
               throw error;
          }
      } catch (e) {
          console.error("Add to playlist error", e);
      }
  }, [currentUser]);

  // Initial App Load
  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
           await supabase.auth.signInAnonymously().catch(err => console.warn(err));
        }

        // @ts-ignore
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        let userId = 0;

        if (tgUser) {
          userId = tgUser.id;
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();

          if (profile) {
            setCurrentUser({
              id: profile.id,
              username: profile.username,
              firstName: profile.first_name,
              lastName: profile.last_name,
              photoUrl: profile.photo_url,
              headerUrl: profile.header_url, 
              bio: profile.bio,
              links: profile.links || {},
              stats: { uploads: 0, likesReceived: 0, totalPlays: 0 },
            });
            // Load playlists if user exists
            const playlists = await fetchUserPlaylists(userId);
            setMyPlaylists(playlists);
          } else {
             // Fallback or registration (simplified)
             setCurrentUser({
                ...INITIAL_USER,
                id: userId,
                username: tgUser.username || `user_${userId}`,
                firstName: tgUser.first_name,
                photoUrl: tgUser.photo_url
             });
          }
        }

        await fetchTracks(userId);
        
        // @ts-ignore
        window.Telegram?.WebApp?.expand();
        // @ts-ignore
        window.Telegram?.WebApp?.ready();
      } catch (e) {
        console.error("App init failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, [fetchTracks, fetchUserPlaylists]);

  const checkGroupMembership = async (userId: number): Promise<boolean> => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return true; 
    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${TELEGRAM_CHAT_ID}&user_id=${userId}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(telegramUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        return data.ok && ['creator', 'administrator', 'member', 'restricted'].includes(data.result.status);
    } catch {
        return false;
    }
  };

  const uploadImage = useCallback(async (file: File, bucket: string, path: string): Promise<string> => {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
  }, []);

  const uploadTrack = useCallback(async (data: UploadTrackData) => {
    if (!currentUser) return;
    try {
        const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
        let uploadPathOwner = currentUser.id.toString();
        
        let audioUrl = data.existingAudioUrl || '';
        if (data.audioFile && !audioUrl) {
            const audioName = `${Date.now()}_${sanitize(data.audioFile.name)}`;
            const audioPath = `audio/${uploadPathOwner}/${audioName}`;
            const { error } = await supabase.storage.from('music').upload(audioPath, data.audioFile);
            if (error) throw new Error(error.message);
            const { data: urlData } = supabase.storage.from('music').getPublicUrl(audioPath);
            audioUrl = urlData.publicUrl;
        }

        let coverUrl = data.existingCoverUrl || 'https://picsum.photos/400/400?random=default';
        if (data.coverFile && !data.existingCoverUrl) {
            const coverName = `${Date.now()}_${sanitize(data.coverFile.name)}`;
            const coverPath = `covers/${uploadPathOwner}/${coverName}`;
            const { error } = await supabase.storage.from('music').upload(coverPath, data.coverFile);
            if (!error) {
                const { data: urlData } = supabase.storage.from('music').getPublicUrl(coverPath);
                coverUrl = urlData.publicUrl;
            }
        }

        const { error: dbError } = await supabase.from('tracks').insert({
            uploader_id: currentUser.id,
            title: data.title,
            description: data.description,
            genre: data.genre,
            audio_url: audioUrl,
            cover_url: coverUrl,
            duration: data.duration
        });

        if (dbError) throw new Error(dbError.message);
        await fetchTracks(currentUser.id); // Refresh feed
        
    } catch (e: any) {
        console.error("Upload failed", e);
        throw e;
    }
  }, [currentUser, fetchTracks]);

  const uploadAlbum = useCallback(async (files: File[], commonData: { description: string, genre: string, coverFile: File | null }) => {
    if (!currentUser) return;
    setIsLoading(true);
    
    // Check membership
    const isMember = await checkGroupMembership(currentUser.id);
    if (!isMember) {
        alert(t('upload_access_denied'));
        setIsLoading(false);
        return;
    }

    try {
        // Upload Common Cover Once
        let commonCoverUrl: string | undefined = undefined;
        if (commonData.coverFile) {
             const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
             const coverName = `album_${Date.now()}_${sanitize(commonData.coverFile.name)}`;
             const coverPath = `covers/${currentUser.id}/${coverName}`;
             const { error } = await supabase.storage.from('music').upload(coverPath, commonData.coverFile);
             if (!error) {
                 const { data } = supabase.storage.from('music').getPublicUrl(coverPath);
                 commonCoverUrl = data.publicUrl;
             }
        }

        // Loop Files
        for (const file of files) {
             // Calculate Duration
             let duration = 0;
             try {
                const audio = new Audio(URL.createObjectURL(file));
                await new Promise(resolve => {
                    audio.onloadedmetadata = () => {
                        duration = audio.duration;
                        resolve(true);
                    };
                    audio.onerror = () => resolve(true); // skip on error
                });
             } catch(err) { console.warn("Duration calc failed", err); }

            const title = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
            await uploadTrack({
                title,
                description: commonData.description,
                genre: commonData.genre,
                audioFile: file,
                coverFile: null,
                existingCoverUrl: commonCoverUrl,
                duration: duration || 180
            });
        }
    } catch (e: any) {
        console.error("Album upload error", e);
        alert(`Failed: ${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, uploadTrack, t]);

  const deleteTrack = useCallback(async (trackId: string) => {
    try {
        // Cleaning up related data
        await Promise.all([
             supabase.from('comments').delete().eq('track_id', trackId),
             supabase.from('track_likes').delete().eq('track_id', trackId),
             supabase.from('listen_history').delete().eq('track_id', trackId),
             supabase.from('playlist_items').delete().eq('track_id', trackId)
        ]);

        const { error } = await supabase.from('tracks').delete().eq('id', trackId);
        if (error) throw error;

        setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch (e: any) {
        console.error("Delete track error", e);
    }
  }, []);

  const toggleLike = useCallback(async (trackId: string) => {
      if (!currentUser) return;
      // Optimistic update
      setTracks(prev => prev.map(t => {
        if (t.id === trackId) {
          const isLiked = !t.isLikedByCurrentUser;
          return { ...t, isLikedByCurrentUser: isLiked, likes: isLiked ? t.likes + 1 : t.likes - 1 };
        }
        return t;
      }));
      try {
        const { data } = await supabase.from('track_likes').select('*').eq('user_id', currentUser.id).eq('track_id', trackId).single();
        if (data) await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
        else await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
      } catch(e) {}
  }, [currentUser]);

  const addComment = useCallback(async (trackId: string, text: string) => {
    if (!currentUser) return;
    try {
        const { data, error } = await supabase.from('comments').insert({
            track_id: trackId,
            user_id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.photoUrl,
            text: text
        }).select().single();
        if (data) {
            setTracks(prev => prev.map(t => t.id === trackId ? { ...t, comments: [data, ...t.comments] } : t));
        }
    } catch (e) {}
  }, [currentUser]);

  const recordListen = useCallback(async (trackId: string) => {
    if (!currentUser) return;
    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const { count } = await supabase.from('listen_history').select('*', { count: 'exact', head: true })
            .eq('user_id', currentUser.id).eq('track_id', trackId).gte('played_at', `${todayStr}T00:00:00.000Z`);

        if (!count) {
            const { data } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
            if (data) await supabase.from('tracks').update({ plays: data.plays + 1 }).eq('id', trackId);
            setTracks(prev => prev.map(t => t.id === trackId ? { ...t, plays: t.plays + 1 } : t));
        }
        await supabase.from('listen_history').insert({ track_id: trackId, user_id: currentUser.id, played_at: new Date().toISOString() });
    } catch (e) {}
  }, [currentUser]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
      if (!currentUser) return;
      const dbUpdates: any = {};
      if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
      if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
      if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;
      if (updates.headerUrl !== undefined) dbUpdates.header_url = updates.headerUrl; 
      if (updates.links !== undefined) dbUpdates.links = updates.links;

      await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);
      setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  }, [currentUser]);

  const fetchUserById = useCallback(async (userId: number): Promise<User | null> => {
       const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
       if (!data) return null;
       
       // Simplified stats fetching for profile view
       const { count: uploads } = await supabase.from('tracks').select('*', { count: 'exact', head: true }).eq('uploader_id', userId);
       
       return {
           id: data.id,
           username: data.username,
           firstName: data.first_name,
           lastName: data.last_name,
           photoUrl: data.photo_url,
           headerUrl: data.header_url,
           bio: data.bio,
           links: data.links || {},
           stats: { uploads: uploads || 0, likesReceived: 0, totalPlays: 0 }
       };
  }, []);

  const getChartTracks = useCallback(async (period: 'week' | 'month'): Promise<Track[]> => {
      // Simplified charts logic - returns top tracks by likes/plays for now
      // In production, this would use the listen_history table aggregation
      try {
          const { data } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').order('plays', {ascending: false}).limit(50);
          return mapTracksData(data || [], currentUser?.id);
      } catch { return []; }
  }, [currentUser]);

  const getLikedTracks = useCallback(async (userId: number): Promise<Track[]> => {
      const { data } = await supabase.from('track_likes').select('track_id').eq('user_id', userId);
      if(!data) return [];
      const ids = data.map(i => i.track_id);
      const { data: tracks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
      return mapTracksData(tracks || [], currentUser?.id);
  }, [currentUser]);

  const getUserHistory = useCallback(async (userId: number): Promise<Track[]> => {
      const { data } = await supabase.from('listen_history').select('track_id').eq('user_id', userId).order('played_at', {ascending:false}).limit(20);
      if(!data) return [];
      const ids = [...new Set(data.map(i => i.track_id))];
      const { data: tracks } = await supabase.from('tracks').select('*, profiles:uploader_id(username, photo_url)').in('id', ids);
      return mapTracksData(tracks || [], currentUser?.id);
  }, [currentUser]);

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        currentUser,
        tracks,
        myPlaylists,
        isLoading,
        language,
        setLanguage,
        t,
        uploadTrack,
        uploadAlbum,
        createPlaylist,
        addToPlaylist,
        fetchUserPlaylists,
        deleteTrack,
        toggleLike,
        addComment,
        recordListen,
        updateProfile,
        uploadImage,
        fetchUserById,
        getChartTracks,
        getLikedTracks,
        getUserHistory
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