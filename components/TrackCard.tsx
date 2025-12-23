
import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { Heart, MessageCircle, Play, MoreVertical, Link, BadgeCheck, Trash2 } from './ui/Icons';
import { useStore } from '../services/store';
import { TELEGRAM_APP_LINK } from '../constants';

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onOpenProfile?: (userId: number) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, onOpenProfile }) => {
  const { currentUser, toggleLike, deleteTrack, t, language } = useStore();
  const [showComments, setShowComments] = useState(false);
  
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiking(true);
    setTimeout(() => setIsLiking(false), 400); 
    toggleLike(track.id);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const deepLink = `${TELEGRAM_APP_LINK}?startapp=track_${track.id}`;
    const shareText = `${t('track_listen_text')} ${track.title} ${t('track_by')} ${track.uploaderName} — MORI MUSIC 🎧`;
    
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg?.initData && typeof tg.openTelegramLink === 'function') {
         tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`);
    } else {
        navigator.clipboard.writeText(deepLink).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    }
  };

  const isOwner = currentUser?.id === track.uploaderId;

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-[2rem] p-5 shadow-sm hover:border-sky-500/30 transition-all group relative">
      <div className="flex gap-5">
        <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-zinc-800 flex-shrink-0 cursor-pointer shadow-2xl" onClick={() => onPlay(track)}>
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Play size={20} className="text-black ml-1" fill="currentColor"/>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                    <h3 className="text-white text-lg font-black truncate tracking-tight mb-0.5 uppercase italic">{track.title}</h3>
                    <div className="flex items-center gap-1.5 text-zinc-400 text-sm font-medium cursor-pointer hover:text-sky-400 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(track.uploaderId); }}>
                        <span className="truncate">{track.uploaderName}</span>
                        {track.isVerifiedUploader && <BadgeCheck size={16} className="text-sky-400" />}
                    </div>
                </div>
                
                <div className="relative" ref={menuRef}>
                    <button className="text-zinc-600 p-2 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
                        <MoreVertical size={20} />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-10 bg-black border border-white/10 rounded-2xl shadow-2xl py-2 z-20 w-48 overflow-hidden backdrop-blur-xl">
                             <button onClick={handleShare} className="w-full text-left px-4 py-3 text-xs font-bold text-white hover:bg-sky-500 hover:text-black flex items-center gap-3 transition-colors">
                                <Link size={16} /> {isCopied ? t('track_copied') : t('track_share')}
                             </button>
                             {isOwner && (
                                <button onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                    <Trash2 size={16} /> {t('track_delete')}
                                </button>
                             )}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-3 mt-3">
               <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">{track.genre}</span>
               <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{new Date(track.createdAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}</span>
            </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
        <div className="flex items-center gap-8">
            <button onClick={handleLike} className={`flex items-center gap-2 text-sm font-bold transition-all ${track.isLikedByCurrentUser ? 'text-sky-400' : 'text-zinc-500 hover:text-white'}`}>
                <Heart size={20} fill={track.isLikedByCurrentUser ? "currentColor" : "none"} className={isLiking ? 'scale-125' : ''}/>
                <span>{track.likes}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-zinc-500 hover:text-white transition-colors">
                <MessageCircle size={20} /><span>{track.comments?.length || 0}</span>
            </button>
        </div>
        <div className="text-[10px] font-black uppercase text-zinc-600 tracking-tighter">{track.plays.toLocaleString()} {t('track_plays')}</div>
      </div>
    </div>
  );
};

export default TrackCard;
