'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, AuthErrorCodes } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createUser } from '@/services/user-service-client';

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

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      toast({
        title: 'Login Successful',
        description: 'Redirecting to your dashboard...',
      });
      router.push('/dashboard');
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
    } finally {
      setIsLoading(false);
    }
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
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, finalData.email, finalData.password);
      const user = userCredential.user;

      // 2. Save user profile data to Firestore
      await createUser(user.uid, {
        email: finalData.email,
        firstName: finalData.firstName,
        lastName: finalData.lastName,
        experience: finalData.experience,
        frequency: finalData.frequency,
        goal: finalData.goal,
      });

      toast({
          title: "Account Created!",
          description: "Welcome. Redirecting to your dashboard.",
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
    <Card className="w-full max-w-md">
      {step === 1 && <Step1 onNext={handleNext} defaultValues={formData} />}
      {step === 2 && <Step2 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 3 && <Step3 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 4 && <Step4 onNext={handleNext} onPrev={handlePrev} defaultValues={formData} />}
      {step === 5 && <Step5 onSubmit={handleSubmit} onPrev={handlePrev} defaultValues={formData} isLoading={isLoading} />}
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

function Step5({ onSubmit, onPrev, defaultValues, isLoading }: any) {
  const form = useForm({
    resolver: zodResolver(signupSchema.pick({ goal: true })),
    defaultValues,
  });
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
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
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Finish
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
