export interface User {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
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
}

export interface Comment {
  id: string;
  userId: number;
  username: string;
  avatar?: string;
  text: string;
  createdAt: number;
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
  createdAt: number;
  plays: number;
  likes: number;
  comments: Comment[];
  isLikedByCurrentUser?: boolean;
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