import React, { useState } from 'react';
import { Track } from '../types';
import { Heart, MessageCircle, Play, MoreVertical, Share2 } from './ui/Icons';
import { useStore } from '../services/store';

interface TrackCardProps {
  track: Track;
  onPlay: (track: Track) => void;
}

const TrackCard: React.FC<TrackCardProps> = ({ track, onPlay }) => {
  const { toggleLike, addComment } = useStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

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

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 mb-4 shadow-sm hover:bg-zinc-800/50 transition-colors">
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
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-white font-bold truncate leading-tight mb-1">{track.title}</h3>
                    <p className="text-zinc-400 text-sm truncate">{track.uploaderName}</p>
                </div>
                <button className="text-zinc-500 p-1">
                    <MoreVertical size={16} />
                </button>
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
                <span>{track.comments.length}</span>
            </button>
            
             <button className="text-zinc-400 hover:text-white transition-colors">
                <Share2 size={18} />
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
                {track.comments.length === 0 ? (
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