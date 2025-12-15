import React from 'react';
import { useStore } from '../services/store';
import { Settings, ExternalLink } from '../components/ui/Icons';
import { Track } from '../types';
import TrackCard from '../components/TrackCard';

interface ProfileProps {
  onPlayTrack: (track: Track) => void;
  onEditProfile: () => void;
}

const Profile: React.FC<ProfileProps> = ({ onPlayTrack, onEditProfile }) => {
  const { currentUser, tracks } = useStore();

  if (!currentUser) return <div>Loading...</div>;

  const userTracks = tracks.filter(t => t.uploaderId === currentUser.id);

  return (
    <div className="pb-32">
       {/* Header / Cover */}
       <div className="h-40 bg-gradient-to-b from-zinc-800 to-black relative">
           <button 
             onClick={onEditProfile}
             className="absolute top-4 right-4 text-white/80 p-2 bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors"
           >
               <Settings size={20} />
           </button>
       </div>

       <div className="px-4 -mt-16 relative z-10">
           <div className="flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-zinc-800 shadow-xl">
                   {currentUser.photoUrl ? (
                       <img src={currentUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center bg-violet-600 text-3xl font-bold">
                           {currentUser.username[0].toUpperCase()}
                       </div>
                   )}
               </div>
               
               <h2 className="text-xl font-bold mt-3 text-white">@{currentUser.username}</h2>
               {currentUser.firstName && <span className="text-sm text-zinc-400">{currentUser.firstName} {currentUser.lastName}</span>}
               
               <p className="text-center text-zinc-300 text-sm mt-3 max-w-xs whitespace-pre-wrap">
                   {currentUser.bio || "No bio yet."}
               </p>

               {/* Stats */}
               <div className="flex gap-8 mt-6 w-full justify-center pb-6 border-b border-zinc-800">
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{currentUser.stats.uploads}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Tracks</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{currentUser.stats.likesReceived}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Likes</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{currentUser.stats.totalPlays.toLocaleString()}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Plays</div>
                   </div>
               </div>

               {/* Social Links */}
               <div className="flex gap-4 mt-6 flex-wrap justify-center">
                   {Object.entries(currentUser.links).map(([key, url]) => {
                       if (!url) return null;
                       return (
                           <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors">
                               <ExternalLink size={18} />
                           </a>
                       );
                   })}
               </div>
           </div>

           {/* User Tracks */}
           <div className="mt-8">
               <h3 className="text-lg font-bold text-white mb-4">My Tracks</h3>
               <div className="space-y-2">
                   {userTracks.length > 0 ? (
                       userTracks.map(track => (
                           <TrackCard key={track.id} track={track} onPlay={onPlayTrack} />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                           <p className="text-zinc-500 text-sm">You haven't uploaded any tracks yet.</p>
                       </div>
                   )}
               </div>
           </div>
       </div>
    </div>
  );
};

export default Profile;