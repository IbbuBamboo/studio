
'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { VideoGrid } from '@/components/room/VideoGrid';
import { MediaControls } from '@/components/room/MediaControls';
import { ChatSidebar } from '@/components/room/ChatSidebar';
import { Button } from '@/components/ui/button';
import { Users, MessageSquare, MessageSquareOff, Copy } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { WebRTCManager } from '@/lib/webrtc';


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
  const [hasMediaPermission, setHasMediaPermission] = useState<boolean | null>(null);
  
  const screenStreamRef = useRef<MediaStream | null>(null);
  const userStreamRef = useRef<MediaStream | null>(null);
  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  const handleParticipantsChange = useCallback((newParticipants: Participant[]) => {
      setParticipants(newParticipants);
  }, []);

  useEffect(() => {
    webrtcManagerRef.current = new WebRTCManager(roomId, handleParticipantsChange);
    
    // Create local participant entry immediately
    const localId = Math.random().toString(36).substring(2, 9);
    const localParticipant: Participant = {
      id: localId,
      name: `${displayName} (You)`,
      stream: null,
      isMuted: true,
      isVideoOff: true,
      isLocal: true,
      isScreenSharing: false,
    };
    setParticipants([localParticipant]);

    return () => {
      webrtcManagerRef.current?.hangUp();
      userStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, displayName, handleParticipantsChange]);


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
  
  const updateLocalParticipant = (updates: Partial<Participant>) => {
    setParticipants(prev =>
      prev.map(p => (p.isLocal ? { ...p, ...updates } : p))
    );
  };

  const requestMediaPermissions = async (): Promise<MediaStream | null> => {
    if (userStreamRef.current) return userStreamRef.current;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      userStreamRef.current = stream;
      setHasMediaPermission(true);

      const localParticipant = participants.find(p => p.isLocal);
      if(localParticipant && webrtcManagerRef.current) {
        webrtcManagerRef.current.joinRoom(stream, localParticipant);
      }
      
      // Start with media off
      stream.getAudioTracks().forEach(t => t.enabled = false);
      stream.getVideoTracks().forEach(t => t.enabled = false);

      updateLocalParticipant({ stream });
      return stream;
    } catch (err) {
      console.error('Failed to get local stream', err);
      setHasMediaPermission(false);
      toast({
        variant: 'destructive',
        title: 'No Camera/Mic Access',
        description: 'Please grant permission to use your camera and microphone.',
      });
      return null;
    }
  }


  const handleToggleScreenShare = async () => {
    const localParticipant = participants.find(p => p.isLocal);
    if (!localParticipant) return;

    if (localParticipant.isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      
      const isVideoStillOff = userStreamRef.current?.getVideoTracks().every(t => !t.enabled) ?? true;
      
      updateLocalParticipant({ 
        stream: userStreamRef.current, 
        isScreenSharing: false,
        isVideoOff: isVideoStillOff,
      });

    } else {
        const stream = await requestMediaPermissions();
        if (!stream) return;
        
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        
        screenStream.getVideoTracks()[0].onended = () => {
          handleToggleScreenShare();
        };
        
        screenStreamRef.current = screenStream;
        updateLocalParticipant({ 
          stream: screenStream, 
          isScreenSharing: true, 
          isVideoOff: false 
        });

      } catch (err: any) {
        console.error('Failed to get screen share stream', err);
        if (err.message && err.message.includes('disallowed by permissions policy')) {
            toast({
                variant: 'destructive',
                title: 'Screen Share Blocked by Environment',
                description: 'Your development environment is preventing screen sharing due to security permissions. This is not a bug in the app.'
            });
        } else if (err.name === 'NotAllowedError') {
             toast({ 
                variant: 'destructive', 
                title: 'Screen Share Permission Denied',
                description: 'You need to grant permission to share your screen.'
            });
        } else {
            toast({ 
                variant: 'destructive', 
                title: 'Could Not Share Screen',
                description: 'Your browser or an unknown issue may be blocking screen sharing.'
            });
        }
      }
    }
  };

  const toggleMedia = async (type: 'audio' | 'video') => {
    let streamToToggle = userStreamRef.current;
    if (!streamToToggle) {
        streamToToggle = await requestMediaPermissions();
        if (!streamToToggle) return;
    }

    const localParticipant = participants.find(p => p.isLocal);
    if (!localParticipant) return;
    
    if (localParticipant.isScreenSharing && type === 'video') {
      toast({ title: 'Cannot turn off video while screen sharing.' });
      return;
    }

    let track = streamToToggle.getTracks().find(t => t.kind === type);
    if(!track) {
         toast({ variant: 'destructive', title: 'Media not available', description: `Could not find a ${type} track.` });
        return;
    }

    const isEnabledNow = !track.enabled;
    track.enabled = isEnabledNow;

    if (type === 'audio') {
      updateLocalParticipant({ isMuted: !isEnabledNow });
    } else {
      updateLocalParticipant({ isVideoOff: !isEnabledNow });
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b shrink-0">
        <h1 className="text-xl font-bold font-headline text-primary truncate">
          AnonMeet: <span className="text-foreground">{roomId}</span>
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
                <SheetContent side="right" className="flex flex-col p-0 w-full max-w-sm">
                  <ChatSidebar messages={messages} onSendMessage={handleSendMessage} />
                </SheetContent>
              </Sheet>
            </div>
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col p-4 gap-4">
          <VideoGrid participants={participants} />
          {hasMediaPermission === false && (
             <Alert variant="destructive" className="max-w-xl mx-auto">
              <AlertTitle>Camera and Microphone Blocked</AlertTitle>
              <AlertDescription>
                You have denied camera and microphone permissions. To share your video or audio, please enable them in your browser's site settings.
              </AlertDescription>
            </Alert>
          )}
          <MediaControls
            onLeave={handleLeave}
            onToggleMute={() => toggleMedia('audio')}
            onToggleVideo={() => toggleMedia('video')}
            onToggleScreenShare={handleToggleScreenShare}
            onToggleChat={() => setIsChatOpen(!isChatOpen)}
            isChatOpen={isChatOpen}
            localParticipant={participants.find(p => p.isLocal)}
          />
        </div>

        {isChatOpen && (
          <aside className="w-full max-w-xs border-l hidden md:flex flex-col">
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
