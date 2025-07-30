'use client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Settings } from 'lucide-react';
import type { Participant } from '@/app/room/[roomId]/page';
import { cn } from '@/lib/utils';

interface MediaControlsProps {
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  localParticipant?: Participant;
}

export function MediaControls({ onLeave, onToggleMute, onToggleVideo, onToggleScreenShare, localParticipant }: MediaControlsProps) {
  const isMuted = localParticipant?.isMuted ?? true;
  const isVideoOff = localParticipant?.isVideoOff ?? true;
  const isScreenSharing = localParticipant?.isScreenSharing ?? false;
  const hasMedia = !!localParticipant?.stream;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex justify-center items-center gap-2 md:gap-4 p-4 mt-auto bg-card rounded-xl shadow-lg w-full max-w-xl mx-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={isMuted ? "destructive" : "outline"} size="lg" className="rounded-full w-14 h-14 md:w-16 md:h-16" onClick={onToggleMute} disabled={!localParticipant?.stream?.getAudioTracks().length}>
              {isMuted ? <MicOff className="w-6 h-6 md:w-7 md:h-7" /> : <Mic className="w-6 h-6 md:w-7 md:h-7" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={isVideoOff ? "destructive" : "outline"} size="lg" className="rounded-full w-14 h-14 md:w-16 md:h-16" onClick={onToggleVideo} disabled={isScreenSharing || !localParticipant?.stream?.getVideoTracks().length}>
              {isVideoOff ? <VideoOff className="w-6 h-6 md:w-7 md:h-7" /> : <Video className="w-6 h-6 md:w-7 md:h-7" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isVideoOff ? 'Start Video' : 'Stop Video'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="lg" className={cn("rounded-full w-14 h-14 md:w-16 md:h-16", isScreenSharing && "bg-blue-500 text-white hover:bg-blue-600")} onClick={onToggleScreenShare}>
              {isScreenSharing ? <ScreenShareOff className="w-6 h-6 md:w-7 md:h-7" /> : <ScreenShare className="w-6 h-6 md:w-7 md:h-7" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="lg" className="rounded-full w-14 h-14 md:w-16 md:h-16 hidden sm:flex">
              <Settings className="w-6 h-6 md:w-7 md:h-7" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>

        <div className="h-10 border-l mx-2"></div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="destructive" size="lg" className="rounded-full w-14 h-14 md:w-16 md:h-16" onClick={onLeave}>
              <PhoneOff className="w-6 h-6 md:w-7 md:h-7" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Leave Call</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
