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
  incrementPlay: (trackId: string) => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  fetchUserById: (userId: number) => Promise<User | null>;
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
               // This is expected if Anon Auth is disabled in Supabase
               console.warn("Anonymous sign-in skipped (check Supabase Auth settings):", err.message);
           });
        }

        // @ts-ignore
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        
        let userId = 0;

        if (tgUser) {
          userId = tgUser.id;
          // Check if user exists in DB
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
             // Error PGRST116 is "Row not found", so we insert.
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
             // Other errors (e.g. table missing)
             console.warn("Could not fetch profile.", error);
             setCurrentUser(null);
          }
        } else {
          // Dev mode or non-Telegram environment
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
    // If no config, assume dev mode or open access
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("Telegram Bot Token or Chat ID not set in constants.ts. Skipping membership check.");
        return true; 
    }

    try {
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${TELEGRAM_CHAT_ID}&user_id=${userId}`;
        
        // We MUST use a CORS proxy because browsers block direct calls to Telegram API
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(telegramUrl)}`;

        const response = await fetch(proxyUrl);
        const data = await response.json();

        if (!data.ok) {
            console.error("Telegram API Error:", data.description);
            // If error (e.g. bot not admin), we deny access to be safe, or check description
            return false;
        }

        const status = data.result.status;
        // Allowed statuses
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

        // 1. CHECK MEMBERSHIP
        const isMember = await checkGroupMembership(currentUser.id);
        
        if (!isMember) {
            // Check if tokens are even set
            if (!TELEGRAM_BOT_TOKEN) {
                alert("Ошибка конфигурации: TELEGRAM_BOT_TOKEN не установлен в коде.");
                return;
            }

            // Show UI Alert with Link
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
            return; // Stop upload
        }

        // --- PROCEED WITH UPLOAD ---
        const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');

        // 2. Attempt to resolve a Storage Owner ID
        let storageOwnerId: string | undefined;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            storageOwnerId = user?.id;
            
            if (!storageOwnerId) {
                const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
                if (!anonError && anonData.user) {
                    storageOwnerId = anonData.user.id;
                } else {
                    console.warn("Could not authenticate with Supabase for upload. Proceeding with Telegram ID fallback.");
                }
            }
        } catch (authErr) {
            console.warn("Auth check failed, using fallback.", authErr);
        }

        const uploadPathOwner = storageOwnerId || currentUser.id.toString();

        // 3. Upload Audio
        const audioName = `${Date.now()}_${sanitize(data.audioFile.name)}`;
        const audioPath = `audio/${uploadPathOwner}/${audioName}`;
        
        const { error: audioError } = await supabase.storage
            .from('music')
            .upload(audioPath, data.audioFile);
        
        if (audioError) {
             throw new Error(`Audio upload failed: ${audioError.message}`);
        }
        
        const { data: { publicUrl: audioUrl } } = supabase.storage.from('music').getPublicUrl(audioPath);

        // 4. Upload Cover (if exists)
        let coverUrl = 'https://picsum.photos/400/400?random=default';
        if (data.coverFile) {
            const coverName = `${Date.now()}_${sanitize(data.coverFile.name)}`;
            const coverPath = `covers/${uploadPathOwner}/${coverName}`;
            
            const { error: coverError } = await supabase.storage
                .from('music')
                .upload(coverPath, data.coverFile);
            
            if (coverError) {
                console.warn("Cover upload failed (using default):", coverError.message);
            } else {
                const { data: { publicUrl } } = supabase.storage.from('music').getPublicUrl(coverPath);
                coverUrl = publicUrl;
            }
        }

        // 5. Insert Track Record
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

        // Refresh tracks
        await fetchTracks(currentUser.id);

    } catch (e: any) {
        console.error("Upload failed", e);
        
        const errorMsg = e.message || JSON.stringify(e);
        let helpText = "Unknown error occurred.";

        if (errorMsg.includes("row-level security") || errorMsg.includes("policy") || errorMsg.includes("permission denied")) {
            helpText = `
SETUP REQUIRED (Do one of these):

OPTION A (Recommended):
1. Go to Supabase Dashboard > Authentication > Providers
2. Enable "Anonymous Sign-ins"
3. Click Save

OPTION B (Easier):
1. Go to Supabase Dashboard > Storage > 'music' bucket > Policies
2. Create Policy: "Give users access to all files"
3. Select "All" operations (INSERT, SELECT, etc)
4. Check "Anon" and "Authenticated" roles
`;
        }

        alert(`Upload Failed!\n\n${errorMsg}\n\n${helpText}`);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, fetchTracks]);

  const deleteTrack = useCallback(async (trackId: string) => {
    try {
        // Fetch track details first to get file URLs for storage cleanup
        const { data: trackToDelete } = await supabase
            .from('tracks')
            .select('audio_url, cover_url')
            .eq('id', trackId)
            .single();

        // 1. Manually delete dependencies (Comments & Likes) to prevent Foreign Key errors
        // Note: Promise.all allows these to happen in parallel
        await Promise.all([
            supabase.from('comments').delete().eq('track_id', trackId),
            supabase.from('track_likes').delete().eq('track_id', trackId)
        ]);

        // 2. Delete the track record from Database
        const { error } = await supabase
            .from('tracks')
            .delete()
            .eq('id', trackId);

        if (error) throw error;

        // 3. Update UI immediately
        setTracks(prev => prev.filter(t => t.id !== trackId));

        // 4. Cleanup Storage (Best effort, runs in background)
        if (trackToDelete) {
            const getPath = (url: string) => {
                if (!url) return null;
                // Extracts path from .../music/folder/filename
                const parts = url.split('/music/'); 
                if (parts.length === 2) return parts[1];
                return null;
            };

            const filesToRemove = [
                getPath(trackToDelete.audio_url),
                getPath(trackToDelete.cover_url)
            ].filter(p => p !== null && !p.includes('picsum.photos')) as string[];

            if (filesToRemove.length > 0) {
                supabase.storage.from('music').remove(filesToRemove).catch(err => {
                    console.warn("Background storage cleanup failed (non-critical):", err);
                });
            }
        }

    } catch (e: any) {
        console.error("Error deleting track", e);
        alert(`Failed to delete track: ${e.message || "Unknown error"}`);
    }
  }, []);

  const toggleLike = useCallback(async (trackId: string) => {
    if (!currentUser) return;

    // Optimistic Update
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        const isLiked = !t.isLikedByCurrentUser;
        return {
          ...t,
          isLikedByCurrentUser: isLiked,
          likes: isLiked ? t.likes + 1 : t.likes - 1
        };
      }
      return t;
    }));

    try {
        // DB Update
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
                if (t.id === trackId) {
                    return { ...t, comments: [data, ...t.comments] };
                }
                return t;
            }));
        }
    } catch (e) {
        console.error("Error adding comment", e);
    }
  }, [currentUser]);

  const incrementPlay = useCallback(async (trackId: string) => {
    // Optimistic
    setTracks(prev => prev.map(t => {
        if (t.id === trackId) return { ...t, plays: t.plays + 1 };
        return t;
    }));

    try {
        const { data } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
        if (data) {
            await supabase.from('tracks').update({ plays: data.plays + 1 }).eq('id', trackId);
        }
    } catch (e) {
        console.warn("Failed to update play count in DB", e);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!currentUser) return;

    // Map User type to DB columns
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
      // 1. Fetch Profile Basic Info (Simple select to avoid JOIN errors)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
          console.error(`Error fetching profile for ID ${userId}:`, error.message);
          return null;
      }
      
      if (!profile) return null;

      // 2. Fetch Stats Manually to ensure robustness
      
      // Uploads Count
      const { count: uploads } = await supabase
        .from('tracks')
        .select('*', { count: 'exact', head: true })
        .eq('uploader_id', userId);

      // Total Plays (Sum plays of user's tracks)
      const { data: userTracks } = await supabase
        .from('tracks')
        .select('id, plays')
        .eq('uploader_id', userId);
        
      const totalPlays = userTracks?.reduce((sum, t) => sum + t.plays, 0) || 0;

      // Likes Received (Count track_likes where track_id IN userTracks)
      let likesReceived = 0;
      if (userTracks && userTracks.length > 0) {
          const trackIds = userTracks.map(t => t.id);
          // Note: .in() might fail if array is too large, but for a music app user tracks it's usually fine
          const { count } = await supabase
            .from('track_likes')
            .select('*', { count: 'exact', head: true })
            .in('track_id', trackIds);
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
          stats: {
              uploads: uploads || 0,
              likesReceived: likesReceived,
              totalPlays: totalPlays
          }
      };
    } catch (e) {
      console.error("Unexpected error in fetchUserById:", e);
      return null;
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
        incrementPlay,
        updateProfile,
        fetchUserById
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