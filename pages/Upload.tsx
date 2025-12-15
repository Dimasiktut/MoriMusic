import React, { useState, useRef } from 'react';
import { useStore } from '../services/store';
import { UploadCloud, Image as ImageIcon, Music } from 'lucide-react';
import { GENRES } from '../constants';

interface UploadProps {
  onUploadSuccess: () => void;
}

const Upload: React.FC<UploadProps> = ({ onUploadSuccess }) => {
  const { uploadTrack } = useStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState(GENRES[0]);
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);
      setPreviewCover(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !title) return;

    // Create persistent URLs for the session
    const audioUrl = URL.createObjectURL(audioFile);
    const coverUrl = coverFile ? URL.createObjectURL(coverFile) : 'https://picsum.photos/400/400?random=default';

    uploadTrack({
      title,
      description,
      genre,
      audioUrl,
      coverUrl,
      duration: 180, // Mock duration since we can't easily parse without metadata libs
    });

    onUploadSuccess();
  };

  return (
    <div className="p-4 pb-32">
       <h1 className="text-2xl font-bold text-white mb-6 mt-2">Upload Track</h1>
       
       <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* File Inputs */}
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
                            <span className="text-xs text-white">Change</span>
                        </div>
                    </>
                ) : (
                    <>
                        <ImageIcon className="text-zinc-500 mb-2" size={24} />
                        <span className="text-xs text-zinc-500">Add Cover</span>
                    </>
                )}
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
             </div>

             {/* Audio Upload */}
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
                            Remove
                         </button>
                     </div>
                 ) : (
                     <>
                        <UploadCloud className="text-zinc-500 mb-2" size={24} />
                        <span className="text-xs text-zinc-500">Upload MP3/WAV</span>
                     </>
                 )}
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
             </div>
          </div>

          <div className="space-y-4">
              <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Title</label>
                  <input 
                    required
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none"
                    placeholder="Track Name"
                  />
              </div>

              <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Genre</label>
                  <select 
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none appearance-none"
                  >
                      {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
              </div>

              <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white focus:ring-1 focus:ring-violet-500 outline-none h-24 resize-none"
                    placeholder="Tell us about your track..."
                  />
              </div>
          </div>

          <button 
            type="submit"
            disabled={!audioFile || !title}
            className="w-full bg-violet-600 hover:bg-violet-700 active:scale-95 text-white font-bold py-4 rounded-xl shadow-lg shadow-violet-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publish Track
          </button>
       </form>
    </div>
  );
};

export default Upload;