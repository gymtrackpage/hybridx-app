// Program Recommendation Service
// Matches user preferences from signup to the best Hyrox program

import { hyroxProgramsComparison, type ProgramComparison, recommendationWeights } from '@/data/hyrox-programs-comparison';

export interface UserPreferences {
  experience: 'beginner' | 'intermediate' | 'advanced';
  frequency: '3' | '4' | '5+';
  goal: 'strength' | 'endurance' | 'hybrid';
}

export interface ProgramRecommendation {
  program: ProgramComparison;
  score: number;
  matchPercentage: number;
  matchReasons: string[];
  considerations: string[];
}

/**
 * Calculate how well a program matches user preferences
 * Returns a score from 0-100
 */
function calculateMatchScore(
  program: ProgramComparison,
  preferences: UserPreferences
): { score: number; reasons: string[]; considerations: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const considerations: string[] = [];

  // 1. Experience Level Match (40 points max)
  if (program.experienceLevel === preferences.experience) {
    score += recommendationWeights.experienceMatch;
    reasons.push(`Perfect match for ${preferences.experience} level athletes`);
  } else {
    // Partial credit for adjacent levels
    const experienceLevels = ['beginner', 'intermediate', 'advanced'];
    const userIndex = experienceLevels.indexOf(preferences.experience);
    const programIndex = experienceLevels.indexOf(program.experienceLevel);
    const difference = Math.abs(userIndex - programIndex);

    if (difference === 1) {
      score += recommendationWeights.experienceMatch * 0.5;
      if (programIndex > userIndex) {
        considerations.push('This program may be challenging - consider if you\'re ready for the next level');
      } else {
        considerations.push('This program may be easier than ideal - could be good for building confidence');
      }
    } else {
      considerations.push(`Designed for ${program.experienceLevel} athletes - may not match your level`);
    }
  }

  // 2. Training Frequency Match (30 points max)
  if (program.requiredFrequency === preferences.frequency) {
    score += recommendationWeights.frequencyMatch;
    reasons.push(`Fits your ${preferences.frequency} days/week schedule perfectly`);
  } else {
    // Check if program frequency is compatible
    const userFreq = parseInt(preferences.frequency);
    const programFreq = parseInt(program.requiredFrequency);

    if (!isNaN(userFreq) && !isNaN(programFreq)) {
      if (programFreq <= userFreq) {
        // Program requires less than user can commit - good!
        score += recommendationWeights.frequencyMatch * 0.8;
        reasons.push(`Only requires ${program.daysPerWeek} days/week - you have flexibility`);
      } else {
        // Program requires more than user can commit - warning
        score += recommendationWeights.frequencyMatch * 0.3;
        considerations.push(`Requires ${program.daysPerWeek} days/week - more than your ${preferences.frequency} preference`);
      }
    }
  }

  // 3. Goal Alignment (20 points max)
  if (program.primaryGoal === preferences.goal) {
    score += recommendationWeights.goalAlignment;
    reasons.push(`Directly targets your ${preferences.goal} goal`);
  } else {
    // Check goal compatibility
    if (preferences.goal === 'hybrid') {
      // Hybrid users are flexible
      score += recommendationWeights.goalAlignment * 0.7;
      reasons.push(`You want hybrid training - this ${program.primaryGoal}-focused program can still work`);
    } else if (program.primaryGoal === 'hybrid') {
      // Hybrid programs work for specific goals too
      score += recommendationWeights.goalAlignment * 0.8;
      reasons.push('Balanced hybrid approach supports your goal');
    } else {
      // Mismatched specific goals
      score += recommendationWeights.goalAlignment * 0.3;
      considerations.push(`Focuses on ${program.primaryGoal} rather than your ${preferences.goal} goal`);
    }
  }

  // 4. Additional Bonuses and Penalties

  // Beginner bonus for "First Steps" program
  if (preferences.experience === 'beginner' && program.id === 'JrHDGwFm0Cn4sRJosApH') {
    score += 5;
    reasons.push('Specifically designed to introduce Hyrox to beginners');
  }

  // Advanced athletes should avoid beginner programs
  if (preferences.experience === 'advanced' && program.experienceLevel === 'beginner') {
    score -= 20;
    considerations.push('This beginner program will likely be too easy for your level');
  }

  // Intensity consideration based on experience
  if (program.intensity === 'very-high' && preferences.experience === 'beginner') {
    score -= 15;
    considerations.push('Very high intensity may be overwhelming for beginners');
  }

  // Partner program consideration
  if (program.isPartnerProgram) {
    considerations.push('⚠️ This is a partner/doubles program - requires a training partner');
  }

  // Specialization notes
  if (program.specialization) {
    considerations.push(`Specialized for: ${program.specialization}`);
  }

  return { score: Math.max(0, Math.min(100, score)), reasons, considerations };
}

/**
 * Get ranked program recommendations for a user
 * Returns all programs sorted by match score
 */
export function getRecommendedPrograms(
  preferences: UserPreferences
): ProgramRecommendation[] {
  const recommendations: ProgramRecommendation[] = hyroxProgramsComparison.map(program => {
    const { score, reasons, considerations } = calculateMatchScore(program, preferences);

    return {
      program,
      score,
      matchPercentage: Math.round(score),
      matchReasons: reasons,
      considerations
    };
  });

  // Sort by score (highest first)
  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Get the single best program recommendation
 */
export function getBestProgram(preferences: UserPreferences): ProgramRecommendation {
  const recommendations = getRecommendedPrograms(preferences);
  return recommendations[0];
}

/**
 * Get top N program recommendations
 */
export function getTopPrograms(
  preferences: UserPreferences,
  count: number = 3
): ProgramRecommendation[] {
  const recommendations = getRecommendedPrograms(preferences);
  return recommendations.slice(0, count);
}

/**
 * Format a program recommendation for display
 */
export function formatRecommendation(recommendation: ProgramRecommendation): string {
  const { program, matchPercentage, matchReasons, considerations } = recommendation;

  let output = `${program.name} (${matchPercentage}% Match)\n\n`;
  output += `${program.description}\n\n`;
  output += `Duration: ${program.duration} weeks | ${program.daysPerWeek} days/week\n`;
  output += `Level: ${program.experienceLevel} | Intensity: ${program.intensity}\n\n`;

  if (matchReasons.length > 0) {
    output += `Why this fits you:\n`;
    matchReasons.forEach(reason => output += `✓ ${reason}\n`);
  }

  if (considerations.length > 0) {
    output += `\nThings to consider:\n`;
    considerations.forEach(consideration => output += `• ${consideration}\n`);
  }

  return output;
}
