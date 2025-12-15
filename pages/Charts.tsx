import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { Track } from '../types';
import { Play } from '../components/ui/Icons';
import { Loader2 } from 'lucide-react';

interface ChartsProps {
  onPlayTrack: (track: Track) => void;
}

const Charts: React.FC<ChartsProps> = ({ onPlayTrack }) => {
  const { getChartTracks } = useStore();
  const [chartType, setChartType] = useState<'week' | 'month'>('week');
  const [chartTracks, setChartTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCharts = async () => {
        setLoading(true);
        const data = await getChartTracks(chartType);
        setChartTracks(data);
        setLoading(false);
    };
    loadCharts();
  }, [chartType, getChartTracks]);

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
        {loading ? (
            <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-violet-500" size={32} />
            </div>
        ) : chartTracks.length === 0 ? (
            <div className="text-center text-zinc-500 py-10">
                Not enough data for this period yet.
            </div>
        ) : (
            chartTracks.map((track, index) => (
            <div 
                key={track.id} 
                className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-xl active:bg-zinc-800 transition-colors cursor-pointer border border-transparent hover:border-white/5"
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
                <p className="text-zinc-500 text-xs truncate">
                    {track.uploaderName} • {track.plays.toLocaleString()} plays (total)
                </p>
                </div>

                <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
                <Play size={14} fill="currentColor" className="ml-0.5" />
                </button>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Charts;