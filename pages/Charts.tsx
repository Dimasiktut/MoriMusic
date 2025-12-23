
import React, { useState, useEffect } from 'react';
import { useStore } from '../services/store';
import { Track } from '../types';
import { Play } from '../components/ui/Icons';
import { Loader2 } from 'lucide-react';

interface ChartsProps {
  onPlayTrack: (track: Track) => void;
}

const Charts: React.FC<ChartsProps> = ({ onPlayTrack }) => {
  const { getChartTracks, t } = useStore();
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
    <div className="p-5 pb-32">
      <h1 className="text-3xl font-black text-white mb-6 mt-4 uppercase italic tracking-tighter">{t('charts_title')}</h1>

      {/* Tabs */}
      <div className="flex border-b border-white/5 mb-8">
        <button
          onClick={() => setChartType('week')}
          className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest transition-colors relative ${chartType === 'week' ? 'text-sky-400' : 'text-zinc-600'}`}
        >
          {t('charts_week')}
          {chartType === 'week' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-t-full shadow-[0_-5px_15px_rgba(56,189,248,0.4)]" />}
        </button>
        <button
          onClick={() => setChartType('month')}
          className={`flex-1 pb-4 text-xs font-black uppercase tracking-widest transition-colors relative ${chartType === 'month' ? 'text-sky-400' : 'text-zinc-600'}`}
        >
          {t('charts_month')}
          {chartType === 'month' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-t-full shadow-[0_-5px_15px_rgba(56,189,248,0.4)]" />}
        </button>
      </div>

      {/* Ranking List */}
      <div className="space-y-3">
        {loading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-sky-400" size={32} />
            </div>
        ) : chartTracks.length === 0 ? (
            <div className="text-center text-zinc-600 py-10 font-bold uppercase text-xs">
                {t('charts_empty')}
            </div>
        ) : (
            chartTracks.map((track, index) => (
            <div 
                key={track.id} 
                className="flex items-center gap-4 bg-zinc-900/40 p-4 rounded-3xl active:bg-zinc-800 transition-all cursor-pointer border border-white/5 hover:border-sky-500/30 group"
                onClick={() => onPlayTrack(track)}
            >
                <div className={`w-8 text-center font-black text-xl italic ${index < 3 ? 'text-sky-400' : 'text-zinc-700'}`}>
                {index + 1}
                </div>
                
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-zinc-800 flex-shrink-0 shadow-lg">
                    <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>

                <div className="flex-1 min-w-0">
                    <h4 className="text-white font-black truncate uppercase italic tracking-tight">{track.title}</h4>
                    <p className="text-zinc-500 text-xs font-bold truncate mt-0.5">
                        {track.uploaderName} • {track.plays.toLocaleString()}
                    </p>
                </div>

                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-sky-400 group-hover:bg-sky-400 group-hover:text-black transition-all">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default Charts;
