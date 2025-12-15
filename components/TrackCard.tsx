import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { Heart, MessageCircle, Play, MoreVertical, Share2, Trash2, Check, Link } from './ui/Icons';
import { useStore } from '../services/store';
import { TELEGRAM_APP_LINK } from '../constants';

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onOpenProfile?: (userId: number) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, onOpenProfile }) => {
  const { currentUser, toggleLike, addComment, deleteTrack } = useStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
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
    toggleLike(track.id);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(track.id, commentText);
    setCommentText('');
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this track? This cannot be undone.")) {
        await deleteTrack(track.id);
    }
    setShowMenu(false);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const deepLink = `${TELEGRAM_APP_LINK}`;
    const shareText = `Слушать мой трек название: ${track.title} Автор: ${track.uploaderName} on MoriMusic 🎧`;
    
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    
    // Check if running inside Telegram
    // Enhanced check: initData, platform, or UserAgent to strictly catch Android WebView environment
    const isTelegram = (tg && (tg.initData || tg.platform !== 'unknown')) || 
                       (navigator.userAgent && navigator.userAgent.includes('Telegram'));

    const copyToClipboard = () => {
        navigator.clipboard.writeText(deepLink).then(() => {
            setIsCopied(true);
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.notificationOccurred('success');
            }
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => {
            console.error("Clipboard failed", err);
        });
    };

    // 1. Inside Telegram: Use openTelegramLink OR Clipboard. NEVER navigator.share
    if (isTelegram) {
         if (tg && typeof tg.openTelegramLink === 'function') {
             const url = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`;
             tg.openTelegramLink(url);
         } else {
             // Fallback to clipboard if openTelegramLink is missing (unlikely in WebApp)
             copyToClipboard();
         }
         setShowMenu(false);
         return;
    }

    // 2. Outside Telegram (Regular Browser): Try Native Share, then Clipboard
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'MoriMusic',
                text: shareText,
                url: deepLink
            });
            setShowMenu(false);
            return; 
        } catch (err: any) {
            console.warn("Native share failed", err);
            if (err.name !== 'AbortError') {
                copyToClipboard();
            }
        }
    } else {
        copyToClipboard();
    }
    
    setShowMenu(false);
  };

  const isOwner = currentUser?.id === track.uploaderId;

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 mb-4 shadow-sm hover:bg-zinc-800/50 transition-colors relative">
      <div className="flex gap-4">
        {/* Cover Art & Play Overlay */}
        <div 
          className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0 group cursor-pointer"
          onClick={() => onPlay(track)}
        >
          <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                <Play size={14} className="text-black ml-0.5" fill="currentColor"/>
            </div>
          </div>
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center relative">
            <div className="flex justify-between items-start">
                <div className="min-w-0 flex-1 mr-6">
                    <h3 className="text-white font-bold truncate leading-tight mb-1">{track.title}</h3>
                    <p 
                        className="text-zinc-400 text-sm truncate cursor-pointer hover:text-violet-400 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenProfile && onOpenProfile(track.uploaderId);
                        }}
                    >
                        {track.uploaderName}
                    </p>
                </div>
                
                {/* Menu Button */}
                <div className="absolute top-0 right-0" ref={menuRef}>
                    <button 
                        className="text-zinc-500 p-1 hover:text-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                    >
                        <MoreVertical size={16} />
                    </button>
                    
                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="absolute right-0 top-6 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl py-1 z-10 w-36 animate-in fade-in zoom-in-95 duration-100">
                             <button 
                                onClick={handleShare}
                                className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 flex items-center gap-2"
                             >
                                {isCopied ? <Check size={12} className="text-green-500"/> : <Link size={12} />}
                                {isCopied ? "Copied!" : "Share Track"}
                             </button>
                             {isOwner && (
                                <button 
                                    onClick={handleDelete}
                                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-zinc-700 flex items-center gap-2"
                                >
                                    <Trash2 size={12} /> Delete
                                </button>
                             )}
                        </div>
                    )}
                </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
               <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
                 {track.genre}
               </span>
               <span className="text-xs text-zinc-600">
                  {new Date(track.createdAt).toLocaleDateString()}
               </span>
            </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-6">
            <button 
                onClick={handleLike}
                className={`flex items-center gap-1.5 text-sm transition-colors ${track.isLikedByCurrentUser ? 'text-red-500' : 'text-zinc-400 hover:text-white'}`}
            >
                <Heart size={18} fill={track.isLikedByCurrentUser ? "currentColor" : "none"} />
                <span>{track.likes}</span>
            </button>
            
            <button 
                onClick={() => setShowComments(!showComments)}
                className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
                <MessageCircle size={18} />
                <span>{track.comments?.length || 0}</span>
            </button>
            
             <button 
                onClick={handleShare}
                className={`text-zinc-400 hover:text-white transition-colors ${isCopied ? 'text-green-500' : ''}`}
             >
                {isCopied ? <Check size={18} /> : <Share2 size={18} />}
            </button>
        </div>
        
        <div className="text-xs text-zinc-500">
            {track.plays.toLocaleString()} plays
        </div>
      </div>

      {/* Inline Comments Section */}
      {showComments && (
        <div className="mt-4 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-3 max-h-40 overflow-y-auto mb-3 custom-scrollbar">
                {(!track.comments || track.comments.length === 0) ? (
                    <p className="text-center text-xs text-zinc-600 italic">No comments yet. Be the first!</p>
                ) : (
                    track.comments.map(c => (
                        <div key={c.id} className="flex gap-2 text-xs">
                             <div className="font-bold text-zinc-300">{c.username}</div>
                             <div className="text-zinc-400">{c.text}</div>
                        </div>
                    ))
                )}
            </div>
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input 
                    type="text" 
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-zinc-800 border-none rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-violet-500 outline-none"
                />
                <button type="submit" disabled={!commentText.trim()} className="text-violet-500 font-medium text-sm px-2 disabled:opacity-50">
                    Post
                </button>
            </form>
        </div>
      )}
    </div>
  );
};

export default TrackCard;