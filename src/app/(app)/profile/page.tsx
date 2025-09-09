
// src/app/(app)/profile/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Loader2, Link as LinkIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient, updateUser } from '@/services/user-service-client';
import type { User, PersonalRecords, UserRunningProfile } from '@/models/types';
import { timeStringToSeconds, secondsToTimeString } from '@/lib/pace-utils';

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
});

const recordsFormSchema = z.object({
    backSquat: z.string().optional(),
    deadlift: z.string().optional(),
    benchPress: z.string().optional(),
    run1k: z.string().optional(),
    run5k: z.string().optional(),
    run10k: z.string().optional(),
});

const runningProfileSchema = z.object({
    mile: z.string().optional(),
    fiveK: z.string().optional(),
    tenK: z.string().optional(),
    halfMarathon: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;
type RecordsFormData = z.infer<typeof recordsFormSchema>;
type RunningProfileFormData = z.infer<typeof runningProfileSchema>;

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
  });

  const recordsForm = useForm<RecordsFormData>({
    resolver: zodResolver(recordsFormSchema),
  });

  const runningForm = useForm<RunningProfileFormData>({
    resolver: zodResolver(runningProfileSchema),
  });


  useEffect(() => {
    const initialize = async () => {
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const currentUser = await getUserClient(firebaseUser.uid);
            setUser(currentUser);
            if (currentUser) {
            profileForm.reset({
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                experience: currentUser.experience,
            });
            recordsForm.reset({
                backSquat: currentUser.personalRecords?.backSquat || '',
                deadlift: currentUser.personalRecords?.deadlift || '',
                benchPress: currentUser.personalRecords?.benchPress || '',
                run1k: currentUser.personalRecords?.run1k || '',
                run5k: currentUser.personalRecords?.run5k || '',
                run10k: currentUser.personalRecords?.run10k || '',
            });
            runningForm.reset({
                mile: currentUser.runningProfile?.benchmarkPaces?.mile ? secondsToTimeString(currentUser.runningProfile.benchmarkPaces.mile) : '',
                fiveK: currentUser.runningProfile?.benchmarkPaces?.fiveK ? secondsToTimeString(currentUser.runningProfile.benchmarkPaces.fiveK) : '',
                tenK: currentUser.runningProfile?.benchmarkPaces?.tenK ? secondsToTimeString(currentUser.runningProfile.benchmarkPaces.tenK) : '',
                halfMarathon: currentUser.runningProfile?.benchmarkPaces?.halfMarathon ? secondsToTimeString(currentUser.runningProfile.benchmarkPaces.halfMarathon) : '',
            })
            }
        }
        setLoading(false);
        });
        return unsubscribe;
    };
    
    let unsubscribe: () => void;
    initialize().then(unsub => unsubscribe = unsub);

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [profileForm, recordsForm, runningForm]);

  const handleProfileSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    try {
      await updateUser(user.id, data);
      toast({ title: 'Success', description: 'Your profile has been updated.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update profile.', variant: 'destructive' });
    }
  };

  const handleRecordsSubmit = async (data: RecordsFormData) => {
    if (!user) return;
    try {
      // Filter out empty strings
      const recordsToUpdate = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== ''));
      await updateUser(user.id, { personalRecords: recordsToUpdate });
      toast({ title: 'Success', description: 'Your personal records have been updated.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update records.', variant: 'destructive' });
    }
  };

  const handleRunningSubmit = async (data: RunningProfileFormData) => {
    if (!user) return;
    try {
        const benchmarkPaces: { [key: string]: number } = {};
        
        const paceData = {
            mile: data.mile ? timeStringToSeconds(data.mile, 'mile') : undefined,
            fiveK: data.fiveK ? timeStringToSeconds(data.fiveK, '5k') : undefined,
            tenK: data.tenK ? timeStringToSeconds(data.tenK, '10k') : undefined,
            halfMarathon: data.halfMarathon ? timeStringToSeconds(data.halfMarathon, 'half-marathon') : undefined,
        };

        // Only add paces to the object if they are valid numbers greater than 0
        for (const [key, value] of Object.entries(paceData)) {
            if (value && value > 0) {
                benchmarkPaces[key] = value;
            }
        }

        const profileToUpdate: UserRunningProfile = {
            benchmarkPaces,
        };
        
        await updateUser(user.id, { runningProfile: profileToUpdate });
        toast({ title: 'Success', description: 'Your running profile has been updated.' });
    } catch (error: any) {
        console.error("Detailed error updating running profile:", error);
        toast({ title: 'Error', description: `Failed to update running profile: ${error.message}`, variant: 'destructive' });
    }
  };

  const initiateStravaAuth = () => {
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId) {
      toast({ title: 'Error', description: 'Strava integration is not configured correctly.', variant: 'destructive' });
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/strava/exchange`);
    const scope = 'read,activity:read_all,activity:write';
    
    const authUrl = `https://www.strava.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${redirectUri}&` +
      `approval_prompt=force&` +
      `scope=${scope}`;
      
    window.location.href = authUrl;
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-1/2" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Your Profile</h1>
        <p className="text-muted-foreground">Manage your personal information and track your achievements.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your name and experience level.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                  <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                  <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={profileForm.control} name="experience" render={({ field }) => (
                  <FormItem><FormLabel>Experience Level</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-1">
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="beginner" /></FormControl><FormLabel className="font-normal">Beginner</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="intermediate" /></FormControl><FormLabel className="font-normal">Intermediate</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="advanced" /></FormControl><FormLabel className="font-normal">Advanced</FormLabel></FormItem>
                  </RadioGroup></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  {profileForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
        
        <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect your account to other services.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Button onClick={initiateStravaAuth} variant="outline" disabled={!!user?.strava?.accessToken}>
                    <LinkIcon className="mr-2"/>
                    {user?.strava?.accessToken ? 'Connected to Strava' : 'Connect with Strava'}
                  </Button>
              </CardContent>
            </Card>

            <Card>
                <Form {...runningForm}>
                    <form onSubmit={runningForm.handleSubmit(handleRunningSubmit)}>
                        <CardHeader>
                            <CardTitle>Running Profile</CardTitle>
                            <CardDescription>Enter at least one recent race time to calculate your training paces.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={runningForm.control} name="mile" render={({ field }) => (
                                <FormItem><FormLabel>Best Mile Time</FormLabel><FormControl><Input placeholder="e.g., 06:30" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={runningForm.control} name="fiveK" render={({ field }) => (
                                <FormItem><FormLabel>Best 5k Time</FormLabel><FormControl><Input placeholder="e.g., 25:00" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={runningForm.control} name="tenK" render={({ field }) => (
                                <FormItem><FormLabel>Best 10k Time</FormLabel><FormControl><Input placeholder="e.g., 52:00" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={runningForm.control} name="halfMarathon" render={({ field }) => (
                                <FormItem><FormLabel>Best Half Marathon Time</FormLabel><FormControl><Input placeholder="e.g., 01:55:00" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={runningForm.formState.isSubmitting}>
                                {runningForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Running Profile
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>

            <Card>
                <Form {...recordsForm}>
                    <form onSubmit={recordsForm.handleSubmit(handleRecordsSubmit)}>
                        <CardHeader>
                            <CardTitle>HYROX Personal Records</CardTitle>
                            <CardDescription>Log your strength and hybrid benchmarks. Use units like "kg", "lbs", or time "hh:mm:ss".</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={recordsForm.control} name="backSquat" render={({ field }) => (
                                <FormItem><FormLabel>Back Squat (1RM)</FormLabel><FormControl><Input placeholder="e.g., 100kg" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={recordsForm.control} name="deadlift" render={({ field }) => (
                                <FormItem><FormLabel>Deadlift (1RM)</FormLabel><FormControl><Input placeholder="e.g., 150kg" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={recordsForm.control} name="benchPress" render={({ field }) => (
                                <FormItem><FormLabel>Bench Press (1RM)</FormLabel><FormControl><Input placeholder="e.g., 80kg" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={recordsForm.control} name="run1k" render={({ field }) => (
                                <FormItem><FormLabel>1km Run</FormLabel><FormControl><Input placeholder="e.g., 03:30" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={recordsForm.control} name="run5k" render={({ field }) => (
                                <FormItem><FormLabel>5km Run</FormLabel><FormControl><Input placeholder="e.g., 20:00" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={recordsForm.control} name="run10k" render={({ field }) => (
                                <FormItem><FormLabel>10km Run</FormLabel><FormControl><Input placeholder="e.g., 45:00" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={recordsForm.formState.isSubmitting}>
                                {recordsForm.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Records
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>

      </div>
    </div>
  );
}
