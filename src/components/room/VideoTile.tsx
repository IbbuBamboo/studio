
'use client';
import { useEffect, useRef } from 'react';
import { Mic, MicOff, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Participant } from '@/app/room/[roomId]/page';

interface VideoTileProps {
  participant: Participant;
}

export function VideoTile({ participant }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const hasVideoStream = participant.stream && participant.stream.getVideoTracks().filter(t => t.enabled).length > 0;
  const isVideoReallyOff = participant.isVideoOff || !hasVideoStream;

  return (
    <Card className="relative overflow-hidden w-full h-full bg-card shadow-lg aspect-video rounded-lg">
      <CardContent className="p-0 w-full h-full flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoReallyOff ? 'opacity-0' : 'opacity-100'}`}
        />
        <div className={`absolute inset-0 flex items-center justify-center bg-secondary transition-opacity duration-300 ${isVideoReallyOff ? 'opacity-100' : 'opacity-0'}`}>
            <User className="w-24 h-24 text-muted-foreground" />
        </div>
        <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/50 p-1.5 rounded-lg">
          {participant.isMuted ? <MicOff className="text-destructive-foreground bg-destructive p-1 rounded-full w-6 h-6" /> : <Mic className="text-white w-5 h-5" />}
          <span className="text-white text-sm font-medium">{participant.name}</span>
        </div>
      </CardContent>
    </Card>
  );
}
