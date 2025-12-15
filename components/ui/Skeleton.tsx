import React from 'react';

export const TrackSkeleton: React.FC = () => {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 mb-4 shadow-sm animate-pulse">
      <div className="flex gap-4">
        {/* Cover Skeleton */}
        <div className="w-20 h-20 rounded-xl bg-zinc-800 flex-shrink-0" />

        {/* Info Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-2">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
            <div className="flex gap-2 mt-1">
                <div className="h-4 w-12 bg-zinc-800 rounded-full" />
                <div className="h-4 w-16 bg-zinc-800 rounded" />
            </div>
        </div>
      </div>
      
      {/* Actions Skeleton */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
         <div className="flex gap-4">
            <div className="h-4 w-8 bg-zinc-800 rounded" />
            <div className="h-4 w-8 bg-zinc-800 rounded" />
         </div>
         <div className="h-4 w-16 bg-zinc-800 rounded" />
      </div>
    </div>
  );
};