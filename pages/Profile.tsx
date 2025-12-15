
import React, { useEffect, useState } from 'react';
import { useStore } from '../services/store';
import { Settings, ExternalLink, ArrowLeft, BadgeCheck, Heart, Music, Clock, ListMusic, Plus, Loader2, Bookmark, Mic, Headphones, Zap, TrendingUp, Send } from '../components/ui/Icons';
import { Track, User, Playlist } from '../types';
import TrackCard from '../components/TrackCard';
import { TrackSkeleton } from '../components/ui/Skeleton';

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
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Playlist View State
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
            const likes = await getLikedTracks(profileUser.id);
            setLikedTracks(likes);
            setLoadingLikes(false);
        } else if (activeTab === 'history') {
            setLoadingHistory(true);
            const history = await getUserHistory(profileUser.id);
            setHistoryTracks(history);
            setLoadingHistory(false);
        } else if (activeTab === 'playlists') {
            setLoadingPlaylists(true);
            const userPlaylists = await fetchUserPlaylists(profileUser.id);
            setPlaylists(userPlaylists);
            setLoadingPlaylists(false);
        }
    };
    loadData();
  }, [activeTab, profileUser, getLikedTracks, getUserHistory, fetchUserPlaylists]);

  // Load playlist tracks when a playlist is selected
  useEffect(() => {
      const loadPlaylistTracks = async () => {
          if (selectedPlaylist) {
              setLoadingPlaylistTracks(true);
              const tracks = await fetchPlaylistTracks(selectedPlaylist.id);
              setPlaylistTracks(tracks);
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
      if (profileUser) {
          const updated = await fetchUserPlaylists(profileUser.id);
          setPlaylists(updated);
      }
  };

  const handleOpenPlaylist = (playlist: Playlist) => {
      setSelectedPlaylist(playlist);
  };

  const handleBackFromPlaylist = () => {
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
  };

  const getBadgeIcon = (badge: string) => {
      switch(badge) {
          case 'verified': return <BadgeCheck size={16} className="text-blue-500 fill-blue-500/10" />;
          case 'creator': return <div className="p-0.5 bg-violet-500/10 rounded-full border border-violet-500/30"><Mic size={12} className="text-violet-400" /></div>;
          case 'meloman': return <div className="p-0.5 bg-pink-500/10 rounded-full border border-pink-500/30"><Headphones size={12} className="text-pink-400" /></div>;
          case 'star': return <div className="p-0.5 bg-yellow-500/10 rounded-full border border-yellow-500/30"><Zap size={12} className="text-yellow-400" /></div>;
          default: return null;
      }
  };

  if (loadingProfile) return <div className="p-4 pt-10"><TrackSkeleton /><TrackSkeleton /></div>;
  if (!profileUser) return <div className="p-10 text-center text-zinc-500">{t('profile_not_found')}</div>;

  const isOwnProfile = currentUser?.id === profileUser.id;
  const userTracks = tracks.filter(t => t.uploaderId === profileUser.id);

  const getLinkLabel = (key: string, url: string) => {
    if (key === 'telegram') return 'Channel';
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

  // --- RENDER PLAYLIST VIEW ---
  if (selectedPlaylist) {
      const isSaved = savedPlaylists.some(p => p.id === selectedPlaylist.id);
      const isOwner = currentUser?.id === selectedPlaylist.userId;

      return (
          <div className="pb-32 min-h-screen bg-zinc-950 animate-in slide-in-from-right-4 duration-300">
              {/* Playlist Header */}
              <div className="relative h-48 bg-zinc-900">
                  {selectedPlaylist.coverUrl ? (
                      <div className="absolute inset-0">
                          <img src={selectedPlaylist.coverUrl} className="w-full h-full object-cover opacity-50 blur-lg" alt="" />
                          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent" />
                      </div>
                  ) : (
                      <div className="absolute inset-0 bg-gradient-to-b from-violet-900/20 to-zinc-950" />
                  )}
                  
                  <div className="absolute top-4 left-4 z-20">
                      <button onClick={handleBackFromPlaylist} className="p-2 bg-black/30 rounded-full hover:bg-black/50 backdrop-blur-md text-white transition-all">
                          <ArrowLeft size={20} />
                      </button>
                  </div>

                  {/* Save Button for non-owners */}
                  {!isOwner && currentUser && (
                       <div className="absolute top-4 right-4 z-20">
                           <button 
                             onClick={() => toggleSavePlaylist(selectedPlaylist.id)}
                             className={`p-2 rounded-full backdrop-blur-md transition-all flex items-center gap-2 ${isSaved ? 'bg-violet-600 text-white' : 'bg-black/30 hover:bg-black/50 text-white'}`}
                           >
                               <Bookmark size={20} fill={isSaved ? "currentColor" : "none"} />
                           </button>
                       </div>
                  )}

                  <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4 z-10">
                      <div className="w-24 h-24 rounded-lg bg-zinc-800 shadow-2xl flex-shrink-0 overflow-hidden border border-white/10">
                          {selectedPlaylist.coverUrl ? (
                              <img src={selectedPlaylist.coverUrl} className="w-full h-full object-cover" alt={selectedPlaylist.title} />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-500 bg-zinc-900">
                                  <ListMusic size={32} />
                              </div>
                          )}
                      </div>
                      <div className="mb-1">
                          <h2 className="text-2xl font-bold text-white leading-tight">{selectedPlaylist.title}</h2>
                          <p className="text-sm text-zinc-400">{isOwner ? t('profile_my_tracks') : selectedPlaylist.userId}</p>
                      </div>
                  </div>
              </div>

              {/* Tracks List */}
              <div className="p-4 space-y-2">
                  <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2 font-medium">Tracks</div>
                  {loadingPlaylistTracks ? (
                      <>
                          <TrackSkeleton />
                          <TrackSkeleton />
                      </>
                  ) : playlistTracks.length > 0 ? (
                      playlistTracks.map(track => (
                          <TrackCard 
                             key={track.id} 
                             track={track} 
                             onPlay={onPlayTrack} 
                             onOpenProfile={isOwnProfile ? undefined : undefined} 
                          />
                      ))
                  ) : (
                      <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/50">
                          <p className="text-zinc-500">No tracks in this playlist yet.</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  // --- RENDER MAIN PROFILE ---
  return (
    <div className="pb-32 animate-in fade-in slide-in-from-bottom-4 duration-300 relative">
       {showCreatePlaylist && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-sm p-6 space-y-4">
                   <h3 className="text-lg font-bold text-white">{t('profile_create_playlist')}</h3>
                   <input 
                      type="text" 
                      autoFocus
                      value={newPlaylistTitle}
                      onChange={e => setNewPlaylistTitle(e.target.value)}
                      placeholder={t('profile_playlist_name')}
                      className="w-full bg-zinc-800 border-none rounded-xl p-3 text-white focus:ring-2 focus:ring-violet-500 outline-none"
                   />
                   <div className="flex gap-3 pt-2">
                       <button 
                         onClick={() => setShowCreatePlaylist(false)}
                         className="flex-1 py-3 text-sm text-zinc-400 font-medium hover:text-white"
                       >
                           {t('profile_playlist_cancel')}
                       </button>
                       <button 
                         onClick={handleCreatePlaylist}
                         disabled={!newPlaylistTitle.trim() || creatingPlaylist}
                         className="flex-1 py-3 bg-violet-600 rounded-xl text-white font-bold text-sm hover:bg-violet-700 disabled:opacity-50 flex justify-center"
                       >
                           {creatingPlaylist ? <Loader2 className="animate-spin" size={16}/> : t('profile_playlist_create_btn')}
                       </button>
                   </div>
               </div>
           </div>
       )}

       <div className="h-40 bg-zinc-900 relative overflow-hidden">
           {profileUser.headerUrl ? (
               <img src={profileUser.headerUrl} alt="header" className="w-full h-full object-cover" />
           ) : (
               <div className="w-full h-full bg-gradient-to-b from-zinc-800 to-black" />
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
           {onBack && (
               <button onClick={onBack} className="absolute top-4 left-4 text-white/80 p-2 bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors z-20"><ArrowLeft size={20} /></button>
           )}
           {isOwnProfile && (
                <button onClick={onEditProfile} className="absolute top-4 right-4 text-white/80 p-2 bg-black/20 hover:bg-black/40 rounded-full backdrop-blur-sm transition-colors z-20"><Settings size={20} /></button>
           )}
       </div>

       <div className="px-4 -mt-16 relative z-10">
           <div className="flex flex-col items-center">
               <div className="w-32 h-32 rounded-full border-4 border-black overflow-hidden bg-zinc-800 shadow-xl relative">
                   {profileUser.photoUrl ? (
                       <img src={profileUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                   ) : (
                       <div className="w-full h-full flex items-center justify-center bg-violet-600 text-3xl font-bold">{profileUser.username[0].toUpperCase()}</div>
                   )}
               </div>
               
               <div className="flex items-center gap-2 mt-3">
                   <h2 className="text-xl font-bold text-white">@{profileUser.username}</h2>
                   {profileUser.badges && profileUser.badges.length > 0 && (
                       <div className="flex gap-1">
                           {profileUser.badges.map(b => <span key={b}>{getBadgeIcon(b)}</span>)}
                       </div>
                   )}
               </div>
               
               {profileUser.firstName && <span className="text-sm text-zinc-400">{profileUser.firstName} {profileUser.lastName}</span>}
               
               <p className="text-center text-zinc-300 text-sm mt-3 max-w-xs whitespace-pre-wrap">
                   {profileUser.bio || (isOwnProfile ? t('profile_bio_placeholder') : t('profile_no_bio'))}
               </p>

               {/* Creator Hub for Owner */}
               {isOwnProfile && profileUser.stats.uploads > 0 && (
                   <div className="w-full mt-6 bg-zinc-900/80 border border-violet-500/20 rounded-xl p-4">
                       <div className="flex items-center gap-2 mb-3 text-violet-400 font-semibold text-xs uppercase tracking-wide">
                           <TrendingUp size={14} /> Creator Hub
                       </div>
                       <div className="flex justify-between items-center text-center">
                            <div>
                                <div className="text-2xl font-bold text-white">{profileUser.stats.totalPlays.toLocaleString()}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">Total Plays</div>
                            </div>
                            <div className="h-8 w-[1px] bg-zinc-800"></div>
                            <div>
                                <div className="text-2xl font-bold text-white">{profileUser.stats.likesReceived}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">Total Likes</div>
                            </div>
                            <div className="h-8 w-[1px] bg-zinc-800"></div>
                            <div>
                                <div className="text-2xl font-bold text-white">{profileUser.stats.uploads}</div>
                                <div className="text-[10px] text-zinc-500 uppercase">Uploads</div>
                            </div>
                       </div>
                   </div>
               )}

               {/* Gate-to-Stream / Subscribe Button */}
               {profileUser.links.telegram && !isOwnProfile && (
                   <a 
                     href={profileUser.links.telegram.startsWith('http') ? profileUser.links.telegram : `https://t.me/${profileUser.links.telegram.replace('@', '')}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="mt-4 px-6 py-2.5 bg-[#2AABEE] text-white rounded-full font-bold text-sm shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform flex items-center gap-2"
                   >
                       <Send size={16} /> Subscribe to Channel
                   </a>
               )}

               {/* Standard Stats (Hidden if Creator Hub shown for owner, or shown for visitor) */}
               {(!isOwnProfile || profileUser.stats.uploads === 0) && (
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
               )}

               <div className="flex flex-wrap gap-3 mt-6 justify-center">
                   {Object.entries(profileUser.links).map(([key, url]) => {
                       if (!url || key === 'telegram') return null; // Telegram handled above
                       const linkUrl = url as string;
                       return (
                           <a key={key} href={linkUrl} target="_blank" rel="noopener noreferrer" 
                             className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-300 hover:text-white hover:border-violet-500/50 transition-all text-xs font-medium flex items-center gap-2">
                               <ExternalLink size={14} />{getLinkLabel(key, linkUrl)}
                           </a>
                       );
                   })}
               </div>
           </div>

           <div className="mt-8 flex border-b border-zinc-800 mb-4 overflow-x-auto no-scrollbar">
                <button onClick={() => setActiveTab('tracks')} className={`flex-1 min-w-[25%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'tracks' ? 'text-violet-400' : 'text-zinc-500'}`}>
                    <Music size={16} /> <span className="hidden sm:inline">{isOwnProfile ? t('profile_my_tracks') : t('profile_tracks')}</span>
                    {activeTab === 'tracks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                </button>
                <button onClick={() => setActiveTab('playlists')} className={`flex-1 min-w-[25%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'playlists' ? 'text-violet-400' : 'text-zinc-500'}`}>
                    <ListMusic size={16} /> <span className="hidden sm:inline">{t('profile_playlists')}</span>
                    {activeTab === 'playlists' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                </button>
                <button onClick={() => setActiveTab('likes')} className={`flex-1 min-w-[25%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'likes' ? 'text-violet-400' : 'text-zinc-500'}`}>
                    <Heart size={16} /> <span className="hidden sm:inline">{t('profile_likes')}</span>
                    {activeTab === 'likes' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                </button>
                 {isOwnProfile && (
                    <button onClick={() => setActiveTab('history')} className={`flex-1 min-w-[25%] pb-3 text-sm font-medium transition-colors relative flex justify-center items-center gap-2 ${activeTab === 'history' ? 'text-violet-400' : 'text-zinc-500'}`}>
                        <Clock size={16} /> <span className="hidden sm:inline">{t('profile_history')}</span>
                        {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 rounded-t-full" />}
                    </button>
                 )}
           </div>

           <div className="space-y-2">
               {activeTab === 'tracks' && (
                   userTracks.length > 0 ? (
                       userTracks.map(track => (
                           <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={isOwnProfile ? undefined : undefined} />
                       ))
                   ) : (
                       <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm">{t('profile_no_tracks')}</p></div>
                   )
               )}

               {activeTab === 'playlists' && (
                    <div className="space-y-6">
                        {/* My Playlists */}
                        <div>
                            {isOwnProfile && (
                                <button onClick={() => setShowCreatePlaylist(true)} className="w-full mb-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 border-dashed rounded-xl text-zinc-400 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                                    <Plus size={18} />{t('profile_create_playlist')}
                                </button>
                            )}
                            
                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{t('profile_playlists')}</h4>
                            
                            {loadingPlaylists ? (
                                <div className="space-y-3"><div className="h-16 bg-zinc-900 rounded-xl animate-pulse" /></div>
                            ) : playlists.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {playlists.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleOpenPlaylist(p)}
                                            className="bg-zinc-900 rounded-xl overflow-hidden border border-white/5 group cursor-pointer hover:border-violet-500/50 transition-colors"
                                        >
                                            <div className="aspect-square bg-zinc-800 relative">
                                                {p.coverUrl ? (
                                                    <img src={p.coverUrl} className="w-full h-full object-cover" alt={p.title} />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-zinc-600"><ListMusic size={32} /></div>
                                                )}
                                            </div>
                                            <div className="p-3"><h4 className="text-white text-sm font-bold truncate">{p.title}</h4></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm">{t('profile_no_playlists')}</p></div>
                            )}
                        </div>

                        {/* Saved Playlists (Only visible on own profile) */}
                        {isOwnProfile && (
                            <div>
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{t('profile_saved_playlists')}</h4>
                                {savedPlaylists.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {savedPlaylists.map(p => (
                                            <div 
                                                key={p.id} 
                                                onClick={() => handleOpenPlaylist(p)}
                                                className="bg-zinc-900 rounded-xl overflow-hidden border border-white/5 group cursor-pointer hover:border-violet-500/50 transition-colors"
                                            >
                                                <div className="aspect-square bg-zinc-800 relative">
                                                    {p.coverUrl ? (
                                                        <img src={p.coverUrl} className="w-full h-full object-cover" alt={p.title} />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-zinc-600"><ListMusic size={32} /></div>
                                                    )}
                                                    <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><Bookmark size={12} className="text-violet-400" fill="currentColor"/></div>
                                                </div>
                                                <div className="p-3"><h4 className="text-white text-sm font-bold truncate">{p.title}</h4></div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm">{t('profile_no_saved_playlists')}</p></div>
                                )}
                            </div>
                        )}
                    </div>
               )}

               {activeTab === 'likes' && (
                   loadingLikes ? <TrackSkeleton /> : likedTracks.length > 0 ? likedTracks.map(track => (
                       <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={onBack ? undefined : undefined} />
                   )) : <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm">No liked tracks.</p></div>
               )}

               {activeTab === 'history' && (
                    loadingHistory ? <TrackSkeleton /> : historyTracks.length > 0 ? historyTracks.map(track => (
                       <TrackCard key={track.id} track={track} onPlay={onPlayTrack} onOpenProfile={onBack ? undefined : undefined} />
                   )) : <div className="text-center py-8 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800"><p className="text-zinc-500 text-sm">No history.</p></div>
               )}
           </div>
       </div>
    </div>
  );
};

export default Profile;
