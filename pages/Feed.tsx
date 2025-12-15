import React, { useState } from 'react';
import { useStore } from '../services/store';
import TrackCard from '../components/TrackCard';
import { Track } from '../types';
import { Search } from '../components/ui/Icons';

interface FeedProps {
  onPlayTrack: (track: Track) => void;
  onOpenProfile: (userId: number) => void;
}

const Feed: React.FC<FeedProps> = ({ onPlayTrack, onOpenProfile }) => {
  const { tracks, isLoading } = useStore();
  const [filter, setFilter] = useState<'new' | 'hot'>('new');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Filter by Search
  const searchedTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.uploaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 2. Sort by Type
  const sortedTracks = [...searchedTracks].sort((a, b) => {
    if (filter === 'new') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return (b.likes + b.plays) - (a.likes + a.plays);
  });

  if (isLoading && tracks.length === 0) {
      return <div className="p-10 text-center text-zinc-500">Loading beats...</div>;
  }

  return (
    <div className="p-4 pb-32">
      <header className="flex justify-between items-center mb-4 mt-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
          MoriMusic
        </h1>
        <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5">
          <button 
            onClick={() => setFilter('new')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === 'new' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
          >
            New
          </button>
          <button 
            onClick={() => setFilter('hot')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === 'hot' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
          >
            Hot
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
            <Search size={18} />
        </div>
        <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks, artists, genres..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-violet-500 outline-none transition-all placeholder:text-zinc-600"
        />
      </div>

      <div className="space-y-2">
        {sortedTracks.map(track => (
          <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={onOpenProfile} />
        ))}
        {sortedTracks.length === 0 && (
            <div className="text-center py-20 text-zinc-600">
                {searchQuery ? "No tracks found for that search." : "No tracks found. Upload the first one!"}
            </div>
        )}
      </div>
    </div>
  );
};

export default Feed;