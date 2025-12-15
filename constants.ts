import { Track, User } from './types';

export const MOCK_USER_ID = 99999;

export const GENRES = [
  'Phonk', 'Hip-Hop', 'Electronic', 'Lo-Fi', 'Rock', 'Ambient', 'Techno', 'Pop'
];

export const INITIAL_USER: User = {
  id: MOCK_USER_ID,
  username: 'music_lover',
  firstName: 'Alex',
  lastName: 'Mori',
  photoUrl: 'https://picsum.photos/200/200?random=user',
  bio: 'Beatmaker & Vibe enthusiast. Uploading weekly.',
  links: {
    soundcloud: 'https://soundcloud.com/mori',
    spotify: 'https://spotify.com/mori',
  },
  stats: {
    uploads: 12,
    likesReceived: 1405,
    totalPlays: 54002,
  },
};

export const MOCK_TRACKS: Track[] = [
  {
    id: 't1',
    uploaderId: 101,
    uploaderName: 'Neon Driver',
    uploaderAvatar: 'https://picsum.photos/100/100?random=1',
    title: 'Nightcall Drift',
    description: 'Late night vibes for the highway.',
    genre: 'Phonk',
    coverUrl: 'https://picsum.photos/400/400?random=1',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 372,
    createdAt: Date.now() - 10000000,
    plays: 1240,
    likes: 342,
    comments: [
      { id: 'c1', userId: 202, username: 'vibez', text: 'This hits hard!', createdAt: Date.now() - 50000 }
    ],
    isLikedByCurrentUser: false,
  },
  {
    id: 't2',
    uploaderId: 102,
    uploaderName: 'CyberSoul',
    uploaderAvatar: 'https://picsum.photos/100/100?random=2',
    title: 'Digital Rain',
    description: 'Ambient sounds for coding.',
    genre: 'Ambient',
    coverUrl: 'https://picsum.photos/400/400?random=2',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    duration: 425,
    createdAt: Date.now() - 25000000,
    plays: 8500,
    likes: 1200,
    comments: [],
    isLikedByCurrentUser: true,
  },
  {
    id: 't3',
    uploaderId: MOCK_USER_ID,
    uploaderName: 'Alex Mori',
    uploaderAvatar: 'https://picsum.photos/200/200?random=user',
    title: 'My First Beat',
    description: 'Just testing the waters.',
    genre: 'Lo-Fi',
    coverUrl: 'https://picsum.photos/400/400?random=3',
    audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    duration: 310,
    createdAt: Date.now() - 5000,
    plays: 12,
    likes: 4,
    comments: [],
    isLikedByCurrentUser: false,
  }
];