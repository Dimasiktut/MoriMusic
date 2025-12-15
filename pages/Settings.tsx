import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { ArrowLeft, Camera, Save, Globe } from '../components/ui/Icons';
import { User } from '../types';

interface SettingsProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, updateProfile } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<User['links']>({
    yandex: '',
    spotify: '',
    soundcloud: '',
    other: ''
  });
  const [photoUrl, setPhotoUrl] = useState('');

  // Initial load
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setBio(currentUser.bio || '');
      setLinks({
        yandex: currentUser.links?.yandex || '',
        spotify: currentUser.links?.spotify || '',
        soundcloud: currentUser.links?.soundcloud || '',
        other: currentUser.links?.other || ''
      });
      setPhotoUrl(currentUser.photoUrl || '');
    }
  }, [currentUser]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setPhotoUrl(url);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      firstName,
      lastName,
      bio,
      links,
      photoUrl
    });
    onBack();
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">Edit Profile</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-900 shadow-xl overflow-hidden cursor-pointer group"
            >
              {photoUrl ? (
                <img src={photoUrl} alt="avatar" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-violet-600 text-3xl font-bold">
                   {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={32} className="text-white drop-shadow-md" />
              </div>
              
              <input 
                ref={fileInputRef} 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange} 
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">Tap to change photo</p>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Public Info</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">First Name</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                  placeholder="Alex"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">Last Name</label>
                <input 
                  type="text" 
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                  placeholder="Mori"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Bio</label>
              <textarea 
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none min-h-[100px] resize-none transition-all"
                placeholder="Tell the world about your music..."
                maxLength={150}
              />
              <div className="text-right text-[10px] text-zinc-600 mt-1">{bio.length}/150</div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Social Links</h3>
            
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
                  <Globe size={18} />
                </div>
                <input 
                  type="url"
                  value={links.soundcloud || ''}
                  onChange={e => setLinks({...links, soundcloud: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-700 transition-all"
                  placeholder="SoundCloud URL"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
                  <Globe size={18} />
                </div>
                <input 
                  type="url"
                  value={links.spotify || ''}
                  onChange={e => setLinks({...links, spotify: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-700 transition-all"
                  placeholder="Spotify URL"
                />
              </div>

              <div className="relative">
                <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
                  <Globe size={18} />
                </div>
                <input 
                  type="url"
                  value={links.yandex || ''}
                  onChange={e => setLinks({...links, yandex: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-700 transition-all"
                  placeholder="Yandex Music URL"
                />
              </div>
              
              <div className="relative">
                <div className="absolute left-3 top-3 text-zinc-500 pointer-events-none">
                  <Globe size={18} />
                </div>
                <input 
                  type="url"
                  value={links.other || ''}
                  onChange={e => setLinks({...links, other: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-700 transition-all"
                  placeholder="Other (VK, YouTube, etc.)"
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-violet-900/20 transition-all"
          >
            <Save size={18} />
            Save Changes
          </button>

        </form>
      </div>
    </div>
  );
};

export default SettingsPage;