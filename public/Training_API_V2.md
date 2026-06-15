# Garmin Connect Developer Program - Training API V2

> Converted from `Training_API_V2.pdf`. Original document marked **CONFIDENTIAL**. Version 1.0.

---

<!-- Page 1 -->
**GARMIN INTERNATIONAL**
Garmin Connect Developer
Program
Training API V2
Version 1.0
**CONFIDENTIAL**


<!-- Page 2 -->
## 1 Revision History
Version Date Revisions
### 1.0 05/26/2025 Initial version

#### Extracted table(s) from page 2

| Version | Date | Revisions |
| --- | --- | --- |
| 1.0 | 05/26/2025 | Initial version |


<!-- Page 3 -->
Contents
## 1 Revision History ...................................................................................................................................... 2
## 2 Getting Started ....................................................................................................................................... 4
### 2.1 Purpose of the API ...................................................................................................................... 4
### 2.2 Consumer Key and Secret .......................................................................................................... 4
### 2.3 User Registration ........................................................................................................................ 4
### 2.4 Training API Import Types .......................................................................................................... 5
### 2.5 Requesting a Production Key ..................................................................................................... 5
### 2.6 API Rate Limiting or Excessive Usage ....................................................................................... 6
## 3 Training API Endpoint Details .................................................................................................................. 7
### 3.1 Training API Permissions............................................................................................................ 7
### 3.2 Workouts ..................................................................................................................................... 8
#### 3.2.1 Field Definitions ....................................................................................................................................... 8
#### 3.2.2 Example JSON ........................................................................................................................................ 14
#### 3.2.3 Create .................................................................................................................................................... 21
#### 3.2.4 Retrieve .................................................................................................................................................. 21
#### 3.2.5 Update ................................................................................................................................................... 21
#### 3.2.6 Delete .................................................................................................................................................... 21
#### 3.2.7 Response Code ....................................................................................................................................... 21
### 3.3 Workout Schedules ................................................................................................................... 22
#### 3.3.1 Field Definitions ..................................................................................................................................... 22
#### 3.3.2 Example JSON ........................................................................................................................................ 22
#### 3.3.3 Create .................................................................................................................................................... 22
#### 3.3.4 Retrieve .................................................................................................................................................. 22
#### 3.3.5 Update ................................................................................................................................................... 22
#### 3.3.6 Delete .................................................................................................................................................... 23
#### 3.3.7 Retrieve by Date .................................................................................................................................... 23
#### 3.3.8 Response Code ....................................................................................................................................... 23


<!-- Page 4 -->
## 2 Getting Started
### 2.1 Purpose of the API
The Garmin Connect Training API is the underlying mechanism that allows users to
import workouts and workout schedules from third-party platforms for supported
activity types into their Garmin Connect account, making it easy to manage this type of
information in a centralized location.
Support Email: connect-support@developer.garmin.com
### 2.2 Consumer Key and Secret
Garmin Connect Training API partners will be provided with a consumer key and secret,
which will be used to gain access to the Training API. The consumer key is used to
identify a partner's app uniquely, and the consumer secret is used to validate that the
requests received are from that partner and not from a third party that has gained
unauthorized access to the consumer key. The consumer key can be considered public
information, but the consumer secret is private. For the security of users, the
consumer secret should be secured and never sent over a network in plain text.
Consumer key credentials are created using the Developer Portal and the creation of
apps (https://developerportal.garmin.com/user/me/apps?program=829).
Your first app is designed for testing, and the partner must pass the app review to
request a production-level app for commercial use.
- Please see "Requesting a Production Key" below for more information.
- Evaluation-level apps violating API guidelines may be disabled with no prior
notice.
### 2.3 User Registration
Before a partner can write data to a user's account, the user must grant the partner write
access. Please refer to the detailed Garmin OAuth documentation for details on acquiring,
authorizing, and signing with a User Access Token (UAT) to write data to a Garmin user's
account.


<!-- Page 5 -->
### 2.4 Training API Import Types
All data uploaded to Garmin Connect via the Training API can either be categorized as a
workout or a workout schedule. The API allows for the standard CRUD operations on
these two data types.
• Workout
A workout contains a list of steps for the user to take as part of their workout, as well as
metadata about the workout (e.g. description, sport type, etc.).
• Workout Schedule
A workout schedule allows a previously defined workout to be scheduled for a specified
day.
### 2.5 Requesting a Production Key
The first consumer key generated through the Developer Portal is an evaluation key. This
key is rate-limited and should only be used for testing, evaluation, and development. To
receive production-level credentials, Garmin must review and approve the Training API
integration to ensure high-quality user experience in Garmin Connect. Garmin will also
review partner applications and/or websites to ensure proper usage of Garmin assets
(e.g., device images, logos) and adherence to Garmin brand guidelines.
Please email Training API support at connect-support@developer.garmin.com to
request and schedule a production readiness review.
Garmin will review the following technical review:
• Authorization for at least two Garmin Connect users.
• User Deregistration/User Permission Endpoints enabled.
• No unnecessary or excessive API call utilization or volume.
• Proper handling of quota violations and subsequent retry attempts.
User experience review. This review can be achieved through a demonstration
application to Garmin via video conference or other mutually agreed-upon method. This
review is used to confirm that the following criteria are met:
• Proper representation of all Garmin trademarked/copyrighted terms.
• Proper representation of Garmin products and product images.
• The user experience (UX) flow does not misrepresent Garmin or portray it in a
negative light.


<!-- Page 6 -->
### 2.6 API Rate Limiting or Excessive Usage
To manage capacity and ensure system stability, Garmin Training API implementations
may be subject to rate limiting.
Please plan the implementation with the following limitations in mind:
Evaluation Rate Limits
## 100 API call requests per partner per minute - a rolling 60 second window summing the
OAuth requests and API calls.
## 200 API call requests per user per day - a rolling 24-hour window excluding OAuth
requests.
Production Rate limits
## 3000 API call requests per partner per minute - a rolling 60 second window summing the
OAuth requests and API calls.
## 1000 API call requests per user per day - a 24-hour window rolling excluding OAuth
requests.
If one or both above limits are exceeded by a partner or a specific user, the subsequent
API call request attempts will receive an HTTP Status Code 429 (too many requests). The
calls in question will need to be attempted again later.


<!-- Page 7 -->
## 3 Training API Endpoint Details
### 3.1 Training API Permissions
Consumers can have multiple permissions like "Activity Export" and "Workout Import"
set up with GC. Users, while signing up may only opt in for fewer permissions, so this
endpoint helps in fetching the permissions for that particular user.
Method & URL: GET https://apis.garmin.com/userPermissions/
Response body: The retrieved user permissions in JSON.
Example response for this endpoint:
**{[ "WORKOUT_IMPORT"]}**
Users can change their permission after the permission at their Garmin Connect account
settings; Partners will be notified via the User Permission summary Endpoint (see Start
Guide, section 2.6.3 for the summary description)


<!-- Page 8 -->
### 3.2 Workouts
#### 3.2.1 Field Definitions
Multisport workouts have a limit of 25 segments (25 individual sports) and 250 steps overall. Single sport
workout (one segment) has a limit of 100 steps.
List of devices supporting each workout sport types
https://support.garmin.com/en-US/?faq=lLvhWrmlMv0vGmyGpWjOX6
Workout Data Type Description
workoutId Long A unique identifier for the Workout. This field is not
necessary for the Create action and will be set
automatically.
ownerId Long A unique identifier for the owner of the Workout. This
field is not necessary for Creating workouts but is
required for updates.
workoutName String The name of the Workout.
description String A description of the Workout with a maximum length of
1024 characters. Longer descriptions will be truncated.
updatedDate String A datetime representing the last update time of the
Workout, formatted as YYYY-mm-dd. Example: "2019-
01-14T16:25:10.0". This field is not necessary for Create
or Update actions and will be set automatically.
createdDate String A datetime representing the creation time of the
Workout, formatted as YYYY-mm-dd. Example: "2019-
01-14T16:25:10.0". This field is not necessary for
Create or Update actions and will be set automatically.
sport String The type of sport.
Multi Sport workouts: MULTI_SPORT
Single Segment (sport) workouts: RUNNING, CYCLING,
**LAP_SWIMMING, STRENGTH_TRAINING,**
CARDIO_TRAINING, GENERIC (supported by some devices
only), YOGA, PILATES
estimatedDurationInSecs Integer The estimated duration of the Workout in seconds. This
value is calculated server-side and will be ignored in
Create and Update actions.
estimatedDistanceInMeters Double The estimated distance of the Workout in meters. This
value is calculated server-side and will be ignored in
Create and Update actions.
poolLength Double The length of the pool. Used for when LAP_SWIMMING
segment is present.

#### Extracted table(s) from page 8

| Workout | Data Type | Description |
| --- | --- | --- |
| workoutId | Long | A unique identifier for the Workout. This field is not<br>necessary for the Create action and will be set<br>automatically. |
| ownerId | Long | A unique identifier for the owner of the Workout. This<br>field is not necessary for Creating workouts but is<br>required for updates. |
| workoutName | String | The name of the Workout. |
| description | String | A description of the Workout with a maximum length of<br>1024 characters. Longer descriptions will be truncated. |
| updatedDate | String | A datetime representing the last update time of the<br>Workout, formatted as YYYY-mm-dd. Example: "2019-<br>01-14T16:25:10.0". This field is not necessary for Create<br>or Update actions and will be set automatically. |
| createdDate | String | A datetime representing the creation time of the<br>Workout, formatted as YYYY-mm-dd. Example: "2019-<br>01-14T16:25:10.0". This field is not necessary for<br>Create or Update actions and will be set automatically. |
| sport | String | The type of sport.<br>Multi Sport workouts: MULTI_SPORT<br>Single Segment (sport) workouts: RUNNING, CYCLING,<br>LAP_SWIMMING, STRENGTH_TRAINING,<br>CARDIO_TRAINING, GENERIC (supported by some devices<br>only), YOGA, PILATES |
| estimatedDurationInSecs | Integer | The estimated duration of the Workout in seconds. This<br>value is calculated server-side and will be ignored in<br>Create and Update actions. |
| estimatedDistanceInMeters | Double | The estimated distance of the Workout in meters. This<br>value is calculated server-side and will be ignored in<br>Create and Update actions. |
| poolLength | Double | The length of the pool. Used for when LAP_SWIMMING<br>segment is present. |


<!-- Page 9 -->
Pull Length can be null for undefined pulls (not all devices
support undefined pool, see Appendix C)
poolLengthUnit String The unit of the pool length. Valid values: YARD, METER.
workoutProvider String The workout provider to display to the user (20
characters max).
workoutSourceId String The workout provider to use for internal tracking
purposes. This value should be the same as
workoutProvider unless otherwise noted (20 characters
max).
isSessionTransitionEnabled Boolean Must be set to true if workouts should have transitions
for multisport workouts.
Segment List<Segments> A list of Segments (individual sports) that specify the
details of the workout.
Segment Data Type Description
segmentOrder Integer Represents the order of the Segments (individual sport)
sport String The type of sport.
Valid values: RUNNING, CYCLING, LAP_SWIMMING,
**STRENGTH_TRAINING, CARDIO_TRAINING, GENERIC**
(supported by some devices only), YOGA, PILATES
estimatedDurationInSecs Integer The estimated duration of the Segment in seconds. This
value is calculated server-side and will be ignored in Create
and Update actions.
Will be set to null for single segments workouts
estimatedDistanceInMeters Double The estimated distance of the Segment in meters. This
value is calculated server-side and will be ignored in
Create and Update actions.
Will be set to null for single segments workouts
poolLength Double The length of the pool. Used for LAP_SWIMMING.
Must match poolLenght provided in the Workout section
for Multi Sport workouts.
Will be set to null for single segments workouts
(see examples below)
poolLengthUnit String The unit of the pool length. Valid values: YARD, METER.
Must match poolLenght provided in the Workout section
for Multi Sport workouts.
Will be set to null for single segments workouts
(see examples below)
steps List<Step> A list of Steps that specify the details of the workout.

#### Extracted table(s) from page 9

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  | Pull Length can be null for undefined pulls (not all devices<br>support undefined pool, see Appendix C) |
| poolLengthUnit | String | The unit of the pool length. Valid values: YARD, METER. |
| workoutProvider | String | The workout provider to display to the user (20<br>characters max). |
| workoutSourceId | String | The workout provider to use for internal tracking<br>purposes. This value should be the same as<br>workoutProvider unless otherwise noted (20 characters<br>max). |
| isSessionTransitionEnabled | Boolean | Must be set to true if workouts should have transitions<br>for multisport workouts. |
| Segment | List<Segments> | A list of Segments (individual sports) that specify the<br>details of the workout. |
| Segment | Data Type | Description |
| segmentOrder | Integer | Represents the order of the Segments (individual sport) |
| sport | String | The type of sport.<br>Valid values: RUNNING, CYCLING, LAP_SWIMMING,<br>STRENGTH_TRAINING, CARDIO_TRAINING, GENERIC<br>(supported by some devices only), YOGA, PILATES |
| estimatedDurationInSecs | Integer | The estimated duration of the Segment in seconds. This<br>value is calculated server-side and will be ignored in Create<br>and Update actions.<br>Will be set to null for single segments workouts |
| estimatedDistanceInMeters | Double | The estimated distance of the Segment in meters. This<br>value is calculated server-side and will be ignored in<br>Create and Update actions.<br>Will be set to null for single segments workouts |
| poolLength | Double | The length of the pool. Used for LAP_SWIMMING.<br>Must match poolLenght provided in the Workout section<br>for Multi Sport workouts.<br>Will be set to null for single segments workouts<br>(see examples below) |
| poolLengthUnit | String | The unit of the pool length. Valid values: YARD, METER.<br>Must match poolLenght provided in the Workout section<br>for Multi Sport workouts.<br>Will be set to null for single segments workouts<br>(see examples below) |
| steps | List<Step> | A list of Steps that specify the details of the workout. |


<!-- Page 10 -->
WorkoutStep Data Type Description
type String The type of Step. Valid values are WorkoutStep and
WorkoutRepeatStep. WorkoutStep type Steps contains
details of the Step itself, while workoutRepeatSteps
contain a sub-list of Steps that should be repeated until a
condition is met as specified in the repeatType and
repeatValue field.
stepId Long A unique ID is generated for Step. This value is calculated
server-side and will be ignored in Create actions.
stepOrder Integer Represents the order of the Step.
repeatType String The type of repeat action specifies how long or until
when the user should repeat the sub-list of Steps. Used
only for WorkoutRepeatSteps. Valid values:
**REPEAT_UNTIL_STEPS_CMPLT, REPEAT_UNTIL_TIME,**
**REPEAT_UNTIL_DISTANCE, REPEAT_UNTIL_CALORIES,**
**REPEAT_UNTIL_HR_LESS_THAN,**
**REPEAT_UNTIL_HR_GREATER_THAN,**
**REPEAT_UNTIL_POWER_LESS_THAN,**
**REPEAT_UNTIL_POWER_GREATER_THAN,**
**REPEAT_UNTIL_POWER_LAST_LAP_LESS_THAN,**
**REPEAT_UNTIL_MAX_POWER_LAST_LAP_LESS_THAN**
repeatValue Double The value of repeating action. When paired with
repeatType, specifies how long or until when the user
should repeat the sub list of steps. Used only for
WorkoutRepeatSteps.
skipLastRestStep Boolean Flag to support Garmin Connect Skip Rest step feature. Set to
true automatically for all LAP_SWIMMING workouts to support
backward compatibility.
steps List<Step> The list of steps that should be repeated as specified by
repeatType and repeatValue. Used only for
WorkoutRepeatSteps.
intensity String The intensity of the Step. Valid values: REST, WARMUP,
**COOLDOWN, RECOVERY, ACTIVE, INTERVAL, MAIN (SWIM**
only)
description String A description of the Step with a maximum of 512
characters. Longer descriptions will be truncated.
durationType String The type of duration. Paired with durationValue, this
represents the relative duration of the Step. Valid values:
**TIME, DISTANCE, HR_LESS_THAN, HR_GREATER_THAN,**
**CALORIES, OPEN, POWER_LESS_THAN,**
**POWER_GREATER_THAN, TIME_AT_VALID_CDA,**
FIXED_REST (for rest steps)
REPS (HIIT, CARDIO, STRENGH_TRSINING only)

#### Extracted table(s) from page 10

| WorkoutStep | Data Type | Description |
| --- | --- | --- |
| type | String | The type of Step. Valid values are WorkoutStep and<br>WorkoutRepeatStep. WorkoutStep type Steps contains<br>details of the Step itself, while workoutRepeatSteps<br>contain a sub-list of Steps that should be repeated until a<br>condition is met as specified in the repeatType and<br>repeatValue field. |
| stepId | Long | A unique ID is generated for Step. This value is calculated<br>server-side and will be ignored in Create actions. |
| stepOrder | Integer | Represents the order of the Step. |
| repeatType | String | The type of repeat action specifies how long or until<br>when the user should repeat the sub-list of Steps. Used<br>only for WorkoutRepeatSteps. Valid values:<br>REPEAT_UNTIL_STEPS_CMPLT, REPEAT_UNTIL_TIME,<br>REPEAT_UNTIL_DISTANCE, REPEAT_UNTIL_CALORIES,<br>REPEAT_UNTIL_HR_LESS_THAN,<br>REPEAT_UNTIL_HR_GREATER_THAN,<br>REPEAT_UNTIL_POWER_LESS_THAN,<br>REPEAT_UNTIL_POWER_GREATER_THAN,<br>REPEAT_UNTIL_POWER_LAST_LAP_LESS_THAN,<br>REPEAT_UNTIL_MAX_POWER_LAST_LAP_LESS_THAN |
| repeatValue | Double | The value of repeating action. When paired with<br>repeatType, specifies how long or until when the user<br>should repeat the sub list of steps. Used only for<br>WorkoutRepeatSteps. |
| skipLastRestStep | Boolean | Flag to support Garmin Connect Skip Rest step feature. Set to<br>true automatically for all LAP_SWIMMING workouts to support<br>backward compatibility. |
| steps | List<Step> | The list of steps that should be repeated as specified by<br>repeatType and repeatValue. Used only for<br>WorkoutRepeatSteps. |
| intensity | String | The intensity of the Step. Valid values: REST, WARMUP,<br>COOLDOWN, RECOVERY, ACTIVE, INTERVAL, MAIN (SWIM<br>only) |
| description | String | A description of the Step with a maximum of 512<br>characters. Longer descriptions will be truncated. |
| durationType | String | The type of duration. Paired with durationValue, this<br>represents the relative duration of the Step. Valid values:<br>TIME, DISTANCE, HR_LESS_THAN, HR_GREATER_THAN,<br>CALORIES, OPEN, POWER_LESS_THAN,<br>POWER_GREATER_THAN, TIME_AT_VALID_CDA,<br>FIXED_REST (for rest steps)<br>REPS (HIIT, CARDIO, STRENGH_TRSINING only) |


<!-- Page 11 -->
**LAP_SWIMMING ONLY:**
FIXED_REST (should be used for REST In LAP_SWIMMING)
REPETITION_SWIM_CSS_OFFSET (CSS-Based Send-Off
Time) valid values -60 to 60)
FIXED_REPETITION (Send-off time)
Please note "poolLengthUnit" must be set with the use of send-
off time.
equipmentType String The type of equipment needed for this Step. Currently used
only for LAP_SWIMMING Workouts. Valid values: NONE,
**SWIM_FINS, SWIM_KICKBOARD, SWIM_PADDLES,**
**SWIM_PULL_BUOY, SWIM_SNORKEL**
exerciseCategory String The exercise category for this Step. Used only for
STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,
PILATES, and YOGA Workouts.
Valid values: See Appendix A and B.(excel file)
exerciseName String The exercise name for this Step. Used only for
STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,
PILATES, and YOGA Workouts.
See Appendix A and B (excel file)
weightValue Double The weight value for this step is kilograms. Used only for
STRENGTH_TRAINING Workouts.
weightDisplayUnit String The units in which to display the weightValue to the
user, if a weightValue exists. The display unit does not
impact weightValue within the Training API, only for
display. Valid values: KILOGRAM, POUND
durationValue Double The duration value. Pair with durationType, this
represents the relative duration of the Step.
durationValueType String A modifier for duration value is used only for HR and
POWER, types to express units. Valid values: PERCENT
targetType String The type of target for this Step. Valid values: SPEED,
**HEART_RATE, CADENCE, POWER, GRADE, RESISTANCE,**
**POWER_3S, POWER_10S, POWER_30S, POWER_LAP,**
**SPEED_LAP, HEART_RATE_LAP, OPEN**
PACE (as speed in m/s)
Please note that targetType is not supported for swim
workouts. Please set targetType as null for swim

#### Extracted table(s) from page 11

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  | LAP_SWIMMING ONLY:<br>FIXED_REST (should be used for REST In LAP_SWIMMING)<br>REPETITION_SWIM_CSS_OFFSET (CSS-Based Send-Off<br>Time) valid values -60 to 60)<br>FIXED_REPETITION (Send-off time)<br>Please note "poolLengthUnit" must be set with the use of send-<br>off time. |
| equipmentType | String | The type of equipment needed for this Step. Currently used<br>only for LAP_SWIMMING Workouts. Valid values: NONE,<br>SWIM_FINS, SWIM_KICKBOARD, SWIM_PADDLES,<br>SWIM_PULL_BUOY, SWIM_SNORKEL |
| exerciseCategory | String | The exercise category for this Step. Used only for<br>STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,<br>PILATES, and YOGA Workouts.<br>Valid values: See Appendix A and B.(excel file) |
| exerciseName | String | The exercise name for this Step. Used only for<br>STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,<br>PILATES, and YOGA Workouts.<br>See Appendix A and B (excel file) |
| weightValue | Double | The weight value for this step is kilograms. Used only for<br>STRENGTH_TRAINING Workouts. |
| weightDisplayUnit | String | The units in which to display the weightValue to the<br>user, if a weightValue exists. The display unit does not<br>impact weightValue within the Training API, only for<br>display. Valid values: KILOGRAM, POUND |
| durationValue | Double | The duration value. Pair with durationType, this<br>represents the relative duration of the Step. |
| durationValueType | String | A modifier for duration value is used only for HR and<br>POWER, types to express units. Valid values: PERCENT |
| targetType | String | The type of target for this Step. Valid values: SPEED,<br>HEART_RATE, CADENCE, POWER, GRADE, RESISTANCE,<br>POWER_3S, POWER_10S, POWER_30S, POWER_LAP,<br>SPEED_LAP, HEART_RATE_LAP, OPEN<br>PACE (as speed in m/s)<br>Please note that targetType is not supported for swim<br>workouts. Please set targetType as null for swim |


<!-- Page 12 -->
workouts
Use PAZE_ZONE as the secondary target for swim
workouts.
OPEN - if using secondary target, this value cannot be set as
targetType.
targetValue Double The target HR (valid values 1-5) or power zone (valid
values 1-7) to be used for this Step. Target zones must
have been previously defined and saved.
targetValueLow Double The lowest value for the target range. Used to specify a
custom range instead of specifying a target zone through
targetValue.
targetValueHigh Double The highest value for the target range. Used to specify a
custom range instead of specifying a target zone through
targetValue.
targetValueType String A modifier for target value is used only for HR and POWER
types to express units. Valid values: PERCENT
secondaryTargetType* String The type of target for this Step. Valid values: SPEED,
**HEART_RATE, OPEN, CADENCE, POWER, GRADE,**
**RESISTANCE, POWER_3S, POWER_10S, POWER_30S,**
**POWER_LAP, SPEED_LAP, HEART_RATE_LAP,**
PACE (as speed in m/s)
LAP_SWIMMING WORKOUT only:
1. SWIM_INSTRUCTION (Text-based Intensity target)
**2. SWIM_CSS_OFFSET**
PACE_ZONE (in m/s)
secondaryTargetValue* Double The target HR (valid values 1-5) or power zone (valid
values 1-7) is to be used for this Step. Target zones must
have been previously defined and saved.
secondaryTargetValueLow* Double The lowest value for the target range. Used to specify a
custom range instead of specifying a target zone through
targetValue.
**LAP_SWIMMING:**
SWIM_INSTRUCTION valid values: 1- 10
**1 -RECOVERY**
**2 -VERY EASY**
**3 -EASY**
**4 -MODERATE**
**5 -HARD**

#### Extracted table(s) from page 12

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  | workouts<br>Use PAZE_ZONE as the secondary target for swim<br>workouts.<br>OPEN - if using secondary target, this value cannot be set as<br>targetType. |
| targetValue | Double | The target HR (valid values 1-5) or power zone (valid<br>values 1-7) to be used for this Step. Target zones must<br>have been previously defined and saved. |
| targetValueLow | Double | The lowest value for the target range. Used to specify a<br>custom range instead of specifying a target zone through<br>targetValue. |
| targetValueHigh | Double | The highest value for the target range. Used to specify a<br>custom range instead of specifying a target zone through<br>targetValue. |
| targetValueType | String | A modifier for target value is used only for HR and POWER<br>types to express units. Valid values: PERCENT |
| secondaryTargetType* | String | The type of target for this Step. Valid values: SPEED,<br>HEART_RATE, OPEN, CADENCE, POWER, GRADE,<br>RESISTANCE, POWER_3S, POWER_10S, POWER_30S,<br>POWER_LAP, SPEED_LAP, HEART_RATE_LAP,<br>PACE (as speed in m/s)<br>LAP_SWIMMING WORKOUT only:<br>1. SWIM_INSTRUCTION (Text-based Intensity target)<br>2. SWIM_CSS_OFFSET<br>PACE_ZONE (in m/s) |
| secondaryTargetValue* | Double | The target HR (valid values 1-5) or power zone (valid<br>values 1-7) is to be used for this Step. Target zones must<br>have been previously defined and saved. |
| secondaryTargetValueLow* | Double | The lowest value for the target range. Used to specify a<br>custom range instead of specifying a target zone through<br>targetValue.<br>LAP_SWIMMING:<br>SWIM_INSTRUCTION valid values: 1- 10<br>1 -RECOVERY<br>2 -VERY EASY<br>3 -EASY<br>4 -MODERATE<br>5 -HARD |


<!-- Page 13 -->
**6 -VERY_HARD**
**7 -ALL_OUT**
**8 -FAST**
**9 -ASCEND**
**10 -DESCEND**
SWIM_CSS_OFFSET (CSS-Based Target Pace) valid value: -60
to 60
(seconds)
**PACE_ZONE**
Provide value in m/s
### 0.8333333333333334 device with the metric system shown as
2:00/100
secondaryTargetValueHigh* Double The highest value for the target range. Used to specify a
custom range instead of specifying a target zone through
targetValue.
secondaryTargetValueType* String A modifier for target value is used only for HR and POWER
types to express units.
strokeType String The type of stroke for this Step. Used only in
LAP_SWIMMING Workouts.
Valid values: BACKSTROKE, BREASTSTROKE,
**BUTTERFLY, FREESTYLE, MIXED, IM, RIMO, CHOICE**
drillType String The type of drill for this Step. Used only in
LAP_SWIMMING Workouts.
Valid values: KICK, PULL, BUTTERFLY
equipmentType String The type of equipment needed for this Step. Currently used
only for LAP_SWIMMING Workouts. Valid values: NONE,
**SWIM_FINS, SWIM_KICKBOARD, SWIM_PADDLES,**
**SWIM_PULL_BUOY, SWIM_SNORKEL**
exerciseCategory String The exercise category for this Step. Used only for
STRENGTH_TRAINING, YOGA, and CARDIO_TRAINING
Workouts.
Valid values: See Appendix A and B.
exerciseName String The exercise name for this Step. Used only for
STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,
PILATES, and YOGA Workouts.
See Appendix A for the list of exercise names for YOGA and
**PILATES**
See Appendix B for the list of exercise names for
STRENGTH_TRAINING and CARDIO_TRAINING, HIIT

#### Extracted table(s) from page 13

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  | 6 -VERY_HARD<br>7 -ALL_OUT<br>8 -FAST<br>9 -ASCEND<br>10 -DESCEND<br>SWIM_CSS_OFFSET (CSS-Based Target Pace) valid value: -60<br>to 60<br>(seconds)<br>PACE_ZONE<br>Provide value in m/s<br>0.8333333333333334 device with the metric system shown as<br>2:00/100 |
| secondaryTargetValueHigh* | Double | The highest value for the target range. Used to specify a<br>custom range instead of specifying a target zone through<br>targetValue. |
| secondaryTargetValueType* | String | A modifier for target value is used only for HR and POWER<br>types to express units. |
| strokeType | String | The type of stroke for this Step. Used only in<br>LAP_SWIMMING Workouts.<br>Valid values: BACKSTROKE, BREASTSTROKE,<br>BUTTERFLY, FREESTYLE, MIXED, IM, RIMO, CHOICE |
| drillType | String | The type of drill for this Step. Used only in<br>LAP_SWIMMING Workouts.<br>Valid values: KICK, PULL, BUTTERFLY |
| equipmentType | String | The type of equipment needed for this Step. Currently used<br>only for LAP_SWIMMING Workouts. Valid values: NONE,<br>SWIM_FINS, SWIM_KICKBOARD, SWIM_PADDLES,<br>SWIM_PULL_BUOY, SWIM_SNORKEL |
| exerciseCategory | String | The exercise category for this Step. Used only for<br>STRENGTH_TRAINING, YOGA, and CARDIO_TRAINING<br>Workouts.<br>Valid values: See Appendix A and B. |
| exerciseName | String | The exercise name for this Step. Used only for<br>STRENGTH_TRAINING and CARDIO_TRAINING, HIIT,<br>PILATES, and YOGA Workouts.<br>See Appendix A for the list of exercise names for YOGA and<br>PILATES<br>See Appendix B for the list of exercise names for<br>STRENGTH_TRAINING and CARDIO_TRAINING, HIIT |


<!-- Page 14 -->
weightValue Double The weight value for this step is kilograms. Used only for
STRENGTH_TRAINING Workouts.
weightDisplayUnit String The units in which to display the weightValue to the
user, if a weightValue exists. The display unit does not
impact weightValue within the Training API, only for
display. Valid values: KILOGRAM, POUND
List of supported devices for CYCLING secondary target https://support.garmin.com/en-
US/?faq=EMMh03mfYU59Zt0ldOw0U6
The secondary target is valid for:
1. CYCLING and should be treated as a less formal, accessory target. The target type
for a secondary target should be different from the primary target. If secondary
target is used, OPEN cannot be used as first target.
2. Secondary is also supported for SWIM workouts to provide a text-based target,
pace, CSS-based target pace (see Appendix C for additional details)
** Swim workouts should be distance-based and if there is a repeat block with rest as a
step included, an extra repeat step should be added after the repeat block because the
device will skip the last rest step in the repeat block.

#### 3.2.2 Example JSON

```json
MULTI_SPORT:
{
"ownerId": 12345,
"workoutName": "TEST",
"description": "TEST",
"sport": "MULTI_SPORT",
"estimatedDurationInSecs": 1200,
"estimatedDistanceInMeters": 1400,
"poolLength": null,
"poolLengthUnit": null,
"workoutProvider": "multipsport",
"workoutSourceId": "multisport",
"isSessionTransitionEnabled": true,
"segments": [
{
"segmentOrder": 1,
```

#### Extracted table(s) from page 14

| weightValue | Double | The weight value for this step is kilograms. Used only for<br>STRENGTH_TRAINING Workouts. |
| --- | --- | --- |
| weightDisplayUnit | String | The units in which to display the weightValue to the<br>user, if a weightValue exists. The display unit does not<br>impact weightValue within the Training API, only for<br>display. Valid values: KILOGRAM, POUND |


<!-- Page 15 -->
```json
"sport": "CYCLING",
"poolLength": null,
"poolLengthUnit": null,
"estimatedDurationInSecs": 500,
"estimatedDistanceInMeters": 500,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 1,
"intensity": "ACTIVE",
"description": "",
"durationType": "DISTANCE",
"durationValue": 1000,
"durationValueType": "METER",
"targetType": "OPEN",
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null
"drillType": null,
"equipmentType": null
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
},
{
"type": "WorkoutRepeatStep",
"stepOrder": 2,
"repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
"repeatValue": 4,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 3,
"intensity": "ACTIVE",
"description": null,
"durationType": "DISTANCE",
"durationValue": 100,
"durationValueType": "METER",
"targetType": null,
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
```


<!-- Page 16 -->
```json
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
}
]
}
]
},
{
"segmentOrder": 2,
"sport": "RUNNING",
"poolLength": null,
"poolLengthUnit": null,
"estimatedDurationInSecs": null,
"estimatedDistanceInMeters": null,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 4,
"intensity": "ACTIVE",
"description": "",
"durationType": "DISTANCE",
"durationValue": 1000,
"durationValueType": "METER",
"targetType": "OPEN",
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"drillType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
```


<!-- Page 17 -->
```json
},
{
"type": "WorkoutRepeatStep",
"stepOrder": 5,
"repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
"repeatValue": 4,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 6,
"intensity": "ACTIVE",
"description": null,
"durationType": "DISTANCE",
"durationValue": 100,
"durationValueType": "METER",
"targetType": null,
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
}
]
}
]
}
]
}
SINGLE Segment (one sport type)
{
"ownerId": 12345,
"workoutName": "TEST",
"description": "TEST",
"sport": "CYCLING",
"estimatedDurationInSecs": 1200,
"estimatedDistanceInMeters": 1400,
"poolLength": null,
"poolLengthUnit": null,
```


<!-- Page 18 -->
```json
"workoutProvider": "single_segemnt",
"workoutSourceId": "single_segemnt",
"isSessionTransitionEnabled": false,
"segments": [
{
"segmentOrder": 1,
"sport": "CYCLING",
"poolLength": null,
"poolLengthUnit": null,
"estimatedDurationInSecs": 500,
"estimatedDistanceInMeters": 500,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 1,
"intensity": "ACTIVE",
"description": "",
"durationType": "DISTANCE",
"durationValue": 1000,
"durationValueType": "METER",
"targetType": "OPEN",
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"drillType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
},
{
"type": "WorkoutRepeatStep",
"stepOrder": 2,
"repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
"repeatValue": 4,
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 3,
"intensity": "ACTIVE",
"description": null,
"durationType": "DISTANCE",
```


<!-- Page 19 -->
```json
"durationValue": 100,
"durationValueType": "METER",
"targetType": null,
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
},
{
"type": "WorkoutStep",
"stepOrder": 4,
"intensity": "ACTIVE",
"description": "",
"durationType": "DISTANCE",
"durationValue": 1000,
"durationValueType": "METER",
"targetType": "OPEN",
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"drillType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
},
{
"type": "WorkoutRepeatStep",
"stepOrder": 5,
"repeatType": "REPEAT_UNTIL_STEPS_CMPLT",
"repeatValue": 4,
```


<!-- Page 20 -->
```json
"steps": [
{
"type": "WorkoutStep",
"stepOrder": 6,
"intensity": "ACTIVE",
"description": null,
"durationType": "DISTANCE",
"durationValue": 100,
"durationValueType": "METER",
"targetType": null,
"targetValue": null,
"targetValueLow": null,
"targetValueHigh": null,
"targetValueType": null,
"secondaryTargetType": null,
"secondaryTargetValue": null,
"secondaryTargetValueLow": null,
"secondaryTargetValueHigh": null,
"secondaryTargetValueType": null,
"strokeType": null,
"equipmentType": null,
"exerciseCategory": null,
"exerciseName": null,
"weightValue": null,
"weightDisplayUnit": null
}
]
}
]
}
]
}
]
}
```


<!-- Page 21 -->
#### 3.2.3 Create
This request is to create a workout by/for a user:
Method & URL: POST https://apis.garmin.com/workoutportal/workout/v2
Request body: The new workout in JSON. A workout ID should not be included.
Content-Type: application/json
Response Body: The newly created workout as JSON.
#### 3.2.4 Retrieve
This request is to retrieve a workout by/for a user:
Method & URL: GET https://apis.garmin.com/training-api/workout/v2/{workoutId}
Response body: The retrieved workout in JSON.
#### 3.2.5 Update
This request is to update a workout by/for a user:
Method & URL: PUT https://apis.garmin.com/training-api/workout/v2/{workoutId}
Request body: The full updated workout in JSON.
Content-Type: application/json
#### 3.2.6 Delete
This request is to delete a workout by/for a user:
Method & URL: DELETE https://apis.garmin.com/training-api/workout/v2/{workoutId}
#### 3.2.7 Response Code
HTTP Response Status Description
200/204 Workout successfully created
## 400 Bad Request
## 401 User Access Token doesn't exist
## 403 Not allowed
## 412 User Permission error
## 429 Quota violation / rate-limiting

#### Extracted table(s) from page 21

| HTTP Response Status | Description |
| --- | --- |
| 200/204 | Workout successfully created |
| 400 | Bad Request |
| 401 | User Access Token doesn't exist |
| 403 | Not allowed |
| 412 | User Permission error |
| 429 | Quota violation / rate-limiting |


<!-- Page 22 -->
### 3.3 Workout Schedules
#### 3.3.1 Field Definitions
Filed Name Description
scheduleId A unique identifier for the workout schedule
workoutId The ID of the workout to which the schedule
refers
date The schedule data, formatter as
'YYYY-mm-dd'
#### 3.3.2 Example JSON
{
"scheduleId":123, "workoutId":123, "date":"2019-01-31"
}
#### 3.3.3 Create
This request is to create a workout schedule by/for a user:
Method & URL: POST https://apis.garmin.com/training-api/schedule/
Request body: A workout schedule to create. A schedule Id should not be included.
Content-Type: application/json
#### 3.3.4 Retrieve
This request is to retrieve a workout schedule by/for a user:
Method & URL:
GET https://apis.garmin.com/training-api/schedule/{workoutScheduleId}
Response body: The retrieved workout schedule
#### 3.3.5 Update
This request is to update a workout schedule by/for a user:
Method & URL:
PUT https://apis.garmin.com/training-api/schedule/{workoutScheduleId}
Request body: The full workout schedule in JSON.
Content-Type: application/json
Response body: The updated workout schedule.

#### Extracted table(s) from page 22

| Filed Name | Description |
| --- | --- |
| scheduleId | A unique identifier for the workout schedule |
| workoutId | The ID of the workout to which the schedule<br>refers |
| date | The schedule data, formatter as<br>'YYYY-mm-dd' |


<!-- Page 23 -->
#### 3.3.6 Delete
This request is to delete a workout schedule by/for a user:
Method & URL:
DELETE https://apis.garmin.com/training-api/schedule/{workoutScheduleId}
#### 3.3.7 Retrieve by Date
This request is used to retrieve the workout schedule by/for a user by date range:
Method & URL:
GET https://apis.garmin.com/training-api/schedule?startDate=YYYY-mm-
dd&endDate=YYYY-mm-dd
#### 3.3.8 Response Code
HTTP Response Status Description
200/204 Workout successfully created
## 400 Bad Request
## 401 User Access Token doesn't exist
## 403 Not allowed
## 412 User Permission error
## 429 Quota violation / rate-limiting

#### Extracted table(s) from page 23

| HTTP Response Status | Description |
| --- | --- |
| 200/204 | Workout successfully created |
| 400 | Bad Request |
| 401 | User Access Token doesn't exist |
| 403 | Not allowed |
| 412 | User Permission error |
| 429 | Quota violation / rate-limiting |


<!-- Page 24 -->
Appendix C.
Garmin Connect Swim improvements feature overview
This is an overview of all changes for the Training API and swim workouts 2024
Improvement JSON/comments
Support for 100 workout steps for all sport
types
(except Forerunner 935 generation and
older, Fenix 5 generation and older)
Handling pool size mismatches on devices.
If your pool size provided via API differs
from the pool size set on the watch, users
are given the option on your device to
convert the workout and do it anyway
"Unspecified" pool size support. "poolLength" : null,
Workouts created with unspecified pool "poolLengthUnit": null
sizes can be completed in any size of the Please note "poolLengthUnit" must be set
pool. The step distances specified in the using send-off time, CSS-Based Send-Off
workout are shown on the device without Time, and pace secondary target. Valid
conversion. values: YARD, METER
Swim target supported as secondary target "targetType": null,
(no primary target must be specified) "secondaryTargetType":
Text-based Intensity target "SWIM_INSTRUCTION",
CSS (valid values -60 to 60) "secondaryTargetValueLow": "RECOVERY"
Pace is officially supported as a secondary
target "targetType": null,
"secondaryTargetType":
**"SWIM_CSS_OFFSET",**
"secondaryTargetValueLow": -5,
"targetType": null,
"secondaryTargetType": "PACE_ZONE",
"secondaryTargetValueLow":
### 0.5555555555555556 (the number needs
to be provided in m/s)
Please note "poolLengthUnit" must be set
using send-off time and pace secondary

#### Extracted table(s) from page 24

| Improvement | JSON/comments |
| --- | --- |
| Support for 100 workout steps for all sport<br>types<br>(except Forerunner 935 generation and<br>older, Fenix 5 generation and older) |  |
| Handling pool size mismatches on devices.<br>If your pool size provided via API differs<br>from the pool size set on the watch, users<br>are given the option on your device to<br>convert the workout and do it anyway |  |
| "Unspecified" pool size support.<br>Workouts created with unspecified pool<br>sizes can be completed in any size of the<br>pool. The step distances specified in the<br>workout are shown on the device without<br>conversion. | "poolLength" : null,<br>"poolLengthUnit": null<br>Please note "poolLengthUnit" must be set<br>using send-off time, CSS-Based Send-Off<br>Time, and pace secondary target. Valid<br>values: YARD, METER |
| Swim target supported as secondary target<br>(no primary target must be specified)<br>Text-based Intensity target<br>CSS (valid values -60 to 60)<br>Pace is officially supported as a secondary<br>target | "targetType": null,<br>"secondaryTargetType":<br>"SWIM_INSTRUCTION",<br>"secondaryTargetValueLow": "RECOVERY"<br>"targetType": null,<br>"secondaryTargetType":<br>"SWIM_CSS_OFFSET",<br>"secondaryTargetValueLow": -5,<br>"targetType": null,<br>"secondaryTargetType": "PACE_ZONE",<br>"secondaryTargetValueLow":<br>0.5555555555555556 (the number needs<br>to be provided in m/s)<br>Please note "poolLengthUnit" must be set<br>using send-off time and pace secondary |


<!-- Page 25 -->
target. Valid values: YARD, METER
New drill types ("Kick", "Pull", and "Drill") "strokeType": "BUTTERFLY"
are shown separately from the stroke type "drillType": "KICK"
on the user's device. E.g. "Free Pull" or (targetType will is not supported with use
"Butterfly Kick". of strokeType, please use secondary target
to specify targets).
New stroke types: "strokeType": "RIMO"
- RIMO (Reverse IM order)
- IM by Round
- Choice
New Step Intensity "intensity": "MAIN"
- Main
New Duration types for Swim Rest Step REPETITON_SWIM_CSS_OFFSET (CSS-
added: CSS-Based Send-Off Time and Send- Based Send-Off Time) valid values -60 to 60
off time FIXED_REPETITION (Send-off time)
Send-off times and target paces defined Please note "poolLengthUnit" must be set
relative to your CSS will automatically with use of send-off time and pace
adjust when your CSS changes. Default CSS secondary target. Valid values: YARD,
is 2:00 / 100 m. METER
skipLastRestStep Optional Flag to support Garmin Connect
Skip Rest step feature. Set to true for all
LAP_SWIMMING workout to support
backward compatibility.
Time-Based steps support. On the device, Range: 1 minute - 59 minutes.
an alert sounds when the target time has
elapsed. Continue swimming to the wall
and press Lap to advance to the next step.

#### Extracted table(s) from page 25

| Column 1 | Column 2 |
| --- | --- |
|  | target. Valid values: YARD, METER |
| New drill types ("Kick", "Pull", and "Drill")<br>are shown separately from the stroke type<br>on the user's device. E.g. "Free Pull" or<br>"Butterfly Kick". | "strokeType": "BUTTERFLY"<br>"drillType": "KICK"<br>(targetType will is not supported with use<br>of strokeType, please use secondary target<br>to specify targets). |
| New stroke types:<br>- RIMO (Reverse IM order)<br>- IM by Round<br>- Choice | "strokeType": "RIMO" |
| New Step Intensity<br>- Main | "intensity": "MAIN" |
| New Duration types for Swim Rest Step<br>added: CSS-Based Send-Off Time and Send-<br>off time<br>Send-off times and target paces defined<br>relative to your CSS will automatically<br>adjust when your CSS changes. Default CSS<br>is 2:00 / 100 m. | REPETITON_SWIM_CSS_OFFSET (CSS-<br>Based Send-Off Time) valid values -60 to 60<br>FIXED_REPETITION (Send-off time)<br>Please note "poolLengthUnit" must be set<br>with use of send-off time and pace<br>secondary target. Valid values: YARD,<br>METER |
| skipLastRestStep | Optional Flag to support Garmin Connect<br>Skip Rest step feature. Set to true for all<br>LAP_SWIMMING workout to support<br>backward compatibility. |
| Time-Based steps support. On the device,<br>an alert sounds when the target time has<br>elapsed. Continue swimming to the wall<br>and press Lap to advance to the next step. | Range: 1 minute - 59 minutes. |

