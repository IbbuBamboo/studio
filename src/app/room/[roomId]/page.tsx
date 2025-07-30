'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { VideoGrid } from '@/components/room/VideoGrid';
import { MediaControls } from '@/components/room/MediaControls';
import { ChatSidebar } from '@/components/room/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, MessageSquareOff, Copy } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

export interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isLocal?: boolean;
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

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        const localParticipant: Participant = {
          id: 'local',
          name: `${displayName} (You)`,
          stream,
          isMuted: false,
          isVideoOff: false,
          isLocal: true,
        };
        setParticipants(prev => [localParticipant, ...prev]);

        // Mock other participants joining
        setTimeout(() => {
          const mockParticipant1: Participant = {
            id: 'peer-1', name: 'Alice', stream: new MediaStream(), isMuted: true, isVideoOff: false
          };
          setParticipants(prev => [...prev, mockParticipant1]);
        }, 1500);
        setTimeout(() => {
          const mockParticipant2: Participant = {
            id: 'peer-2', name: 'Bob', stream: new MediaStream(), isMuted: false, isVideoOff: true
          };
          setParticipants(prev => [...prev, mockParticipant2]);
        }, 2500);
      })
      .catch(err => {
        console.error('Failed to get local stream', err);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not access camera and microphone. Please check permissions.',
        });
        router.push('/');
      });

    // Mock incoming messages
    setTimeout(() => {
      addMessage({ sender: 'Alice', content: 'Hey everyone!' });
    }, 3500);

    return () => {
      participants.forEach(p => p.stream?.getTracks().forEach(track => track.stop()));
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

  const toggleMedia = (type: 'audio' | 'video') => {
    setParticipants(prev => prev.map(p => {
      if (p.isLocal) {
        p.stream?.getTracks().forEach(track => {
          if (track.kind === type) {
            track.enabled = !track.enabled;
          }
        });
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
            onToggleScreenShare={() => toast({ title: 'Screen sharing is not yet implemented.' })}
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
