export interface User {
  id: number; // Telegram ID is number (bigint)
  username: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  headerUrl?: string; // Background banner for profile
  bio?: string;
  links: {
    yandex?: string;
    spotify?: string;
    soundcloud?: string;
    other?: string;
  };
  stats: {
    uploads: number;
    likesReceived: number;
    totalPlays: number;
  };
  isVerified?: boolean;
}

export interface Comment {
  id: string; // UUID
  userId: number;
  username: string;
  avatar?: string;
  text: string;
  createdAt: string; // ISO string from DB
}

export interface Track {
  id: string; // UUID from DB
  uploaderId: number;
  uploaderName: string;
  uploaderAvatar?: string;
  title: string;
  description?: string;
  genre: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  createdAt: string; // ISO string from DB
  plays: number;
  likes: number; // Count
  comments: Comment[];
  isLikedByCurrentUser?: boolean;
  isVerifiedUploader?: boolean; // New field for UI
}

export type TabView = 'feed' | 'charts' | 'upload' | 'profile' | 'settings';

export type ChartType = 'week' | 'month';

export interface AudioPlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  isMinimized: boolean;
}