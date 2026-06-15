# CSV Training Program Import Guide

This document describes the unified CSV format for importing training programs into HYBRIDX.CLUB. A single file format handles all program types (running, strength, hybrid). The type of each row is determined by the `sessionType` column, not the file's header set.

## General Rules

- The file must be saved as **UTF-8** encoded CSV.
- The **first row must contain the exact column headers** listed below. Headers are case-sensitive.
- All rows must belong to a single training program (`programName`, `programDescription`, and `programType` must be identical on every row).
- There should be no completely empty rows.
- Multiple rows with the same `workoutDay` are grouped into one program day. The `workoutTitle` of the **first row for a given day** becomes that day's title.
- A single day can contain both run rows and exercise rows — each session type produces a separate Garmin workout when synced.

---

## Column Reference

### Program-level columns (repeat on every row)

| Column | Required | Type | Valid values | Description |
|---|---|---|---|---|
| `id` | No | String | Any | Leave blank to create a new program. Fill with an existing program ID to overwrite it. |
| `programName` | Yes | String | Any | Name of the program. Must be identical on all rows. |
| `programDescription` | Yes | String | Any | Short description of the program's goals. Must be identical on all rows. |
| `programType` | Yes | Enum | `running` `hyrox` `hybrid` | Overall type of the program. Use `hybrid` for plans that mix running and strength work. |
| `targetRace` | No | Enum | `mile` `5k` `10k` `half-marathon` `marathon` `ultra` | Target race distance (running programs). Leave blank for pure strength programs. |

### Day-level columns

| Column | Required | Type | Description |
|---|---|---|---|
| `workoutDay` | Yes | Integer | The day number within the program (1-indexed). Rows sharing the same day number are grouped into one workout. |
| `workoutTitle` | Yes | String | Title for this row's session. The first row to create a day sets that day's overall title. |

### Row-type discriminator

| Column | Required | Type | Valid values | Description |
|---|---|---|---|---|
| `sessionType` | Yes | Enum | `run` `strength` `cardio` `rest` | Determines which columns the parser reads for this row. |
| `garminSport` | No | Enum | See below | Explicit Garmin sport type. If blank, a default is applied per `sessionType`. Invalid values are rejected on import. |

**Accepted `garminSport` values** (single-segment sport types per Garmin Training API V2):

`RUNNING` · `CYCLING` · `LAP_SWIMMING` · `STRENGTH_TRAINING` · `CARDIO_TRAINING` · `YOGA` · `PILATES` · `GENERIC`

> **Note:** `FUNCTIONAL_STRENGTH_TRAINING` is **not** a valid Garmin sport type and will be rejected. Use `CARDIO_TRAINING` for CrossFit-style conditioning, circuits, plyometrics, and cross-training.

**Default `garminSport` values by `sessionType`:**

| `sessionType` | Default `garminSport` |
|---|---|
| `run` | `RUNNING` |
| `strength` | `STRENGTH_TRAINING` |
| `cardio` | `CARDIO_TRAINING` |
| `rest` | *(no Garmin workout created)* |

### Run columns (fill these for `sessionType: run` rows)

| Column | Required | Type | Valid values | Description |
|---|---|---|---|---|
| `runType` | Yes | Enum | `easy` `tempo` `intervals` `long` `recovery` | The character of this run segment. |
| `runDistance` | Yes | Float | Any ≥ 0 | Distance in **kilometres** for this segment. Use `0` only for genuine zero-distance steps (e.g. a recovery row that is time-based). |
| `runPaceZone` | Yes | Enum | `recovery` `easy` `marathon` `threshold` `interval` `repetition` | Target pace zone mapped to the athlete's calculated training zones. |
| `runDescription` | Yes | String | Any | Plain-text description of what to do in this segment. |
| `runEffortLevel` | Yes | Integer 1–10 | 1–10 | Perceived effort (RPE) for this segment. |
| `noIntervals` | No | Integer | Any | Number of repetitions for interval rows (e.g. `5` for 5×1km). Leave blank for non-interval rows. |

### Exercise columns (fill these for `sessionType: strength` or `cardio` rows)

| Column | Required | Type | Description |
|---|---|---|---|
| `exerciseName` | Yes* | String | Name of the exercise (e.g. `Back squat`). *Required unless both name and details are blank (blank rows are treated as rest-day placeholders). |
| `exerciseDetails` | Yes* | String | Prescription for the exercise (e.g. `4×5 \| RPE 8`). Required whenever `exerciseName` is populated. |
| `garminExerciseCategory` | No | String | Garmin exercise category string for structured Garmin sync. |
| `garminExerciseName` | No | String | Garmin exercise name string for structured Garmin sync. |
| `weightKg` | No | Float | Load in kilograms. |
| `restSeconds` | No | Integer | Rest period in seconds. |
| `sets` | No | Integer | Number of sets. |
| `reps` | No | Integer | Number of reps per set. |

---

## Row Types in Detail

### `sessionType: run`

Each `run` row represents one **segment** of a run session. Complex workouts (warm-up → intervals → cool-down) use multiple rows, all sharing the same `workoutDay` and `sessionType: run`. Leave all exercise columns blank.

### `sessionType: strength`

Each `strength` row represents one **exercise** in a strength session. All rows for the same day with the same `sessionType` and `garminSport` are grouped into a single Garmin strength workout. Leave all run columns blank.

### `sessionType: cardio`

Same structure as `strength` rows but mapped to `CARDIO_TRAINING` in Garmin by default. Use for CrossFit-style conditioning, plyometrics, circuits, and cross-training. Leave all run columns blank.

### `sessionType: rest`

A rest-day placeholder. No run or exercise data is required — the row just ensures the day appears in the program. Garmin receives no workout for rest days.

### Multi-session days

A single `workoutDay` can contain a mix of session types. For example, day 1 might have one `run` row and several `strength` rows. The Garmin sync creates **separate workouts** for each distinct `(sessionType, garminSport)` pair within the day.

---

## Example: Hybrid Plan (first 3 days)

```csv
id,programName,programDescription,programType,targetRace,workoutDay,workoutTitle,sessionType,garminSport,exerciseName,exerciseDetails,garminExerciseCategory,garminExerciseName,weightKg,restSeconds,sets,reps,runType,runDistance,runPaceZone,runDescription,runEffortLevel,noIntervals
,"My Hybrid Plan","12-week hybrid training plan.",hybrid,,1,Lower Body Strength,strength,STRENGTH_TRAINING,Back squat,"4×5 | RPE 8",,,,,,,,,,,,
,"My Hybrid Plan","12-week hybrid training plan.",hybrid,,1,Lower Body Strength,strength,STRENGTH_TRAINING,Romanian deadlift,"3×6 | RPE 7",,,,,,,,,,,,
,"My Hybrid Plan","12-week hybrid training plan.",hybrid,,1,Lower Body Strength,strength,STRENGTH_TRAINING,Nordic hamstring curl,"3×5 | RPE 8",,,,,,,,,,,,
,"My Hybrid Plan","12-week hybrid training plan.",hybrid,,2,Tempo Run,run,RUNNING,,,,,,,,,tempo,5,threshold,"5km at threshold pace",7,
,"My Hybrid Plan","12-week hybrid training plan.",hybrid,,3,Rest Day,rest,,,,,,,,,,,,,,,,
```

## Example: Running Plan with Intervals

```csv
id,programName,programDescription,programType,targetRace,workoutDay,workoutTitle,sessionType,garminSport,exerciseName,exerciseDetails,garminExerciseCategory,garminExerciseName,weightKg,restSeconds,sets,reps,runType,runDistance,runPaceZone,runDescription,runEffortLevel,noIntervals
,"10k Plan","12-week 10k plan.",running,10k,1,Interval Session,run,RUNNING,,,,,,,,,easy,1.5,easy,"Warm-up easy jog",4,
,"10k Plan","12-week 10k plan.",running,10k,1,Interval Session,run,RUNNING,,,,,,,,,intervals,0.8,interval,"800m at interval pace",8,5
,"10k Plan","12-week 10k plan.",running,10k,1,Interval Session,run,RUNNING,,,,,,,,,recovery,0.4,recovery,"400m easy jog recovery",3,
,"10k Plan","12-week 10k plan.",running,10k,1,Interval Session,run,RUNNING,,,,,,,,,easy,1.5,easy,"Cool-down easy jog",3,
,"10k Plan","12-week 10k plan.",running,10k,2,Rest Day,rest,,,,,,,,,,,,,,,,
,"10k Plan","12-week 10k plan.",running,10k,3,Easy Run,run,RUNNING,,,,,,,,,easy,8,easy,"Comfortable easy effort",4,
```

## Example: Hybrid Day (run + strength on same day)

```csv
id,programName,programDescription,programType,targetRace,workoutDay,workoutTitle,sessionType,garminSport,exerciseName,exerciseDetails,garminExerciseCategory,garminExerciseName,weightKg,restSeconds,sets,reps,runType,runDistance,runPaceZone,runDescription,runEffortLevel,noIntervals
,"Hybrid Plan","Hybrid training plan.",hybrid,,5,Morning Run + Lift,run,RUNNING,,,,,,,,,easy,8,easy,"Morning easy run",4,
,"Hybrid Plan","Hybrid training plan.",hybrid,,5,Upper Body Strength,strength,STRENGTH_TRAINING,Push press,"4×4 | RPE 8",,,,,,,,,,,,
,"Hybrid Plan","Hybrid training plan.",hybrid,,5,Upper Body Strength,strength,STRENGTH_TRAINING,Weighted pull-up,"4×5 | RPE 8",,,,,,,,,,,,
,"Hybrid Plan","Hybrid training plan.",hybrid,,5,Upper Body Strength,strength,STRENGTH_TRAINING,Pendlay row,"3×6 | RPE 7",,,,,,,,,,,,
```

The run and the strength block share day 5. Garmin sync will schedule two separate workouts on that calendar date.

---

## Common Errors

| Error message | Cause | Fix |
|---|---|---|
| `CSV must include programType` | The `programType` column is missing or blank on the first row. | Add the column and set it to `running`, `hyrox`, or `hybrid`. |
| `sessionType must be one of: run, strength, cardio, rest` | A row has an unrecognised or misspelled `sessionType`. | Correct the value in that row. |
| `exerciseDetails is required for a strength row` | `exerciseName` is populated but `exerciseDetails` is blank. | Both columns must be filled for every exercise row. |
| `runType is required for a run row` | A `run` row is missing its `runType`. | Fill in `easy`, `tempo`, `intervals`, `long`, or `recovery`. |
| `runEffortLevel must be an integer 1-10` | The effort level is blank, non-numeric, or out of range. | Enter a whole number between 1 and 10. |
| `Invalid targetRace` | The `targetRace` value is not one of the accepted options. | Use `mile`, `5k`, `10k`, `half-marathon`, `marathon`, or `ultra`. |
| `invalid garminSport` | The `garminSport` value is not a Garmin-supported sport type. | Use one of `RUNNING`, `CYCLING`, `LAP_SWIMMING`, `STRENGTH_TRAINING`, `CARDIO_TRAINING`, `YOGA`, `PILATES`, `GENERIC`. |

---

## File Encoding

Save the file as **UTF-8** (not UTF-8 with BOM, not Windows-1252). If you export from Microsoft Excel, choose "CSV UTF-8 (comma delimited)" from the Save As format list. Incorrect encoding causes special characters (`×`, `·`, `—`) to appear as garbled sequences on import.
