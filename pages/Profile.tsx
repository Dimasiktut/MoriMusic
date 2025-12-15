import React, { useEffect, useState } from 'react';
import { useStore } from '../services/store';
import { Settings, ExternalLink, ArrowLeft, BadgeCheck, Heart, Music, Clock } from '../components/ui/Icons';
import { Track, User } from '../types';
import TrackCard from '../components/TrackCard';
import { TrackSkeleton } from '../components/ui/Skeleton';

interface ProfileProps {
  onPlayTrack: (track: Track) => void;
  onEditProfile: () => void;
  onBack?: () => void; 
  targetUserId?: number | null; 
}

const Profile: React.FC<ProfileProps> = ({ onPlayTrack, onEditProfile, onBack, targetUserId }) => {
  const { currentUser, tracks, fetchUserById, getLikedTracks, getUserHistory, t } = useStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  // Tabs State
  const [activeTab, setActiveTab] = useState<'tracks' | 'likes' | 'history'>('tracks');
  
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // 1. Load User
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

  // 2. Load Secondary Tab Data
  useEffect(() => {
    const loadData = async () => {
        if (!profileUser) return;

        if (activeTab === 'likes') {
            setLoadingLikes(true);
            const likes = await getLikedTracks(profileUser.id);
            setLikedTracks(likes);
            setLoadingLikes(false);
        } else if (activeTab === 'history') {
            setLoadingHistory(true);
            const history = await getUserHistory(profileUser.id);
            setHistoryTracks(history);
            setLoadingHistory(false);
        }
    };
    loadData();
  }, [activeTab, profileUser, getLikedTracks, getUserHistory]);

  if (loadingProfile) return <div className="p-4 pt-10"><TrackSkeleton /><TrackSkeleton /></div>;
  if (!profileUser) return <div className="p-10 text-center text-zinc-500">{t('profile_not_found')}</div>;

  const isOwnProfile = currentUser?.id === profileUser.id;
  const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);

  // Helper to get nice labels for links
  const getLinkLabel = (key: string, url: string) => {
    if (key === 'spotify') return t('link_spotify');
    if (key === 'soundcloud') return t('link_soundcloud');
    if (key === 'yandex') return t('link_yandex');
    if (key === 'other') {
        if (url.includes('vk.com')) return t('link_vk');
        if (url.includes('youtube.com')) return t('link_youtube');
        return t('link_website');
    }
    return key;
  };

  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300">
       {/* Header / Cover */}
       <div className="h-40 bg-zinc-900 relative overflow-hidden">
           {profileUser.headerUrl ? (
               <img src={profileUser.headerUrl} alt="header" className="w-full h-full object-cover" />
           ) : (
               <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black" />
           )}
           
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

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
               
               <div className="flex items-center gap-1 mt-3">
                   <h2 className="text-xl font-bold text-white">@{profileUser.username}</h2>
                   {profileUser.isVerified && <BadgeCheck size={18} className="text-violet-500 fill-violet-500/10" />}
               </div>

               {profileUser.firstName && <span className="text-sm text-zinc-400">{profileUser.firstName} {profileUser.lastName}</span>}
               
               <p className="text-center text-zinc-300 text-sm mt-3 max-w-xs whitespace-pre-wrap">
                   {profileUser.bio || (isOwnProfile ? t('profile_bio_placeholder') : t('profile_no_bio'))}
               </p>

               {/* Stats */}
               <div className="flex gap-8 mt-6 w-full justify-center pb-6 border-b border-zinc-800">
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{userTracks.length}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">{t('profile_tracks')}</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{profileUser.stats.likesReceived}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">{t('profile_likes')}</div>
                   </div>
                   <div className="text-center">
                       <div className="text-lg font-bold text-white">{profileUser.stats.totalPlays.toLocaleString()}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-wide">{t('profile_plays')}</div>
                   </div>
               </div>

               {/* Social Links */}
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
               </div>
           </div>

           {/* Tabs Switcher */}
           <div className="mt-8 flex border-b border-zinc-800 mb-4 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('tracks')}
                    className={`flex-1 min-w-[30%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'tracks' ? 'text-violet-400' : 'text-zinc-500'}`}
                >
                    <Music size={16} />
                    {isOwnProfile ? t('profile_my_tracks') : t('profile_tracks')}
                    {activeTab === 'tracks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                </button>
                <button
                    onClick={() => setActiveTab('likes')}
                    className={`flex-1 min-w-[30%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'likes' ? 'text-violet-400' : 'text-zinc-500'}`}
                >
                    <Heart size={16} />
                    {t('profile_likes')}
                    {activeTab === 'likes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                </button>
                 {isOwnProfile && (
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 min-w-[30%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'history' ? 'text-violet-400' : 'text-zinc-500'}`}
                    >
                        <Clock size={16} />
                        {t('profile_history')}
                        {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                    </button>
                 )}
           </div>

           {/* Content */}
           <div className="space-y-2">
               {activeTab === 'tracks' && (
                   userTracks.length > 0 ? (
                       userTracks.map(track => (
                           <TrackCard 
                                key={track.id} 
                                track={track} 
                                onPlay={onPlayTrack}
                                onOpenProfile={isOwnProfile ? undefined : undefined} 
                           />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                           <p className="text-zinc-500 text-sm">{t('profile_no_tracks')}</p>
                       </div>
                   )
               )}

               {activeTab === 'likes' && (
                   loadingLikes ? (
                        <>
                            <TrackSkeleton />
                            <TrackSkeleton />
                        </>
                   ) : likedTracks.length > 0 ? (
                       likedTracks.map(track => (
                           <TrackCard 
                                key={track.id} 
                                track={track} 
                                onPlay={onPlayTrack}
                                onOpenProfile={onBack ? undefined : undefined} 
                           />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                           <p className="text-zinc-500 text-sm">No liked tracks yet.</p>
                       </div>
                   )
               )}

               {activeTab === 'history' && (
                    loadingHistory ? (
                        <>
                            <TrackSkeleton />
                            <TrackSkeleton />
                        </>
                   ) : historyTracks.length > 0 ? (
                       historyTracks.map(track => (
                           <TrackCard 
                                key={track.id} 
                                track={track} 
                                onPlay={onPlayTrack}
                                onOpenProfile={onBack ? undefined : undefined} 
                           />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
                           <p className="text-zinc-500 text-sm">No listening history yet.</p>
                       </div>
                   )
               )}
           </div>
       </div>
    </div>
  );
};

export default Profile;