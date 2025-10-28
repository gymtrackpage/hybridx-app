
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Award } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { createUser } from '@/services/user-service-client';
import { getTopPrograms, type ProgramRecommendation } from '@/services/program-recommendation';
import { getProgramClient } from '@/services/program-service-client';
import { adjustTrainingPlan } from '@/ai/flows/adjust-training-plan';
import type { Workout } from '@/models/types';

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const completePendingStravaAuth = async () => {
    const pendingAuth = localStorage.getItem('pending-strava-auth');
    if (pendingAuth) {
        try {
            const { code, scope, timestamp } = JSON.parse(pendingAuth);
            
            // Check if the code is still fresh (codes expire quickly)
            if (Date.now() - timestamp < 300000) { // 5 minutes
                localStorage.removeItem('pending-strava-auth');
                
                // We need to set the session cookie before redirecting
                const auth = await getAuthInstance();
                const idToken = await auth.currentUser?.getIdToken(true);

                await fetch('/api/auth/session', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ idToken }),
                });

                // Redirect to complete the Strava connection
                window.location.href = `/api/strava/exchange?code=${code}&scope=${scope}`;
                return true; // Indicate that a redirect is happening
            }
        } catch (error) {
            console.error('Failed to parse pending Strava auth:', error);
        }
        
        localStorage.removeItem('pending-strava-auth');
        toast({
            title: 'Strava Connection Expired',
            description: 'Please try connecting to Strava again from your profile.',
            variant: 'destructive'
        });
    }
    return false; // No redirect
  };

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      const auth = await getAuthInstance();
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);

      // CRITICAL FIX: Always create session cookie on login for server-side auth
      console.log('🍪 Creating session cookie after login...');
      const idToken = await userCredential.user.getIdToken(true);
      if (idToken) {
          await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          });
          console.log('✅ Session cookie created successfully');
      }

      const wasRedirected = await completePendingStravaAuth();

      if (!wasRedirected) {
          toast({
            title: 'Login Successful',
            description: 'Redirecting to your dashboard...',
          });
          router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      let description = 'An unexpected error occurred. Please try again.';
      if (error.code === AuthErrorCodes.INVALID_LOGIN_CREDENTIALS) {
        description = 'Invalid email or password. Please try again.';
      }
      toast({
        title: 'Login Failed',
        description,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
    // Don't setIsLoading(false) if redirecting, to prevent button flicker
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-headline">Welcome Back</CardTitle>
        <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Sign Up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  experience: z.enum(['beginner', 'intermediate', 'advanced']),
  frequency: z.enum(['3', '4', '5+']),
  goal: z.enum(['strength', 'endurance', 'hybrid']),
  selectedProgramId: z.string().optional(),
});

type SignupData = z.infer<typeof signupSchema>;

const initialSignupData: Partial<SignupData> = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  experience: 'beginner',
  frequency: '3',
  goal: 'hybrid',
  selectedProgramId: undefined,
};

export function SignupForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<SignupData>>(initialSignupData);

  const handleNext = (data: Partial<SignupData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep((prev) => prev + 1);
  };

  const handlePrev = () => {
    setStep((prev) => prev - 1);
  };
  
  const handleSubmit = async (data: Partial<SignupData>) => {
    setIsLoading(true);
    const finalData = { ...formData, ...data } as SignupData;

    try {
      const auth = await getAuthInstance();
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, finalData.email, finalData.password);
      const user = userCredential.user;

      // 1.5. CRITICAL FIX: Create session cookie immediately after signup
      console.log('🍪 Creating session cookie after signup...');
      const idToken = await user.getIdToken(true);
      if (idToken) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        console.log('✅ Session cookie created successfully');
      }


      // 2. Prepare user data
      let customProgram: Workout[] | null = null;
      let adjustmentMessage = "";

      // 3. If program selected, check if AI adjustment is needed
      if (finalData.selectedProgramId) {
        try {
          const selectedProgram = await getProgramClient(finalData.selectedProgramId);

          if (selectedProgram && selectedProgram.programType === 'hyrox') {
            // Count non-rest workouts in the program
            const nonRestWorkouts = selectedProgram.workouts.filter(
              w => !w.title.toLowerCase().includes('rest')
            );

            // Check if adjustment is needed based on user's frequency preference
            const userFrequencyNumber = parseInt(finalData.frequency, 10);
            const needsAdjustment = finalData.frequency !== '5+' &&
                                   nonRestWorkouts.length > userFrequencyNumber;

            if (needsAdjustment) {
              toast({
                title: 'Tailoring your program...',
                description: 'Our AI coach is adjusting the program to fit your schedule.',
              });

              // Call AI to adjust the program
              const result = await adjustTrainingPlan({
                currentWorkouts: selectedProgram.workouts as any,
                targetDays: finalData.frequency as '3' | '4',
              });

              customProgram = result.adjustedWorkouts as Workout[];
              adjustmentMessage = ` We've intelligently adjusted it to fit your ${finalData.frequency}-day schedule!`;
            }
          }
        } catch (adjustError) {
          console.error('Program adjustment failed:', adjustError);
          // Continue without adjustment if it fails
        }
      }

      // 4. Save user profile data to Firestore with selected program
      await createUser(user.uid, {
        email: finalData.email,
        firstName: finalData.firstName,
        lastName: finalData.lastName,
        experience: finalData.experience,
        frequency: finalData.frequency,
        goal: finalData.goal,
        programId: finalData.selectedProgramId || null,
        startDate: finalData.selectedProgramId ? new Date() : undefined,
        customProgram: customProgram,
      });

      const programMessage = finalData.selectedProgramId
        ? " Your selected program is ready to start!" + adjustmentMessage
        : " You can select a program from your dashboard.";

      toast({
          title: "Account Created!",
          description: "Welcome." + programMessage,
      });
      router.push('/dashboard');

    } catch (error: any) {
        console.error('Signup error:', error);
        let description = "An unexpected error occurred. Please try again.";
        if (error.code === AuthErrorCodes.EMAIL_EXISTS) {
            description = "This email address is already in use.";
        } else if (error.code === AuthErrorCodes.WEAK_PASSWORD) {
            description = "The password is too weak. Please choose a stronger password.";
        }
        toast({
            title: "Signup Failed",
            description,
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl">
      {step === 1 && <Step1 onNext={handleNext} defaultValues={formData} />}
      {step === 2 && <Step2 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 3 && <Step3 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 4 && <Step4 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 5 && <Step5 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 6 && <Step6 onSubmit={handleSubmit} onPrev={handlePrev} defaultValues={formData} isLoading={isLoading} />}
    </Card>
  );
}

function Step1({ onNext, defaultValues }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ email: true, password: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)}>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Start your journey with HYBRIDX.CLUB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="name@example.com" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="password" render={({ field }) => (
            <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min. 8 characters" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function Step2({ onNext, onPrev, defaultValues }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ firstName: true, lastName: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)}>
        <CardHeader>
          <CardTitle>Tell us your name</CardTitle>
          <CardDescription>Let's get personal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="Jane" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function Step3({ onNext, onPrev, defaultValues }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ experience: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)}>
        <CardHeader><CardTitle>Fitness Assessment (1/3)</CardTitle><CardDescription>What is your current experience level?</CardDescription></CardHeader>
        <CardContent>
          <FormField control={form.control} name="experience" render={({ field }) => (
            <FormItem><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="beginner" /></FormControl><FormLabel className="font-normal">Beginner (New to structured training)</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="intermediate" /></FormControl><FormLabel className="font-normal">Intermediate (Consistent training for 6+ months)</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="advanced" /></FormControl><FormLabel className="font-normal">Advanced (Years of dedicated training)</FormLabel></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function Step4({ onNext, onPrev, defaultValues }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ frequency: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)}>
        <CardHeader><CardTitle>Fitness Assessment (2/3)</CardTitle><CardDescription>How many days per week can you train?</CardDescription></CardHeader>
        <CardContent>
          <FormField control={form.control} name="frequency" render={({ field }) => (
            <FormItem><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="3" /></FormControl><FormLabel className="font-normal">3 days / week</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="4" /></FormControl><FormLabel className="font-normal">4 days / week</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="5+" /></FormControl><FormLabel className="font-normal">5+ days / week</FormLabel></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function Step5({ onNext, onPrev, defaultValues }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ goal: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)}>
        <CardHeader><CardTitle>Fitness Assessment (3/3)</CardTitle><CardDescription>What is your primary training goal?</CardDescription></CardHeader>
        <CardContent>
          <FormField control={form.control} name="goal" render={({ field }) => (
            <FormItem><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="space-y-2">
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="strength" /></FormControl><FormLabel className="font-normal">Build Strength</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="endurance" /></FormControl><FormLabel className="font-normal">Improve Endurance</FormLabel></FormItem>
              <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="hybrid" /></FormControl><FormLabel className="font-normal">Hybrid (Balanced approach)</FormLabel></FormItem>
            </RadioGroup></FormControl><FormMessage /></FormItem>
          )} />
        </CardContent>
        <CardFooter className="justify-between">
          <Button type="button" variant="ghost" onClick={onPrev}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
          <Button type="submit">Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
        </CardFooter>
      </form>
    </Form>
  );
}

function Step6({ onSubmit, onPrev, defaultValues, isLoading }: any) {
  // Get top 3 program recommendations based on user preferences
  const recommendations = getTopPrograms({
    experience: defaultValues.experience,
    frequency: defaultValues.frequency,
    goal: defaultValues.goal
  }, 3);

  const form = useForm({
    defaultValues: {
      selectedProgramId: recommendations[0]?.program.id || ''
    }
  });

  const selectedProgramId = form.watch('selectedProgramId');

  const handleStartNow = () => {
    const dataWithProgram = {
      ...defaultValues,
      selectedProgramId: form.getValues('selectedProgramId')
    };
    onSubmit(dataWithProgram);
  };

  const handleSkip = () => {
    const dataWithoutProgram = {
      ...defaultValues,
      selectedProgramId: undefined
    };
    onSubmit(dataWithoutProgram);
  };

  return (
    <Form {...form}>
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Award className="h-6 w-6 text-primary" />
          <CardTitle>Choose Your Program</CardTitle>
        </div>
        <CardDescription>
          Select a program to start immediately, or skip and choose later from your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="selectedProgramId"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="space-y-4"
                >
                  {recommendations.map((rec, index) => {
                    const isTopMatch = index === 0;
                    const isSelected = selectedProgramId === rec.program.id;

                    return (
                      <div
                        key={rec.program.id}
                        className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : isTopMatch
                            ? 'border-primary/30 hover:border-primary/50'
                            : 'border-border hover:border-primary/30'
                        }`}
                      >
                        <FormItem className="flex items-start space-x-3 space-y-0">
                          <FormControl>
                            <RadioGroupItem value={rec.program.id} className="mt-1" />
                          </FormControl>
                          <div className="flex-1 space-y-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <FormLabel className="font-bold text-base cursor-pointer">
                                  {rec.program.name}
                                </FormLabel>
                                {isTopMatch && (
                                  <span className="inline-flex items-center rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                                    Best Match
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {rec.matchPercentage}% match • {rec.program.duration} weeks • {rec.program.daysPerWeek} days/week
                              </p>
                            </div>

                            <p className="text-sm">{rec.program.description}</p>

                            {rec.matchReasons.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Why this fits:</p>
                                {rec.matchReasons.slice(0, 2).map((reason, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs">
                                    <CheckCircle2 className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">{reason}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {rec.considerations.length > 0 && isSelected && (
                              <div className="space-y-1 border-t pt-2">
                                <p className="text-xs font-medium text-muted-foreground">Things to consider:</p>
                                {rec.considerations.map((consideration, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-xs">
                                    <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">{consideration}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </FormItem>
                      </div>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="bg-muted/50 rounded-lg p-4 text-sm">
          <p className="font-medium mb-1">Not sure yet?</p>
          <p className="text-muted-foreground text-xs">
            You can skip program selection and browse all available programs from your dashboard after creating your account.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onPrev}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleSkip} disabled={isLoading}>
            Skip for Now
          </Button>
          <Button onClick={handleStartNow} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Now
          </Button>
        </div>
      </CardFooter>
    </Form>
  );
}
