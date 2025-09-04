// src/app/(app)/subscription/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { differenceInDays, addMonths, format } from 'date-fns';
import { Loader2, CheckCircle, ShieldCheck, Star, PauseCircle, XCircle } from 'lucide-react';

import { auth } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { createCheckoutSession, pauseSubscription, cancelSubscription } from '@/services/stripe-service';
import type { User } from '@/models/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SubscriptionPage() {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [isManaging, setIsManaging] = useState(false);
    const { toast } = useToast();

    const fetchUserData = async (fbUser: FirebaseUser) => {
        const appUser = await getUserClient(fbUser.uid);
        setUser(appUser);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            if (fbUser) {
                setFirebaseUser(fbUser);
                await fetchUserData(fbUser);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSubscribe = async () => {
        if (!firebaseUser) {
            toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
            return;
        }
        setIsRedirecting(true);
        try {
            const { url } = await createCheckoutSession(firebaseUser.uid);
            if (url) {
                window.location.href = url;
            } else {
                throw new Error('Could not create checkout session.');
            }
        } catch (error: any) {
            console.error('Subscription error:', error);
            toast({ title: 'Error', description: error.message || 'Could not redirect to payment page.', variant: 'destructive' });
            setIsRedirecting(false);
        }
    };
    
    const handlePause = async () => {
        if (!user?.subscriptionId) return;
        setIsManaging(true);
        try {
            await pauseSubscription(user.id);
            toast({ title: 'Success', description: 'Your subscription has been paused.'});
            if (firebaseUser) await fetchUserData(firebaseUser);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsManaging(false);
        }
    }

    const handleCancel = async () => {
        if (!user?.subscriptionId) return;
        setIsManaging(true);
        try {
            await cancelSubscription(user.id);
            toast({ title: 'Success', description: 'Your subscription will be cancelled at the end of the current billing period.'});
            if (firebaseUser) await fetchUserData(firebaseUser);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } finally {
            setIsManaging(false);
        }
    }
    
    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <Card><CardContent className="p-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    if (user?.isAdmin) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Subscription Status</h1>
                    <p className="text-muted-foreground">Manage your subscription and billing details.</p>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-primary" />
                            Administrator Account
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">As an administrator, you have full access to all features and are exempt from billing.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const status = user?.subscriptionStatus || 'trial';
    const trialStart = user?.trialStartDate;
    const trialEndDate = trialStart ? addMonths(trialStart, 1) : new Date();
    const daysLeft = trialStart ? differenceInDays(trialEndDate, new Date()) : 0;
    const trialEndDateFormatted = trialStart ? format(trialEndDate, 'MMMM do, yyyy') : '';

    return (
        <div className="space-y-6">
             <div>
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Subscription Status</h1>
                <p className="text-muted-foreground">Manage your subscription and billing details.</p>
            </div>
            
            {status === 'active' && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CheckCircle className="h-6 w-6 text-green-500" />
                            Subscription Active
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Thank you for being a member! You have full access to all features.</p>
                    </CardContent>
                    <CardFooter className="flex-col sm:flex-row gap-2 items-start">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isManaging}>
                                    {isManaging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Pause Subscription
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Pause your subscription?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will pause your payments. You can resume anytime. Your current access will continue until the end of this billing period.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handlePause}>Confirm Pause</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isManaging}>
                                     {isManaging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Cancel Subscription
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure you want to cancel?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                       Your subscription will be cancelled at the end of the current billing period. You will lose access to all features at that time.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleCancel}>Confirm Cancellation</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
            )}

            {status === 'paused' && (
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PauseCircle className="h-6 w-6 text-yellow-500" />
                            Subscription Paused
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Your subscription is currently paused. To regain access, please re-subscribe.</p>
                    </CardContent>
                     <CardFooter>
                        <Button onClick={handleSubscribe} disabled={isRedirecting}>
                            {isRedirecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Resume Subscription (£5/month)
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {status === 'trial' && (
                <Card className="border-primary/50 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <Star className="h-6 w-6 text-yellow-400" />
                            You are on a free trial!
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {daysLeft > 0 ? (
                            <p className="text-muted-foreground">
                                You have <span className="font-bold text-foreground">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</span> left in your free trial.
                                Your trial will end on <span className="font-bold text-foreground">{trialEndDateFormatted}</span>.
                            </p>
                        ) : (
                            <p className="text-destructive">Your free trial has ended. Please subscribe to continue.</p>
                        )}
                    </CardContent>
                    <CardFooter>
                         <Button onClick={handleSubscribe} disabled={isRedirecting}>
                            {isRedirecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Subscribe Now (£5/month)
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {['expired', 'canceled', 'incomplete'].includes(status) && (
                <Card className="border-destructive/50 bg-destructive/5">
                     <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <XCircle className="h-6 w-6" />
                           {status === 'expired' && 'Subscription Expired'}
                           {status === 'canceled' && 'Subscription Cancelled'}
                           {status === 'incomplete' && 'Action Required'}
                        </CardTitle>
                        <CardDescription>
                            {user?.cancel_at_period_end 
                                ? `Your subscription is set to cancel at the end of the current period. Your access will continue until then.`
                                : `Your access is currently limited. Please subscribe to regain full access.`
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={handleSubscribe} disabled={isRedirecting}>
                            {isRedirecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             Re-subscribe Now (£5/month)
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}
