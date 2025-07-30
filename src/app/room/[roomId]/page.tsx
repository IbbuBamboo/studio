'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { VideoGrid } from '@/components/room/VideoGrid';
import { MediaControls } from '@/components/room/MediaControls';
import { ChatSidebar } from '@/components/room/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, MessageSquareOff, Copy } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
}

export interface Message {
    id: string;
    sender: string;
    content: string;
    timestamp: string;
}

function RoomPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const roomId = params.roomId as string;
  const displayName = searchParams.get('name') || 'Guest';
  
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);


  useEffect(() => {
    const setupLocalParticipant = (stream: MediaStream | null) => {
      userStreamRef.current = stream;
      const localParticipant: Participant = {
        id: 'local',
        name: `${displayName} (You)`,
        stream,
        isMuted: stream === null,
        isVideoOff: stream === null,
        isLocal: true,
        isScreenSharing: false,
      };
      
      setParticipants([localParticipant]);
    };

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setupLocalParticipant(stream);
      })
      .catch(err => {
        console.error('Failed to get local stream', err);
        toast({
          variant: 'destructive',
          title: 'No Camera/Mic Access',
          description: 'You can still participate in chat.',
        });
        setupLocalParticipant(null);
      });
      
    return () => {
      participants.forEach(p => p.stream?.getTracks().forEach(track => track.stop()));
      userStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...msg,
      id: new Date().toISOString() + Math.random(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, newMessage]);
  }

  const handleSendMessage = (content: string) => {
    addMessage({ sender: displayName, content });
  };
  
  const handleLeave = () => {
    router.push('/');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ title: 'Link Copied!', description: 'You can now share this link with others.' });
  };

  const setLocalParticipantStream = (stream: MediaStream | null) => {
     setParticipants(prev => prev.map(p => {
        if (p.isLocal) {
            return { ...p, stream };
        }
        return p;
     }));
  }

  const handleToggleScreenShare = async () => {
    const localParticipant = participants.find(p => p.isLocal);
    if (!localParticipant) return;

    if (localParticipant.isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
        setLocalParticipantStream(userStreamRef.current);
        setParticipants(prev => prev.map(p => p.isLocal ? {...p, isScreenSharing: false, isVideoOff: !userStreamRef.current?.getVideoTracks()[0]?.enabled} : p));
    } else {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenStreamRef.current = stream;
            setLocalParticipantStream(stream);
            setParticipants(prev => prev.map(p => p.isLocal ? {...p, isScreenSharing: true, isVideoOff: false} : p));

            stream.getVideoTracks()[0].onended = () => {
                screenStreamRef.current = null;
                setLocalParticipantStream(userStreamRef.current);
                setParticipants(prev => prev.map(p => p.isLocal ? {...p, isScreenSharing: false, isVideoOff: !userStreamRef.current?.getVideoTracks()[0]?.enabled} : p));
            };
        } catch (err) {
            console.error('Failed to get screen share stream', err);
            toast({ variant: 'destructive', title: 'Could not share screen' });
        }
    }
  };


  const toggleMedia = (type: 'audio' | 'video') => {
    setParticipants(prev => prev.map(p => {
      if (p.isLocal) {
        if (p.isScreenSharing && type === 'video') {
            toast({ title: 'Cannot turn off video while screen sharing.' });
            return p;
        }

        const streamToToggle = p.isScreenSharing ? screenStreamRef.current : userStreamRef.current;
        if (!streamToToggle) {
            toast({ variant: 'destructive', title: 'Media not available', description: 'Could not find a camera or microphone.' });
            return p;
        }

        let mediaChanged = false;
        streamToToggle.getTracks().forEach(track => {
          if (track.kind === type) {
            track.enabled = !track.enabled;
            mediaChanged = true;
          }
        });
        
        if (!mediaChanged) {
            toast({ variant: 'destructive', title: 'Media not available', description: `Could not find a ${type} track.` });
            return p;
        }

        return { ...p, isMuted: type === 'audio' ? !p.isMuted : p.isMuted, isVideoOff: type === 'video' ? !p.isVideoOff : p.isVideoOff };
      }
      return p;
    }));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <Toaster />
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold font-headline text-primary truncate">
          Secure-chat: <span className="text-foreground">{roomId}</span>
        </h1>
        <div className="flex items-center gap-2 md:gap-4">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="hidden sm:inline-flex">
              <Copy className="w-4 h-4 mr-2" />
              Copy Invite Link
            </Button>
            <div className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                <Users className="w-5 h-5" />
                <span className="font-semibold">{participants.length}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(!isChatOpen)} className="hidden md:inline-flex">
              {isChatOpen ? <MessageSquareOff /> : <MessageSquare />}
            </Button>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon"><MessageSquare /></Button>
                </SheetTrigger>
                <SheetContent className="flex flex-col p-0">
                  <ChatSidebar messages={messages} onSendMessage={handleSendMessage} />
                </SheetContent>
              </Sheet>
            </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col p-4 gap-4">
          <VideoGrid participants={participants} />
          <MediaControls
            onLeave={handleLeave}
            onToggleMute={() => toggleMedia('audio')}
            onToggleVideo={() => toggleMedia('video')}
            onToggleScreenShare={handleToggleScreenShare}
            localParticipant={participants.find(p => p.isLocal)}
          />
        </div>

        {isChatOpen && (
          <aside className="w-80 border-l hidden md:flex flex-col">
            <ChatSidebar messages={messages} onSendMessage={handleSendMessage} />
          </aside>
        )}
      </main>
    </div>
  );
}

export default function RoomPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <RoomPageContent />
        </Suspense>
    )
}
