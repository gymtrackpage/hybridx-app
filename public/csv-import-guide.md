# CSV Training Program Import Guide

This document outlines the precise CSV format required to successfully import training programs into the HYBRIDX.CLUB application. The system supports two distinct program types: **HYROX/Hybrid** and **Running**. The CSV parser will automatically detect the program type based on the column headers provided.

## General Rules for All CSV Files

-   The file **must** be a valid CSV (Comma-Separated Values) file.
-   The **first row must contain the exact column headers** as specified below. Headers are case-sensitive.
-   All rows must belong to a single training program.
-   There should be no empty rows between data rows.
-   The `programName` and `programDescription` values must be identical for every row in the file.

---

## 1. HYROX / Hybrid Program Format

This format is for strength, functional fitness, or hybrid training plans.

### Required Columns

The CSV file must contain these exact 6 columns:

1.  `programName`
2.  `programDescription`
3.  `workoutDay`
4.  `workoutTitle`
5.  `exerciseName`
6.  `exerciseDetails`

### Column-by-Column Explanation

| Column Name          | Type    | Description                                                                                                                              | Example                                 |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `programName`        | String  | The name of the entire training program. Must be the same for all rows.                                                                  | `First Steps to Hyrox`                  |
| `programDescription` | String  | A description of the program's goals and target audience. Must be the same for all rows.                                                 | `A 12-week plan for Hyrox beginners.`   |
| `workoutDay`         | Integer | The day number for the workout (e.g., 1, 2, 3...). Workouts on the same day are grouped.                                                   | `1`                                     |
| `workoutTitle`       | String  | The title for a specific day's workout. If a day has multiple exercises, this title must be the same for all rows corresponding to that day. | `Full Body Strength A`                  |
| `exerciseName`       | String  | The name of a single exercise.                                                                                                           | `Back Squat`                            |
| `exerciseDetails`    | String  | The prescription for the exercise (sets, reps, time, etc.).                                                                              | `5x5 reps @ 75% 1RM, rest 90s`          |

### Example CSV Data (HYROX/Hybrid)

```csv
programName,programDescription,workoutDay,workoutTitle,exerciseName,exerciseDetails
First Steps to Hyrox,"A 12-week plan for beginners.",1,Full Body Strength A,Back Squat,"5x5 reps, heavy"
First Steps to Hyrox,"A 12-week plan for beginners.",1,Full Body Strength A,Bench Press,"5x5 reps, heavy"
First Steps to Hyrox,"A 12-week plan for beginners.",1,Full Body Strength A,Core Finisher,"3 rounds: 30s plank, 15 leg raises"
First Steps to Hyrox,"A 12-week plan for beginners.",2,Running Foundations,Run/Walk,"10 min warm-up, 5x (3 min run, 2 min walk), 5 min cool-down"
First Steps to Hyrox,"A 12-week plan for beginners.",3,Rest,Rest Day,"Active recovery or complete rest"
```

---

## 2. Running Program Format

This format is for structured running plans. The presence of the `runType` and `runPaceZone` columns will trigger the running program parser.

### Required Columns

The CSV file must contain these exact 11 columns:

1.  `programName`
2.  `programDescription`
3.  `targetRace`
4.  `workoutDay`
5.  `workoutTitle`
6.  `runType`
7.  `noIntervals`
8.  `runDistance`
9.  `runPaceZone`
10. `runDescription`
11. `runEffortLevel`

### Column-by-Column Explanation

| Column Name          | Type                                            | Description                                                                                                                                     | Example                               |
| -------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `programName`        | String                                          | The name of the entire training program. Must be the same for all rows.                                                                         | `Beginner 10k Plan`                   |
| `programDescription` | String                                          | A description of the program's goals. Must be the same for all rows.                                                                            | `A 12-week plan to run your first 10k.` |
| `targetRace`         | Enum: `5k`, `10k`, `half-marathon`, `marathon`    | The primary race distance this program is designed for. Must be the same for all rows.                                                          | `10k`                                 |
| `workoutDay`         | Integer                                         | The day number for the workout (e.g., 1, 2, 3...).                                                                                               | `1`                                     |
| `workoutTitle`       | String                                          | The title for a specific day's workout.                                                                                                         | `Tempo Run`                             |
| `runType`            | Enum: `easy`, `tempo`, `intervals`, `long`, `recovery` | The type of run for this specific row.                                                                                                          | `tempo`                               |
| `noIntervals`        | Integer (Optional)                              | The number of intervals to perform (e.g., for `4`x800m, this would be 4). Leave blank if not an interval run.                                   | `4`                                   |
| `runDistance`        | Float                                           | The distance for this specific run or interval in **kilometers**.                                                                               | `1.2` (for 1.2km)                   |
| `runPaceZone`        | Enum: `recovery`, `easy`, `marathon`, `threshold`, `interval`, `repetition` | The target pace zone for the run, which maps to the user's calculated training zones.                                                           | `threshold`                           |
| `runDescription`     | String                                          | A detailed description of the run segment.                                                                                                      | `800m at Threshold pace`              |
| `runEffortLevel`     | Integer (1-10)                                  | A subjective perceived effort level from 1 (very light) to 10 (max effort).                                                                     | `7`                                     |

### Example CSV Data (Running)

```csv
programName,programDescription,targetRace,workoutDay,workoutTitle,runType,noIntervals,runDistance,runPaceZone,runDescription,runEffortLevel
Beginner 10k Plan,"Prepare for your first 10k race.",10k,1,Interval Training,intervals,4,0.8,interval,"800m at Interval pace",8
Beginner 10k Plan,"Prepare for your first 10k race.",10k,1,Interval Training,recovery,,0.4,recovery,"400m easy jog recovery",3
Beginner 10k Plan,"Prepare for your first 10k race.",10k,2,Rest Day,recovery,,0,recovery,"Rest or light walk",1
Beginner 10k Plan,"Prepare for your first 10k race.",10k,3,Tempo Run,easy,,1.5,easy,"1.5km warm-up",4
Beginner 10k Plan,"Prepare for your first 10k race.",10k,3,Tempo Run,tempo,,5,threshold,"5km at Threshold pace",7
Beginner 10k Plan,"Prepare for your first 10k race.",10k,3,Tempo Run,easy,,1.5,easy,"1.5km cool-down",3
```

This guide provides all the necessary details to construct a valid CSV file for either program type. Adhering to these specifications will ensure a smooth import process.
