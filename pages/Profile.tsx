
import React, { useEffect, useState, useMemo } from 'react';
import { useStore } from '../services/store';
import { 
    Settings, ArrowLeft, BadgeCheck, Heart, Music, Clock, 
    ListMusic, Plus, Loader2, Mic, Headphones, 
    Zap, TrendingUp, Globe, Check, User as UserIcon,
    Send
} from '../components/ui/Icons';
import { Track, User, Playlist } from '../types';
import TrackCard from '../components/TrackCard';
import { TrackSkeleton } from '../components/ui/Skeleton';
import AuraEffect, { VibeType } from '../components/AuraEffect';

interface ProfileProps {
  onPlayTrack: (track: Track) => void;
  onEditProfile: () => void;
  onBack?: () => void; 
  targetUserId?: number | null; 
}

const Profile: React.FC<ProfileProps> = ({ onPlayTrack, onEditProfile, onBack, targetUserId }) => {
  const { currentUser, tracks, fetchUserById, getLikedTracks, getUserHistory, fetchUserPlaylists, createPlaylist, t, toggleFollow, isFollowing } = useStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isFollowingState, setIsFollowingState] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'tracks' | 'likes' | 'history' | 'playlists'>('tracks');
  
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const isOwnProfile = useMemo(() => {
    if (!targetUserId) return true;
    return currentUser?.id === targetUserId;
  }, [targetUserId, currentUser?.id]);

  useEffect(() => {
    let isMounted = true;
    const loadUser = async () => {
        if (!targetUserId || targetUserId === currentUser?.id) {
            if (isMounted) {
              setProfileUser(currentUser);
            }
            return;
        }

        if (isMounted) setLoadingProfile(true);
        const user = await fetchUserById(targetUserId);
        const followingStatus = await isFollowing(targetUserId);
        if (isMounted) {
            setProfileUser(user);
            setIsFollowingState(followingStatus);
            setLoadingProfile(false);
        }
    };
    loadUser();
    return () => { isMounted = false; };
  }, [targetUserId, currentUser?.id, fetchUserById, isFollowing]);

  useEffect(() => {
    const loadData = async () => {
        if (!profileUser) return;
        if (activeTab === 'likes' && likedTracks.length === 0) {
            setLoadingLikes(true);
            const data = await getLikedTracks(profileUser.id);
            setLikedTracks(data);
            setLoadingLikes(false);
        } else if (activeTab === 'history' && historyTracks.length === 0) {
            setLoadingHistory(true);
            const data = await getUserHistory(profileUser.id);
            setHistoryTracks(data);
            setLoadingHistory(false);
        } else if (activeTab === 'playlists' && playlists.length === 0) {
            const data = await fetchUserPlaylists(profileUser.id);
            setPlaylists(data);
        }
    };
    loadData();
  }, [activeTab, profileUser?.id, getLikedTracks, getUserHistory, fetchUserPlaylists]);

  const handleFollow = async () => {
      if (!profileUser || isFollowLoading) return;
      setIsFollowLoading(true);
      await toggleFollow(profileUser.id);
      setIsFollowingState(!isFollowingState);
      
      setProfileUser(prev => prev ? {
          ...prev,
          stats: {
              ...prev.stats,
              followers: (prev.stats.followers || 0) + (isFollowingState ? -1 : 1)
          }
      } : null);
      
      if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      setIsFollowLoading(false);
  };

  const handleCreatePlaylist = async () => {
      if (!newPlaylistTitle.trim()) return;
      setCreatingPlaylist(true);
      await createPlaylist(newPlaylistTitle);
      setNewPlaylistTitle('');
      setShowCreatePlaylist(false);
      setCreatingPlaylist(false);
      if (profileUser) setPlaylists(await fetchUserPlaylists(profileUser.id));
  };

  const getBadgeIcon = (badge: string) => {
      switch(badge) {
          case 'verified': return <BadgeCheck size={18} className="text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)]" />;
          case 'creator': return <div className="p-1 bg-sky-500/10 rounded-full border border-sky-500/20"><Mic size={14} className="text-sky-400" /></div>;
          case 'meloman': return <div className="p-1 bg-white/5 rounded-full border border-white/10"><Headphones size={14} className="text-white" /></div>;
          case 'star': return <div className="p-1 bg-sky-500/10 rounded-full border border-sky-500/20"><Zap size={14} className="text-sky-400" /></div>;
          default: return null;
      }
  };

  const getProfileVibe = (): VibeType => {
      if (!profileUser) return 'default';
      const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);
      if (userTracks.length === 0) return 'default';
      const genreCounts: Record<string, number> = {};
      userTracks.forEach(t => { genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1; });
      const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
      if (sortedGenres.length === 0) return 'default';
      const topGenre = sortedGenres[0][0].toLowerCase();
      if (topGenre.includes('phonk')) return 'phonk';
      if (topGenre.includes('lo-fi') || topGenre.includes('chill')) return 'lofi';
      if (topGenre.includes('electronic') || topGenre.includes('techno')) return 'electronic';
      if (topGenre.includes('rock')) return 'rock';
      return 'default';
  };

  if (loadingProfile) return <div className="p-5 pt-20"><TrackSkeleton /><TrackSkeleton /></div>;
  if (!profileUser) return <div className="p-10 text-center text-zinc-600 font-bold uppercase italic">{t('profile_not_found')}</div>;

  const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);
  const currentVibe = getProfileVibe();

  const socialLinks = profileUser.links || {};
  const hasSocials = Object.values(socialLinks).some(link => !!link);

  return (
    <div className="pb-32 animate-in slide-in-from-bottom-4 duration-500 relative">
       {showCreatePlaylist && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
               <div className="bg-zinc-900 border border-white/10 rounded-[2.5rem] w-full max-w-sm p-8 space-y-6 shadow-2xl">
                   <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">{t('profile_create_playlist')}</h3>
                   <input type="text" autoFocus value={newPlaylistTitle} onChange={e => setNewPlaylistTitle(e.target.value)} placeholder={t('profile_playlist_name')} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white font-bold text-sm focus:ring-2 focus:ring-sky-500/50 outline-none transition-all" />
                   <div className="flex gap-4">
                       <button onClick={() => setShowCreatePlaylist(false)} className="flex-1 py-4 text-xs font-black uppercase text-zinc-500">{t('profile_playlist_cancel')}</button>
                       <button onClick={handleCreatePlaylist} disabled={!newPlaylistTitle.trim() || creatingPlaylist} className="flex-1 py-4 bg-sky-500 rounded-2xl text-black font-black uppercase text-xs shadow-lg shadow-sky-500/20">{creatingPlaylist ? <Loader2 className="animate-spin" size={18}/> : t('profile_playlist_create_btn')}</button>
                   </div>
               </div>
           </div>
       )}

       <div className="h-48 bg-zinc-900 relative overflow-hidden">
           <AuraEffect vibe={currentVibe} />
           {profileUser.headerUrl ? <img src={profileUser.headerUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black/20" />}
           <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
           {onBack && <button onClick={onBack} className="absolute top-6 left-5 text-white p-3 bg-black/40 rounded-full border border-white/10 backdrop-blur-md z-20"><ArrowLeft size={24} /></button>}
           {isOwnProfile && <button onClick={onEditProfile} className="absolute top-6 right-5 text-white p-3 bg-black/40 rounded-full border border-white/10 backdrop-blur-md z-20"><Settings size={24} /></button>}
       </div>

       <div className="px-5 -mt-20 relative z-10 flex flex-col items-center">
           <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-sky-400 to-purple-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
               <div className="w-36 h-36 rounded-full border-8 border-black overflow-hidden bg-zinc-800 shadow-2xl relative">
                   {profileUser.photoUrl ? <img src={profileUser.photoUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-sky-500 text-black text-4xl font-black italic">M</div>}
               </div>
           </div>
           
           <div className="flex items-center gap-2 mt-4">
               <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">@{profileUser.username}</h2>
               <div className="flex gap-1">{profileUser.badges?.map(b => <span key={b}>{getBadgeIcon(b)}</span>)}</div>
           </div>
           
           <p className="text-center text-zinc-400 text-sm mt-3 font-bold max-w-xs">{profileUser.bio || (isOwnProfile ? t('profile_bio_placeholder') : t('profile_no_bio'))}</p>

           {/* Social Links Row */}
           {hasSocials && (
             <div className="flex gap-3 mt-6">
               {socialLinks.telegram && (
                 <a href={socialLinks.telegram.startsWith('http') ? socialLinks.telegram : `https://t.me/${socialLinks.telegram.replace('@', '')}`} target="_blank" className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-full text-sky-400 hover:bg-sky-500 hover:text-black transition-all">
                   <Send size={18} />
                 </a>
               )}
               {socialLinks.spotify && (
                 <a href={socialLinks.spotify} target="_blank" className="p-3 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 hover:bg-green-500 hover:text-black transition-all">
                   <Music size={18} />
                 </a>
               )}
               {socialLinks.soundcloud && (
                 <a href={socialLinks.soundcloud} target="_blank" className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 hover:bg-orange-500 hover:text-black transition-all">
                   <Headphones size={18} />
                 </a>
               )}
               {socialLinks.yandex && (
                 <a href={socialLinks.yandex} target="_blank" className="p-3 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 hover:bg-red-500 hover:text-black transition-all">
                   <Zap size={18} />
                 </a>
               )}
               {socialLinks.other && (
                 <a href={socialLinks.other.startsWith('http') ? socialLinks.other : `https://${socialLinks.other}`} target="_blank" className="p-3 bg-zinc-800 border border-white/5 rounded-full text-zinc-400 hover:text-white transition-all">
                   <Globe size={18} />
                 </a>
               )}
             </div>
           )}

           {!isOwnProfile && (
               <button 
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                  className={`mt-6 px-10 py-3 rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all flex items-center gap-2 ${isFollowingState ? 'bg-zinc-800 text-zinc-400 border border-white/10' : 'bg-sky-500 text-black shadow-lg shadow-sky-500/20 active:scale-95'}`}
               >
                  {isFollowLoading ? <Loader2 size={16} className="animate-spin" /> : isFollowingState ? <><Check size={16}/> {t('profile_following')}</> : <><UserIcon size={16}/> {t('profile_follow')}</>}
               </button>
           )}

           <div className="w-full mt-8 bg-zinc-900/40 border border-sky-500/20 rounded-[2.5rem] p-6 shadow-inner relative overflow-hidden">
               <div className="flex items-center gap-2 mb-4 text-sky-400 font-black uppercase text-[10px] tracking-[0.2em] relative z-10">
                   <TrendingUp size={14} /> {t('profile_artist_hub')}
               </div>
               <div className="grid grid-cols-4 gap-2 items-center text-center relative z-10">
                    <div><div className="text-xl font-black text-white italic">{(profileUser.stats.totalPlays || 0).toLocaleString()}</div><div className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">{t('profile_plays')}</div></div>
                    <div><div className="text-xl font-black text-white italic">{profileUser.stats.followers || 0}</div><div className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">{t('profile_followers')}</div></div>
                    <div><div className="text-xl font-black text-white italic">{profileUser.stats.likesReceived || 0}</div><div className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">{t('profile_likes')}</div></div>
                    <div><div className="text-xl font-black text-white italic">{profileUser.stats.uploads || 0}</div><div className="text-[7px] font-black uppercase text-zinc-600 tracking-widest mt-1">{t('profile_tracks')}</div></div>
               </div>
           </div>

           <div className="mt-10 w-full flex border-b border-white/5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'tracks', label: t('profile_tracks'), icon: Music },
                  { id: 'playlists', label: t('profile_playlists'), icon: ListMusic },
                  { id: 'likes', label: t('profile_likes'), icon: Heart },
                  ...(isOwnProfile ? [{ id: 'history', label: t('profile_history'), icon: Clock }] : [])
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative flex flex-col items-center gap-2 ${activeTab === tab.id ? 'text-sky-400' : 'text-zinc-600'}`}>
                        <tab.icon size={18} />
                        <span>{tab.label}</span>
                        {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400 rounded-t-full shadow-[0_-5px_15px_rgba(56,189,248,0.4)]" />}
                    </button>
                ))}
           </div>

           <div className="w-full mt-6 space-y-4">
               {activeTab === 'tracks' && (userTracks.length > 0 ? userTracks.map(t => <TrackCard key={t.id} track={t} onPlay={onPlayTrack} />) : <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">{t('profile_no_tracks')}</div>)}
               {activeTab === 'playlists' && (
                    <div className="space-y-6">
                        {isOwnProfile && <button onClick={() => setShowCreatePlaylist(true)} className="w-full py-4 bg-zinc-900 border border-white/5 border-dashed rounded-3xl text-zinc-500 font-black uppercase text-[10px] tracking-widest hover:text-white transition-all"><Plus size={18} className="inline mr-2" />{t('profile_create_playlist')}</button>}
                        <div className="grid grid-cols-2 gap-4">
                            {playlists.map(p => (
                                <div key={p.id} className="bg-zinc-900/40 rounded-[2rem] overflow-hidden border border-white/5 p-4 cursor-pointer hover:border-sky-500/30 transition-all">
                                    <div className="aspect-square bg-zinc-800 rounded-2xl relative mb-3 overflow-hidden">{p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ListMusic size={32} /></div>}</div>
                                    <h4 className="text-white text-xs font-black uppercase truncate">{p.title}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
               )}
               {activeTab === 'likes' && (loadingLikes ? <TrackSkeleton /> : likedTracks.length > 0 ? likedTracks.map(t => <TrackCard key={t.id} track={t} onPlay={onPlayTrack} />) : <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">{t('profile_no_tracks')}</div>)}
               {activeTab === 'history' && (loadingHistory ? <TrackSkeleton /> : historyTracks.length > 0 ? historyTracks.map(t => <TrackCard key={t.id} track={t} onPlay={onPlayTrack} />) : <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">{t('profile_history_empty')}</div>)}
           </div>
       </div>
    </div>
  );
};

export default Profile;
