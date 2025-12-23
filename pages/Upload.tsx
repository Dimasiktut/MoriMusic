
import React, { useState, useRef } from 'react';
import { useStore } from '../services/store';
import { UploadCloud, Image as ImageIcon, Music, Loader2, Layers, Music as MusicIcon, Zap } from 'lucide-react';
import { GENRES } from '../constants';

interface UploadProps {
  onUploadSuccess: () => void;
}

const Upload: React.FC<UploadProps> = ({ onUploadSuccess }) => {
  const { uploadTrack, uploadAlbum, generateTrackDescription, isLoading, t } = useStore();
  const [mode, setMode] = useState<'single' | 'album'>('single');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [albumFiles, setAlbumFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const albumInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioFile(file);
      const audio = new Audio(URL.createObjectURL(file));
      audio.onloadedmetadata = () => {
          setDuration(audio.duration);
      };
    }
  };

  const handleAlbumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        setAlbumFiles(Array.from(e.target.files));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setPreviewCover(URL.createObjectURL(file));
    }
  };

  const handleAiDescription = async () => {
      if (!title) return;
      setIsGeneratingAi(true);
      const aiText = await generateTrackDescription(title, genre);
      if (aiText) setDescription(aiText);
      setIsGeneratingAi(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'single') {
        if (!audioFile || !title) return;
        await uploadTrack({ title, description, genre, audioFile, coverFile, duration: duration || 180 });
    } else {
        if (albumFiles.length === 0 || !title) return;
        await uploadAlbum(albumFiles, { title, description, genre, coverFile });
    }
    onUploadSuccess();
  };

  return (
    <div className="p-5 pb-32">
       <h1 className="text-3xl font-black text-white mb-6 mt-4 uppercase italic tracking-tighter">{t('upload_title')}</h1>

       <div className="flex bg-zinc-900/50 p-1.5 rounded-2xl mb-8 border border-white/5">
           <button 
             type="button"
             onClick={() => setMode('single')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'single' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-500'}`}
           >
               <MusicIcon size={16} />
               {t('upload_mode_single')}
           </button>
           <button 
             type="button"
             onClick={() => setMode('album')}
             className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === 'album' ? 'bg-sky-500 text-black shadow-lg shadow-sky-500/20' : 'text-zinc-500'}`}
           >
               <Layers size={16} />
               {t('upload_mode_album')}
           </button>
       </div>
       
       <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-2 gap-4">
             <div 
                onClick={() => coverInputRef.current?.click()}
                className="aspect-square rounded-[2rem] bg-zinc-900/50 border-2 border-dashed border-white/10 hover:border-sky-500/50 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden"
             >
                {previewCover ? (
                    <>
                        <img src={previewCover} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase text-white">{t('upload_cover_change')}</span>
                        </div>
                    </>
                ) : (
                    <>
                        <ImageIcon className="text-zinc-700 mb-2" size={28} />
                        <span className="text-[10px] font-black uppercase text-zinc-500">{t('upload_cover_add')}</span>
                    </>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
             </div>

             <div 
                onClick={() => (mode === 'single' ? audioInputRef : albumInputRef).current?.click()}
                className={`aspect-square rounded-[2rem] bg-zinc-900/50 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${(mode === 'single' ? audioFile : albumFiles.length > 0) ? 'border-sky-500/50 bg-sky-500/5' : 'border-white/10 hover:border-sky-500/50'}`}
             >
                 {(mode === 'single' ? audioFile : albumFiles.length > 0) ? (
                     <div className="text-center p-4">
                         {mode === 'single' ? <Music className="text-sky-400 mb-2 mx-auto" size={28} /> : <Layers className="text-sky-400 mb-2 mx-auto" size={28} />}
                         <span className="text-[10px] font-black uppercase text-sky-400 line-clamp-2">
                             {mode === 'single' ? audioFile?.name : `${albumFiles.length} Tracks`}
                         </span>
                         <button type="button" onClick={(e) => { e.stopPropagation(); mode === 'single' ? setAudioFile(null) : setAlbumFiles([]); }} className="mt-2 text-[10px] font-black uppercase text-red-500 underline">{t('upload_audio_remove')}</button>
                     </div>
                 ) : (
                     <>
                        <UploadCloud className="text-zinc-700 mb-2" size={28} />
                        <span className="text-[10px] font-black uppercase text-zinc-500 px-2 text-center">
                            {mode === 'single' ? t('upload_audio_placeholder') : t('upload_audio_multi_placeholder')}
                        </span>
                     </>
                 )}
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
                <input ref={albumInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleAlbumChange} />
             </div>
          </div>

          <div className="space-y-6">
              <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{mode === 'single' ? t('upload_label_title') : t('upload_label_album_title')}</label>
                  <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none transition-all" placeholder={mode === 'single' ? t('upload_placeholder_title') : t('upload_placeholder_album_title')}/>
              </div>

              <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{t('upload_label_genre')}</label>
                  <div className="relative">
                    <select value={genre} onChange={(e) => setGenre(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none appearance-none transition-all">
                        {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        <Layers size={16} />
                    </div>
                  </div>
              </div>

              <div>
                  <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500">{t('upload_label_desc')}</label>
                      <button 
                        type="button" 
                        onClick={handleAiDescription}
                        disabled={!title || isGeneratingAi}
                        className="text-[10px] font-black uppercase flex items-center gap-1.5 text-sky-400 hover:text-sky-300 disabled:opacity-30 transition-all px-3 py-1 bg-sky-500/10 rounded-full border border-sky-500/20"
                      >
                        {isGeneratingAi ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} fill="currentColor"/>}
                        Magic AI
                      </button>
                  </div>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 text-sm font-bold text-white focus:ring-2 focus:ring-sky-500/50 outline-none h-32 resize-none transition-all" placeholder={t('upload_placeholder_desc')}/>
              </div>
          </div>

          <button type="submit" disabled={(mode === 'single' ? (!audioFile || !title) : (albumFiles.length === 0 || !title)) || isLoading} className="w-full bg-sky-500 hover:bg-sky-400 active:scale-95 text-black font-black uppercase tracking-widest py-5 rounded-2xl shadow-xl shadow-sky-500/20 transition-all disabled:opacity-30 flex items-center justify-center gap-3">
            {isLoading ? (<><Loader2 className="animate-spin" size={20} />{mode === 'single' ? t('upload_btn_loading') : t('upload_btn_loading_album')}</>) : (mode === 'single' ? t('upload_btn') : t('upload_btn_album'))}
          </button>
       </form>
    </div>
  );
};

export default Upload;
