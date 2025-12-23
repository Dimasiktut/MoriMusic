
import React from 'react';

export const TrackSkeleton: React.FC = () => {
  return (
    <div className="bg-zinc-900 border border-white/5 rounded-[1.5rem] p-3.5 mb-4 shadow-sm animate-pulse">
      <div className="flex gap-4">
        {/* Cover Skeleton */}
        <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex-shrink-0" />

        {/* Info Skeleton */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5">
            <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
            <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
            <div className="flex gap-2 mt-1">
                <div className="h-3 w-10 bg-zinc-800 rounded-md" />
                <div className="h-3 w-14 bg-zinc-800 rounded" />
            </div>
        </div>
      </div>
      
      {/* Actions Skeleton */}
      <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-white/5">
         <div className="flex gap-4">
            <div className="h-3 w-6 bg-zinc-800 rounded" />
            <div className="h-3 w-6 bg-zinc-800 rounded" />
         </div>
         <div className="h-3 w-12 bg-zinc-800 rounded" />
      </div>
    </div>
  );
};
