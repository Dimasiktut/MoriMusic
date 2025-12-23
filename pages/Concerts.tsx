
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../services/store';
import { Concert } from '../types';
import { Users, Star, Gift, Send, X, ArrowLeft, Loader2 } from '../components/ui/Icons';

interface ConcertsProps {
  // Navigation props can be added here if needed
}

const Concerts: React.FC<ConcertsProps> = () => {
  const { concerts, currentUser, donateToConcert, t } = useStore();
  const [activeConcert, setActiveConcert] = useState<Concert | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<{user: string, text: string, isSystem?: boolean}[]>([]);
  const [inputText, setInputText] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  // Donation State
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [isProcessingDonation, setIsProcessingDonation] = useState(false);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, activeConcert]);

  const handleOpenConcert = (concert: Concert) => {
      setActiveConcert(concert);
      // Mock initial chat messages
      setMessages([
          { user: 'System', text: `Welcome to ${concert.title}!`, isSystem: true },
          { user: 'fan_123', text: 'Waiting for this!' },
          { user: 'music_lover', text: 'Lets goooo 🔥' },
      ]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || !currentUser) return;
      setMessages(prev => [...prev, { user: currentUser.username || 'User', text: inputText }]);
      setInputText('');
  };

  const handleDonate = async (amount: number) => {
      if (!activeConcert) return;
      setIsProcessingDonation(true);
      
      const success = await donateToConcert(activeConcert.id, amount);
      
      setIsProcessingDonation(false);
      setShowDonateModal(false);
      
      if (success) {
          // Add system message about donation
          setMessages(prev => [...prev, { 
              user: 'System', 
              text: `${currentUser?.username} sent ${amount} Stars! ⭐️`, 
              isSystem: true 
          }]);
          
          // Trigger visual feedback (simple alert for now, could be confetti)
          // Fix: Access Telegram WebApp safely using type casting to any
          if ((window as any).Telegram?.WebApp) {
             (window as any).Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      }
  };

  // --- RENDER LIST VIEW ---
  if (!activeConcert) {
      return (
          <div className="p-4 pb-32 animate-in fade-in">
              <h1 className="text-3xl font-black text-white mb-6 mt-4 uppercase italic tracking-tighter">
                  {t('concerts_title')}
              </h1>

              <div className="space-y-6">
                  {/* Live Now Section */}
                  <div>
                      <h2 className="text-[10px] font-black text-sky-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_rgba(56,189,248,0.8)]"/> {t('concerts_live_now')}
                      </h2>
                      <div className="space-y-4">
                          {concerts.filter(c => c.status === 'live').map(concert => (
                              <div 
                                key={concert.id}
                                onClick={() => handleOpenConcert(concert)}
                                className="group relative aspect-video rounded-[2rem] overflow-hidden cursor-pointer border border-white/5 bg-zinc-900 shadow-2xl transition-all hover:border-sky-500/30"
                              >
                                  <img src={concert.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80" alt=""/>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                                  
                                  <div className="absolute top-4 left-4 bg-sky-500 text-black text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider shadow-lg">
                                      LIVE
                                  </div>
                                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1 rounded-lg flex items-center gap-1.5 border border-white/10">
                                      <Users size={12} /> {concert.viewers}
                                  </div>

                                  <div className="absolute bottom-5 left-5 right-5">
                                      <h3 className="text-white font-black text-xl leading-tight uppercase italic tracking-tight">{concert.title}</h3>
                                      <div className="flex items-center gap-2 mt-2">
                                          <img src={concert.artistAvatar} className="w-6 h-6 rounded-full border border-white/10" alt=""/>
                                          <span className="text-zinc-300 text-xs font-bold">{concert.artistName}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {concerts.filter(c => c.status === 'live').length === 0 && (
                              <div className="text-zinc-600 text-xs font-black uppercase tracking-widest py-8 text-center border border-dashed border-white/5 rounded-[2rem]">
                                  No live concerts right now.
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Upcoming Section */}
                  <div>
                      <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3">
                          {t('concerts_upcoming')}
                      </h2>
                      <div className="space-y-3">
                          {concerts.filter(c => c.status !== 'live').map(concert => (
                              <div key={concert.id} className="bg-zinc-900/40 rounded-[2rem] p-4 flex gap-4 border border-white/5 transition-all hover:bg-zinc-900/60">
                                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/5">
                                      <img src={concert.coverUrl} className="w-full h-full object-cover grayscale opacity-50" alt=""/>
                                  </div>
                                  <div className="flex-1 flex flex-col justify-center">
                                      <h4 className="text-white font-black uppercase italic tracking-tight">{concert.title}</h4>
                                      <div className="text-zinc-500 text-[10px] font-bold uppercase mt-1">
                                          {new Date(concert.startTime).toLocaleDateString()} • {new Date(concert.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-2">
                                          <img src={concert.artistAvatar} className="w-4 h-4 rounded-full grayscale opacity-50" alt=""/>
                                          <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">{concert.artistName}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER ROOM VIEW ---
  return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in slide-in-from-bottom-full duration-500">
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 p-5 flex justify-between items-start bg-gradient-to-b from-black/90 to-transparent">
              <button onClick={() => setActiveConcert(null)} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10">
                  <ArrowLeft size={24} />
              </button>
              <div className="bg-sky-500/90 backdrop-blur-md px-4 py-1.5 rounded-xl text-[10px] font-black text-black shadow-lg shadow-sky-500/20 animate-pulse tracking-widest">
                  LIVE
              </div>
          </div>

          {/* Video Area */}
          <div className="w-full h-[40vh] bg-zinc-950 relative flex-shrink-0 overflow-hidden">
               {activeConcert.streamUrl ? (
                   <video 
                     src={activeConcert.streamUrl} 
                     className="w-full h-full object-cover" 
                     autoPlay 
                     muted 
                     loop 
                     playsInline 
                   />
               ) : (
                   <div className="w-full h-full flex items-center justify-center text-zinc-800 bg-zinc-950 font-black uppercase tracking-[0.3em] text-[10px]">
                       Stream Loading...
                   </div>
               )}
               {/* Progress / Info Overlay */}
               <div className="absolute bottom-6 left-6 right-6 z-10">
                   <h2 className="text-white font-black text-2xl uppercase italic drop-shadow-2xl tracking-tighter">{activeConcert.title}</h2>
                   <div className="flex items-center gap-2.5 mt-2">
                        <img src={activeConcert.artistAvatar} className="w-8 h-8 rounded-full border-2 border-white/20 shadow-xl" alt=""/>
                        <span className="text-white font-black text-sm uppercase italic drop-shadow-lg">{activeConcert.artistName}</span>
                   </div>
               </div>
          </div>

          {/* Donation Progress Bar */}
          <div className="bg-black px-6 py-4 border-b border-white/5 flex-shrink-0">
               <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                   <span className="flex items-center gap-1.5"><Star size={12} className="text-sky-400" fill="currentColor" /> Live Goal</span>
                   <span className="text-white italic">{activeConcert.currentDonations || 0} / {activeConcert.donationsGoal}</span>
               </div>
               <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden shadow-inner">
                   <div 
                     className="h-full bg-sky-400 transition-all duration-1000 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                     style={{ width: `${Math.min(100, ((activeConcert.currentDonations || 0) / (activeConcert.donationsGoal || 1)) * 100)}%` }}
                   />
               </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-black overflow-hidden flex flex-col relative">
               <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar" ref={chatRef}>
                   <div className="text-center text-zinc-800 text-[10px] font-black uppercase tracking-widest my-6">Chat Securely Encrypted</div>
                   {messages.map((msg, idx) => (
                       <div key={idx} className={`flex flex-col ${msg.isSystem ? 'items-center my-4' : 'items-start'}`}>
                           {msg.isSystem ? (
                               <span className="bg-sky-500/10 text-sky-400 text-[10px] font-black uppercase px-4 py-1.5 rounded-full border border-sky-500/20 tracking-wider shadow-sm">
                                   {msg.text}
                               </span>
                           ) : (
                               <div className="bg-zinc-900/60 backdrop-blur-md rounded-2xl rounded-tl-none px-4 py-2.5 max-w-[85%] border border-white/5 shadow-lg">
                                   <span className="text-sky-400 text-[10px] font-black uppercase block mb-1 tracking-wider italic">{msg.user}</span>
                                   <span className="text-zinc-200 text-sm font-medium">{msg.text}</span>
                               </div>
                           )}
                       </div>
                   ))}
               </div>

               {/* Donate & Chat Input */}
               <div className="p-4 bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 flex gap-3 items-center pb-safe">
                   <button 
                     onClick={() => setShowDonateModal(true)}
                     className="bg-sky-500 hover:bg-sky-400 text-black rounded-2xl p-3.5 shadow-xl shadow-sky-500/20 active:scale-95 transition-all flex items-center justify-center"
                   >
                       <Gift size={24} />
                   </button>

                   <form onSubmit={handleSendMessage} className="flex-1 relative">
                       <input 
                         type="text" 
                         value={inputText}
                         onChange={(e) => setInputText(e.target.value)}
                         placeholder={t('concerts_chat_placeholder')}
                         className="w-full bg-black border border-white/10 rounded-2xl py-3.5 pl-5 pr-12 text-white text-sm font-bold focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                       />
                       <button type="submit" disabled={!inputText.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-sky-400 hover:text-white disabled:opacity-30 transition-all">
                           <Send size={20} />
                       </button>
                   </form>
               </div>
          </div>

          {/* Donation Modal (Bottom Sheet style) */}
          {showDonateModal && (
              <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end animate-in fade-in duration-300">
                  <div className="w-full bg-zinc-950 border-t border-white/10 rounded-t-[3rem] p-8 animate-in slide-in-from-bottom duration-500 shadow-2xl">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                              <Star className="text-sky-400" fill="currentColor" /> {t('concerts_donate')}
                          </h3>
                          <button onClick={() => setShowDonateModal(false)} className="bg-zinc-900 p-2 rounded-full text-zinc-500 border border-white/5">
                              <X size={20} />
                          </button>
                      </div>

                      <p className="text-zinc-500 text-sm font-medium mb-8 leading-relaxed">Support <b>{activeConcert.artistName}</b> directly with <span className="text-sky-400">Telegram Stars</span>!</p>

                      <div className="grid grid-cols-3 gap-4 mb-8">
                          {[50, 100, 500].map(amount => (
                              <button 
                                key={amount}
                                disabled={isProcessingDonation}
                                onClick={() => handleDonate(amount)}
                                className="bg-zinc-900/50 hover:bg-sky-500 group border border-white/5 rounded-[1.5rem] py-6 flex flex-col items-center gap-2 active:scale-95 transition-all"
                              >
                                  <Star size={28} className="text-sky-400 group-hover:text-black transition-colors" fill="currentColor" />
                                  <span className="text-white font-black text-lg group-hover:text-black transition-colors italic tracking-tighter">{amount}</span>
                              </button>
                          ))}
                      </div>
                      
                      {isProcessingDonation && (
                          <div className="text-center text-[10px] font-black uppercase text-sky-400 tracking-[0.2em] flex justify-center gap-3 py-4 animate-pulse">
                              <Loader2 className="animate-spin" size={16} /> Processing payment...
                          </div>
                      )}
                      
                      <p className="text-center text-[9px] font-black uppercase tracking-widest text-zinc-700 mt-4">
                          Securely powered by Telegram Ecosystem.
                      </p>
                  </div>
              </div>
          )}

      </div>
  );
};

export default Concerts;
