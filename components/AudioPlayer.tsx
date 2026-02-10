
import React, { useEffect, useRef, useState } from 'react';
import { Track } from '../types';
import { Play, Pause, X, Music, SkipForward, SkipBack, AlignLeft } from './ui/Icons';
import { useStore, useVisuals } from '../services/store';

interface AudioPlayerProps {
  track: Track | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onOpenProfile?: (userId: number) => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ track, onClose, onOpenProfile, onNext, onPrev }) => {
  const { recordListen, t } = useStore();
  const { setAudioIntensity, setAudioAnalyser } = useVisuals();
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCountedListen, setHasCountedListen] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);

  // Handle Track Changes & Playback
  useEffect(() => {
    let isSubscribed = true;
    const audio = audioRef.current;

    if (track && audio) {
      // Don't re-set src if it's already playing this track
      if (audio.src !== track.audioUrl) {
        audio.src = track.audioUrl;
        audio.crossOrigin = "anonymous";
        audio.load();
      }

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (isSubscribed) setIsPlaying(true);
          })
          .catch(error => {
            // Auto-play might be blocked or interrupted by track change
            if (error.name !== 'AbortError') {
              console.error("Playback error:", error);
            }
          });
      }
      
      setHasCountedListen(false);
      setShowLyrics(false);
    } else {
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      setIsPlaying(false);
      setAudioIntensity(0);
      setShowLyrics(false);
    }

    return () => {
      isSubscribed = false;
    };
  }, [track, setAudioIntensity]);

  // Handle Visualizer Setup
  useEffect(() => {
    if (isPlaying && audioRef.current && !audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        
        try {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          setAudioAnalyser(analyserRef.current);
        } catch (e) {
          console.warn("AudioContext source already connected");
        }
    }

    let animationFrame: number;
    const bufferLength = analyserRef.current?.frequencyBinCount || 0;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const intensity = sum / (bufferLength * 255);
        setAudioIntensity(intensity);

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * height;
            ctx.fillStyle = `rgba(56, 189, 248, ${0.1 + (dataArray[i]/255) * 0.4})`;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }

        animationFrame = requestAnimationFrame(renderFrame);
    };

    if (isPlaying) {
        renderFrame();
    } else {
        setAudioIntensity(0);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, setAudioIntensity, setAudioAnalyser]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const total = audioRef.current.duration;
      if (total) {
        setProgress((current / total) * 100);
      }
      if (!hasCountedListen && total > 0 && track && current > 30) {
          setHasCountedListen(true);
          recordListen(track.id);
      }
    }
  };

  if (!track) return null;

  return (
    <>
      {showLyrics && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-3xl animate-in slide-in-from-bottom-full duration-500 flex flex-col p-8 pt-safe">
            <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-4">
                    <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                    <div>
                        <h4 className="text-white font-black uppercase italic tracking-tighter truncate max-w-[200px]">{track.title}</h4>
                        <p className="text-zinc-500 text-[10px] font-bold uppercase">{track.uploaderName}</p>
                    </div>
                </div>
                <button onClick={() => setShowLyrics(false)} className="p-3 bg-white/5 rounded-full text-white border border-white/10">
                    <X size={24} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                <p className="text-white text-2xl font-black uppercase italic leading-loose tracking-tight whitespace-pre-wrap">
                    {track.lyrics || t('track_no_lyrics')}
                </p>
            </div>
        </div>
      )}

      <div className="fixed bottom-[90px] left-0 right-0 px-5 pb-2 z-40 animate-in slide-in-from-bottom-10 duration-500">
        <div className="glass border border-white/10 rounded-[2.5rem] p-4 shadow-2xl flex flex-col gap-3 relative overflow-hidden">
          
          <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full opacity-30 pointer-events-none"
            width={400} 
            height={100}
          />

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
                  <div className="flex items-center gap-2">
                    <span 
                        className="text-xs font-bold text-zinc-500 truncate hover:text-sky-400 cursor-pointer transition-colors"
                        onClick={() => onOpenProfile && onOpenProfile(track.uploaderId)}
                    >
                        {track.uploaderName}
                    </span>
                    {track.lyrics && (
                      <button 
                          onClick={() => setShowLyrics(true)}
                          className="p-1 bg-white/5 rounded-md text-sky-400 hover:text-white transition-all flex items-center gap-1"
                      >
                          <AlignLeft size={10} />
                          <span className="text-[8px] font-black uppercase tracking-widest">TXT</span>
                      </button>
                    )}
                  </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
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
    </>
  );
};

export default AudioPlayer;
