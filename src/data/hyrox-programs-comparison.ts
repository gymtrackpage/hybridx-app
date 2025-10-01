// Hyrox Program Comparison Data
// Based on analysis of all 6 Hyrox programs in the database

export interface ProgramComparison {
  id: string;
  name: string;
  description: string;

  // Program Structure
  duration: number; // weeks
  daysPerWeek: number;
  totalWorkouts: number;

  // Target Audience
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  requiredFrequency: '3' | '4' | '5+';
  primaryGoal: 'strength' | 'endurance' | 'hybrid';

  // Program Focus (0-10 scale)
  runningFocus: number;
  strengthFocus: number;
  hyroxSpecificFocus: number;

  // Additional Attributes
  isPartnerProgram: boolean;
  specialization?: string;
  intensity: 'moderate' | 'high' | 'very-high';

  // Detailed Review
  bestFor: string[];
  notRecommendedFor: string[];
  keyFeatures: string[];
  weeklyStructure: string;
}

export const hyroxProgramsComparison: ProgramComparison[] = [
  {
    id: 'JrHDGwFm0Cn4sRJosApH',
    name: 'First Steps to Hyrox',
    description: 'This 12-week plan is the perfect bridge for those with gym experience but new to Hyrox. It focuses on building running capability from the ground up, gently introducing Hyrox movements with a focus on technique, and building confidence on a manageable 4-day/week schedule to get you to the start line feeling prepared.',

    duration: 12,
    daysPerWeek: 4,
    totalWorkouts: 84,

    experienceLevel: 'beginner',
    requiredFrequency: '4',
    primaryGoal: 'hybrid',

    runningFocus: 4,
    strengthFocus: 7,
    hyroxSpecificFocus: 6,

    isPartnerProgram: false,
    intensity: 'moderate',

    bestFor: [
      'Complete Hyrox beginners with gym experience',
      'Athletes new to running but experienced with strength training',
      'Those who need to build cardio base from scratch',
      'People wanting a manageable 4-day schedule'
    ],
    notRecommendedFor: [
      'Experienced Hyrox athletes',
      'Strong runners',
      'Those who can only train 3 days/week',
      'Athletes looking for high-volume training'
    ],
    keyFeatures: [
      'Gradual running progression with run/walk intervals',
      'Strong emphasis on strength fundamentals',
      'Technique-focused Hyrox movement introduction',
      'Progressive overload on both strength and cardio',
      'Built-in recovery with 3 rest days per week'
    ],
    weeklyStructure: 'Full Body Strength A, Running Foundations, Full Body Strength B, Long Easy Endurance, 3 Rest/Recovery Days'
  },

  {
    id: 'j5qE8awNGl8IPoNzaVFH',
    name: 'Hyrox Fusion Balance',
    description: 'A 12-week periodized plan for the experienced intermediate athlete. Built on a 4-day/week schedule, it uses modern endurance and strength principles to systematically build race-specific performance and improve your overall time.',

    duration: 12,
    daysPerWeek: 4,
    totalWorkouts: 84,

    experienceLevel: 'intermediate',
    requiredFrequency: '4',
    primaryGoal: 'hybrid',

    runningFocus: 7,
    strengthFocus: 8,
    hyroxSpecificFocus: 9,

    isPartnerProgram: false,
    intensity: 'high',

    bestFor: [
      'Intermediate Hyrox athletes wanting to improve times',
      'Athletes with 6+ months of Hyrox training',
      'Those seeking balanced strength and endurance development',
      'Athletes wanting periodized, systematic progression',
      'People with 4 days/week available'
    ],
    notRecommendedFor: [
      'Complete beginners to Hyrox',
      'Athletes new to structured training',
      'Those wanting to specialize in just running or strength',
      'People needing 5+ training days'
    ],
    keyFeatures: [
      'Scientifically periodized 12-week progression',
      'True hybrid approach balancing all components',
      'Threshold running with structured pace work',
      'Compromised running (post-strength endurance)',
      'Race-specific workouts and simulations',
      'Efficient 4-day schedule with smart recovery'
    ],
    weeklyStructure: 'Strength & Capacity, Running - Threshold, Hybrid/Compromised Running, Long Aerobic Run, 3 Rest/Recovery Days'
  },

  {
    id: 'mTSbnEGsI9nzqDccm90B',
    name: 'Hyrox Run Performance',
    description: 'A 12-week, 5-day/week plan for athletes wanting to make running their weapon. Built on proven 10k principles, it integrates supportive strength and Hyrox-specific compromised running to maximize your running potential.',

    duration: 12,
    daysPerWeek: 5,
    totalWorkouts: 84,

    experienceLevel: 'intermediate',
    requiredFrequency: '5+',
    primaryGoal: 'endurance',

    runningFocus: 10,
    strengthFocus: 5,
    hyroxSpecificFocus: 7,

    isPartnerProgram: false,
    intensity: 'high',

    bestFor: [
      'Athletes wanting running to be their strength in Hyrox',
      'Those with weak running but good strength base',
      'Intermediate athletes willing to train 5 days/week',
      'People coming from pure strength backgrounds',
      'Athletes preparing for running-heavy Hyrox courses'
    ],
    notRecommendedFor: [
      'Beginners to running',
      'Those who can only train 3-4 days/week',
      'Athletes wanting to prioritize strength gains',
      'People with running injuries or limitations'
    ],
    keyFeatures: [
      'Built on proven 10k running principles',
      'High running volume with 5 days/week training',
      'Supportive strength work to maintain muscle',
      'Compromised running (running fatigued) practice',
      'Structured pace zones (easy, recovery, threshold, intervals)',
      'Progressive long runs building aerobic base'
    ],
    weeklyStructure: 'Easy Run, Strength for Runners, Easy Recovery, Compromised Running, Long Aerobic Run, 2 Rest Days'
  },

  {
    id: 'uf3EsOGPMp5wGV7bPi1h',
    name: 'Hyrox Doubles & Relay Prep',
    description: 'A 12-week, 5-day/week plan for partner events. It methodically builds individual fitness while integrating partner-specific workouts focused on synchronicity, strategy, and communication to create a high-performing team.',

    duration: 12,
    daysPerWeek: 5,
    totalWorkouts: 84,

    experienceLevel: 'intermediate',
    requiredFrequency: '5+',
    primaryGoal: 'hybrid',

    runningFocus: 7,
    strengthFocus: 7,
    hyroxSpecificFocus: 10,

    isPartnerProgram: true,
    specialization: 'Partner/Doubles events',
    intensity: 'high',

    bestFor: [
      'Athletes training for Hyrox Doubles/Relay events',
      'Training partners wanting synchronized programming',
      'Intermediate athletes with a committed partner',
      'Those who can train 5 days/week',
      'Athletes wanting team-specific tactics'
    ],
    notRecommendedFor: [
      'Solo Hyrox competitors',
      'Beginners to Hyrox',
      'Those without a consistent training partner',
      'Athletes who can only train 3-4 days/week'
    ],
    keyFeatures: [
      'Partner-specific workouts and drills',
      'Individual fitness building alongside team work',
      'Synchronicity and communication training',
      'Strategic handoff and pacing practice',
      'Team WODs (workouts of the day)',
      'Builds chemistry and trust between partners'
    ],
    weeklyStructure: 'Individual Running - Speed, Individual Strength, Active Recovery, Partner WOD, Partner Endurance, 2 Rest Days'
  },

  {
    id: 'QXpgKvrxjW4VfYspOlHQ',
    name: 'Olympic Lifting & Power Cycle',
    description: 'A 12-week dedicated cycle to build maximal strength and technical proficiency in the Olympic lifts. Test your 1RMs for Back Squat, Snatch, and Clean & Jerk before starting, as the program is built on percentages.',

    duration: 12,
    daysPerWeek: 5,
    totalWorkouts: 84,

    experienceLevel: 'advanced',
    requiredFrequency: '5+',
    primaryGoal: 'strength',

    runningFocus: 2,
    strengthFocus: 10,
    hyroxSpecificFocus: 3,

    isPartnerProgram: false,
    specialization: 'Olympic Lifting & Maximal Strength',
    intensity: 'very-high',

    bestFor: [
      'Advanced athletes with Olympic lifting experience',
      'Those wanting to build maximal strength',
      'Athletes preparing for a strength-focused phase',
      'People with technique proficiency in Snatch and Clean & Jerk',
      'Those who know their 1RM and can work with percentages'
    ],
    notRecommendedFor: [
      'Beginners or intermediate athletes',
      'Those new to Olympic lifts',
      'Athletes wanting balanced Hyrox preparation',
      'People prioritizing running or endurance',
      'Those without proper coaching on Olympic lifts'
    ],
    keyFeatures: [
      'Percentage-based Olympic lifting program',
      'Focus on Snatch, Clean & Jerk, and Back Squat',
      'High volume strength work',
      'Minimal running/cardio to prioritize strength',
      'Periodized strength cycles',
      'GPP (General Physical Preparedness) accessory work'
    ],
    weeklyStructure: 'Snatch & Squat Volume, Clean & Jerk & Squat, Active Recovery, Pulling & Posterior Chain, Accessory & GPP, 2 Rest Days'
  },

  {
    id: 'dBJAHOM8TqeMyanNG9s5',
    name: 'Ultra Elite Performance',
    description: 'An advanced 12-week program for competitive athletes, with undulating cycle. It alternates between High Intensity Anaerobic, High Volume Base Training, and Max Aerobic Cardiac Capacity to maximise your perfomance.',

    duration: 12,
    daysPerWeek: 6,
    totalWorkouts: 84,

    experienceLevel: 'advanced',
    requiredFrequency: '5+',
    primaryGoal: 'hybrid',

    runningFocus: 8,
    strengthFocus: 9,
    hyroxSpecificFocus: 10,

    isPartnerProgram: false,
    specialization: 'Elite Competition Performance',
    intensity: 'very-high',

    bestFor: [
      'Elite Hyrox competitors',
      'Advanced athletes with years of training',
      'Those competing at high levels',
      'Athletes who can handle 6 days/week training',
      'People wanting maximum performance optimization'
    ],
    notRecommendedFor: [
      'Beginners or intermediate athletes',
      'Those new to structured training',
      'Athletes who cannot train 6 days/week',
      'People without solid base fitness',
      'Those prone to overtraining'
    ],
    keyFeatures: [
      'Undulating periodization (varied weekly cycles)',
      'High Intensity Anaerobic work',
      'High Volume Base Training phases',
      'Max Aerobic Cardiac Capacity development',
      'Elite-level training volume and intensity',
      '6 days/week training with only 1 rest day',
      'Power endurance and compromised running'
    ],
    weeklyStructure: 'Lower Body Power, Running - Speed Intervals, Upper Body Strength & Power, Active Recovery, Compromised Run/Power Endurance, Long Run, 1 Rest Day'
  }
];

// Scoring weights for recommendation algorithm
export const recommendationWeights = {
  experienceMatch: 40,    // 40% weight on experience level
  frequencyMatch: 30,     // 30% weight on training frequency
  goalAlignment: 20,      // 20% weight on primary goal
  intensityPreference: 10 // 10% weight on intensity preference
};
