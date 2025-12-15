
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { ArrowLeft, Camera, Save, Globe, Loader2, Image as ImageIcon, Send } from '../components/ui/Icons';
import { User } from '../types';

interface SettingsProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, updateProfile, uploadImage, t, language, setLanguage } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<User['links']>({
    telegram: '',
    yandex: '',
    spotify: '',
    soundcloud: '',
    other: ''
  });
  
  // Image State
  const [photoUrl, setPhotoUrl] = useState('');
  const [headerUrl, setHeaderUrl] = useState('');
  
  // File State
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  
  // Saving State
  const [isSaving, setIsSaving] = useState(false);

  // Initial load
  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setBio(currentUser.bio || '');
      setLinks({
        telegram: currentUser.links?.telegram || '',
        yandex: currentUser.links?.yandex || '',
        spotify: currentUser.links?.spotify || '',
        soundcloud: currentUser.links?.soundcloud || '',
        other: currentUser.links?.other || ''
      });
      setPhotoUrl(currentUser.photoUrl || '');
      setHeaderUrl(currentUser.headerUrl || '');
    }
  }, [currentUser]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPhotoUrl(URL.createObjectURL(file)); // Preview
    }
  };

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setHeaderFile(file);
      setHeaderUrl(URL.createObjectURL(file)); // Preview
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setIsSaving(true);
    try {
        let finalPhotoUrl = photoUrl;
        let finalHeaderUrl = headerUrl;

        // 1. Upload Avatar if changed
        if (avatarFile) {
            const path = `avatars/${currentUser.id}/${Date.now()}_avatar`;
            finalPhotoUrl = await uploadImage(avatarFile, 'music', path);
        }

        // 2. Upload Header if changed
        if (headerFile) {
            const path = `headers/${currentUser.id}/${Date.now()}_header`;
            finalHeaderUrl = await uploadImage(headerFile, 'music', path);
        }

        // 3. Update Profile
        await updateProfile({
          firstName,
          lastName,
          bio,
          links,
          photoUrl: finalPhotoUrl,
          headerUrl: finalHeaderUrl
        });
        
        onBack();
    } catch (err) {
        console.error("Failed to save profile:", err);
        alert(t('settings_error'));
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 p-4 flex items-center gap-4">
        <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-white">{t('settings_title')}</h1>
      </div>

      <div className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSave} className="space-y-8">

          {/* Language Selector */}
          <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{t('settings_language')}</h3>
              <div className="flex bg-zinc-900 rounded-lg p-1 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLanguage('ru')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${language === 'ru' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
                  >
                      Русский
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${language === 'en' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
                  >
                      English
                  </button>
              </div>
          </div>
          
          {/* Images Section */}
          <div className="space-y-4">
              {/* Header Image */}
              <div>
                  <label className="block text-xs text-zinc-400 mb-2">{t('settings_header')}</label>
                  <div 
                    onClick={() => headerInputRef.current?.click()}
                    className="w-full h-32 rounded-xl bg-zinc-900 border-2 border-dashed border-zinc-800 hover:border-violet-500 cursor-pointer relative overflow-hidden group transition-colors"
                  >
                      {headerUrl ? (
                          <>
                            <img src={headerUrl} alt="Header" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                <ImageIcon size={24} className="text-white" />
                            </div>
                          </>
                      ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 gap-2">
                              <ImageIcon size={20} />
                              <span className="text-xs">{t('settings_header_add')}</span>
                          </div>
                      )}
                      <input 
                        ref={headerInputRef} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleHeaderChange} 
                      />
                  </div>
              </div>

              {/* Avatar - Centered and overlapping if possible, but keep simple layout for now */}
              <div className="flex flex-col items-center -mt-8 relative z-10">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full bg-zinc-800 border-4 border-zinc-950 shadow-xl overflow-hidden cursor-pointer group"
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt="avatar" className="w-full h-full object-cover opacity-100 group-hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-violet-600 text-3xl font-bold">
                       {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <Camera size={24} className="text-white drop-shadow-md" />
                  </div>
                  
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleAvatarChange} 
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">{t('settings_avatar_hint')}</p>
              </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{t('settings_public_info')}</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('settings_firstname')}</label>
                <input 
                  type="text" 
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                  placeholder="Alex"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">{t('settings_lastname')}</label>
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
              <label className="block text-xs text-zinc-400 mb-1.5">{t('settings_bio')}</label>
              <textarea 
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none min-h-[100px] resize-none transition-all"
                placeholder={t('settings_bio_placeholder')}
                maxLength={150}
              />
              <div className="text-right text-[10px] text-zinc-600 mt-1">{bio.length}/150</div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">{t('settings_socials')}</h3>
            
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute left-3 top-3 text-blue-400 pointer-events-none">
                  <Send size={18} />
                </div>
                <input 
                  type="text"
                  value={links.telegram || ''}
                  onChange={e => setLinks({...links, telegram: e.target.value})}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 pl-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-700 transition-all"
                  placeholder="@your_channel_link"
                />
              </div>

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
                  placeholder={t('settings_other_placeholder')}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
                <>
                    <Loader2 className="animate-spin" size={18} /> {t('settings_saving')}
                </>
            ) : (
                <>
                    <Save size={18} /> {t('settings_save')}
                </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
