import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Track } from '../types';
import { Play } from '../components/ui/Icons';

interface ChartsProps {
  onPlayTrack: (track: Track) => void;
}

const Charts: React.FC<ChartsProps> = ({ onPlayTrack }) => {
  const { tracks } = useStore();
  const [chartType, setChartType] = useState<'week' | 'month'>('week');

  // Simple mocking of time filtering. In a real app, we'd check timestamps.
  // Here we just shuffle/sort slightly differently to simulate different charts.
  const chartTracks = [...tracks].sort((a, b) => {
    const scoreA = a.likes * 2 + a.plays;
    const scoreB = b.likes * 2 + b.plays;
    return scoreB - scoreA;
  }).slice(0, 10);

  return (
    <div className="p-4 pb-32">
      <h1 className="text-2xl font-bold text-white mb-6 mt-2">Top Charts</h1>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 mb-6">
        <button
          onClick={() => setChartType('week')}
          className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${chartType === 'week' ? 'text-violet-400' : 'text-zinc-500'}`}
        >
          Top of Week
          {chartType === 'week' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
        </button>
        <button
          onClick={() => setChartType('month')}
          className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${chartType === 'month' ? 'text-violet-400' : 'text-zinc-500'}`}
        >
          Top of Month
          {chartType === 'month' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
        </button>
      </div>

      {/* Ranking List */}
      <div className="space-y-4">
        {chartTracks.map((track, index) => (
          <div 
            key={track.id} 
            className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-xl active:bg-zinc-800 transition-colors cursor-pointer"
            onClick={() => onPlayTrack(track)}
          >
            <div className={`w-6 text-center font-bold text-lg ${index < 3 ? 'text-yellow-500' : 'text-zinc-600'}`}>
              {index + 1}
            </div>
            
            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
              <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium truncate">{track.title}</h4>
              <p className="text-zinc-500 text-xs truncate">{track.uploaderName} • {track.likes} likes</p>
            </div>

            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
              <Play size={14} fill="currentColor" className="ml-0.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Charts;