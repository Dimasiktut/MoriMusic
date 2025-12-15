import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Track, User, Comment } from '../types';
import { INITIAL_USER, MOCK_TRACKS } from '../constants';

// Define context shape
interface StoreContextType {
  currentUser: User | null;
  tracks: Track[];
  isLoading: boolean;
  uploadTrack: (track: Omit<Track, 'id' | 'createdAt' | 'plays' | 'likes' | 'comments' | 'uploaderId' | 'uploaderName' | 'uploaderAvatar'>) => void;
  toggleLike: (trackId: string) => void;
  addComment: (trackId: string, text: string) => void;
  incrementPlay: (trackId: string) => void;
  updateProfile: (updates: Partial<User>) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize (Mock Auth & Data Load)
  useEffect(() => {
    const initApp = async () => {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // Telegram WebApp Mock Integration
      // In a real app, we would validate initData with backend
      // @ts-ignore
      const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
      
      if (tgUser) {
        setCurrentUser({
          ...INITIAL_USER,
          id: tgUser.id,
          username: tgUser.username || `user_${tgUser.id}`,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name,
          photoUrl: tgUser.photo_url || INITIAL_USER.photoUrl
        });
      } else {
        // Fallback for browser dev
        setCurrentUser(INITIAL_USER);
      }

      setTracks(MOCK_TRACKS);
      setIsLoading(false);
      
      // Expand Telegram WebApp
      // @ts-ignore
      window.Telegram?.WebApp?.expand();
      // @ts-ignore
      window.Telegram?.WebApp?.ready();
    };

    initApp();
  }, []);

  const uploadTrack = useCallback((trackData: Omit<Track, 'id' | 'createdAt' | 'plays' | 'likes' | 'comments' | 'uploaderId' | 'uploaderName' | 'uploaderAvatar'>) => {
    if (!currentUser) return;

    const newTrack: Track = {
      ...trackData,
      id: `t_${Date.now()}`,
      uploaderId: currentUser.id,
      uploaderName: currentUser.username,
      uploaderAvatar: currentUser.photoUrl,
      createdAt: Date.now(),
      plays: 0,
      likes: 0,
      comments: [],
      isLikedByCurrentUser: false,
    };

    setTracks(prev => [newTrack, ...prev]);
    setCurrentUser(prev => prev ? {
      ...prev,
      stats: { ...prev.stats, uploads: prev.stats.uploads + 1 }
    } : null);
  }, [currentUser]);

  const toggleLike = useCallback((trackId: string) => {
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

    // Update user stats if it's their own track? 
    // Usually likesReceived counts likes from OTHERS, but for simplicity let's leave it.
  }, []);

  const addComment = useCallback((trackId: string, text: string) => {
    if (!currentUser) return;
    
    const newComment: Comment = {
      id: `c_${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.photoUrl,
      text,
      createdAt: Date.now()
    };

    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          comments: [newComment, ...t.comments]
        };
      }
      return t;
    }));
  }, [currentUser]);

  const incrementPlay = useCallback((trackId: string) => {
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return { ...t, plays: t.plays + 1 };
      }
      return t;
    }));
  }, []);

  const updateProfile = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

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