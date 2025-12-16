
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
          // @ts-ignore
          if (window.Telegram?.WebApp) {
             // @ts-ignore
             window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
          }
      }
  };

  // --- RENDER LIST VIEW ---
  if (!activeConcert) {
      return (
          <div className="p-4 pb-32 animate-in fade-in">
              <h1 className="text-2xl font-bold text-white mb-6 mt-2 flex items-center gap-2">
                  <Star className="text-yellow-400 fill-yellow-400" /> {t('concerts_title')}
              </h1>

              <div className="space-y-6">
                  {/* Live Now Section */}
                  <div>
                      <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/> {t('concerts_live_now')}
                      </h2>
                      <div className="space-y-4">
                          {concerts.filter(c => c.status === 'live').map(concert => (
                              <div 
                                key={concert.id}
                                onClick={() => handleOpenConcert(concert)}
                                className="group relative aspect-video rounded-2xl overflow-hidden cursor-pointer border border-white/10"
                              >
                                  <img src={concert.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt=""/>
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                                  
                                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                                      LIVE
                                  </div>
                                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-md text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                                      <Users size={12} /> {concert.viewers}
                                  </div>

                                  <div className="absolute bottom-3 left-3 right-3">
                                      <h3 className="text-white font-bold text-lg leading-tight">{concert.title}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                          <img src={concert.artistAvatar} className="w-5 h-5 rounded-full" alt=""/>
                                          <span className="text-zinc-300 text-xs">{concert.artistName}</span>
                                      </div>
                                  </div>
                              </div>
                          ))}
                          {concerts.filter(c => c.status === 'live').length === 0 && (
                              <div className="text-zinc-500 text-sm italic py-4">No live concerts right now.</div>
                          )}
                      </div>
                  </div>

                  {/* Upcoming Section */}
                  <div>
                      <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">
                          {t('concerts_upcoming')}
                      </h2>
                      <div className="space-y-3">
                          {concerts.filter(c => c.status !== 'live').map(concert => (
                              <div key={concert.id} className="bg-zinc-900 rounded-xl p-3 flex gap-4 border border-white/5 opacity-70">
                                  <div className="w-16 h-16 rounded-lg bg-zinc-800 flex-shrink-0 overflow-hidden">
                                      <img src={concert.coverUrl} className="w-full h-full object-cover grayscale" alt=""/>
                                  </div>
                                  <div className="flex-1 flex flex-col justify-center">
                                      <h4 className="text-white font-medium">{concert.title}</h4>
                                      <div className="text-zinc-500 text-xs mt-1">
                                          {new Date(concert.startTime).toLocaleDateString()} • {new Date(concert.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-2">
                                          <img src={concert.artistAvatar} className="w-4 h-4 rounded-full grayscale" alt=""/>
                                          <span className="text-zinc-400 text-xs">{concert.artistName}</span>
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
      <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-in slide-in-from-bottom-full duration-300">
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
              <button onClick={() => setActiveConcert(null)} className="p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/20">
                  <ArrowLeft size={24} />
              </button>
              <div className="bg-red-600/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg animate-pulse">
                  LIVE
              </div>
          </div>

          {/* Video Area */}
          <div className="w-full h-[40vh] bg-zinc-900 relative flex-shrink-0">
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
                   <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-900">
                       Video Stream Placeholder
                   </div>
               )}
               {/* Progress / Info Overlay */}
               <div className="absolute bottom-4 left-4 right-4 z-10">
                   <h2 className="text-white font-bold text-xl drop-shadow-md">{activeConcert.title}</h2>
                   <div className="flex items-center gap-2 mt-1">
                        <img src={activeConcert.artistAvatar} className="w-6 h-6 rounded-full border border-white" alt=""/>
                        <span className="text-white font-medium text-sm drop-shadow-md">{activeConcert.artistName}</span>
                   </div>
               </div>
          </div>

          {/* Donation Progress Bar */}
          <div className="bg-zinc-900 px-4 py-3 border-b border-white/5 flex-shrink-0">
               <div className="flex justify-between text-xs text-zinc-400 mb-1">
                   <span className="flex items-center gap-1"><Star size={10} className="text-yellow-400 fill-yellow-400" /> Goal</span>
                   <span>{activeConcert.currentDonations || 0} / {activeConcert.donationsGoal}</span>
               </div>
               <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000"
                     style={{ width: `${Math.min(100, ((activeConcert.currentDonations || 0) / (activeConcert.donationsGoal || 1)) * 100)}%` }}
                   />
               </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 bg-zinc-950 overflow-hidden flex flex-col relative">
               <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={chatRef}>
                   <div className="text-center text-zinc-600 text-xs my-4">Chat started</div>
                   {messages.map((msg, idx) => (
                       <div key={idx} className={`flex flex-col ${msg.isSystem ? 'items-center my-2' : 'items-start'}`}>
                           {msg.isSystem ? (
                               <span className="bg-white/10 text-yellow-300 text-xs px-3 py-1 rounded-full border border-yellow-500/30">
                                   {msg.text}
                               </span>
                           ) : (
                               <div className="bg-zinc-900/80 rounded-xl rounded-tl-none px-3 py-2 max-w-[85%] border border-white/5">
                                   <span className="text-violet-400 text-xs font-bold block mb-0.5">{msg.user}</span>
                                   <span className="text-zinc-200 text-sm">{msg.text}</span>
                               </div>
                           )}
                       </div>
                   ))}
               </div>

               {/* Donate & Chat Input */}
               <div className="p-3 bg-zinc-900 border-t border-white/10 flex gap-2 items-center pb-safe">
                   <button 
                     onClick={() => setShowDonateModal(true)}
                     className="bg-yellow-500 hover:bg-yellow-400 text-black rounded-full p-3 shadow-lg shadow-yellow-900/20 active:scale-95 transition-transform"
                   >
                       <Gift size={24} />
                   </button>

                   <form onSubmit={handleSendMessage} className="flex-1 relative">
                       <input 
                         type="text" 
                         value={inputText}
                         onChange={(e) => setInputText(e.target.value)}
                         placeholder={t('concerts_chat_placeholder')}
                         className="w-full bg-zinc-800 border border-zinc-700 rounded-full py-2.5 pl-4 pr-10 text-white text-sm focus:ring-1 focus:ring-violet-500 outline-none"
                       />
                       <button type="submit" disabled={!inputText.trim()} className="absolute right-1 top-1 p-1.5 text-violet-400 hover:text-white disabled:opacity-50">
                           <Send size={18} />
                       </button>
                   </form>
               </div>
          </div>

          {/* Donation Modal (Bottom Sheet style) */}
          {showDonateModal && (
              <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in">
                  <div className="w-full bg-zinc-900 border-t border-white/10 rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300">
                      <div className="flex justify-between items-center mb-4">
                          <h3 className="text-white font-bold text-lg flex items-center gap-2">
                              <Star className="text-yellow-400 fill-yellow-400" /> {t('concerts_donate')}
                          </h3>
                          <button onClick={() => setShowDonateModal(false)} className="bg-zinc-800 p-1 rounded-full text-zinc-400">
                              <X size={20} />
                          </button>
                      </div>

                      <p className="text-zinc-400 text-sm mb-6">Support <b>{activeConcert.artistName}</b> directly with Telegram Stars!</p>

                      <div className="grid grid-cols-3 gap-3 mb-4">
                          {[50, 100, 500].map(amount => (
                              <button 
                                key={amount}
                                disabled={isProcessingDonation}
                                onClick={() => handleDonate(amount)}
                                className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl py-4 flex flex-col items-center gap-1 active:scale-95 transition-all"
                              >
                                  <Star size={24} className="text-yellow-400 fill-yellow-400" />
                                  <span className="text-white font-bold">{amount}</span>
                              </button>
                          ))}
                      </div>
                      
                      {isProcessingDonation && (
                          <div className="text-center text-sm text-zinc-400 flex justify-center gap-2 py-2">
                              <Loader2 className="animate-spin" /> Processing payment...
                          </div>
                      )}
                      
                      <p className="text-center text-[10px] text-zinc-600 mt-2">
                          Secure payment via Telegram. 
                          <br/> Developer commission included.
                      </p>
                  </div>
              </div>
          )}

      </div>
  );
};

export default Concerts;
