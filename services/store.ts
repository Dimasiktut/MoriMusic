import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment } from '../types';
import { INITIAL_USER, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_LINK, TRANSLATIONS, Language } from '../constants';
import { supabase } from './supabase';

interface UploadTrackData {
  title: string;
  description: string;
  genre: string;
  audioFile: File;
  coverFile: File | null;
  duration: number;
}

interface StoreContextType {
  currentUser: User | null;
  tracks: Track[];
  isLoading: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof TRANSLATIONS['en']) => string;
  uploadTrack: (data: UploadTrackData) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  
  // Default to Russian if not set
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

  // Determine verification status (simple logic for now)
  const checkVerification = (stats: { uploads: number, totalPlays: number }) => {
      // Example logic: Verified if > 3 uploads OR > 1000 plays
      return stats.uploads >= 3 || stats.totalPlays > 1000;
  };

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
             
             // Optimization: In a real app, 'isVerified' should be a column on the 'profiles' table.
             // Here we just mock it true for demo purposes if plays > 1000 on the track itself as a heuristic
             // or fetch profile stats if critical.
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
          isVerifiedUploader: t.plays > 1000 // Temporary logic: verify high performing tracks' authors
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
      console.error("Error fetching tracks:", JSON.stringify(e, null, 2));
      setTracks([]); 
    }
  }, []);

  const getLikedTracks = useCallback(async (userId: number): Promise<Track[]> => {
    try {
        // 1. Get IDs of liked tracks
        const { data: likes } = await supabase
            .from('track_likes')
            .select('track_id')
            .eq('user_id', userId);
        
        if (!likes || likes.length === 0) return [];
        const ids = likes.map(l => l.track_id);

        // 2. Fetch those tracks
        const { data: tracksData } = await supabase
            .from('tracks')
            .select(`
                *,
                profiles:uploader_id (
                    username,
                    photo_url
                )
            `)
            .in('id', ids)
            .order('created_at', { ascending: false });
        
        // 3. Map
        return await mapTracksData(tracksData || [], currentUser?.id);
    } catch (e) {
        console.error("Error fetching liked tracks", e);
        return [];
    }
  }, [currentUser]);

  const getUserHistory = useCallback(async (userId: number): Promise<Track[]> => {
    try {
        const { data: history } = await supabase
            .from('listen_history')
            .select('track_id, played_at')
            .eq('user_id', userId)
            .order('played_at', { ascending: false })
            .limit(50); // Last 50 tracks
        
        if (!history || history.length === 0) return [];
        
        // Dedup tracks, keeping most recent listen
        const seen = new Set();
        const uniqueIds: string[] = [];
        for (const h of history) {
            if (!seen.has(h.track_id)) {
                seen.add(h.track_id);
                uniqueIds.push(h.track_id);
            }
        }

        const { data: tracksData } = await supabase
            .from('tracks')
            .select(`*, profiles:uploader_id(username, photo_url)`)
            .in('id', uniqueIds);

        if (!tracksData) return [];
        
        const mapped = await mapTracksData(tracksData, currentUser?.id);
        
        // Sort back by history order
        return uniqueIds.map(id => mapped.find(t => t.id === id)).filter(Boolean) as Track[];
    } catch (e) {
        console.error("Error fetching history", e);
        return [];
    }
  }, [currentUser]);

  // Initialize App
  useEffect(() => {
    const initApp = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
           await supabase.auth.signInAnonymously().catch(err => {
               console.warn("Anonymous sign-in skipped:", err.message);
           });
        }

        // @ts-ignore
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        let userId = 0;

        if (tgUser) {
          userId = tgUser.id;
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (profile) {
            // Check verification based on simple stats (fetch real stats if needed)
            const isVerified = false; // Logic moved to fetchUserById for detailed views

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
              isVerified: isVerified
            });
          } else if (error && error.code === 'PGRST116') { 
            const newUser = {
              id: userId,
              username: tgUser.username || `user_${userId}`,
              first_name: tgUser.first_name,
              last_name: tgUser.last_name,
              photo_url: tgUser.photo_url,
            };
            
            const { error: insertError } = await supabase.from('profiles').insert(newUser);
            if (!insertError) {
                setCurrentUser({
                ...INITIAL_USER,
                id: userId,
                username: newUser.username,
                firstName: newUser.first_name,
                photoUrl: newUser.photo_url
                });
            } else {
                 console.warn("Failed to create profile.", insertError);
                 setCurrentUser(null);
            }
          } else {
             console.warn("Could not fetch profile.", error);
             setCurrentUser(null);
          }
        } else {
          console.warn("No Telegram User detected.");
          setCurrentUser(null);
        }

        await fetchTracks(userId);
        
        // @ts-ignore
        window.Telegram?.WebApp?.expand();
        // @ts-ignore
        window.Telegram?.WebApp?.ready();
      } catch (e) {
        console.error("App initialization failed", e);
        setCurrentUser(null);
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };

    initApp();
  }, [fetchTracks]);

  // --- TELEGRAM MEMBERSHIP CHECKER ---
  const checkGroupMembership = async (userId: number): Promise<boolean> => {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        return true; 
    }
    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${TELEGRAM_CHAT_ID}&user_id=${userId}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(telegramUrl)}`;
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (!data.ok) return false;
        const status = data.result.status;
        const allowed = ['creator', 'administrator', 'member', 'restricted'];
        return allowed.includes(status);
    } catch (error) {
        console.error("Failed to verify membership:", error);
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
        setIsLoading(true);
        const isMember = await checkGroupMembership(currentUser.id);
        if (!isMember) {
            if (!TELEGRAM_BOT_TOKEN) {
                alert("Ошибка конфигурации: TELEGRAM_BOT_TOKEN не установлен в коде.");
                return;
            }
            const shouldJoin = confirm(
                `🔒 ${t('upload_access_denied')}\n\n${t('upload_sub_required')} ${TELEGRAM_CHAT_ID}.\n\n${t('upload_sub_btn')}`
            );
            if (shouldJoin) {
                // @ts-ignore
                if (window.Telegram?.WebApp?.openTelegramLink) {
                    // @ts-ignore
                    window.Telegram.WebApp.openTelegramLink(TELEGRAM_GROUP_LINK);
                } else {
                    window.open(TELEGRAM_GROUP_LINK, '_blank');
                }
            }
            return; 
        }

        const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');
        let storageOwnerId: string | undefined;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            storageOwnerId = user?.id;
            if (!storageOwnerId) {
                const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
                if (!anonError && anonData.user) {
                    storageOwnerId = anonData.user.id;
                }
            }
        } catch (authErr) {
            console.warn("Auth check failed, using fallback.", authErr);
        }

        const uploadPathOwner = storageOwnerId || currentUser.id.toString();
        const audioName = `${Date.now()}_${sanitize(data.audioFile.name)}`;
        const audioPath = `audio/${uploadPathOwner}/${audioName}`;
        
        const { error: audioError } = await supabase.storage
            .from('music')
            .upload(audioPath, data.audioFile);
        
        if (audioError) throw new Error(`Audio upload failed: ${audioError.message}`);
        
        const { data: { publicUrl: audioUrl } } = supabase.storage.from('music').getPublicUrl(audioPath);

        let coverUrl = 'https://picsum.photos/400/400?random=default';
        if (data.coverFile) {
            const coverName = `${Date.now()}_${sanitize(data.coverFile.name)}`;
            const coverPath = `covers/${uploadPathOwner}/${coverName}`;
            const { error: coverError } = await supabase.storage
                .from('music')
                .upload(coverPath, data.coverFile);
            if (!coverError) {
                const { data: { publicUrl } } = supabase.storage.from('music').getPublicUrl(coverPath);
                coverUrl = publicUrl;
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

        if (dbError) throw new Error(`Database insert failed: ${dbError.message}`);
        await fetchTracks(currentUser.id);
    } catch (e: any) {
        console.error("Upload failed", e);
        alert(`Upload Failed!\n\n${e.message}`);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, fetchTracks, t]);

  const deleteTrack = useCallback(async (trackId: string) => {
    try {
        const { data: trackToDelete } = await supabase
            .from('tracks')
            .select('audio_url, cover_url')
            .eq('id', trackId)
            .single();

        await Promise.all([
            supabase.from('comments').delete().eq('track_id', trackId),
            supabase.from('track_likes').delete().eq('track_id', trackId),
            supabase.from('listen_history').delete().eq('track_id', trackId)
        ]);

        const { error } = await supabase.from('tracks').delete().eq('id', trackId);
        if (error) throw error;

        setTracks(prev => prev.filter(t => t.id !== trackId));

        if (trackToDelete) {
            const getPath = (url: string) => {
                if (!url) return null;
                const parts = url.split('/music/'); 
                if (parts.length === 2) return parts[1];
                return null;
            };
            const filesToRemove = [
                getPath(trackToDelete.audio_url),
                getPath(trackToDelete.cover_url)
            ].filter(p => p !== null && !p.includes('picsum.photos')) as string[];
            if (filesToRemove.length > 0) {
                supabase.storage.from('music').remove(filesToRemove).catch(() => {});
            }
        }
    } catch (e: any) {
        console.error("Error deleting track", e);
        alert(`Failed to delete track: ${e.message}`);
    }
  }, []);

  const toggleLike = useCallback(async (trackId: string) => {
    if (!currentUser) return;
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        const isLiked = !t.isLikedByCurrentUser;
        return { ...t, isLikedByCurrentUser: isLiked, likes: isLiked ? t.likes + 1 : t.likes - 1 };
      }
      return t;
    }));

    try {
        const { data: existingLike } = await supabase
            .from('track_likes')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('track_id', trackId)
            .single();

        if (existingLike) {
            await supabase.from('track_likes').delete().eq('user_id', currentUser.id).eq('track_id', trackId);
        } else {
            await supabase.from('track_likes').insert({ user_id: currentUser.id, track_id: trackId });
        }
    } catch (e) {
        console.error("Error toggling like", e);
    }
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
        if (error) throw error;
        if (data) {
            setTracks(prev => prev.map(t => {
                if (t.id === trackId) return { ...t, comments: [data, ...t.comments] };
                return t;
            }));
        }
    } catch (e) {
        console.error("Error adding comment", e);
    }
  }, [currentUser]);

  const recordListen = useCallback(async (trackId: string) => {
    setTracks(prev => prev.map(t => {
        if (t.id === trackId) return { ...t, plays: t.plays + 1 };
        return t;
    }));

    try {
        const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
        if (trackData) {
            await supabase.from('tracks').update({ plays: trackData.plays + 1 }).eq('id', trackId);
        }
        if (currentUser) {
            await supabase.from('listen_history').insert({
                track_id: trackId,
                user_id: currentUser.id,
                played_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.warn("Failed to record listen", e);
    }
  }, [currentUser]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!currentUser) return;
    const dbUpdates: any = {};
    if (updates.firstName) dbUpdates.first_name = updates.firstName;
    if (updates.lastName) dbUpdates.last_name = updates.lastName;
    if (updates.bio) dbUpdates.bio = updates.bio;
    if (updates.photoUrl) dbUpdates.photo_url = updates.photoUrl;
    if (updates.headerUrl) dbUpdates.header_url = updates.headerUrl; 
    if (updates.links) dbUpdates.links = updates.links;

    try {
        const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);
        if (error) throw error;
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
    } catch (e) {
        console.error("Profile update failed", e);
    }
  }, [currentUser]);

  const fetchUserById = useCallback(async (userId: number): Promise<User | null> => {
    try {
      const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (error || !profile) return null;

      const { count: uploads } = await supabase.from('tracks').select('*', { count: 'exact', head: true }).eq('uploader_id', userId);
      
      const { data: userTracks } = await supabase.from('tracks').select('id, plays').eq('uploader_id', userId);
      const totalPlays = userTracks?.reduce((sum, t) => sum + t.plays, 0) || 0;

      let likesReceived = 0;
      if (userTracks && userTracks.length > 0) {
          const trackIds = userTracks.map(t => t.id);
          const { count } = await supabase.from('track_likes').select('*', { count: 'exact', head: true }).in('track_id', trackIds);
          likesReceived = count || 0;
      }
      
      const stats = { uploads: uploads || 0, likesReceived: likesReceived, totalPlays: totalPlays };
      const isVerified = checkVerification(stats);

      return {
          id: profile.id,
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          photoUrl: profile.photo_url,
          headerUrl: profile.header_url,
          bio: profile.bio,
          links: profile.links || {},
          stats: stats,
          isVerified: isVerified
      };
    } catch (e) {
      console.error("Unexpected error in fetchUserById:", e);
      return null;
    }
  }, []);

  const getChartTracks = useCallback(async (period: 'week' | 'month'): Promise<Track[]> => {
      try {
          const now = new Date();
          const startDate = new Date();
          if (period === 'week') startDate.setDate(now.getDate() - 7);
          else startDate.setDate(now.getDate() - 30);

          const { data: history, error } = await supabase
            .from('listen_history')
            .select('track_id, user_id, played_at')
            .gte('played_at', startDate.toISOString());

          if (error) throw error;
          if (!history || history.length === 0) return [];

          const uniquePlaysMap = new Set<string>();
          const trackScores: Record<string, number> = {};

          history.forEach(h => {
              const dateKey = h.played_at.split('T')[0];
              const uniqueKey = `${h.track_id}_${h.user_id}_${dateKey}`;
              
              if (!uniquePlaysMap.has(uniqueKey)) {
                  uniquePlaysMap.add(uniqueKey);
                  trackScores[h.track_id] = (trackScores[h.track_id] || 0) + 1;
              }
          });

          const sortedTrackIds = Object.entries(trackScores)
              .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
              .slice(0, 50)
              .map(([id]) => id);

          if (sortedTrackIds.length === 0) return [];

          const { data: tracksData } = await supabase
            .from('tracks')
            .select(`*, profiles:uploader_id(username, photo_url)`)
            .in('id', sortedTrackIds);

          if (!tracksData) return [];
          
          // Re-use common mapper
          const mapped = await mapTracksData(tracksData, currentUser?.id);

           return mapped.sort((a, b) => {
               const scoreA = trackScores[a.id] || 0;
               const scoreB = trackScores[b.id] || 0;
               return scoreB - scoreA;
           });

      } catch (e) {
          console.error("Error calculating charts", e);
          return [];
      }
  }, [currentUser]);

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        currentUser,
        tracks,
        isLoading,
        language,
        setLanguage,
        t,
        uploadTrack,
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