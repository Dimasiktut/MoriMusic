
import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { Heart, MessageCircle, Play, MoreVertical, Link, BadgeCheck, Trash2, Send, Loader2, Download, ListPlus, X } from './ui/Icons';
import { useStore } from '../services/store';
import { TELEGRAM_APP_LINK } from '../constants';

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onOpenProfile?: (userId: number) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, onOpenProfile }) => {
  const { currentUser, toggleLike, deleteTrack, addComment, downloadTrack, addToPlaylist, myPlaylists, t, language } = useStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showMenu, setShowMenu] = useState(false);
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowPlaylistSelector(false);
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

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await addComment(track.id, commentText.trim());
      setCommentText('');
    } finally {
      setIsSubmitting(false);
    }
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

  const handleAddToPlaylist = (e: React.MouseEvent, playlistId: string) => {
      e.stopPropagation();
      addToPlaylist(track.id, playlistId);
      setShowPlaylistSelector(false);
      setShowMenu(false);
  };

  const isOwner = currentUser?.id === track.uploaderId;

  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-[1.5rem] p-3.5 shadow-sm hover:border-sky-500/30 transition-all group relative">
      <div className="flex gap-4">
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-zinc-800 flex-shrink-0 cursor-pointer shadow-lg" onClick={() => onPlay(track)}>
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                <Play size={16} className="text-black ml-0.5" fill="currentColor"/>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1">
                    <h3 className="text-white text-sm font-black truncate tracking-tight mb-0.5 uppercase italic">{track.title}</h3>
                    <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-medium cursor-pointer hover:text-sky-400 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onOpenProfile && onOpenProfile(track.uploaderId); }}>
                        <span className="truncate">{track.uploaderName}</span>
                        {track.isVerifiedUploader && <BadgeCheck size={12} className="text-sky-400" />}
                    </div>
                </div>
                
                <div className="relative" ref={menuRef}>
                    <button className="text-zinc-600 p-1.5 hover:text-white transition-colors" onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}>
                        <MoreVertical size={18} />
                    </button>
                    {showMenu && (
                        <div className="absolute right-0 top-8 bg-black border border-white/10 rounded-2xl shadow-2xl py-1.5 z-20 w-48 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                             <button onClick={handleShare} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-white hover:bg-sky-500 hover:text-black flex items-center gap-3 transition-colors">
                                <Link size={14} /> {isCopied ? t('track_copied') : t('track_share')}
                             </button>
                             
                             <button onClick={(e) => { e.stopPropagation(); setShowPlaylistSelector(true); }} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-white hover:bg-sky-500 hover:text-black flex items-center gap-3 transition-colors">
                                <ListPlus size={14} /> {t('track_add_playlist')}
                             </button>

                             <button onClick={(e) => { e.stopPropagation(); downloadTrack(track); }} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-white hover:bg-sky-500 hover:text-black flex items-center gap-3 transition-colors">
                                <Download size={14} /> {t('track_download')}
                             </button>

                             {isOwner && (
                                <button onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }} className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-3 transition-colors">
                                    <Trash2 size={14} /> {t('track_delete')}
                                </button>
                             )}
                        </div>
                    )}

                    {/* Playlist Selector Overlay */}
                    {showPlaylistSelector && (
                        <div className="absolute right-0 top-8 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl p-3 z-30 w-56 backdrop-blur-2xl animate-in slide-in-from-right-4 duration-300">
                             <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5">
                                 <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">{t('profile_playlists')}</span>
                                 <button onClick={(e) => { e.stopPropagation(); setShowPlaylistSelector(false); }} className="text-zinc-600 hover:text-white"><X size={14}/></button>
                             </div>
                             <div className="space-y-1.5 max-h-40 overflow-y-auto no-scrollbar">
                                 {myPlaylists.length > 0 ? myPlaylists.map(p => (
                                     <button 
                                        key={p.id} 
                                        onClick={(e) => handleAddToPlaylist(e, p.id)}
                                        className="w-full text-left p-2 rounded-xl text-[10px] font-bold text-white hover:bg-sky-500/10 hover:text-sky-400 transition-all truncate"
                                     >
                                         {p.title}
                                     </button>
                                 )) : (
                                     <div className="text-[8px] font-bold text-zinc-700 text-center py-4 uppercase">{t('profile_no_playlists')}</div>
                                 )}
                             </div>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
               <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">{track.genre}</span>
               <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{new Date(track.createdAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}</span>
            </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/5">
        <div className="flex items-center gap-6">
            <button onClick={handleLike} className={`flex items-center gap-1.5 text-[11px] font-bold transition-all ${track.isLikedByCurrentUser ? 'text-sky-400' : 'text-zinc-500 hover:text-white'}`}>
                <Heart size={16} fill={track.isLikedByCurrentUser ? "currentColor" : "none"} className={isLiking ? 'scale-125' : ''}/>
                <span>{track.likes}</span>
            </button>
            <button onClick={() => setShowComments(!showComments)} className={`flex items-center gap-1.5 text-[11px] font-bold transition-colors ${showComments ? 'text-sky-400' : 'text-zinc-500 hover:text-white'}`}>
                <MessageCircle size={16} /><span>{track.comments?.length || 0}</span>
            </button>
        </div>
        <div className="text-[9px] font-black uppercase text-zinc-600 tracking-tighter">{track.plays.toLocaleString()} {t('track_plays')}</div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-3.5 pt-3.5 border-t border-white/5 space-y-3 animate-in slide-in-from-top-2 duration-300">
          <form onSubmit={handleCommentSubmit} className="relative">
            <input 
              type="text" 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('track_comment_placeholder')}
              className="w-full bg-black/50 border border-white/5 rounded-xl py-2.5 pl-4 pr-10 text-xs text-white focus:ring-1 focus:ring-sky-500 outline-none transition-all placeholder:text-zinc-600"
            />
            <button 
              type="submit" 
              disabled={!commentText.trim() || isSubmitting}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-sky-400 disabled:opacity-30 hover:text-white transition-colors"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>

          <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {track.comments && track.comments.length > 0 ? (
              track.comments.map((comment) => (
                <div key={comment.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/10">
                    {comment.avatar ? <img src={comment.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-sky-500 flex items-center justify-center text-[9px] font-bold text-black uppercase italic">{comment.username[0]}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-white uppercase italic tracking-wider">{comment.username}</span>
                      <span className="text-[7px] font-bold text-zinc-600 uppercase">{new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">{comment.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-[9px] font-black uppercase text-zinc-600 py-2 italic">{t('track_no_comments')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackCard;
