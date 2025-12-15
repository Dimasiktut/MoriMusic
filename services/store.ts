import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment } from '../types';
import { INITIAL_USER, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_GROUP_LINK } from '../constants';
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
  uploadTrack: (data: UploadTrackData) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  addComment: (trackId: string, text: string) => Promise<void>;
  recordListen: (trackId: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  fetchUserById: (userId: number) => Promise<User | null>;
  getChartTracks: (period: 'week' | 'month') => Promise<Track[]>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper to fetch tracks with joined data
  const fetchTracks = useCallback(async (userId?: number) => {
    try {
      // 1. Get Tracks
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
      
      if (!tracksData) {
         setTracks([]);
         return;
      }

      // 2. Get Likes for current user (to set isLikedByCurrentUser)
      let userLikes: string[] = [];
      if (userId) {
        const { data: likesData } = await supabase
          .from('track_likes')
          .select('track_id')
          .eq('user_id', userId);
        
        if (likesData) userLikes = likesData.map(l => l.track_id);
      }

      // 3. Map DB response to UI Track type
      const mappedTracks: Track[] = await Promise.all(tracksData.map(async (t: any) => {
         let comments: Comment[] = [];
         let likesCount = 0;

         try {
             // Get latest 3 comments
             const { data: commentsData } = await supabase
                .from('comments')
                .select('*')
                .eq('track_id', t.id)
                .order('created_at', { ascending: false })
                .limit(3);
             if (commentsData) comments = commentsData;

             // Get like count
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
        };
      }));

      setTracks(mappedTracks);

    } catch (e: any) {
      console.error("Error fetching tracks:", JSON.stringify(e, null, 2));
      setTracks([]); // Empty state on error
    }
  }, []);

  // Initialize App
  useEffect(() => {
    const initApp = async () => {
      try {
        // Attempt Anonymous Sign-in (Best effort, don't crash if it fails)
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
            setCurrentUser({
              id: profile.id,
              username: profile.username,
              firstName: profile.first_name,
              lastName: profile.last_name,
              photoUrl: profile.photo_url,
              bio: profile.bio,
              links: profile.links || {},
              stats: { uploads: 0, likesReceived: 0, totalPlays: 0 }
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
                `🔒 Доступ запрещен\n\nЧтобы загружать треки, вы должны быть подписаны на наш канал ${TELEGRAM_CHAT_ID}.\n\nПодписаться сейчас?`
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
  }, [currentUser, fetchTracks]);

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
            // Also clean up history for this track
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

  // --- NEW LISTENING LOGIC ---
  const recordListen = useCallback(async (trackId: string) => {
    // 1. Optimistically update visual "Total Plays"
    setTracks(prev => prev.map(t => {
        if (t.id === trackId) return { ...t, plays: t.plays + 1 };
        return t;
    }));

    try {
        // 2. Increment DB Total Plays
        const { data: trackData } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
        if (trackData) {
            await supabase.from('tracks').update({ plays: trackData.plays + 1 }).eq('id', trackId);
        }

        // 3. Insert into History (for Charts & Uniqueness)
        // If currentUser is null (guest), we can still record anonymous listen if we want, 
        // but charts usually rely on user_id to deduplicate.
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

      return {
          id: profile.id,
          username: profile.username,
          firstName: profile.first_name,
          lastName: profile.last_name,
          photoUrl: profile.photo_url,
          bio: profile.bio,
          links: profile.links || {},
          stats: { uploads: uploads || 0, likesReceived: likesReceived, totalPlays: totalPlays }
      };
    } catch (e) {
      console.error("Unexpected error in fetchUserById:", e);
      return null;
    }
  }, []);

  // --- NEW CHART CALCULATION LOGIC ---
  const getChartTracks = useCallback(async (period: 'week' | 'month'): Promise<Track[]> => {
      try {
          const now = new Date();
          const startDate = new Date();
          if (period === 'week') startDate.setDate(now.getDate() - 7);
          else startDate.setDate(now.getDate() - 30);

          // 1. Fetch listening history for the period
          // Note: In a high-scale app, this aggregation should happen on DB (RPC or View)
          // For now, we fetch relevant rows and aggregate client-side
          const { data: history, error } = await supabase
            .from('listen_history')
            .select('track_id, user_id, played_at')
            .gte('played_at', startDate.toISOString());

          if (error) throw error;
          if (!history || history.length === 0) return [];

          // 2. Aggregate Unique Listens
          // Logic: One unique listen per user per track per day is allowed
          const scores: Record<string, number> = {};

          history.forEach(record => {
             const trackId = record.track_id;
             const userId = record.user_id;
             // Simple day string (YYYY-MM-DD)
             const day = record.played_at.split('T')[0];
             const key = `${trackId}-${userId}-${day}`;
             
             // We can optimize this by just counting distinct UserIDs per Track if the requirement 
             // was just "unique per period". 
             // But prompt says: "Unique listen per user per track per day".
             // So if I listen on Monday and Tuesday, that counts as 2 unique listens for the Week chart.
             
             // We'll use a Set to track "User-Track-Day" combinations we've already counted
             // Actually, simply counting the history rows might be wrong if we don't dedupe.
             // But since we are calculating charts, let's create a map of TrackID -> Count
          });

          // Let's implement the specific rule:
          // "Unique Play": Increments only once per user per track per day.
          const uniquePlaysMap = new Set<string>(); // Stores "trackId_userId_date"
          const trackScores: Record<string, number> = {};

          history.forEach(h => {
              const dateKey = h.played_at.split('T')[0]; // YYYY-MM-DD
              const uniqueKey = `${h.track_id}_${h.user_id}_${dateKey}`;
              
              if (!uniquePlaysMap.has(uniqueKey)) {
                  uniquePlaysMap.add(uniqueKey);
                  trackScores[h.track_id] = (trackScores[h.track_id] || 0) + 1;
              }
          });

          // 3. Sort IDs by score
          const sortedTrackIds = Object.entries(trackScores)
              .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
              .slice(0, 50) // Top 50
              .map(([id]) => id);

          if (sortedTrackIds.length === 0) return [];

          // 4. Fetch full track details for these IDs
          // Reuse the existing track fetching logic via a fresh query to ensure we get uploader details
          const { data: tracksData } = await supabase
            .from('tracks')
            .select(`*, profiles:uploader_id(username, photo_url)`)
            .in('id', sortedTrackIds);

          if (!tracksData) return [];

          // 5. Map and Re-sort (because .in() doesn't preserve order)
          // We also need likes count for display
           const mappedChartTracks: Track[] = await Promise.all(tracksData.map(async (t: any) => {
              // Basic minimal mapping for chart display
              // We fetch likes count just for display, but sorting is determined by 'trackScores'
              const { count: likes } = await supabase.from('track_likes').select('*', { count: 'exact', head: true }).eq('track_id', t.id);
              
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
                  plays: t.plays, // Show TOTAL plays
                  likes: likes || 0,
                  comments: [],
                  isLikedByCurrentUser: false // Not critical for chart view
              };
           }));

           // Sort based on the calculated scores
           return mappedChartTracks.sort((a, b) => {
               const scoreA = trackScores[a.id] || 0;
               const scoreB = trackScores[b.id] || 0;
               return scoreB - scoreA;
           });

      } catch (e) {
          console.error("Error calculating charts", e);
          return [];
      }
  }, []);

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        currentUser,
        tracks,
        isLoading,
        uploadTrack,
        deleteTrack,
        toggleLike,
        addComment,
        recordListen,
        updateProfile,
        fetchUserById,
        getChartTracks
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