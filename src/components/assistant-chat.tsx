'use client';

import { useState, useRef, useEffect } from 'react';
import { CornerDownLeft, Loader2, Sparkles } from 'lucide-react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

import { trainingAssistant } from '@/ai/flows/training-assistant';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Logo } from './icons';
import { Skeleton } from './ui/skeleton';
import { getUserClient } from '@/services/user-service';
import { getProgramClient } from '@/services/program-service';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getOrCreateWorkoutSession, getAllUserSessions } from '@/services/session-service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Helper function to fetch all necessary data on the client, using client-side SDK functions
const getUserWorkoutData = async (userId: string) => {
    const user = await getUserClient(userId);
    if (!user) {
        return { user: null };
    }

    const sessions = await getAllUserSessions(userId);

    if (user.programId && user.startDate) {
        const program = await getProgramClient(user.programId);
        if(program) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const { workout } = getWorkoutForDay(program, user.startDate, today);
            if (workout) {
                const session = await getOrCreateWorkoutSession(userId, program.id, today, workout);
                return { user, program, todaysWorkout: workout, todaysSession: session, allSessions: sessions };
            }
            return { user, program, allSessions: sessions, todaysWorkout: null };
        }
    }
    return { user, allSessions: sessions };
};


export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hello! I'm your AI Training Assistant. How can I help you improve your performance today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
      }
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }
  }, [messages]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !currentUser) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Fetch data on the client-side
      const userData = await getUserWorkoutData(currentUser.uid);
      
      // 2. Pass the fetched data to the AI flow
      const result = await trainingAssistant({ 
          question: input,
          userData: JSON.stringify(userData) // Pass data as a string
      });

      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.answer,
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error calling training assistant:", error);
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting right now. Please try again later.",
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!authChecked) {
      return (
          <Card className="flex flex-1 flex-col">
              <CardContent className="flex-1 p-6">
                  <div className="space-y-4">
                      <Skeleton className="h-10 w-2/3" />
                      <Skeleton className="h-10 w-1/2 ml-auto" />
                      <Skeleton className="h-10 w-2/3" />
                  </div>
              </CardContent>
              <CardFooter className='border-t pt-6'>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
          </Card>
      )
  }

  return (
    <Card className="flex flex-1 flex-col">
      <CardHeader>
        {/* Can be used for status indicators */}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4" ref={scrollAreaRef as any}>
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-start gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8 border bg-primary text-primary-foreground flex items-center justify-center">
                    <Logo className="h-6 w-6" />
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-md rounded-lg p-3 text-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p>{message.content}</p>
                </div>
                {message.role === 'user' && (
                  <Avatar className="h-8 w-8 border">
                    <AvatarFallback>{currentUser?.email?.[0].toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
                 <div className='flex items-start gap-3 justify-start'>
                    <Avatar className="h-8 w-8 border bg-primary text-primary-foreground flex items-center justify-center">
                        <Logo className="h-6 w-6" />
                    </Avatar>
                    <div className='max-w-md rounded-lg p-3 bg-muted flex items-center gap-2'>
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className='text-sm text-muted-foreground'>Thinking...</span>
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t pt-6">
        <form onSubmit={handleSubmit} className="relative w-full">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={currentUser ? "e.g., How can I improve my sled push time?" : "Please log in to use the assistant."}
            className="pr-12"
            disabled={isLoading || !currentUser}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            disabled={isLoading || !input.trim() || !currentUser}
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
