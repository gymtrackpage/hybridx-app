
export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy for HYBRIDX.CLUB</h1>
        <p className="text-muted-foreground">Last Updated: October 23, 2025</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">1. Introduction</h2>
        <p className="text-muted-foreground">
          This Privacy Policy describes how HYBRIDX.CLUB ("we", "our", or "us") collects, uses, stores, and shares your personal information when you use our hybrid training application (the "App"). We are committed to protecting your privacy and ensuring transparency about our data practices.
        </p>
        <p className="text-muted-foreground">
          By using the App, you agree to the collection and use of information in accordance with this Privacy Policy.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">2. Information We Collect</h2>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.1 Account & Authentication Data</h3>
          <p className="text-muted-foreground">When you create an account with HYBRIDX.CLUB, we collect:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Email address</strong> - Used for account authentication and communication</li>
            <li><strong>Password</strong> - Securely hashed and managed by Firebase Authentication (never stored in plaintext)</li>
            <li><strong>Firebase User ID (UID)</strong> - Unique identifier assigned to your account</li>
            <li><strong>Email verification status</strong> - To confirm your email address</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.2 Profile Information</h3>
          <p className="text-muted-foreground">You provide the following information to personalize your training experience:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>First and last name</strong></li>
            <li><strong>Training experience level</strong> (beginner, intermediate, advanced)</li>
            <li><strong>Training frequency preference</strong> (3, 4, or 5+ days per week)</li>
            <li><strong>Primary training goal</strong> (strength, endurance, or hybrid)</li>
            <li><strong>Personal records</strong> - Strength benchmarks (back squat, deadlift, bench press, etc.) and running times (1K, 5K, 10K)</li>
            <li><strong>Running profile</strong> - Benchmark paces (mile, 5K, 10K, half marathon) and injury history</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.3 Workout & Performance Data</h3>
          <p className="text-muted-foreground">We collect data about your training activities:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Workout sessions</strong> - Date, title, program type, start/finish times, completion status</li>
            <li><strong>Exercise details</strong> - Specific exercises, sets, reps, weights, and running distances/paces</li>
            <li><strong>Workout notes</strong> - Your personal notes and observations</li>
            <li><strong>AI-generated exercise extensions</strong> - Additional exercises recommended during workouts</li>
            <li><strong>Personal records</strong> - Your best lifts and running times</li>
            <li><strong>Training progress</strong> - Historical workout completion data</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.4 Subscription & Payment Data</h3>
          <p className="text-muted-foreground">For subscription management:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Stripe Customer ID</strong> - Links your account to our payment processor</li>
            <li><strong>Subscription ID and status</strong> - Active, trial, paused, canceled, or expired</li>
            <li><strong>Trial start date</strong> - When your 30-day trial began</li>
            <li><strong>Cancellation information</strong> - If and when you cancel your subscription</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            <strong>Important:</strong> We do not store your credit card or payment method details. All payment information is securely processed and stored by Stripe, our PCI-compliant payment processor.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.5 Strava Integration Data (Optional)</h3>
          <p className="text-muted-foreground">If you choose to connect your Strava account, we collect:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Strava authentication tokens</strong> - Access token, refresh token, and expiration date</li>
            <li><strong>Athlete ID</strong> - Your Strava user identifier</li>
            <li><strong>Activity data</strong> - Distance, time, pace, elevation, heart rate, cadence, route coordinates, activity type, and descriptions</li>
            <li><strong>Location data</strong> - City, state, country, and GPS coordinates of activities</li>
            <li><strong>Sync timestamps</strong> - When data was last synchronized</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.6 Device & Technical Data</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Internet connectivity</strong> - Required for app functionality</li>
            <li><strong>Session tokens</strong> - Stored in browser cookies (14-day expiration) for authentication</li>
            <li><strong>Cached data</strong> - Workout sessions, program details, and user profile stored locally for 24 hours for offline access</li>
            <li><strong>Notification preferences</strong> - Your preferred workout reminder times</li>
            <li><strong>App installation data</strong> - PWA installation status and device configuration</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">2.7 Usage Data</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Last sync timestamps</strong> - When you last synchronized data</li>
            <li><strong>Workout completion tracking</strong> - Which workouts you've completed or skipped</li>
            <li><strong>Login/logout events</strong> - Authentication state changes</li>
            <li><strong>Subscription lifecycle events</strong> - Changes to your subscription status</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.1 Core App Functionality</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Account management</strong> - Create, maintain, and authenticate your user account</li>
            <li><strong>Training program delivery</strong> - Provide personalized workout programs based on your goals and experience</li>
            <li><strong>Progress tracking</strong> - Monitor your fitness improvements and workout completion</li>
            <li><strong>Workout recommendations</strong> - Tailor training suggestions to your preferences</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.2 AI-Powered Features</h3>
          <p className="text-muted-foreground">We use Google's Gemini AI model to process your workout data and preferences to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Generate personalized workout adjustments</li>
            <li>Create motivational notification messages</li>
            <li>Provide training plan recommendations</li>
            <li>Generate dashboard summaries and insights</li>
            <li>Offer coaching assistance</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            <strong>Data sent to Google Gemini includes:</strong> Your fitness preferences, workout details, selected program information, and training history.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.3 Subscription Management</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Process payments through Stripe</li>
            <li>Manage trial periods and subscription status</li>
            <li>Handle subscription upgrades, cancellations, and renewals</li>
            <li>Send billing-related communications</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.4 Strava Integration</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Sync your external training activities</li>
            <li>Display comprehensive training data in one place</li>
            <li>Optionally upload completed workouts to Strava</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.5 Communication</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Send workout reminder notifications (with your permission)</li>
            <li>Provide account-related updates</li>
            <li>Respond to support requests</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">3.6 App Improvement</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Understand how users interact with the app</li>
            <li>Identify and fix technical issues</li>
            <li>Improve user experience and features</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">4. How We Store Your Information</h2>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">4.1 Cloud Storage</h3>
          <p className="text-muted-foreground">Your data is stored using:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Firebase Authentication</strong> - Managed by Google, with industry-standard security</li>
            <li><strong>Cloud Firestore</strong> - Google's secure, scalable NoSQL database</li>
            <li><strong>Firebase Storage</strong> - For any uploaded files</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            All data is encrypted in transit using HTTPS and at rest using Google Cloud's encryption standards.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">4.2 Local Storage</h3>
          <p className="text-muted-foreground">The App stores limited data locally on your device for offline functionality:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Browser cookies</strong> - Session authentication token (14-day expiration, HttpOnly, Secure flags)</li>
            <li><strong>Local storage</strong> - Cached user profile, workout sessions, and notification preferences (24-hour cache duration)</li>
            <li><strong>IndexedDB</strong> - Firebase authentication persistence for seamless login</li>
          </ul>
          <p className="text-muted-foreground mt-3">
            All locally stored authentication data is cleared when you log out.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">4.3 Data Retention</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Active accounts</strong> - Data retained for the lifetime of your account</li>
            <li><strong>Deleted accounts</strong> - Personal data deleted within 30 days, except as required for legal compliance</li>
            <li><strong>Backup data</strong> - May persist in backups for up to 90 days</li>
            <li><strong>Payment records</strong> - Stripe retains transaction history for compliance purposes</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">5. How We Share Your Information</h2>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">5.1 Third-Party Service Providers</h3>
          <p className="text-muted-foreground">We share your data with the following trusted third parties to operate the App:</p>

          <div className="space-y-4 mt-4">
            <div className="border-l-4 border-primary pl-4">
              <h4 className="font-semibold">Firebase/Google Cloud (Infrastructure & Authentication)</h4>
              <p className="text-sm text-muted-foreground"><strong>Data shared:</strong> All user account and workout data</p>
              <p className="text-sm text-muted-foreground"><strong>Purpose:</strong> Cloud hosting, authentication, database storage</p>
              <p className="text-sm text-muted-foreground"><strong>Privacy policy:</strong> <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://policies.google.com/privacy</a></p>
            </div>

            <div className="border-l-4 border-primary pl-4">
              <h4 className="font-semibold">Google Gemini AI</h4>
              <p className="text-sm text-muted-foreground"><strong>Data shared:</strong> Workout data, user preferences, training history</p>
              <p className="text-sm text-muted-foreground"><strong>Purpose:</strong> AI-powered workout recommendations and coaching</p>
              <p className="text-sm text-muted-foreground"><strong>Privacy policy:</strong> <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://policies.google.com/privacy</a></p>
            </div>

            <div className="border-l-4 border-primary pl-4">
              <h4 className="font-semibold">Stripe (Payment Processing)</h4>
              <p className="text-sm text-muted-foreground"><strong>Data shared:</strong> Email address, Stripe customer ID, subscription details</p>
              <p className="text-sm text-muted-foreground"><strong>Purpose:</strong> Payment processing and subscription management</p>
              <p className="text-sm text-muted-foreground"><strong>Privacy policy:</strong> <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://stripe.com/privacy</a></p>
            </div>

            <div className="border-l-4 border-primary pl-4">
              <h4 className="font-semibold">Strava (Optional Integration)</h4>
              <p className="text-sm text-muted-foreground"><strong>Data shared:</strong> Workout session details (when you choose to upload)</p>
              <p className="text-sm text-muted-foreground"><strong>Purpose:</strong> Sync activities to your Strava account</p>
              <p className="text-sm text-muted-foreground"><strong>Privacy policy:</strong> <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://www.strava.com/legal/privacy</a></p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">5.2 Legal Requirements</h3>
          <p className="text-muted-foreground">We may disclose your information if required by law, court order, or governmental regulation, or if we believe disclosure is necessary to:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Comply with legal obligations</li>
            <li>Protect our rights, property, or safety</li>
            <li>Prevent fraud or security threats</li>
            <li>Enforce our Terms of Service</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">5.3 Business Transfers</h3>
          <p className="text-muted-foreground">
            If HYBRIDX.CLUB is acquired, merged, or sells assets, your information may be transferred to the new entity. We will notify you via email and/or prominent notice in the App before your data is transferred.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">5.4 What We Don't Do</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>We do not sell your personal data</strong> to third parties</li>
            <li><strong>We do not use traditional analytics</strong> or tracking services (no Google Analytics, Facebook Pixel, etc.)</li>
            <li><strong>We do not display advertisements</strong> in the App</li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">6. Your Data Rights</h2>
        <p className="text-muted-foreground">You have the following rights regarding your personal information:</p>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">6.1 Access & Portability</h3>
          <p className="text-muted-foreground">
            You can access all your personal data through the App's profile and settings pages. You may request a complete export of your data by contacting us at <a href="mailto:training@hybridx.club" className="text-primary hover:underline">training@hybridx.club</a>.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">6.2 Correction</h3>
          <p className="text-muted-foreground">
            You can update your profile information, personal records, and running profile at any time through the App's settings.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">6.3 Account Deletion</h3>
          <p className="text-muted-foreground">
            You have the right to request the deletion of your account and all associated personal data. To initiate this process, please send an email from the address associated with your HYBRIDX.CLUB account to <a href="mailto:training@hybridx.club?subject=Account%20Deletion%20Request" className="text-primary hover:underline">training@hybridx.club</a> with the subject line "Account Deletion Request".
          </p>
          <p className="text-muted-foreground font-semibold mt-2">What data is deleted?</p>
          <p className="text-muted-foreground">Upon verification, we will permanently delete the following information:</p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Your Firebase Authentication account (email, password)</li>
            <li>Your user profile in Firestore (name, preferences, records)</li>
            <li>All your workout history and session data</li>
            <li>Your Stripe customer information (your subscription will be canceled)</li>
            <li>Any connection tokens for third-party services like Strava</li>
          </ul>
          <p className="text-muted-foreground font-semibold mt-2">What data is kept?</p>
          <p className="text-muted-foreground">
            Anonymized transaction records may be retained by Stripe for legal and financial compliance for a period of up to 10 years. This data cannot be linked back to your personal account.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">6.4 Withdraw Consent</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Strava connection:</strong> Disconnect at any time through the App settings</li>
            <li><strong>Notifications:</strong> Disable through your device or browser settings</li>
            <li><strong>Data processing:</strong> Delete your account to stop all data processing</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">6.5 Objection & Restriction</h3>
          <p className="text-muted-foreground">
            You may object to certain data processing activities or request restriction by contacting us. We will respond within 30 days.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">7. Data Security</h2>
        <p className="text-muted-foreground">We implement industry-standard security measures to protect your information:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Encryption in transit</strong> - All data transmitted using HTTPS/TLS</li>
          <li><strong>Encryption at rest</strong> - Data stored using Google Cloud's encryption</li>
          <li><strong>Secure authentication</strong> - Firebase Authentication with hashed passwords</li>
          <li><strong>Session security</strong> - HttpOnly, Secure, and SameSite cookie flags</li>
          <li><strong>Token management</strong> - Automatic token refresh and expiration (1-hour ID tokens, 14-day session cookies)</li>
          <li><strong>Payment security</strong> - PCI-compliant payment processing through Stripe</li>
          <li><strong>OAuth security</strong> - State parameter CSRF protection for Strava integration</li>
          <li><strong>Admin access controls</strong> - Limited administrative access with audit logs</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          While we strive to protect your data, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">8. Children's Privacy</h2>
        <p className="text-muted-foreground">
          HYBRIDX.CLUB is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us, and we will delete such information promptly.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">9. International Data Transfers</h2>
        <p className="text-muted-foreground">
          Your information may be transferred to and processed in countries other than your country of residence, including the United States, where our service providers (Firebase, Google Cloud, Stripe) operate. These countries may have different data protection laws.
        </p>
        <p className="text-muted-foreground">
          By using the App, you consent to the transfer of your information to these countries. We ensure appropriate safeguards are in place through our service providers' compliance with:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>EU-U.S. Data Privacy Framework</li>
          <li>Standard Contractual Clauses</li>
          <li>GDPR compliance (where applicable)</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">10. California Privacy Rights (CCPA)</h2>
        <p className="text-muted-foreground">If you are a California resident, you have additional rights under the California Consumer Privacy Act:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Right to know</strong> - Request disclosure of personal data collected</li>
          <li><strong>Right to delete</strong> - Request deletion of personal data</li>
          <li><strong>Right to opt-out</strong> - Opt-out of the sale of personal data (note: we do not sell personal data)</li>
          <li><strong>Non-discrimination</strong> - We will not discriminate against you for exercising your rights</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          To exercise these rights, contact us at <a href="mailto:training@hybridx.club" className="text-primary hover:underline">training@hybridx.club</a>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">11. European Privacy Rights (GDPR)</h2>
        <p className="text-muted-foreground">If you are in the European Economic Area (EEA), UK, or Switzerland, you have rights under the General Data Protection Regulation:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Legal basis for processing:</strong> Consent (for non-essential features) and contract performance (for app functionality)</li>
          <li><strong>Right to access</strong> - Obtain confirmation of data processing and access to your data</li>
          <li><strong>Right to rectification</strong> - Correct inaccurate personal data</li>
          <li><strong>Right to erasure</strong> - Request deletion of personal data ("right to be forgotten")</li>
          <li><strong>Right to restrict processing</strong> - Limit how we use your data</li>
          <li><strong>Right to data portability</strong> - Receive your data in a machine-readable format</li>
          <li><strong>Right to object</strong> - Object to processing based on legitimate interests</li>
          <li><strong>Right to withdraw consent</strong> - Withdraw consent at any time</li>
          <li><strong>Right to lodge a complaint</strong> - File a complaint with your local supervisory authority</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          To exercise these rights, contact us at <a href="mailto:training@hybridx.club" className="text-primary hover:underline">training@hybridx.club</a>.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">12. Cookies & Tracking Technologies</h2>
        <p className="text-muted-foreground">The App uses the following technologies:</p>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">12.1 Essential Cookies</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Session cookie (`__session`)</strong> - Required for authentication and security
              <ul className="list-disc list-inside ml-6 mt-1">
                <li>Duration: 14 days</li>
                <li>Flags: HttpOnly, Secure, SameSite=Lax</li>
              </ul>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">12.2 Local Storage</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>User profile cache (24-hour duration)</li>
            <li>Workout session cache (24-hour duration)</li>
            <li>Notification preferences</li>
            <li>Last sync timestamps</li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-semibold">12.3 Service Worker</h3>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li>Enables offline functionality</li>
            <li>Caches app resources for faster loading</li>
            <li>Handles push notifications</li>
          </ul>
        </div>

        <p className="text-muted-foreground font-semibold mt-3">
          We do not use third-party tracking cookies or advertising cookies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">13. Notifications</h2>
        <p className="text-muted-foreground">The App may send you notifications with your permission:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Workout reminders</strong> - AI-generated motivational messages at your preferred time</li>
          <li><strong>Account updates</strong> - Important account or subscription changes</li>
        </ul>
        <p className="text-muted-foreground mt-3">You can manage notification preferences through:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Your device settings</li>
          <li>Your browser settings</li>
          <li>The App's notification settings</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          We use Web Push Notifications, which require explicit user permission and can be disabled at any time.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">14. Third-Party Links</h2>
        <p className="text-muted-foreground">
          The App may contain links to third-party websites or services (such as Strava). We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">15. Changes to This Privacy Policy</h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of any material changes by:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Updating the "Last Updated" date at the top of this policy</li>
          <li>Sending an email notification to your registered email address</li>
          <li>Displaying a prominent notice in the App</li>
        </ul>
        <p className="text-muted-foreground mt-3">
          Your continued use of the App after changes become effective constitutes acceptance of the updated Privacy Policy.
        </p>
        <p className="text-muted-foreground">
          We recommend reviewing this policy periodically to stay informed about how we protect your information.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">16. Contact Information</h2>
        <p className="text-muted-foreground">
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
        </p>
        <div className="bg-accent/20 border border-accent/50 rounded-lg p-4 space-y-2">
          <p className="font-semibold">HYBRIDX.CLUB</p>
          <p className="text-muted-foreground">Email: <a href="mailto:training@hybridx.club" className="text-primary hover:underline">training@hybridx.club</a></p>
          <p className="text-muted-foreground">Website: <a href="https://hybridx.club" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://hybridx.club</a></p>
        </div>
        <p className="text-muted-foreground">
          For data protection inquiries, account deletion requests, or to exercise your privacy rights, please use the email address above. We will respond to all requests within 30 days.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">17. Data Controller</h2>
        <p className="text-muted-foreground">For the purposes of GDPR and other data protection laws, the data controller responsible for your personal information is:</p>
        <div className="bg-accent/20 border border-accent/50 rounded-lg p-4">
          <p className="font-semibold">HYBRIDX.CLUB</p>
          <p className="text-muted-foreground">Somerset</p>
          <p className="text-muted-foreground">United Kingdom</p>
        </div>
      </section>

      <section className="border-t pt-6">
        <h2 className="text-2xl font-semibold mb-4">Summary of Key Points</h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li><strong>Data collected:</strong> Account info, workout data, performance metrics, optional Strava activities</li>
          <li><strong>Purpose:</strong> Provide personalized training programs and track your fitness progress</li>
          <li><strong>Third parties:</strong> Firebase/Google (hosting), Stripe (payments), Strava (optional sync), Google Gemini (AI features)</li>
          <li><strong>Your rights:</strong> Access, correct, delete, export your data at any time</li>
          <li><strong>Security:</strong> Industry-standard encryption and security practices</li>
          <li><strong>No selling of data:</strong> We never sell your personal information</li>
          <li><strong>No ads:</strong> The App does not display advertisements</li>
        </ul>
        <p className="text-muted-foreground mt-4 italic">
          By using HYBRIDX.CLUB, you acknowledge that you have read and understood this Privacy Policy.
        </p>
      </section>
    </div>
  );
}

    