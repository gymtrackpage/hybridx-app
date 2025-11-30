# Play Store Test Account Credentials

This document contains the test account credentials for Google Play Store reviewers.

## Test Account Details

**Created:** November 30, 2024
**User ID:** HbqxhjTcojhNkUus3kXOtwppUTP2
**Status:** Active and ready for review

### Login Credentials

```
Email: playstore-reviewer@hybridx.club
Password: HybridX2024!TestReview
```

⚠️ **IMPORTANT:** Keep these credentials secure but accessible for Play Store submissions.

## Account Features

This test account includes:

- ✅ Email verified (no verification required)
- ✅ Full access to all app features
- ✅ Onboarding completed
- ✅ Profile setup complete
- ✅ Sample preferences configured
- ✅ Marked as test account in database

## How to Enter in Google Play Console

### Step-by-Step Instructions:

1. **Navigate to App Access:**
   - Open Google Play Console
   - Select your app (HYBRIDX.CLUB)
   - Go to: **Policy** → **App access**

2. **Select Access Type:**
   - Choose: **"All or some functionality is restricted"**
   - Click **"Add new instruction set"**

3. **Configure Login Instructions:**
   - Select: **"Login required"**
   - Choose: **"App sign-in"**

4. **Enter Credentials:**
   ```
   Username: playstore-reviewer@hybridx.club
   Password: HybridX2024!TestReview
   ```

5. **Add Additional Instructions (Optional):**
   ```
   This test account has full access to all app features.
   Sample workout programs and data are pre-loaded.
   The account is configured for HYROX training programs.
   No additional setup is required - simply login and explore.
   ```

6. **Save Settings:**
   - Click **"Save"**
   - Verify the credentials appear correctly

7. **Submit for Review:**
   - You should now be able to send your app for review
   - Reviewers will use these credentials to test your app

## Maintaining the Test Account

### Important Notes:

- **Do NOT delete this account** - reviewers may need it for subsequent reviews
- **Do NOT enable 2FA** - this would prevent automated testing
- **Keep credentials current** - if you change the password, update Play Console
- **Monitor usage** - check logs occasionally to see if reviewers have accessed the account

### Regenerating the Test User

If you need to regenerate or reset this test user, run:

```bash
tsx scripts/create-test-user.ts
```

This script will:
- Create the user if it doesn't exist
- Reset the password to the standard test password
- Update the user profile
- Ensure email is verified

## Account Management

### Checking Test Account in Firebase Console:

1. Go to: https://console.firebase.google.com/
2. Select project: **hyroxedgeai**
3. Navigate to: **Authentication** → **Users**
4. Search for: `playstore-reviewer@hybridx.club`

### Firestore Data:

The test user's profile is stored at:
- Collection: `users`
- Document ID: `HbqxhjTcojhNkUus3kXOtwppUTP2`

You can view/edit this in Firebase Console under Firestore Database.

## Troubleshooting

### If reviewers report they can't login:

1. **Verify account exists:**
   ```bash
   tsx scripts/create-test-user.ts
   ```

2. **Check Firebase Console:**
   - Ensure user is not disabled
   - Confirm email is verified
   - Verify account status

3. **Test credentials yourself:**
   - Try logging in with the test account on your live app
   - Ensure all features are accessible

4. **Update Play Console:**
   - If password was changed, update it in Play Console
   - Verify credentials are entered correctly (no extra spaces)

### If account needs additional data:

The test account should be populated with sample data similar to a real user. If reviewers report missing data:

1. Login to your app with the test account
2. Complete any necessary setup flows
3. Add sample workouts or other content
4. Verify the account has realistic usage data

## Security Considerations

- These credentials are for **testing purposes only**
- The account is marked `isTestAccount: true` in the database
- Consider implementing rate limiting for test accounts
- Monitor for abuse or unauthorized access
- Rotate credentials periodically if needed

## For iOS App Store Review

When you submit to iOS App Store, you'll need similar test credentials. You can use the same account:

**Apple App Store Connect → App Review Information:**
```
Email: playstore-reviewer@hybridx.club
Password: HybridX2024!TestReview
```

The same test account works across both platforms.

---

**Last Updated:** November 30, 2024
**Managed By:** Firebase Admin SDK via `scripts/create-test-user.ts`
