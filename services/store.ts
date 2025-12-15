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
      if (!tracksData) return;

      // 2. Get Likes for current user (to set isLikedByCurrentUser)
      let userLikes: string[] = [];
      if (userId) {
        const { data: likesData } = await supabase
          .from('track_likes')
          .select('track_id')
          .eq('user_id', userId);
        
        if (likesData) userLikes = likesData.map(l => l.track_id);
      }

      // 3. Get Comments counts or latest comments (simplified for now: empty array or separate fetch)
      // For performance, we usually fetch comments on demand, but let's just leave empty for feed
      // and update the Track type mapping.

      // Map DB response to UI Track type
      const mappedTracks: Track[] = await Promise.all(tracksData.map(async (t: any) => {
         // Get real comment count or comments
         const { data: commentsData } = await supabase
            .from('comments')
            .select('*')
            .eq('track_id', t.id)
            .order('created_at', { ascending: false })
            .limit(3);

         // Get like count
         const { count: likesCount } = await supabase
            .from('track_likes')
            .select('*', { count: 'exact', head: true })
            .eq('track_id', t.id);

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
          likes: likesCount || 0,
          comments: commentsData || [],
          isLikedByCurrentUser: userLikes.includes(t.id),
        };
      }));

      setTracks(mappedTracks);

    } catch (e) {
      console.error("Error fetching tracks:", e);
    }
  }, []);

  // Initialize App
  useEffect(() => {
    const initApp = async () => {
      // @ts-ignore
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      
      let userId = 0;

      if (tgUser) {
        userId = tgUser.id;
        // Check if user exists in DB
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (profile) {
          // Calculate stats dynamically or rely on stored jsonb
          // For simplicity, we construct the User object
          setCurrentUser({
            id: profile.id,
            username: profile.username,
            firstName: profile.first_name,
            lastName: profile.last_name,
            photoUrl: profile.photo_url,
            bio: profile.bio,
            links: profile.links || {},
            stats: { uploads: 0, likesReceived: 0, totalPlays: 0 } // Todo: implement real stats aggregation
          });
        } else {
          // Create new user
          const newUser = {
            id: userId,
            username: tgUser.username || `user_${userId}`,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
            photo_url: tgUser.photo_url,
          };
          
          await supabase.from('profiles').insert(newUser);
          setCurrentUser({
            ...INITIAL_USER,
            id: userId,
            username: newUser.username,
            firstName: newUser.first_name,
            photoUrl: newUser.photo_url
          });
        }
      } else {
        // Dev mode fallback
        console.warn("No Telegram User detected. Using Mock/Dev mode might fail with DB RLS.");
        setCurrentUser(INITIAL_USER);
        userId = INITIAL_USER.id;
      }

      await fetchTracks(userId);
      setIsLoading(false);
      
      // @ts-ignore
      window.Telegram?.WebApp?.expand();
      // @ts-ignore
      window.Telegram?.WebApp?.ready();
    };

    initApp();
  }, [fetchTracks]);

  const uploadTrack = useCallback(async (data: UploadTrackData) => {
    if (!currentUser) return;

    try {
        setIsLoading(true);
        // 1. Upload Audio
        const audioPath = `audio/${currentUser.id}/${Date.now()}_${data.audioFile.name}`;
        const { error: audioError } = await supabase.storage
            .from('music')
            .upload(audioPath, data.audioFile);
        
        if (audioError) throw audioError;
        
        const { data: { publicUrl: audioUrl } } = supabase.storage.from('music').getPublicUrl(audioPath);

        // 2. Upload Cover (if exists)
        let coverUrl = 'https://picsum.photos/400/400?random=default';
        if (data.coverFile) {
            const coverPath = `covers/${currentUser.id}/${Date.now()}_${data.coverFile.name}`;
            const { error: coverError } = await supabase.storage
                .from('music')
                .upload(coverPath, data.coverFile);
            
            if (!coverError) {
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

        if (dbError) throw dbError;

        // Refresh tracks
        await fetchTracks(currentUser.id);

    } catch (e) {
        console.error("Upload failed", e);
        alert("Upload failed. See console.");
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
  }, [currentUser]);

  const addComment = useCallback(async (trackId: string, text: string) => {
    if (!currentUser) return;

    const { data, error } = await supabase.from('comments').insert({
        track_id: trackId,
        user_id: currentUser.id,
        username: currentUser.username,
        avatar: currentUser.photoUrl,
        text: text
    }).select().single();

    if (data) {
        setTracks(prev => prev.map(t => {
            if (t.id === trackId) {
                return { ...t, comments: [data, ...t.comments] };
            }
            return t;
        }));
    }
  }, [currentUser]);

  const incrementPlay = useCallback(async (trackId: string) => {
    // Optimistic
    setTracks(prev => prev.map(t => {
        if (t.id === trackId) return { ...t, plays: t.plays + 1 };
        return t;
    }));

    // RPC call is better for atomicity, but simple update works for prototype
    // Need an RPC function `increment_plays` in Supabase ideally
    // For now, let's just ignore the race condition or do a direct RPC call if setup
    // await supabase.rpc('increment_plays', { row_id: trackId });
    
    // Fallback: fetch, increment, update (not safe for high concurrency)
    const { data } = await supabase.from('tracks').select('plays').eq('id', trackId).single();
    if (data) {
        await supabase.from('tracks').update({ plays: data.plays + 1 }).eq('id', trackId);
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

    const { error } = await supabase.from('profiles').update(dbUpdates).eq('id', currentUser.id);

    if (!error) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
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