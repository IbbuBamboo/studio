
import { VideoTile } from './VideoTile';
import { cn } from '@/lib/utils';
import type { Participant } from '@/app/room/[roomId]/page';

interface VideoGridProps {
  participants: Participant[];
}

export function VideoGrid({ participants }: VideoGridProps) {
  const count = participants.length;

  return (
    <div
      className={cn(
        'grid flex-1 gap-4 items-center justify-center',
        count > 0 && {
          'grid-cols-1 grid-rows-1': count === 1,
          'grid-cols-2 grid-rows-1': count === 2,
          'grid-cols-2 grid-rows-2': count > 2 && count <= 4,
          'grid-cols-3 grid-rows-2': count > 4 && count <= 6,
          'grid-cols-3 grid-rows-3': count > 6 && count <= 9,
          'grid-cols-4 grid-rows-3': count > 9,
        }
      )}
    >
      {participants.map(p => (
        <VideoTile key={p.id} participant={p} />
      ))}
      {count === 0 && (
        <div className="flex flex-col gap-4 items-center justify-center text-muted-foreground">
            <div className="w-16 h-16 border-4 border-dashed rounded-full border-primary animate-spin"></div>
            <p className="text-lg">Connecting to room...</p>
        </div>
      )}
    </div>
  );
}
