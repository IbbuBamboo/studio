
'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Message } from '@/app/room/[roomId]/page';

interface ChatSidebarProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
}

export function ChatSidebar({ messages, onSendMessage }: ChatSidebarProps) {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    // This ensures timestamps are only generated on the client after hydration
    setTimestamp(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollableViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollableViewport) {
        setTimeout(() => {
          scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
        }, 100);
      }
    }
  }, [messages]);


  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold font-headline">Chat</h2>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/20 text-primary font-bold">
                  {msg.sender.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-sm">{msg.sender}</p>
                  <p className="text-xs text-muted-foreground">{msg.timestamp}</p>
                </div>
                <p className="text-sm leading-snug bg-secondary p-2 rounded-lg rounded-tl-none">{msg.content}</p>
              </div>
            </div>
          ))}
           {messages.length === 0 && (
            <div className="text-center text-muted-foreground pt-10">
                <p>No messages yet.</p>
                <p>Say hello!</p>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t bg-background">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button onClick={handleSend} size="icon" disabled={!newMessage.trim()} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
            <Send className="w-4 h-4" />
            <span className="sr-only">Send Message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
