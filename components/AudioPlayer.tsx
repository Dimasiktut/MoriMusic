
import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { Play, Pause, X, Music, SkipForward, SkipBack } from './ui/Icons';
import { useStore } from '../services/store';

interface AudioPlayerProps {
  track: Track | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onOpenProfile?: (userId: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ track, onClose, onOpenProfile, onNext, onPrev }) => {
  const { recordListen } = useStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCountedListen, setHasCountedListen] = useState(false);

  useEffect(() => {
    if (track && audioRef.current) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Playback failed", e));
      setHasCountedListen(false);
    } else {
        setIsPlaying(false);
    }
  }, [track]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      setProgress((current / total) * 100);
      if (!hasCountedListen && total > 0 && track && current > 30) {
          setHasCountedListen(true);
          recordListen(track.id);
      }
    }
  };

  if (!track) return null;

  return (
    <div className="fixed bottom-[90px] left-0 right-0 px-5 pb-2 z-40 animate-in slide-in-from-bottom-10 duration-500">
      <div className="glass border border-white/10 rounded-[2.5rem] p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
        
        {/* Sky Blue Progress */}
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden cursor-pointer relative z-10" 
             onClick={(e) => {
                if(!audioRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                audioRef.current.currentTime = (x / rect.width) * audioRef.current.duration;
             }}>
          <div 
            className="h-full bg-sky-400 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(56,189,248,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4 overflow-hidden flex-1">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden shadow-lg">
                {track.coverUrl ? (
                    <img src={track.coverUrl} alt="cover" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600"><Music size={20} /></div>
                )}
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-black text-white truncate uppercase tracking-tight italic">{track.title}</span>
                <span 
                    className="text-xs font-bold text-zinc-500 truncate hover:text-sky-400 cursor-pointer transition-colors"
                    onClick={() => onOpenProfile && onOpenProfile(track.uploaderId)}
                >
                    {track.uploaderName}
                </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Neon Blue Visualizer */}
             <div className="hidden xs:flex items-end gap-1 h-5 w-8 mr-2">
                 <div className={`w-1.5 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)] ${isPlaying ? 'animate-music-bar-1' : 'h-[20%]'}`}></div>
                 <div className={`w-1.5 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)] ${isPlaying ? 'animate-music-bar-2' : 'h-[50%]'}`}></div>
                 <div className={`w-1.5 bg-sky-400 rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)] ${isPlaying ? 'animate-music-bar-3' : 'h-[30%]'}`}></div>
             </div>
             
             <div className="flex items-center gap-2">
                <button onClick={onPrev} className="text-zinc-500 hover:text-white p-1 transition-colors">
                    <SkipBack size={24} fill="currentColor" />
                </button>

                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-transform"
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1"/>}
                </button>

                <button onClick={onNext} className="text-zinc-500 hover:text-white p-1 transition-colors">
                    <SkipForward size={24} fill="currentColor" />
                </button>
             </div>

             <button onClick={onClose} className="text-zinc-600 hover:text-white p-1 ml-2">
                 <X size={24} />
             </button>
          </div>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onNext}
      />
    </div>
  );
};

export default AudioPlayer;
