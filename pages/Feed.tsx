import React, { useState } from 'react';
import { useStore } from '../services/store';
import TrackCard from '../components/TrackCard';
import { Track } from '../types';

interface FeedProps {
  onPlayTrack: (track: Track) => void;
}

const Feed: React.FC<FeedProps> = ({ onPlayTrack }) => {
  const { tracks } = useStore();
  const [filter, setFilter] = useState<'new' | 'hot'>('new');

  const sortedTracks = [...tracks].sort((a, b) => {
    if (filter === 'new') {
      return b.createdAt - a.createdAt;
    }
    return (b.likes + b.plays) - (a.likes + a.plays);
  });

  return (
    <div className="p-4 pb-32">
      <header className="flex justify-between items-center mb-6 mt-2">
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

      <div className="space-y-2">
        {sortedTracks.map(track => (
          <TrackCard key={track.id} track={track} onPlay={onPlayTrack} />
        ))}
        {sortedTracks.length === 0 && (
            <div className="text-center py-20 text-zinc-600">
                No tracks found.
            </div>
        )}
      </div>
    </div>
  );
};

export default Feed;