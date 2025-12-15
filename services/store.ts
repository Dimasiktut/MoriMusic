import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment } from '../types';
import { INITIAL_USER } from '../constants';
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
  toggleLike: (trackId: string) => Promise<void>;
  addComment: (trackId: string, text: string) => Promise<void>;
  incrementPlay: (trackId: string) => void;
  updateProfile: (updates: Partial<User>) => Promise<void>;
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
        // Try to sign in anonymously to satisfy basic RLS policies (e.g., "authenticated" role)
        // This is a "best effort" to fix RLS errors without backend access.
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
           await supabase.auth.signInAnonymously().catch(err => console.warn("Anon sign-in failed", err));
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

  const uploadTrack = useCallback(async (data: UploadTrackData) => {
    if (!currentUser) return;

    try {
        setIsLoading(true);

        // Sanitize helper
        const sanitize = (name: string) => name.replace(/[^a-zA-Z0-9.-]/g, '_');

        // 1. Upload Audio
        const audioName = `${Date.now()}_${sanitize(data.audioFile.name)}`;
        // Note: We use currentUser.id (Telegram ID) in path. 
        // If RLS enforces auth.uid() match, this will fail unless we are authenticated as that user.
        // Since we are likely anon or signed in anonymously with a different UUID, 
        // the Storage RLS policy must be permissive (e.g., public or allow 'authenticated' generally).
        const audioPath = `audio/${currentUser.id}/${audioName}`;
        
        const { error: audioError } = await supabase.storage
            .from('music')
            .upload(audioPath, data.audioFile);
        
        if (audioError) {
             throw new Error(`Audio upload failed (Storage): ${audioError.message}. Check your Storage RLS policies.`);
        }
        
        const { data: { publicUrl: audioUrl } } = supabase.storage.from('music').getPublicUrl(audioPath);

        // 2. Upload Cover (if exists)
        let coverUrl = 'https://picsum.photos/400/400?random=default';
        if (data.coverFile) {
            const coverName = `${Date.now()}_${sanitize(data.coverFile.name)}`;
            const coverPath = `covers/${currentUser.id}/${coverName}`;
            
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

        // 3. Insert Track Record
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
        // Show the actual error message to help debugging
        alert(`Upload Failed!\n\n${e.message || JSON.stringify(e)}\n\nTip: If you see "row level security policy", you need to disable RLS or add a policy in Supabase Dashboard for the 'music' bucket and 'tracks' table.`);
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, fetchTracks]);

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
        // Removed fake local comment fallback
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

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        currentUser,
        tracks,
        isLoading,
        uploadTrack,
        toggleLike,
        addComment,
        incrementPlay,
        updateProfile
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