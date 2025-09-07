
// src/lib/pace-utils.ts
import type { User } from '@/models/types';

/**
 * VDOT calculation based on Jack Daniels' formula.
 * VDOT is a measure of your running ability.
 */
function calculateVdot(distanceMeters: number, timeSeconds: number): number {
    if (timeSeconds <= 0) return 0;
    const velocity = distanceMeters / (timeSeconds / 60); // meters per minute
    const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeSeconds) + 0.2989558 * Math.exp(-0.1932605 * timeSeconds);
    const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
    return vo2 / percentMax;
}

/**
 * Calculates training paces based on VDOT.
 * These percentages are derived from Jack Daniels' Running Formula tables.
 */
function getPacesFromVdot(vdot: number): Record<string, number> {
    const maxVelocity = 29.54 + 5.000663 * vdot - 0.007546 * vdot * vdot; // meters per minute
    const metersPerMile = 1609.34;

    const calculatePace = (percentage: number) => {
        const pacePerMeter = 1 / (maxVelocity * percentage); // minutes per meter
        return (pacePerMeter * metersPerMile) * 60; // seconds per mile
    };
    
    return {
        easy: calculatePace(0.7),      // ~70% of max velocity
        marathon: calculatePace(0.83), // ~83%
        threshold: calculatePace(0.88),// ~88%
        interval: calculatePace(0.975),// ~97.5%
        repetition: calculatePace(1.05), // ~105%
        recovery: calculatePace(0.65),   // ~65%
    };
}


/**
 * Converts a time string (e.g., "25:30" or "4:55" or "01:55:00") to seconds.
 */
export function timeStringToSeconds(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const parts = timeStr.split(':').map(part => parseInt(part, 10)).filter(num => !isNaN(num));
    if (parts.length === 2) { // MM:SS or HH:MM
        // Heuristic: if first part > 59, it's likely HH:MM for a long race like a half marathon
        if (parts[0] > 59) { 
             return parts[0] * 3600 + parts[1] * 60; // Treat as HH:MM
        }
        return parts[0] * 60 + parts[1]; // Treat as MM:SS
    }
    if (parts.length === 3) { // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
     if (parts.length === 1 && timeStr.split(':').length === 2) { // Handle "1:27" where last part is empty string
        return parts[0] * 3600; // Assume it's hours
    }
    return 0;
}


/**
 * Converts total seconds to a time string (e.g., "25:30").
 */
export function secondsToTimeString(totalSeconds: number): string {
    if (!totalSeconds || totalSeconds <= 0) return '';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);
    
    const paddedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const paddedSeconds = seconds < 10 ? `0${seconds}` : seconds;

    if (hours > 0) {
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }
    return `${minutes}:${paddedSeconds}`;
}


/**
 * Converts a race time over a distance to a pace in seconds per mile.
 */
export function calculatePacePerMile(timeSeconds: number, distanceMiles: number): number {
    if (!timeSeconds || !distanceMiles) return 0;
    return timeSeconds / distanceMiles;
}

/**
 * Primary function to calculate all training zones for a user based on their best race performance.
 */
export function calculateTrainingPaces(user: User): Record<string, number> | null {
    const runningProfile = user.runningProfile;
    if (!runningProfile?.benchmarkPaces) return null;

    const benchmarks = [
        { name: 'mile', distance: 1609.34, time: runningProfile.benchmarkPaces.mile || 0 },
        { name: 'fiveK', distance: 5000, time: runningProfile.benchmarkPaces.fiveK || 0 },
        { name: 'tenK', distance: 10000, time: runningProfile.benchmarkPaces.tenK || 0 },
        { name: 'halfMarathon', distance: 21097.5, time: runningProfile.benchmarkPaces.halfMarathon || 0 },
    ];
    
    let bestVdot = 0;
    
    // Find the best VDOT from all provided benchmarks
    for (const benchmark of benchmarks) {
        if (benchmark.time > 0) {
            const vdot = calculateVdot(benchmark.distance, benchmark.time);
            if (vdot > bestVdot) {
                bestVdot = vdot;
            }
        }
    }
    
    if (bestVdot === 0) return null; // No valid benchmarks provided

    let paces = getPacesFromVdot(bestVdot);
    
    // Apply safety adjustments based on experience
    const adjustmentFactor = user.experience === 'beginner' ? 1.08 : user.experience === 'intermediate' ? 1.04 : 1.0;
    
    const adjustedPaces: Record<string, number> = {};
    for (const zone in paces) {
        adjustedPaces[zone] = Math.round(paces[zone] * adjustmentFactor);
    }
    
    return adjustedPaces;
}

/**
 * Formats a pace in seconds per mile to a "MM:SS" string.
 */
export function formatPace(paceSeconds: number): string {
    if (paceSeconds <= 0) return "N/A";
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.round(paceSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}
