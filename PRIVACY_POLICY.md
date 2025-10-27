# Privacy Policy for HYBRIDX.CLUB

**Last Updated:** October 23, 2025

## 1. Introduction

This Privacy Policy describes how HYBRIDX.CLUB ("we", "our", or "us") collects, uses, stores, and shares your personal information when you use our hybrid training application (the "App"). We are committed to protecting your privacy and ensuring transparency about our data practices.

By using the App, you agree to the collection and use of information in accordance with this Privacy Policy.

## 2. Information We Collect

### 2.1 Account & Authentication Data

When you create an account with HYBRIDX.CLUB, we collect:

- **Email address** - Used for account authentication and communication
- **Password** - Securely hashed and managed by Firebase Authentication (never stored in plaintext)
- **Firebase User ID (UID)** - Unique identifier assigned to your account
- **Email verification status** - To confirm your email address

### 2.2 Profile Information

You provide the following information to personalize your training experience:

- **First and last name**
- **Training experience level** (beginner, intermediate, advanced)
- **Training frequency preference** (3, 4, or 5+ days per week)
- **Primary training goal** (strength, endurance, or hybrid)
- **Personal records** - Strength benchmarks (back squat, deadlift, bench press, etc.) and running times (1K, 5K, 10K)
- **Running profile** - Benchmark paces (mile, 5K, 10K, half marathon) and injury history

### 2.3 Workout & Performance Data

We collect data about your training activities:

- **Workout sessions** - Date, title, program type, start/finish times, completion status
- **Exercise details** - Specific exercises, sets, reps, weights, and running distances/paces
- **Workout notes** - Your personal notes and observations
- **AI-generated exercise extensions** - Additional exercises recommended during workouts
- **Personal records** - Your best lifts and running times
- **Training progress** - Historical workout completion data

### 2.4 Subscription & Payment Data

For subscription management:

- **Stripe Customer ID** - Links your account to our payment processor
- **Subscription ID and status** - Active, trial, paused, canceled, or expired
- **Trial start date** - When your 30-day trial began
- **Cancellation information** - If and when you cancel your subscription

**Important:** We do not store your credit card or payment method details. All payment information is securely processed and stored by Stripe, our PCI-compliant payment processor.

### 2.5 Strava Integration Data (Optional)

If you choose to connect your Strava account, we collect:

- **Strava authentication tokens** - Access token, refresh token, and expiration date
- **Athlete ID** - Your Strava user identifier
- **Activity data** - Distance, time, pace, elevation, heart rate, cadence, route coordinates, activity type, and descriptions
- **Location data** - City, state, country, and GPS coordinates of activities
- **Sync timestamps** - When data was last synchronized

### 2.6 Device & Technical Data

- **Internet connectivity** - Required for app functionality
- **Session tokens** - Stored in browser cookies (14-day expiration) for authentication
- **Cached data** - Workout sessions, program details, and user profile stored locally for 24 hours for offline access
- **Notification preferences** - Your preferred workout reminder times
- **App installation data** - PWA installation status and device configuration

### 2.7 Usage Data

- **Last sync timestamps** - When you last synchronized data
- **Workout completion tracking** - Which workouts you've completed or skipped
- **Login/logout events** - Authentication state changes
- **Subscription lifecycle events** - Changes to your subscription status

## 3. How We Use Your Information

### 3.1 Core App Functionality

- **Account management** - Create, maintain, and authenticate your user account
- **Training program delivery** - Provide personalized workout programs based on your goals and experience
- **Progress tracking** - Monitor your fitness improvements and workout completion
- **Workout recommendations** - Tailor training suggestions to your preferences

### 3.2 AI-Powered Features

We use Google's Gemini AI model to process your workout data and preferences to:

- Generate personalized workout adjustments
- Create motivational notification messages
- Provide training plan recommendations
- Generate dashboard summaries and insights
- Offer coaching assistance

**Data sent to Google Gemini includes:** Your fitness preferences, workout details, selected program information, and training history.

### 3.3 Subscription Management

- Process payments through Stripe
- Manage trial periods and subscription status
- Handle subscription upgrades, cancellations, and renewals
- Send billing-related communications

### 3.4 Strava Integration

- Sync your external training activities
- Display comprehensive training data in one place
- Optionally upload completed workouts to Strava

### 3.5 Communication

- Send workout reminder notifications (with your permission)
- Provide account-related updates
- Respond to support requests

### 3.6 App Improvement

- Understand how users interact with the app
- Identify and fix technical issues
- Improve user experience and features

## 4. How We Store Your Information

### 4.1 Cloud Storage

Your data is stored using:

- **Firebase Authentication** - Managed by Google, with industry-standard security
- **Cloud Firestore** - Google's secure, scalable NoSQL database
- **Firebase Storage** - For any uploaded files

All data is encrypted in transit using HTTPS and at rest using Google Cloud's encryption standards.

### 4.2 Local Storage

The App stores limited data locally on your device for offline functionality:

- **Browser cookies** - Session authentication token (14-day expiration, HttpOnly, Secure flags)
- **Local storage** - Cached user profile, workout sessions, and notification preferences (24-hour cache duration)
- **IndexedDB** - Firebase authentication persistence for seamless login

All locally stored authentication data is cleared when you log out.

### 4.3 Data Retention

- **Active accounts** - Data retained for the lifetime of your account
- **Deleted accounts** - Personal data deleted within 30 days, except as required for legal compliance
- **Backup data** - May persist in backups for up to 90 days
- **Payment records** - Stripe retains transaction history for compliance purposes

## 5. How We Share Your Information

### 5.1 Third-Party Service Providers

We share your data with the following trusted third parties to operate the App:

#### Firebase/Google Cloud (Infrastructure & Authentication)
- **Data shared:** All user account and workout data
- **Purpose:** Cloud hosting, authentication, database storage
- **Privacy policy:** https://policies.google.com/privacy

#### Google Gemini AI
- **Data shared:** Workout data, user preferences, training history
- **Purpose:** AI-powered workout recommendations and coaching
- **Privacy policy:** https://policies.google.com/privacy

#### Stripe (Payment Processing)
- **Data shared:** Email address, Stripe customer ID, subscription details
- **Purpose:** Payment processing and subscription management
- **Privacy policy:** https://stripe.com/privacy

#### Strava (Optional Integration)
- **Data shared:** Workout session details (when you choose to upload)
- **Purpose:** Sync activities to your Strava account
- **Privacy policy:** https://www.strava.com/legal/privacy

### 5.2 Legal Requirements

We may disclose your information if required by law, court order, or governmental regulation, or if we believe disclosure is necessary to:

- Comply with legal obligations
- Protect our rights, property, or safety
- Prevent fraud or security threats
- Enforce our Terms of Service

### 5.3 Business Transfers

If HYBRIDX.CLUB is acquired, merged, or sells assets, your information may be transferred to the new entity. We will notify you via email and/or prominent notice in the App before your data is transferred.

### 5.4 What We Don't Do

- **We do not sell your personal data** to third parties
- **We do not use traditional analytics** or tracking services (no Google Analytics, Facebook Pixel, etc.)
- **We do not display advertisements** in the App

## 6. Your Data Rights

You have the following rights regarding your personal information:

### 6.1 Access & Portability

You can access all your personal data through the App's profile and settings pages. You may request a complete export of your data by contacting us at [your-email@hybridx.club].

### 6.2 Correction

You can update your profile information, personal records, and running profile at any time through the App's settings.

### 6.3 Account Deletion

You have the right to request the deletion of your account and all associated personal data. To initiate this process, please send an email from the address associated with your HYBRIDX.CLUB account to [training@hybridx.club](mailto:training@hybridx.club?subject=Account%20Deletion%20Request) with the subject line "Account Deletion Request".

**What data is deleted?**
Upon verification, we will permanently delete the following information:
- Your Firebase Authentication account (email, password)
- Your user profile in Firestore (name, preferences, records)
- All your workout history and session data
- Your Stripe customer information (your subscription will be canceled)
- Any connection tokens for third-party services like Strava

**What data is kept?**
Anonymized transaction records may be retained by Stripe for legal and financial compliance for a period of up to 10 years. This data cannot be linked back to your personal account.

### 6.4 Withdraw Consent

- **Strava connection:** Disconnect at any time through the App settings
- **Notifications:** Disable through your device or browser settings
- **Data processing:** Delete your account to stop all data processing

### 6.5 Objection & Restriction

You may object to certain data processing activities or request restriction by contacting us. We will respond within 30 days.

## 7. Data Security

We implement industry-standard security measures to protect your information:

- **Encryption in transit** - All data transmitted using HTTPS/TLS
- **Encryption at rest** - Data stored using Google Cloud's encryption
- **Secure authentication** - Firebase Authentication with hashed passwords
- **Session security** - HttpOnly, Secure, and SameSite cookie flags
- **Token management** - Automatic token refresh and expiration (1-hour ID tokens, 14-day session cookies)
- **Payment security** - PCI-compliant payment processing through Stripe
- **OAuth security** - State parameter CSRF protection for Strava integration
- **Admin access controls** - Limited administrative access with audit logs

While we strive to protect your data, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.

## 8. Children's Privacy

HYBRIDX.CLUB is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will delete such information promptly.

## 9. International Data Transfers

Your information may be transferred to and processed in countries other than your country of residence, including the United States, where our service providers (Firebase, Google Cloud, Stripe) operate. These countries may have different data protection laws.

By using the App, you consent to the transfer of your information to these countries. We ensure appropriate safeguards are in place through our service providers' compliance with:

- EU-U.S. Data Privacy Framework
- Standard Contractual Clauses
- GDPR compliance (where applicable)

## 10. California Privacy Rights (CCPA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act:

- **Right to know** - Request disclosure of personal data collected
- **Right to delete** - Request deletion of personal data
- **Right to opt-out** - Opt-out of the sale of personal data (note: we do not sell personal data)
- **Non-discrimination** - We will not discriminate against you for exercising your rights

To exercise these rights, contact us at [your-email@hybridx.club].

## 11. European Privacy Rights (GDPR)

If you are in the European Economic Area (EEA), UK, or Switzerland, you have rights under the General Data Protection Regulation:

- **Legal basis for processing:** Consent (for non-essential features) and contract performance (for app functionality)
- **Right to access** - Obtain confirmation of data processing and access to your data
- **Right to rectification** - Correct inaccurate personal data
- **Right to erasure** - Request deletion of personal data ("right to be forgotten")
- **Right to restrict processing** - Limit how we use your data
- **Right to data portability** - Receive your data in a machine-readable format
- **Right to object** - Object to processing based on legitimate interests
- **Right to withdraw consent** - Withdraw consent at any time
- **Right to lodge a complaint** - File a complaint with your local supervisory authority

To exercise these rights, contact us at [your-email@hybridx.club].

## 12. Cookies & Tracking Technologies

The App uses the following technologies:

### 12.1 Essential Cookies

- **Session cookie (`__session`)** - Required for authentication and security
  - Duration: 14 days
  - Flags: HttpOnly, Secure, SameSite=Lax

### 12.2 Local Storage

- User profile cache (24-hour duration)
- Workout session cache (24-hour duration)
- Notification preferences
- Last sync timestamps

### 12.3 Service Worker

- Enables offline functionality
- Caches app resources for faster loading
- Handles push notifications

**We do not use third-party tracking cookies or advertising cookies.**

## 13. Notifications

The App may send you notifications with your permission:

- **Workout reminders** - AI-generated motivational messages at your preferred time
- **Account updates** - Important account or subscription changes

You can manage notification preferences through:
- Your device settings
- Your browser settings
- The App's notification settings

We use Web Push Notifications, which require explicit user permission and can be disabled at any time.

## 14. Third-Party Links

The App may contain links to third-party websites or services (such as Strava). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.

## 15. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any material changes by:

- Updating the "Last Updated" date at the top of this policy
- Sending an email notification to your registered email address
- Displaying a prominent notice in the App

Your continued use of the App after changes become effective constitutes acceptance of the updated Privacy Policy.

We recommend reviewing this policy periodically to stay informed about how we protect your information.

## 16. Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

**HYBRIDX.CLUB**
Email: [your-email@hybridx.club]
Website: https://hybridx.club

For data protection inquiries, account deletion requests, or to exercise your privacy rights, please use the email address above. We will respond to all requests within 30 days.

## 17. Data Controller

For the purposes of GDPR and other data protection laws, the data controller responsible for your personal information is:

**HYBRIDX.CLUB**
[Your Company Address]
[City, State/Province, Postal Code]
[Country]

---

## Summary of Key Points

- **Data collected:** Account info, workout data, performance metrics, optional Strava activities
- **Purpose:** Provide personalized training programs and track your fitness progress
- **Third parties:** Firebase/Google (hosting), Stripe (payments), Strava (optional sync), Google Gemini (AI features)
- **Your rights:** Access, correct, delete, export your data at any time
- **Security:** Industry-standard encryption and security practices
- **No selling of data:** We never sell your personal information
- **No ads:** The App does not display advertisements

By using HYBRIDX.CLUB, you acknowledge that you have read and understood this Privacy Policy.

    