"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Video } from 'lucide-react';

export default function HomePage() {
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const router = useRouter();

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8);
  }

  const handleContinue = () => {
    const name = displayName.trim() || 'Guest';
    let code = roomCode.trim();

    if (!code) {
      code = generateRoomCode();
    }
    
    router.push(`/room/${code}?name=${encodeURIComponent(name)}`);
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
          <CardTitle className="text-3xl font-headline">Secure-chat</CardTitle>
          <CardDescription>Create a new room or join an existing one. It's fast, secure, and anonymous.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter your name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="py-6 text-center text-lg"
              aria-label="Display Name"
            />
            <Input
              type="text"
              placeholder="Enter room code (or leave blank to create)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
              className="py-6 text-center text-lg"
              aria-label="Room Code"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleContinue} className="w-full py-6 text-lg">
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
