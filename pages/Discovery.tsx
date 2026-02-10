
import React, { useState } from 'react';
import { useStore } from '../services/store';
import { Track } from '../types';
import TrackCard from '../components/TrackCard';
import { Sparkles, Search, Mic, Loader2, Zap, Play } from '../components/ui/Icons';
import AuraEffect from '../components/AuraEffect';

interface DiscoveryProps {
  onPlayTrack: (track: Track) => void;
  onOpenProfile: (userId: number) => void;
}

const Discovery: React.FC<DiscoveryProps> = ({ onPlayTrack, onOpenProfile }) => {
  const { aiMoodSearch, t, tracks } = useStore();
  const [moodPrompt, setMoodPrompt] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const quickVibes = [
    { label: 'Night Drive', icon: '🚗', prompt: 'dark slow phonk for night driving' },
    { label: 'Gym Mode', icon: '💪', prompt: 'high energy aggressive hard phonk' },
    { label: 'Study Lo-Fi', icon: '📚', prompt: 'chill relaxing lo-fi beats' },
    { label: 'Tokyo Drift', icon: '🏎️', prompt: 'fast japanese style phonk' },
  ];

  const handleSearch = async (prompt?: string) => {
    const query = prompt || moodPrompt;
    if (!query.trim()) return;
    
    setIsSearching(true);
    const matched = await aiMoodSearch(query);
    setResults(matched);
    setIsSearching(false);
  };

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US, ru-RU';
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMoodPrompt(transcript);
      handleSearch(transcript);
    };

    if (isListening) recognition.stop();
    else recognition.start();
  };

  return (
    <div className="p-5 pb-32 animate-in fade-in">
      <header className="mb-10 mt-6 text-center relative overflow-hidden p-8 rounded-[3rem] bg-zinc-950 border border-white/5 shadow-2xl">
        <AuraEffect vibe="electronic" />
        <div className="relative z-10">
          <div className="w-16 h-16 bg-sky-500 text-black rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(56,189,248,0.4)]">
            <Sparkles size={32} />
          </div>
          <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">{t('discovery_title')}</h1>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-2 opacity-70">{t('discovery_subtitle')}</p>
        </div>
      </header>

      <div className="space-y-8">
        {/* Mood Input */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-purple-600 rounded-[2rem] blur opacity-10 group-focus-within:opacity-30 transition duration-500"></div>
          <div className="relative bg-zinc-900 border border-white/10 rounded-[2rem] p-2 flex gap-2 shadow-inner">
            <input 
              type="text" 
              value={moodPrompt}
              onChange={(e) => setMoodPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('discovery_placeholder')}
              className="flex-1 bg-transparent border-none px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600"
            />
            <button 
              onClick={toggleVoice}
              className={`p-4 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-zinc-500 hover:text-sky-400'}`}
            >
              <Mic size={20} />
            </button>
            <button 
              onClick={() => handleSearch()}
              disabled={isSearching || !moodPrompt.trim()}
              className="bg-sky-500 text-black p-4 rounded-2xl font-black shadow-lg shadow-sky-500/20 active:scale-95 transition-all disabled:opacity-20"
            >
              {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} fill="currentColor"/>}
            </button>
          </div>
        </div>

        {/* Quick Tags */}
        <section>
          <h3 className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] mb-4 flex items-center gap-2">
            <Sparkles size={12} /> {t('discovery_tags_title')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickVibes.map((vibe) => (
              <button 
                key={vibe.label}
                onClick={() => handleSearch(vibe.prompt)}
                className="bg-zinc-900/40 border border-white/5 p-4 rounded-2xl flex items-center gap-3 active:scale-95 transition-all hover:bg-zinc-900"
              >
                <span className="text-xl">{vibe.icon}</span>
                <span className="text-[10px] font-black uppercase text-white tracking-widest">{vibe.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* AI Results */}
        <section className="space-y-4">
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="animate-spin text-sky-400 mb-4" size={32} />
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.3em]">{t('discovery_ai_thinking')}</p>
            </div>
          )}

          {results.length > 0 && !isSearching && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-5">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Mori AI Picked</h3>
                 <button onClick={() => setResults([])} className="text-zinc-600 text-[10px] font-black uppercase">Clear</button>
              </div>
              {results.map(track => (
                <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={onOpenProfile} />
              ))}
            </div>
          )}

          {!isSearching && results.length === 0 && moodPrompt && (
             <div className="text-center py-10 opacity-40">
                <p className="text-zinc-500 text-xs font-bold">{t('discovery_empty')}</p>
             </div>
          )}
        </section>

        {/* Trending Vibes */}
        {!results.length && !isSearching && (
            <section className="pt-4">
                <h3 className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.2em] mb-4">Trending Now</h3>
                <div className="grid grid-cols-1 gap-4">
                    {tracks.slice(0, 3).map(track => (
                        <div 
                          key={track.id}
                          onClick={() => onPlayTrack(track)}
                          className="group bg-zinc-900/20 border border-white/5 rounded-3xl p-4 flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img src={track.coverUrl} className="w-16 h-16 rounded-2xl object-cover relative z-10" alt=""/>
                            <div className="flex-1 min-w-0 relative z-10">
                                <h4 className="text-white font-black uppercase italic truncate">{track.title}</h4>
                                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{track.genre}</p>
                            </div>
                            <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-sky-400 group-hover:bg-sky-400 group-hover:text-black transition-all">
                                <Play size={16} fill="currentColor" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}
      </div>
    </div>
  );
};

export default Discovery;
