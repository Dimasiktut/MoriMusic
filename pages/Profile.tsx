
import React, { useEffect, useState } from 'react';
import { useStore } from '../services/store';
import { Settings, ArrowLeft, BadgeCheck, Heart, Music, Clock, ListMusic, Plus, Loader2, Bookmark, Mic, Headphones, Zap, TrendingUp } from '../components/ui/Icons';
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
  const { currentUser, tracks, fetchUserById, getLikedTracks, getUserHistory, fetchUserPlaylists, savedPlaylists, toggleSavePlaylist, fetchPlaylistTracks, createPlaylist, t } = useStore();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'tracks' | 'likes' | 'history' | 'playlists'>('tracks');
  
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [historyTracks, setHistoryTracks] = useState<Track[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loadingPlaylistTracks, setLoadingPlaylistTracks] = useState(false);

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

  useEffect(() => {
    const loadData = async () => {
        if (!profileUser) return;
        if (activeTab === 'likes') {
            setLoadingLikes(true);
            setLikedTracks(await getLikedTracks(profileUser.id));
            setLoadingLikes(false);
        } else if (activeTab === 'history') {
            setLoadingHistory(true);
            setHistoryTracks(await getUserHistory(profileUser.id));
            setLoadingHistory(false);
        } else if (activeTab === 'playlists') {
            setPlaylists(await fetchUserPlaylists(profileUser.id));
        }
    };
    loadData();
  }, [activeTab, profileUser, getLikedTracks, getUserHistory, fetchUserPlaylists]);

  useEffect(() => {
      const loadPlaylistTracks = async () => {
          if (selectedPlaylist) {
              setLoadingPlaylistTracks(true);
              setPlaylistTracks(await fetchPlaylistTracks(selectedPlaylist.id));
              setLoadingPlaylistTracks(false);
          }
      };
      loadPlaylistTracks();
  }, [selectedPlaylist, fetchPlaylistTracks]);

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
      userTracks.forEach(t => {
          genreCounts[t.genre] = (genreCounts[t.genre] || 0) + 1;
      });
      
      const topGenre = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0][0].toLowerCase();
      
      if (topGenre.includes('phonk')) return 'phonk';
      if (topGenre.includes('lo-fi') || topGenre.includes('chill')) return 'lofi';
      if (topGenre.includes('electronic') || topGenre.includes('techno')) return 'electronic';
      if (topGenre.includes('rock')) return 'rock';
      
      return 'default';
  };

  if (loadingProfile) return <div className="p-5 pt-20"><TrackSkeleton /><TrackSkeleton /></div>;
  if (!profileUser) return <div className="p-10 text-center text-zinc-600 font-bold uppercase italic">{t('profile_not_found')}</div>;

  const isOwnProfile = currentUser?.id === profileUser.id;
  const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);
  const currentVibe = getProfileVibe();

  if (selectedPlaylist) {
      const isSaved = savedPlaylists.some(p => p.id === selectedPlaylist.id);
      const isOwner = currentUser?.id === selectedPlaylist.userId;
      return (
          <div className="pb-32 min-h-screen bg-black animate-in slide-in-from-right-4 duration-500">
              <div className="relative h-60 bg-zinc-900">
                  {selectedPlaylist.coverUrl && (
                      <div className="absolute inset-0">
                          <img src={selectedPlaylist.coverUrl} className="w-full h-full object-cover opacity-40 blur-xl" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                      </div>
                  )}
                  <div className="absolute top-6 left-5 z-20">
                      <button onClick={() => setSelectedPlaylist(null)} className="p-3 bg-black/40 rounded-full text-white backdrop-blur-md border border-white/10">
                          <ArrowLeft size={24} />
                      </button>
                  </div>
                  {!isOwner && currentUser && (
                       <div className="absolute top-6 right-5 z-20">
                           <button onClick={() => toggleSavePlaylist(selectedPlaylist.id)} className={`p-3 rounded-full backdrop-blur-md border border-white/10 transition-all ${isSaved ? 'bg-sky-500 text-black border-sky-500' : 'bg-black/40 text-white'}`}>
                               <Bookmark size={24} fill={isSaved ? "currentColor" : "none"} />
                           </button>
                       </div>
                  )}
                  <div className="absolute bottom-8 left-6 right-6 flex items-end gap-6 z-10">
                      <div className="w-32 h-32 rounded-3xl bg-zinc-800 shadow-2xl flex-shrink-0 overflow-hidden border border-white/10">
                          {selectedPlaylist.coverUrl ? <img src={selectedPlaylist.coverUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><ListMusic size={40} /></div>}
                      </div>
                      <div className="mb-2">
                          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-tight">{selectedPlaylist.title}</h2>
                          <p className="text-xs font-bold text-sky-400 uppercase tracking-widest mt-1">Playlist</p>
                      </div>
                  </div>
              </div>
              <div className="p-5 space-y-4">
                  {loadingPlaylistTracks ? <TrackSkeleton /> : playlistTracks.length > 0 ? playlistTracks.map(track => <TrackCard key={track.id} track={track} onPlay={onPlayTrack} />) : <div className="text-center py-20 text-zinc-600 font-bold uppercase text-xs border border-dashed border-white/5 rounded-3xl">No tracks here</div>}
              </div>
          </div>
      );
  }

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
           {onBack && <button onClick={onBack} className="absolute top-6 left-5 text-white p-3 bg-black/30 rounded-full border border-white/10 backdrop-blur-md z-20"><ArrowLeft size={24} /></button>}
           {isOwnProfile && <button onClick={onEditProfile} className="absolute top-6 right-5 text-white p-3 bg-black/30 rounded-full border border-white/10 backdrop-blur-md z-20"><Settings size={24} /></button>}
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

           {isOwnProfile && profileUser.stats.uploads > 0 && (
               <div className="w-full mt-8 bg-zinc-900/40 border border-sky-500/20 rounded-[2rem] p-6 shadow-inner relative overflow-hidden">
                   <div className="flex items-center gap-2 mb-4 text-sky-400 font-black uppercase text-[10px] tracking-[0.2em] relative z-10">
                       <TrendingUp size={14} /> Artist Hub
                   </div>
                   <div className="flex justify-between items-center text-center relative z-10">
                        <div><div className="text-2xl font-black text-white italic">{profileUser.stats.totalPlays.toLocaleString()}</div><div className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-1">Plays</div></div>
                        <div className="h-8 w-px bg-white/5"></div>
                        <div><div className="text-2xl font-black text-white italic">{profileUser.stats.likesReceived}</div><div className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-1">Likes</div></div>
                        <div className="h-8 w-px bg-white/5"></div>
                        <div><div className="text-2xl font-black text-white italic">{profileUser.stats.uploads}</div><div className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mt-1">Tracks</div></div>
                   </div>
               </div>
           )}

           <div className="mt-10 w-full flex border-b border-white/5 overflow-x-auto no-scrollbar">
                {[
                  { id: 'tracks', label: 'Tracks', icon: Music },
                  { id: 'playlists', label: 'Playlists', icon: ListMusic },
                  { id: 'likes', label: 'Likes', icon: Heart },
                  ...(isOwnProfile ? [{ id: 'history', label: 'History', icon: Clock }] : [])
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
                                <div key={p.id} onClick={() => setSelectedPlaylist(p)} className="bg-zinc-900/40 rounded-[2rem] overflow-hidden border border-white/5 p-4 cursor-pointer hover:border-sky-500/30 transition-all">
                                    <div className="aspect-square bg-zinc-800 rounded-2xl relative mb-3 overflow-hidden">{p.coverUrl ? <img src={p.coverUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ListMusic size={32} /></div>}</div>
                                    <h4 className="text-white text-xs font-black uppercase truncate">{p.title}</h4>
                                </div>
                            ))}
                        </div>
                    </div>
               )}
               {activeTab === 'likes' && (loadingLikes ? <TrackSkeleton /> : likedTracks.length > 0 ? likedTracks.map(t => <TrackCard key={t.id} track={t} onPlay={onPlayTrack} />) : <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">No likes yet</div>)}
               {activeTab === 'history' && (loadingHistory ? <TrackSkeleton /> : historyTracks.length > 0 ? historyTracks.map(t => <TrackCard key={t.id} track={t} onPlay={onPlayTrack} />) : <div className="text-center py-10 text-zinc-600 font-bold uppercase text-[10px]">Empty history</div>)}
           </div>
       </div>
    </div>
  );
};

export default Profile;
