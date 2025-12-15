import { Track, User } from './types';

export const MOCK_USER_ID = 0;

export const GENRES = [
  'Phonk', 'Hip-Hop', 'Electronic', 'Lo-Fi', 'Rock', 'Ambient', 'Techno', 'Pop'
];

export const INITIAL_USER: User = {
  id: 0,
  username: '',
  firstName: '',
  lastName: '',
  photoUrl: '',
  bio: '',
  links: {},
  stats: {
    uploads: 0,
    likesReceived: 0,
    totalPlays: 0,
  },
};
