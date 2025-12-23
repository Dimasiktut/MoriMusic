
import React, { useState } from 'react';
import { useStore } from '../services/store';
import TrackCard from '../components/TrackCard';
import { Track } from '../types';
import { Search } from '../components/ui/Icons';
import { TrackSkeleton } from '../components/ui/Skeleton';

interface FeedProps {
  onPlayTrack: (track: Track) => void;
  onOpenProfile: (userId: number) => void;
}

const Feed: React.FC<FeedProps> = ({ onPlayTrack, onOpenProfile }) => {
  const { tracks, isLoading, t } = useStore();
  const [filter, setFilter] = useState<'new' | 'hot'>('new');
  const [searchQuery, setSearchQuery] = useState('');

  const searchedTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.uploaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.genre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedTracks = [...searchedTracks].sort((a, b) => {
    if (filter === 'new') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return (b.likes + b.plays) - (a.likes + a.plays);
  });

  return (
    <div className="p-5 pb-32">
      <header className="flex justify-between items-center mb-10 mt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tighter text-white uppercase italic">MORI</h1>
          <h1 className="text-2xl font-black tracking-tighter text-sky-400 uppercase">MUSIC</h1>
        </div>

        <div className="flex bg-zinc-900/50 rounded-2xl p-1 border border-white/5 backdrop-blur-md h-fit">
          <button 
            onClick={() => setFilter('new')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === 'new' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-500'}`}
          >
            {t('feed_new')}
          </button>
          <button 
            onClick={() => setFilter('hot')}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === 'hot' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-500'}`}
          >
            {t('feed_hot')}
          </button>
        </div>
      </header>

      {/* Modern Search Bar */}
      <div className="relative mb-8">
        <div className="absolute left-4 top-4 text-sky-400 pointer-events-none">
            <Search size={20} />
        </div>
        <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('feed_search_placeholder')}
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-sm text-white focus:ring-2 focus:ring-sky-400/50 outline-none transition-all placeholder:text-zinc-600 shadow-inner"
        />
      </div>

      <div className="space-y-4">
        {isLoading && tracks.length === 0 ? (
            <>
                <TrackSkeleton />
                <TrackSkeleton />
                <TrackSkeleton />
            </>
        ) : (
            <>
                {sortedTracks.map(track => (
                    <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={onOpenProfile} />
                ))}
                {sortedTracks.length === 0 && (
                    <div className="text-center py-20 text-zinc-600 font-medium">
                        {searchQuery ? t('feed_no_results') : t('feed_empty')}
                    </div>
                )}
            </>
        )}
      </div>
    </div>
  );
};

export default Feed;
