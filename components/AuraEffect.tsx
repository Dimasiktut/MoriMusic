
import React from 'react';

export type VibeType = 'phonk' | 'lofi' | 'electronic' | 'rock' | 'default';

interface AuraEffectProps {
  vibe?: VibeType;
}

const VIBE_COLORS: Record<VibeType, { primary: string, secondary: string }> = {
  phonk: { primary: 'bg-fuchsia-600', secondary: 'bg-purple-900' },
  lofi: { primary: 'bg-emerald-400', secondary: 'bg-teal-900' },
  electronic: { primary: 'bg-sky-400', secondary: 'bg-blue-900' },
  rock: { primary: 'bg-red-600', secondary: 'bg-orange-900' },
  default: { primary: 'bg-sky-500', secondary: 'bg-zinc-800' }
};

const AuraEffect: React.FC<AuraEffectProps> = ({ vibe = 'default' }) => {
  const colors = VIBE_COLORS[vibe];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
      {/* Primary Glowing Blob */}
      <div className={`absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full ${colors.primary} blur-[80px] animate-pulse duration-[4000ms]`} />
      
      {/* Secondary Moving Blob */}
      <div className={`absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full ${colors.secondary} blur-[100px] animate-bounce-slow`} 
           style={{ animationDuration: '8s' }} />
      
      {/* Center Aura for Avatar */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-white/10 blur-[40px] rounded-full" />
    </div>
  );
};

export default AuraEffect;
