
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { ArrowLeft, Camera, Save, Loader2, Image as ImageIcon } from '../components/ui/Icons';
import { User } from '../types';

interface SettingsProps {
  onBack: () => void;
}

const SettingsPage: React.FC<SettingsProps> = ({ onBack }) => {
  const { currentUser, updateProfile, uploadImage, t, language, setLanguage } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState<User['links']>({ telegram: '', yandex: '', spotify: '', soundcloud: '', other: '' });
  const [photoUrl, setPhotoUrl] = useState('');
  const [headerUrl, setHeaderUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFirstName(currentUser.firstName || '');
      setLastName(currentUser.lastName || '');
      setBio(currentUser.bio || '');
      setLinks({ telegram: currentUser.links?.telegram || '', yandex: currentUser.links?.yandex || '', spotify: currentUser.links?.spotify || '', soundcloud: currentUser.links?.soundcloud || '', other: currentUser.links?.other || '' });
      setPhotoUrl(currentUser.photoUrl || '');
      setHeaderUrl(currentUser.headerUrl || '');
    }
  }, [currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
        let finalPhotoUrl = photoUrl;
        let finalHeaderUrl = headerUrl;
        if (avatarFile) finalPhotoUrl = await uploadImage(avatarFile, 'music', `avatars/${currentUser.id}/${Date.now()}`);
        if (headerFile) finalHeaderUrl = await uploadImage(headerFile, 'music', `headers/${currentUser.id}/${Date.now()}`);
        await updateProfile({ firstName, lastName, bio, links, photoUrl: finalPhotoUrl, headerUrl: finalHeaderUrl });
        onBack();
    } catch (err) { alert(t('settings_error')); } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-black pb-32">
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur-md border-b border-white/5 p-5 flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-zinc-900 rounded-full text-white"><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-black uppercase italic tracking-tighter text-white">{t('settings_title')}</h1>
      </div>

      <div className="p-5 space-y-10">
          <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{t('settings_language')}</h3>
              <div className="flex bg-zinc-900/50 rounded-2xl p-1.5 border border-white/5">
                  <button type="button" onClick={() => setLanguage('ru')} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all ${language === 'ru' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-600'}`}>Русский</button>
                  <button type="button" onClick={() => setLanguage('en')} className={`flex-1 py-3 text-xs font-black uppercase rounded-xl transition-all ${language === 'en' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-600'}`}>English</button>
              </div>
          </div>

          <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{t('settings_header')}</h3>
              <div onClick={() => headerInputRef.current?.click()} className="w-full h-40 rounded-[2rem] bg-zinc-900/50 border-2 border-dashed border-white/5 hover:border-sky-500/50 flex items-center justify-center cursor-pointer relative overflow-hidden transition-all group">
                  {headerUrl ? <img src={headerUrl} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" alt="" /> : <div className="text-zinc-700 flex flex-col items-center gap-2"><ImageIcon size={32} /><span className="text-[10px] font-black uppercase">{t('settings_header_add')}</span></div>}
                  <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if(e.target.files?.[0]) { setHeaderFile(e.target.files[0]); setHeaderUrl(URL.createObjectURL(e.target.files[0])); } }} />
              </div>

              <div className="flex flex-col items-center -mt-12 relative z-10">
                <div onClick={() => fileInputRef.current?.click()} className="relative w-32 h-32 rounded-full bg-zinc-900 border-[8px] border-black shadow-2xl overflow-hidden cursor-pointer group">
                  {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center bg-sky-500 text-black text-3xl font-black italic">M</div>}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"><Camera size={28} className="text-white" /></div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { if(e.target.files?.[0]) { setAvatarFile(e.target.files[0]); setPhotoUrl(URL.createObjectURL(e.target.files[0])); } }} />
                </div>
                <p className="mt-2 text-[10px] font-black uppercase text-zinc-600">{t('settings_avatar_hint')}</p>
              </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600">{t('settings_public_info')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none transition-all" placeholder={t('settings_firstname')}/>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none transition-all" placeholder={t('settings_lastname')}/>
            </div>
            <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none h-32 resize-none transition-all" placeholder={t('settings_bio_placeholder')} maxLength={150}/>
          </div>

          <button type="submit" onClick={handleSave} disabled={isSaving} className="w-full bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-sky-500/20 transition-all flex items-center justify-center gap-3">
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> {t('settings_save')}</>}
          </button>
      </div>
    </div>
  );
};

export default SettingsPage;
