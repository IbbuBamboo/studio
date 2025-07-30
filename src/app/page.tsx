"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

export default function HomePage() {
  const [roomId, setRoomId] = useState('');
  const router = useRouter();

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      router.push(`/room/${roomId.trim()}`);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center mb-4">
            <div className="p-4 bg-primary/20 rounded-full">
              <Video className="w-12 h-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl font-headline">AnonMeet</CardTitle>
          <CardDescription>Real-time anonymous video meetings. No sign up required.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter Room Name"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              className="py-6 text-center text-lg"
              aria-label="Room Name"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleJoinRoom} className="w-full py-6 text-lg" disabled={!roomId.trim()}>
            Enter Room
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
