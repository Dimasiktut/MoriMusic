import React, { useEffect, useState } from 'react';
import { useStore } from '../services/store';
import { Settings, ExternalLink, ArrowLeft } from '../components/ui/Icons';
import { Track, User } from '../types';
import TrackCard from '../components/TrackCard';

interface ProfileProps {
  onPlayTrack: (track: Track) => void;
  onEditProfile: () => void;
  onBack?: () => void; // Present if viewing another user's profile
  targetUserId?: number | null; // If null, show current user
}

const Profile: React.FC<ProfileProps> = ({ onPlayTrack, onEditProfile, onBack, targetUserId }) => {
  const { currentUser, tracks, fetchUserById } = useStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Determine which user to show
  useEffect(() => {
    const loadUser = async () => {
        if (targetUserId && targetUserId !== currentUser?.id) {
            setLoadingProfile(true);
            const user = await fetchUserById(targetUserId);
            setProfileUser(user);
            setLoadingProfile(false);
        } else {
            setProfileUser(currentUser);
        }
    };
    loadUser();
  }, [targetUserId, currentUser, fetchUserById]);

  if (loadingProfile) return <div className="p-10 text-center text-zinc-500">Loading profile...</div>;
  if (!profileUser) return <div className="p-10 text-center text-zinc-500">User not found</div>;

  const isOwnProfile = currentUser?.id === profileUser.id;
  const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);

  // Helper to get nice labels for links
  const getLinkLabel = (key: string, url: string) => {
    if (key === 'spotify') return 'Spotify';
    if (key === 'soundcloud') return 'SoundCloud';
    if (key === 'yandex') return 'Yandex Music';
    if (key === 'other') {
        if (url.includes('vk.com')) return 'VK';
        if (url.includes('youtube.com')) return 'YouTube';
        return 'Website';
    }
    return key;
  };

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
       {/* Header / Cover */}
       <div className="h-40 bg-gradient-to-b from-zinc-800 to-black relative">
           {onBack && (
               <button 
                 onClick={onBack}
                 className="absolute top-4 left-4 text-white/80 p-2 bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors z-20"
               >
                   <ArrowLeft size={20} />
               </button>
           )}
           
           {isOwnProfile && (
                <button 
                    onClick={onEditProfile}
                    className="absolute top-4 right-4 text-white/80 p-2 bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors z-20"
                >
                    <Settings size={20} />
                </button>
           )}
       </div>

       <div className="px-4 -mt-16 relative z-10">
           <div className="flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-zinc-800 shadow-xl">
                   {profileUser.photoUrl ? (
                       <img src={profileUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center bg-violet-600 text-3xl font-bold">
                           {profileUser.username[0].toUpperCase()}
                       </div>
                   )}
               </div>
               
               <h2 className="text-xl font-bold mt-3 text-white">@{profileUser.username}</h2>
               {profileUser.firstName && <span className="text-sm text-zinc-400">{profileUser.firstName} {profileUser.lastName}</span>}
               
               <p className="text-center text-zinc-300 text-sm mt-3 max-w-xs whitespace-pre-wrap">
                   {profileUser.bio || (isOwnProfile ? "Add a bio in settings..." : "No bio.")}
               </p>

               {/* Stats */}
               <div className="flex gap-8 mt-6 w-full justify-center pb-6 border-b border-zinc-800">
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{userTracks.length}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Tracks</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{profileUser.stats.likesReceived}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Likes</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{profileUser.stats.totalPlays.toLocaleString()}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">Plays</div>
                   </div>
               </div>

               {/* Social Links with Labels */}
               <div className="flex flex-wrap gap-3 mt-6 justify-center">
                   {Object.entries(profileUser.links).map(([key, url]) => {
                       if (!url) return null;
                       const label = getLinkLabel(key, url);
                       return (
                           <a 
                             key={key} 
                             href={url} 
                             target="_blank" 
                             rel="noopener noreferrer" 
                             className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-300 hover:text-white hover:border-violet-500/50 hover:bg-violet-500/10 transition-all text-xs font-medium flex items-center gap-2"
                           >
                               <ExternalLink size={14} />
                               {label}
                           </a>
                       );
                   })}
                   {Object.values(profileUser.links).every(l => !l) && (
                       <p className="text-xs text-zinc-600 italic">No social links added.</p>
                   )}
               </div>
           </div>

           {/* User Tracks */}
           <div className="mt-8">
               <h3 className="text-lg font-bold text-white mb-4">
                   {isOwnProfile ? "My Tracks" : `${profileUser.username}'s Tracks`}
               </h3>
               <div className="space-y-2">
                   {userTracks.length > 0 ? (
                       userTracks.map(track => (
                           <TrackCard 
                                key={track.id} 
                                track={track} 
                                onPlay={onPlayTrack}
                                // Don't allow clicking profile to prevent recursion if we are already there
                                onOpenProfile={isOwnProfile ? undefined : undefined} 
                           />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                           <p className="text-zinc-500 text-sm">No tracks available.</p>
                       </div>
                   )}
               </div>
           </div>
       </div>
    </div>
  );
};

export default Profile;