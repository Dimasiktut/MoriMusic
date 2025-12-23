
import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { 
  Heart, MessageCircle, Play, MoreVertical, BadgeCheck, 
  Trash2, Send, Loader2, ListPlus, X, Image as ImageIcon, 
  Share2, Download, Bookmark, Zap
} from './ui/Icons';
import { useStore } from '../services/store';
import { TELEGRAM_APP_LINK } from '../constants';

interface TrackCardProps { track: Track; onPlay: (track: Track) => void; onOpenProfile?: (userId: number) => void; }

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, onOpenProfile }) => {
  const { currentUser, toggleLike, deleteTrack, addComment, addToPlaylist, myPlaylists, t, downloadTrack } = useStore();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isGeneratingSnippet, setIsGeneratingSnippet] = useState(false);
  const [snippetUrl, setSnippetUrl] = useState<string | null>(null);
  const [snippetBlob, setSnippetBlob] = useState<Blob | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track.id);
    if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('light');
  };

  const handleDownloadSnippet = () => {
    if (!snippetUrl) return;
    const link = document.createElement('a');
    link.href = snippetUrl;
    link.download = `mori_snippet_${track.title.toLowerCase().replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareSnippet = async () => {
    if (!snippetBlob) return;
    
    const file = new File([snippetBlob], "snippet.png", { type: "image/png" });
    const shareData = {
      files: [file],
      title: 'MoriMusic Snippet',
      text: `${t('track_listen_text')} ${track.title} on MoriMusic!`,
    };

    // Try native share if available (Mobile Telegram/Browsers)
    if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        console.log("Native share failed, falling back to link", err);
      }
    }

    // Fallback to link share
    const deepLink = `${TELEGRAM_APP_LINK}?startapp=track_${track.id}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(`${t('track_listen_text')} ${track.title} ${t('track_by')} ${track.uploaderName} on MoriMusic!`)}`;
    if ((window as any).Telegram?.WebApp) {
      (window as any).Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank');
    }
  };

  const generateSnippet = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingSnippet(true);
    setIsMenuOpen(false);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 1080;
      canvas.height = 1080;

      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      };

      try {
        const coverImg = await loadImage(track.coverUrl);
        ctx.filter = 'blur(60px) brightness(0.5)';
        ctx.drawImage(coverImg, -150, -150, 1380, 1380);
        ctx.filter = 'none';

        const gradient = ctx.createRadialGradient(540, 540, 200, 540, 540, 900);
        gradient.addColorStop(0, 'rgba(0,0,0,0.1)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1080);

        const coverSize = 640;
        const x = (1080 - coverSize) / 2;
        const y = 160;
        const radius = 100;

        ctx.save();
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
           ctx.roundRect(x, y, coverSize, coverSize, radius);
        } else {
           // Fallback for older browsers
           ctx.rect(x, y, coverSize, coverSize);
        }
        ctx.clip();
        ctx.drawImage(coverImg, x, y, coverSize, coverSize);
        ctx.restore();

        ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
        ctx.shadowBlur = 60;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 6;
        ctx.strokeRect(x, y, coverSize, coverSize);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'italic 900 72px system-ui';
        ctx.fillText(track.title.toUpperCase(), 540, 880);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 38px system-ui';
        ctx.fillText(track.uploaderName.toUpperCase(), 540, 940);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 32px system-ui';
        ctx.letterSpacing = '12px';
        ctx.fillText('MORIMUSIC', 540, 1020);

        canvas.toBlob((blob) => {
          if (blob) {
            setSnippetBlob(blob);
            setSnippetUrl(URL.createObjectURL(blob));
            if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
        }, 'image/png');
      } catch (err) { console.error("Canvas error", err); }
    } finally { setIsGeneratingSnippet(false); }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addComment(track.id, commentText);
    setCommentText('');
  };

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-4 mb-4 shadow-xl hover:border-white/10 transition-all group relative">
      
      {/* Snippet Modal */}
      {snippetUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-2xl p-6 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
           <div className="relative w-full aspect-square max-w-sm rounded-[3rem] overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.2)] border border-white/10">
              <img src={snippetUrl} className="w-full h-full object-cover" alt="Snippet" />
           </div>
           
           <div className="mt-8 text-center">
             <h3 className="text-white font-black text-2xl uppercase italic tracking-tighter">{t('track_share')}</h3>
             <p className="text-zinc-500 text-[10px] font-black uppercase mt-2 tracking-widest opacity-60">Ready for Telegram Stories & Chats</p>
           </div>

           <div className="grid grid-cols-2 gap-4 mt-10 w-full max-w-sm">
              <button 
                onClick={handleDownloadSnippet} 
                className="py-4 bg-zinc-800 rounded-2xl text-white font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} /> Save
              </button>
              <button 
                onClick={handleShareSnippet}
                className="py-4 bg-sky-500 rounded-2xl text-black font-black uppercase text-[10px] tracking-widest shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} /> {snippetBlob && typeof navigator.share === 'function' ? 'Share File' : 'Share Link'}
              </button>
           </div>
           <button onClick={() => setSnippetUrl(null)} className="mt-8 text-zinc-600 font-black uppercase text-[9px] tracking-[0.3em] hover:text-white transition-colors">Close Preview</button>
        </div>
      )}

      {/* Track Row */}
      <div className="flex gap-4 cursor-pointer" onClick={() => onPlay(track)}>
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden relative shadow-lg">
          {track.coverUrl ? (
            <img src={track.coverUrl} alt={track.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImageIcon size={24} /></div>
          )}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play size={24} fill="white" className="text-white" />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <h3 className="text-white font-black text-sm truncate uppercase italic tracking-tight">{track.title}</h3>
            {track.isVerifiedUploader && <BadgeCheck size={14} className="text-sky-400 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span 
              className="text-zinc-500 text-[10px] font-bold hover:text-sky-400 truncate"
              onClick={(e) => { e.stopPropagation(); onOpenProfile?.(track.uploaderId); }}
            >
              {track.uploaderName}
            </span>
            <span className="text-zinc-700 text-[10px]">•</span>
            <span className="text-zinc-600 text-[10px] font-medium uppercase tracking-wider">{track.genre}</span>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            {isGeneratingSnippet ? <Loader2 className="animate-spin" size={20} /> : <MoreVertical size={20} />}
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-10 w-48 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl py-2 z-30 animate-in fade-in slide-in-from-top-2 duration-200">
              <button 
                onClick={generateSnippet}
                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-sky-400 hover:bg-sky-500/10 flex items-center gap-3 transition-colors"
              >
                <Zap size={16} fill="currentColor" /> Visual Snippet
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsPlaylistModalOpen(true); setIsMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-zinc-400 hover:bg-white/5 flex items-center gap-3 transition-colors"
              >
                <ListPlus size={16} /> {t('track_add_playlist')}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); downloadTrack(track); setIsMenuOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-zinc-400 hover:bg-white/5 flex items-center gap-3 transition-colors"
              >
                <Download size={16} /> {t('track_download')}
              </button>
              {currentUser?.id === track.uploaderId && (
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); setIsMenuOpen(false); }}
                  className="w-full px-4 py-2.5 text-left text-[10px] font-black uppercase text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors border-t border-white/5 mt-1"
                >
                  <Trash2 size={16} /> {t('track_delete')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
        <div className="flex items-center gap-5">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-all ${track.isLikedByCurrentUser ? 'text-sky-400 scale-110' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <Heart size={18} fill={track.isLikedByCurrentUser ? 'currentColor' : 'none'} className={track.isLikedByCurrentUser ? 'drop-shadow-[0_0_8px_rgba(56,189,248,0.6)]' : ''} />
            <span className="text-[10px] font-black">{track.likes || 0}</span>
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); setIsCommentsOpen(!isCommentsOpen); }}
            className={`flex items-center gap-1.5 transition-colors ${isCommentsOpen ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <MessageCircle size={18} />
            <span className="text-[10px] font-black">{track.comments?.length || 0}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
            <span className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">{track.plays} {t('track_plays')}</span>
            <button onClick={generateSnippet} className="p-1.5 text-zinc-600 hover:text-sky-400 transition-colors">
                <Share2 size={16} />
            </button>
        </div>
      </div>

      {isPlaylistModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md p-6 flex items-center justify-center animate-in fade-in duration-300">
              <div className="bg-zinc-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-black text-white uppercase italic">{t('track_add_playlist')}</h3>
                      <button onClick={() => setIsPlaylistModalOpen(false)} className="text-zinc-500 p-2"><X size={20} /></button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {myPlaylists.map(p => (
                          <button key={p.id} onClick={() => { addToPlaylist(track.id, p.id); setIsPlaylistModalOpen(false); }} className="w-full p-4 bg-zinc-800/50 hover:bg-sky-500 hover:text-black rounded-2xl text-left text-xs font-black uppercase transition-all flex items-center gap-3">
                              <Bookmark size={16} /> {p.title}
                          </button>
                      ))}
                      {myPlaylists.length === 0 && <p className="text-center py-4 text-zinc-600 text-[10px] font-bold uppercase italic">No playlists found</p>}
                  </div>
              </div>
          </div>
      )}

      {isCommentsOpen && (
        <div className="mt-4 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
          <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t('track_comment_placeholder')}
              className="flex-1 bg-black border border-white/5 rounded-xl px-4 py-2 text-xs text-white focus:ring-1 focus:ring-sky-500 outline-none"
            />
            <button 
              type="submit" 
              disabled={!commentText.trim()}
              className="bg-sky-500 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase disabled:opacity-30"
            >
              <Send size={14} />
            </button>
          </form>

          <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {track.comments?.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden">
                  {comment.avatar ? <img src={comment.avatar} className="w-full h-full object-cover" alt=""/> : <div className="w-full h-full bg-sky-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-sky-400 uppercase italic tracking-tight">{comment.username}</span>
                    <span className="text-[8px] text-zinc-600 uppercase font-bold">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-zinc-300 text-[11px] font-medium leading-relaxed mt-0.5">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackCard;
