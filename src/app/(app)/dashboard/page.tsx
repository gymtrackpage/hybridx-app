import { BarChart, Dumbbell, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import { motivationalCoach } from '@/ai/flows/motivational-coach';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from '@/components/ui/chart';

export const metadata: Metadata = {
  title: 'Dashboard | HyroxEdgeAI',
};

// Mock data
const todaysWorkout = {
  title: 'Full Body Strength & Endurance',
  day: 12,
  exercises: [
    { name: 'Ski Erg', details: '1000m', completed: true },
    { name: 'Sled Push', details: '4x25m', completed: true },
    { name: 'Burpee Broad Jumps', details: '30 reps', completed: false },
    { name: 'Kettlebell Swings', details: '4x15 reps', completed: false },
  ],
};

const progressData = [
  { week: 'W1', workouts: 3 },
  { week: 'W2', workouts: 4 },
  { week: 'W3', workouts: 3 },
  { week: 'W4', workouts: 5 },
];

const chartConfig = {
  workouts: {
    label: "Workouts",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const completedExercises = todaysWorkout.exercises.filter(ex => ex.completed).length;
  const totalExercises = todaysWorkout.exercises.length;
  const progressPercentage = (completedExercises / totalExercises) * 100;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Welcome back, Athlete!
        </h1>
        <p className="text-muted-foreground">Here&apos;s your plan for today. Let&apos;s get it done.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-6 w-6" />
              Today&apos;s Workout (Day {todaysWorkout.day})
            </CardTitle>
            <CardDescription>{todaysWorkout.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground w-20">Progress</span>
                <Progress value={progressPercentage} className="flex-1" />
                <span className="text-sm font-bold">{Math.round(progressPercentage)}%</span>
              </div>
              <Separator />
              <ul className="space-y-3">
                {todaysWorkout.exercises.map((ex) => (
                  <li key={ex.name} className={`flex items-center justify-between ${ex.completed ? 'text-muted-foreground line-through' : ''}`}>
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-sm text-muted-foreground">{ex.details}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Start / Resume Workout</Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-400" />
                Motivational Coach
              </CardTitle>
              <CardDescription>Your AI partner for a mental boost.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Feeling stuck? Get a personalized message from your AI coach based on your recent progress.</p>
            </CardContent>
            <CardFooter>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="w-full">Get Motivation</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Your Daily Boost</DialogTitle>
                    <DialogDescription>
                      Hey there! Remember that killer 1000m Ski Erg time you posted last week? You're building some serious power. Today is another chance to forge that strength. Every push, every rep gets you closer to your goal. You've got this!
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-6 w-6" />
                    Weekly Consistency
                </CardTitle>
                <CardDescription>
                    You've completed an average of 3.75 workouts per week this month.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-40 w-full">
                    <RechartsBarChart data={progressData} margin={{ top: 20, right: 20, bottom: -10, left: -20 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis hide={true} />
                        <Tooltip cursor={false} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="workouts" fill="hsl(var(--primary))" radius={4} />
                    </RechartsBarChart>
                </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
