# AI Program Adjustment in Signup Flow

## Overview
The signup flow now includes intelligent AI-powered program adjustment that automatically tailors training programs to match the user's available training days. This ensures every new user gets a program that perfectly fits their schedule from day one.

---

## How It Works

### User Journey

1. **User completes fitness assessment:**
   - Experience level: Beginner/Intermediate/Advanced
   - Training frequency: **3 / 4 / 5+ days per week**
   - Primary goal: Strength/Endurance/Hybrid

2. **User sees personalized recommendations:**
   - Top 3 programs matched to their preferences
   - Can select their preferred program

3. **🆕 AI Adjustment happens automatically:**
   - App checks if selected program needs adjustment
   - If program has more training days than user can commit:
     - AI is called to intelligently condense the program
     - User sees: "Tailoring your program... Our AI coach is adjusting the program to fit your schedule."
   - Adjusted program saved as `customProgram`

4. **Account created with ready-to-go program:**
   - User sees success message with adjustment confirmation
   - Example: "Your selected program is ready to start! We've intelligently adjusted it to fit your 4-day schedule!"

---

## Technical Implementation

### Files Modified

1. **`src/components/auth-forms.tsx`**
   - Added program adjustment logic to `handleSubmit` function
   - Imports `getProgramClient` and `adjustTrainingPlan`
   - Checks if adjustment needed before account creation

2. **`src/services/user-service-client.ts`**
   - Updated `createUser` to accept `customProgram` field
   - Saves both `programId` (original) and `customProgram` (adjusted)

3. **`src/ai/flows/adjust-training-plan.ts`**
   - Fixed schema reference bug (was `AdjustTrainingPlanLogitBiasOutputSchema`, now `AdjustTrainingPlanOutputSchema`)

---

## Adjustment Logic

### When Does Adjustment Happen?

```typescript
// Conditions for AI adjustment:
1. User selected a program (not skipped)
2. Selected program is Hyrox type
3. User's frequency is NOT '5+'
4. Program has MORE non-rest workouts than user's frequency

// Example scenarios:
✅ User frequency: 3 days, Program: 5 days → ADJUST
✅ User frequency: 4 days, Program: 5 days → ADJUST
❌ User frequency: 5+ days, Program: 5 days → NO ADJUSTMENT
❌ User frequency: 4 days, Program: 4 days → NO ADJUSTMENT
```

### Code Flow

```typescript
// Step 1: Count non-rest workouts
const nonRestWorkouts = selectedProgram.workouts.filter(
  w => !w.title.toLowerCase().includes('rest')
);

// Step 2: Check if adjustment needed
const userFrequencyNumber = parseInt(finalData.frequency, 10);
const needsAdjustment = finalData.frequency !== '5+' &&
                       nonRestWorkouts.length > userFrequencyNumber;

// Step 3: Call AI if needed
if (needsAdjustment) {
  const result = await adjustTrainingPlan({
    currentWorkouts: selectedProgram.workouts,
    targetDays: finalData.frequency as '3' | '4',
  });

  customProgram = result.adjustedWorkouts;
}

// Step 4: Save to user profile
await createUser(user.uid, {
  // ... other fields
  programId: finalData.selectedProgramId,
  customProgram: customProgram,  // AI-adjusted version or null
});
```

---

## AI Adjustment Intelligence

The AI uses sophisticated logic to condense programs:

### What the AI Does

1. **Analyzes Weekly Structure**
   - Identifies workout types (strength, conditioning, recovery)
   - Understands training intensity progression
   - Recognizes critical vs. optional sessions

2. **Prioritizes & Combines**
   - Keeps most critical workouts (strength foundations, key conditioning)
   - Combines complementary sessions intelligently
     - Example: Merges strength + metcon into one session
     - Example: Adds accessory work to main lift days
   - Drops lower priority workouts (light recovery, redundant sessions)

3. **Ensures Quality**
   - Combined days are challenging but manageable
   - Avoids conflicts (e.g., heavy legs + intense running on same day)
   - Maintains program effectiveness in condensed format

4. **Restructures Week**
   - Distributes workouts logically through 7-day week
   - Example 3-day plan: Day 1, Day 3, Day 5
   - Example 4-day plan: Day 1, Day 2, Day 4, Day 5
   - Rest days fill the gaps automatically

### AI Prompt (Abbreviated)

```
You are an expert strength and conditioning coach.
Intelligently condense a 5-day training plan into a 3 or 4-day plan.

CRITICAL INSTRUCTIONS:
1. Analyze the 5-day plan structure, intensity, and goals
2. Identify critical workouts to keep
3. Combine complementary sessions intelligently
4. Drop lower priority workouts if necessary
5. Final output MUST contain exactly {targetDays} workouts
6. Distribute logically through 7-day week
7. Maintain program effectiveness
```

---

## User Experience Examples

### Example 1: Beginner, 3 Days/Week, Hybrid Goal

**Selected Program:** "First Steps to Hyrox" (4 days/week program)

**What Happens:**
1. User selects program in Step 6
2. Clicks "Start Now"
3. System detects: 4-day program, but user wants 3 days
4. Toast appears: "Tailoring your program... Our AI coach is adjusting the program to fit your schedule."
5. AI condenses 4 days → 3 days
6. Account created
7. Success message: "Account Created! Welcome. Your selected program is ready to start! We've intelligently adjusted it to fit your 3-day schedule!"

**Result in Database:**
```javascript
{
  programId: "JrHDGwFm0Cn4sRJosApH",  // Original program
  customProgram: [                      // AI-adjusted version
    { day: 1, title: "Full Body Strength & Core", exercises: [...] },
    { day: 3, title: "Running & Hyrox Skills", exercises: [...] },
    { day: 5, title: "Conditioning & Endurance", exercises: [...] }
  ],
  startDate: "2025-10-01"
}
```

### Example 2: Intermediate, 5+ Days/Week, Hybrid Goal

**Selected Program:** "Hyrox Fusion Balance" (4 days/week program)

**What Happens:**
1. User selects program in Step 6
2. Clicks "Start Now"
3. System detects: 4-day program, user wants 5+ days
4. **NO adjustment needed** (user can handle 4-day program)
5. Account created
6. Success message: "Account Created! Welcome. Your selected program is ready to start!"

**Result in Database:**
```javascript
{
  programId: "j5qE8awNGl8IPoNzaVFH",
  customProgram: null,  // No adjustment needed
  startDate: "2025-10-01"
}
```

---

## Database Schema

### User Document Fields

```typescript
{
  // Core user data
  email: string,
  firstName: string,
  lastName: string,
  experience: 'beginner' | 'intermediate' | 'advanced',
  frequency: '3' | '4' | '5+',  // ← Used for adjustment decision
  goal: 'strength' | 'endurance' | 'hybrid',

  // Program fields
  programId: string | null,          // Original program ID
  startDate: Date | undefined,       // When program started
  customProgram: Workout[] | null,   // 🆕 AI-adjusted version (if needed)

  // Other fields...
}
```

### Program Display Priority

When displaying workouts to the user, the app should:

1. **Check if `customProgram` exists**
   - If YES → Use `customProgram` (AI-adjusted workouts)
   - If NO → Fetch workouts from original program using `programId`

2. **This allows:**
   - Personalized experience for adjusted users
   - Original program remains intact in database
   - User can see what program they're "on" (`programId`)
   - But works through personalized version (`customProgram`)

---

## Error Handling

### Graceful Degradation

The implementation includes try-catch blocks to ensure signup succeeds even if AI adjustment fails:

```typescript
try {
  // Fetch program and run AI adjustment
  const result = await adjustTrainingPlan(...);
  customProgram = result.adjustedWorkouts;
} catch (adjustError) {
  console.error('Program adjustment failed:', adjustError);
  // Continue without adjustment - user gets original program
}
```

**If AI fails:**
- ✅ User account still created successfully
- ✅ Program still assigned (original version)
- ✅ User can still start training
- ❌ No customProgram saved (falls back to original)
- 📝 Error logged for debugging

---

## Benefits

### For Users
✅ **Perfect Fit:** Program automatically matches their schedule
✅ **No Manual Work:** Don't need to figure out which days to skip
✅ **Professional Quality:** AI uses strength & conditioning expertise
✅ **Instant Gratification:** Ready to train immediately after signup
✅ **Personalized:** Each user gets a unique program variation

### For Business
✅ **Higher Retention:** Users more likely to stick with programs that fit their life
✅ **Better Results:** Properly adjusted programs = better adherence
✅ **Unique Value Prop:** AI-powered personalization sets you apart
✅ **Reduced Confusion:** Users don't have to ask "Which days should I do?"
✅ **Scalable:** Works for any program, any frequency combination

---

## Testing Scenarios

| User Frequency | Program Days | Adjustment? | Result |
|---------------|-------------|-------------|---------|
| 3 days | 4-day Hyrox | ✅ YES | AI condenses to 3 days |
| 3 days | 5-day Hyrox | ✅ YES | AI condenses to 3 days |
| 4 days | 5-day Hyrox | ✅ YES | AI condenses to 4 days |
| 4 days | 4-day Hyrox | ❌ NO | Use original program |
| 5+ days | 5-day Hyrox | ❌ NO | Use original program |
| 5+ days | 4-day Hyrox | ❌ NO | Use original program |
| 3 days | Running Program | ❌ NO | Running not supported yet |

---

## Future Enhancements

### Potential Improvements

1. **Running Program Support**
   - Currently only adjusts Hyrox programs
   - Could extend to running programs with pace/distance adjustments

2. **Visual Indicator in Recommendations**
   - Show badge on programs that will be adjusted
   - "This program will be tailored to your 3-day schedule"

3. **Adjustment Preview**
   - Let users preview the adjusted program before signup
   - Show side-by-side comparison of original vs. adjusted

4. **Manual Override**
   - Allow users to opt-out of adjustment
   - "Use original 5-day program anyway" option

5. **Progressive Overload**
   - Track when users complete adjusted programs
   - Suggest graduating to original program with more days

6. **Adjustment History**
   - Store adjustment metadata (when, why, how many days)
   - Analytics on which adjustments are most common

---

## Comparison: Signup vs. Program View

Both flows now have AI adjustment, but they happen at different times:

### Signup Flow (New)
- **When:** During account creation
- **Trigger:** User selects program in Step 6
- **Saves:** Both `programId` and `customProgram` immediately
- **User sees:** Adjustment happens before "Start Now"
- **Benefit:** User has adjusted program from first login

### Program View (Existing)
- **When:** User schedules program from /programs/[id]/view
- **Trigger:** Click "Schedule Program" or "Start Today"
- **Saves:** Updates existing user with `programId` and `customProgram`
- **User sees:** Toast notification during scheduling
- **Benefit:** Users can change programs anytime with adjustment

---

## Summary

The AI program adjustment feature in the signup flow provides a seamless, intelligent onboarding experience that ensures every user gets a training program perfectly tailored to their schedule. By leveraging the existing `adjustTrainingPlan` AI flow, we've created consistency between signup and program selection while giving users personalized training from day one.

**Key Achievement:** Zero-friction onboarding with AI-powered personalization.
