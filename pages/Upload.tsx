import React, { useState, useRef } from 'react';
import { useStore } from '../services/store';
import { UploadCloud, Image as ImageIcon, Music, Loader2, Layers, Music as MusicIcon } from 'lucide-react';
import { GENRES } from '../constants';

interface UploadProps {
  onUploadSuccess: () => void;
}

const Upload: React.FC<UploadProps> = ({ onUploadSuccess }) => {
  const { uploadTrack, uploadAlbum, isLoading, t } = useStore();
  const [mode, setMode] = useState<'single' | 'album'>('single');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  
  // Single File
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  
  // Album Files
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'single') {
        if (!audioFile || !title) return;
        await uploadTrack({
          title,
          description,
          genre,
          audioFile,
          coverFile,
          duration: duration || 180, 
        });
    } else {
        if (albumFiles.length === 0) return;
        await uploadAlbum(albumFiles, {
            description,
            genre,
            coverFile
        });
    }

    onUploadSuccess();
  };

  return (
    <div className="p-4 pb-32">
       <h1 className="text-2xl font-bold text-white mb-6 mt-2">{t('upload_title')}</h1>

       {/* Mode Switcher */}
       <div className="flex bg-zinc-900 p-1 rounded-xl mb-6 border border-zinc-800">
           <button 
             type="button"
             onClick={() => setMode('single')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'single' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500'}`}
           >
               <MusicIcon size={16} />
               {t('upload_mode_single')}
           </button>
           <button 
             type="button"
             onClick={() => setMode('album')}
             className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'album' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500'}`}
           >
               <Layers size={16} />
               {t('upload_mode_album')}
           </button>
       </div>
       
       <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
             {/* Cover Upload */}
             <div 
                onClick={() => coverInputRef.current?.click()}
                className="aspect-square rounded-2xl bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-violet-500 flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden"
             >
                {previewCover ? (
                    <>
                        <img src={previewCover} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white">{t('upload_cover_change')}</span>
                        </div>
                    </>
                ) : (
                    <>
                        <ImageIcon className="text-zinc-500 mb-2" size={24} />
                        <span className="text-xs text-zinc-500">{t('upload_cover_add')}</span>
                    </>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
             </div>

             {/* Audio Upload */}
             {mode === 'single' ? (
                 <div 
                    onClick={() => audioInputRef.current?.click()}
                    className={`aspect-square rounded-2xl bg-zinc-900 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${audioFile ? 'border-green-500/50 bg-green-900/10' : 'border-zinc-700 hover:border-violet-500'}`}
                 >
                     {audioFile ? (
                         <div className="text-center p-2">
                             <Music className="text-green-500 mb-2 mx-auto" size={24} />
                             <span className="text-xs text-green-400 line-clamp-2">{audioFile.name}</span>
                             <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setAudioFile(null); }}
                                className="mt-2 text-xs text-red-400 underline"
                             >
                                {t('upload_audio_remove')}
                             </button>
                         </div>
                     ) : (
                         <>
                            <UploadCloud className="text-zinc-500 mb-2" size={24} />
                            <span className="text-xs text-zinc-500">{t('upload_audio_placeholder')}</span>
                         </>
                     )}
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
                 </div>
             ) : (
                 <div 
                    onClick={() => albumInputRef.current?.click()}
                    className={`aspect-square rounded-2xl bg-zinc-900 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${albumFiles.length > 0 ? 'border-green-500/50 bg-green-900/10' : 'border-zinc-700 hover:border-violet-500'}`}
                 >
                     {albumFiles.length > 0 ? (
                         <div className="text-center p-2">
                             <Layers className="text-green-500 mb-2 mx-auto" size={24} />
                             <span className="text-xs text-green-400 font-bold">{albumFiles.length} Tracks</span>
                             <div className="text-[10px] text-zinc-500 mt-1 line-clamp-2">
                                 {albumFiles.map(f => f.name).join(', ')}
                             </div>
                             <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setAlbumFiles([]); }}
                                className="mt-2 text-xs text-red-400 underline"
                             >
                                {t('upload_audio_remove')}
                             </button>
                         </div>
                     ) : (
                         <>
                            <Layers className="text-zinc-500 mb-2" size={24} />
                            <span className="text-xs text-zinc-500 text-center px-2">{t('upload_audio_multi_placeholder')}</span>
                         </>
                     )}
                    <input ref={albumInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleAlbumChange} />
                 </div>
             )}
          </div>

          <div className="space-y-4">
              {mode === 'single' && (
                  <div>
                      <label className="block text-xs font-medium text-zinc-400 mb-1">{t('upload_label_title')}</label>
                      <input 
                        required
                        type="text" 
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none"
                        placeholder={t('upload_placeholder_title')}
                      />
                  </div>
              )}

              <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">{t('upload_label_genre')}</label>
                  <select 
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none appearance-none"
                  >
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
              </div>

              <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">{t('upload_label_desc')}</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none h-24 resize-none"
                    placeholder={t('upload_placeholder_desc')}
                  />
              </div>
          </div>

          <button 
            type="submit"
            disabled={(mode === 'single' ? (!audioFile || !title) : (albumFiles.length === 0)) || isLoading}
            className="w-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold py-4 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    {t('upload_btn_loading')}
                </>
            ) : (
                mode === 'single' ? t('upload_btn') : t('upload_btn_album')
            )}
          </button>
       </form>
    </div>
  );
};

export default Upload;