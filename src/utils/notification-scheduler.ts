'use client';

/**
 * Utility for scheduling daily workout notifications
 */

import { getAuthInstance } from '@/lib/firebase';

export interface WorkoutNotificationData {
  workoutTitle: string;
  exercises: string;
}

/**
 * Schedules a daily notification for tomorrow's workout
 * Uses the browser's Notification API with service worker
 */
export async function scheduleDailyNotification(
  workoutData: WorkoutNotificationData,
  preferredTime: { hour: number; minute: number } = { hour: 8, minute: 0 }
): Promise<boolean> {
  try {
    // Check if notifications are supported and permitted
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('Notifications not available or not granted');
      return false;
    }

    // Check if service worker is available
    if (!('serviceWorker' in navigator)) {
      console.warn('Service workers not supported');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    // Calculate the time for tomorrow's notification
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setDate(now.getDate() + 1);
    scheduledTime.setHours(preferredTime.hour, preferredTime.minute, 0, 0);

    const delay = scheduledTime.getTime() - now.getTime();

    // Get auth token for API call
    const auth = await getAuthInstance();
    const user = auth.currentUser;
    if (!user) {
      console.error('User not authenticated');
      return false;
    }

    const token = await user.getIdToken();

    // Generate AI message for the notification
    const response = await fetch('/api/notifications/generate-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(workoutData),
    });

    if (!response.ok) {
      throw new Error('Failed to generate notification message');
    }

    const { message } = await response.json();

    // Schedule the notification using setTimeout
    // Note: This approach works for same-session scheduling
    // For persistent scheduling across sessions, you'd need a backend service
    setTimeout(() => {
      registration.showNotification('HYBRIDX Workout', {
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        // @ts-ignore - vibrate is a valid option but not in TypeScript types yet
        vibrate: [200, 100, 200],
        data: {
          url: '/workout',
          dateOfArrival: Date.now(),
        },
        actions: [
          {
            action: 'view',
            title: 'View Workout',
          },
          {
            action: 'close',
            title: 'Dismiss',
          },
        ],
      });
    }, delay);

    // Store in localStorage to reschedule on next visit
    const notificationData = {
      workoutData,
      preferredTime,
      lastScheduled: now.toISOString(),
    };
    localStorage.setItem('workout_notification_schedule', JSON.stringify(notificationData));

    return true;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return false;
  }
}

/**
 * Checks if a notification should be scheduled and schedules it
 * Call this on app load for users who have granted permission
 */
export async function checkAndScheduleNotification(
  workoutData: WorkoutNotificationData,
  userPreferredTime?: { hour: number; minute: number }
): Promise<void> {
  if (Notification.permission !== 'granted') {
    return;
  }

  const stored = localStorage.getItem('workout_notification_schedule');
  const preferredTime = userPreferredTime || { hour: 8, minute: 0 };

  if (!stored) {
    // First time - schedule with preferred time
    await scheduleDailyNotification(workoutData, preferredTime);
    return;
  }

  try {
    const { lastScheduled } = JSON.parse(stored);
    const lastScheduledDate = new Date(lastScheduled);
    const now = new Date();

    // If last scheduled was yesterday or earlier, schedule a new one
    lastScheduledDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    if (lastScheduledDate < now) {
      await scheduleDailyNotification(workoutData, preferredTime);
    }
  } catch (error) {
    console.error('Error checking notification schedule:', error);
  }
}

/**
 * Shows an immediate test notification
 */
export async function sendTestNotification(message: string): Promise<void> {
  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers not supported');
  }

  const registration = await navigator.serviceWorker.ready;

  await registration.showNotification('HYBRIDX Workout', {
    body: message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    // @ts-ignore - vibrate is a valid option but not in TypeScript types yet
    vibrate: [200, 100, 200],
    data: {
      url: '/workout',
      dateOfArrival: Date.now(),
    },
    actions: [
      {
        action: 'view',
        title: 'View Workout',
      },
      {
        action: 'close',
        title: 'Dismiss',
      },
    ],
  });
}
