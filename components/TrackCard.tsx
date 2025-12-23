
import React, { useState, useRef, useEffect } from 'react';
import { Track } from '../types';
import { 
  Heart, MessageCircle, Play, MoreVertical, BadgeCheck, 
  Trash2, Send, Loader2, ListPlus, X, Image as ImageIcon, 
  Share2, Download, Bookmark, Zap
} from './ui/Icons';
import { useStore } from '../services/store';
import { TELEGRAM_APP_LINK } from '../constants';

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
  onOpenProfile?: (userId: number) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay, onOpenProfile }) => {
  const { currentUser, toggleLike, deleteTrack, addComment, addToPlaylist, myPlaylists, t, downloadTrack } = useStore();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isGeneratingSnippet, setIsGeneratingSnippet] = useState(false);
  const [snippetUrl, setSnippetUrl] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(track.id);
    if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('light');
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        
        // 1. Draw Background (Blurred Cover)
        ctx.filter = 'blur(50px) brightness(0.4)';
        ctx.drawImage(coverImg, -100, -100, 1280, 1280);
        ctx.filter = 'none';

        // 2. Draw Vignette/Gradient
        const gradient = ctx.createRadialGradient(540, 540, 200, 540, 540, 800);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1080);

        // 3. Draw Rounded Cover in Center
        const coverSize = 600;
        const x = (1080 - coverSize) / 2;
        const y = 180;
        const radius = 80;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + coverSize - radius, y);
        ctx.quadraticCurveTo(x + coverSize, y, x + coverSize, y + radius);
        ctx.lineTo(x + coverSize, y + coverSize - radius);
        ctx.quadraticCurveTo(x + coverSize, y + coverSize, x + coverSize - radius, y + coverSize);
        ctx.lineTo(x + radius, y + coverSize);
        ctx.quadraticCurveTo(x, y + coverSize, x, y + coverSize - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(coverImg, x, y, coverSize, coverSize);
        ctx.restore();

        // 4. Glow effect around cover
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 40;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Text Info
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'italic 900 64px system-ui';
        ctx.fillText(track.title.toUpperCase(), 540, 860);

        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 36px system-ui';
        ctx.fillText(track.uploaderName.toUpperCase(), 540, 920);

        // 6. Mori Logo Branding
        ctx.fillStyle = '#38bdf8';
        ctx.font = '900 32px system-ui';
        ctx.letterSpacing = '10px';
        ctx.fillText('MORIMUSIC', 540, 1000);

        // 7. Waveform decoration
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        for(let i = 0; i < 20; i++) {
          const h = 20 + Math.random() * 40;
          ctx.beginPath();
          ctx.moveTo(400 + i * 15, 780 - h);
          ctx.lineTo(400 + i * 15, 780 + h);
          ctx.stroke();
        }

        const dataUrl = canvas.toDataURL('image/png');
        setSnippetUrl(dataUrl);
      } catch (err) {
        console.error("Canvas generation failed", err);
      }
    } finally {
      setIsGeneratingSnippet(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    await addComment(track.id, commentText);
    setCommentText('');
  };

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-[2rem] p-4 mb-4 shadow-xl hover:border-white/10 transition-all group relative">
      
      {/* Snippet Overlay / Modal */}
      {snippetUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl p-6 flex flex-col items-center justify-center animate-in fade-in duration-300">
           <div className="relative w-full aspect-square max-w-sm rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 shadow-sky-500/20">
              <img src={snippetUrl} className="w-full h-full object-cover" alt="Snippet" />
           </div>
           
           <h3 className="text-white font-black text-xl uppercase italic mt-8 tracking-tighter">{t('track_share')}</h3>
           <p className="text-zinc-500 text-xs font-bold uppercase mt-2 text-center max-w-xs leading-relaxed">
             Visual snippet is ready for your story or chat!
           </p>

           <div className="flex gap-4 mt-10 w-full max-w-sm">
              <button 
                onClick={() => setSnippetUrl(null)} 
                className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                {t('profile_playlist_cancel')}
              </button>
              <button 
                onClick={handleShare}
                className="flex-2 py-4 bg-sky-500 rounded-2xl text-black font-black uppercase text-[10px] tracking-widest shadow-lg shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} /> Send
              </button>
           </div>
        </div>
      )}

      {/* Main Card Content */}
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
                <Zap size={16} fill="currentColor" /> Share Snippet
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
            <button onClick={handleShare} className="p-1.5 text-zinc-600 hover:text-sky-400 transition-colors">
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
