import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { Play, Pause, X, Music } from './ui/Icons';
import { useStore } from '../services/store';

interface AudioPlayerProps {
  track: Track | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onOpenProfile?: (userId: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ track, onClose, onOpenProfile }) => {
  const { recordListen } = useStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // State for counting plays
  const [hasCountedListen, setHasCountedListen] = useState(false);

  useEffect(() => {
    if (track && audioRef.current) {
      audioRef.current.src = track.audioUrl;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Playback failed", e));
      
      // Reset listen counter for new track
      setHasCountedListen(false);
    } else {
        setIsPlaying(false);
    }
  }, [track]); // Removed recordListen from deps to avoid loop

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
      setDuration(total);

      // --- LISTEN COUNTING LOGIC ---
      if (!hasCountedListen && total > 0 && track) {
          const playedLongEnough = current > 30;
          const playedSignificantPortion = (current / total) > 0.30;

          if (playedLongEnough || playedSignificantPortion) {
              setHasCountedListen(true);
              recordListen(track.id);
          }
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!track) return null;

  return (
    <div className="fixed bottom-[80px] left-0 right-0 px-4 pb-2 z-40">
      <div className="bg-zinc-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl flex flex-col gap-2">
        {/* Progress Bar */}
        <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden cursor-pointer" 
             onClick={(e) => {
                if(!audioRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percent = x / rect.width;
                audioRef.current.currentTime = percent * audioRef.current.duration;
             }}>
          <div 
            className="h-full bg-violet-500 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden relative">
                {track.coverUrl ? (
                    <img src={track.coverUrl} alt="cover" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600"><Music size={16} /></div>
                )}
            </div>
            <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-semibold text-white truncate">{track.title}</span>
                <span 
                    className="text-xs text-zinc-400 truncate hover:text-violet-400 cursor-pointer transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenProfile && onOpenProfile(track.uploaderId);
                    }}
                >
                    {track.uploaderName}
                </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <span className="text-xs text-zinc-500 font-mono">
                 {formatTime(audioRef.current?.currentTime || 0)} / {formatTime(duration)}
             </span>
             
             <button 
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform"
             >
                {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5"/>}
             </button>

             <button onClick={onClose} className="text-zinc-500 hover:text-white p-2">
                 <X size={20} />
             </button>
          </div>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      />
    </div>
  );
};

export default AudioPlayer;