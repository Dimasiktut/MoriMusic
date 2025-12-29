
export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  headerUrl?: string;
  bio?: string;
  links: {
    telegram?: string;
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
  badges?: string[];
  isVerified?: boolean;
}

export interface Comment {
  id: string;
  userId: number;
  username: string;
  avatar?: string;
  text: string;
  createdAt: string;
}

export interface RoomMessage {
  id: string;
  userId: number;
  username: string;
  text: string;
  type: 'text' | 'system';
  createdAt: string;
}

export interface Track {
  id: string;
  uploaderId: number;
  uploaderName: string;
  uploaderAvatar?: string;
  title: string;
  description?: string;
  genre: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  createdAt: string;
  plays: number;
  likes: number;
  comments: Comment[];
  isLikedByCurrentUser?: boolean;
  isVerifiedUploader?: boolean;
}

export interface Playlist {
  id: string;
  userId: number;
  title: string;
  coverUrl?: string;
  createdAt: string;
  trackCount?: number; 
}

export interface Room {
  id: string;
  title: string;
  djId: number;
  djName: string;
  djAvatar: string;
  coverUrl: string;
  startTime: string;
  status: 'live' | 'upcoming' | 'ended';
  listeners: number;
  streamUrl?: string;
  currentTrack?: Track;
  isMicActive?: boolean;
  isPlaying?: boolean;
  currentProgress?: number;
}

export type TabView = 'feed' | 'charts' | 'upload' | 'profile' | 'settings' | 'rooms';

export type ChartType = 'week' | 'month';

export interface AudioPlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  isMinimized: boolean;
}
