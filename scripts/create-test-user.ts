// scripts/create-test-user.ts
// Script to create a test user for Google Play Store reviewers

import { getAdminAuth, getAdminDb } from '../src/lib/firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TEST_USER_EMAIL = 'playstore-reviewer@hybridx.club';
const TEST_USER_PASSWORD = 'HybridX2024!TestReview';
const TEST_USER_DISPLAY_NAME = 'PlayStore Test Reviewer';

async function createTestUser() {
  try {
    console.log('🔧 Initializing Firebase Admin SDK...');
    const auth = getAdminAuth();
    const db = getAdminDb();

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(TEST_USER_EMAIL);
      console.log('✅ Test user already exists:', userRecord.uid);
      console.log('📧 Email:', TEST_USER_EMAIL);
      console.log('🔑 Password: (unchanged) -', TEST_USER_PASSWORD);

      // Update password in case it needs to be reset
      await auth.updateUser(userRecord.uid, {
        password: TEST_USER_PASSWORD,
        displayName: TEST_USER_DISPLAY_NAME,
        emailVerified: true
      });
      console.log('✅ Test user password and profile updated');

    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log('Creating new test user...');

        // Create the user
        userRecord = await auth.createUser({
          email: TEST_USER_EMAIL,
          password: TEST_USER_PASSWORD,
          displayName: TEST_USER_DISPLAY_NAME,
          emailVerified: true // Mark as verified so reviewers don't need to verify email
        });

        console.log('✅ Test user created successfully!');
        console.log('👤 User ID:', userRecord.uid);
        console.log('📧 Email:', TEST_USER_EMAIL);
        console.log('🔑 Password:', TEST_USER_PASSWORD);
      } else {
        throw error;
      }
    }

    // Create or update user profile in Firestore
    const userProfileRef = db.collection('users').doc(userRecord.uid);
    const userProfile = await userProfileRef.get();

    if (!userProfile.exists) {
      console.log('📝 Creating user profile in Firestore...');

      await userProfileRef.set({
        email: TEST_USER_EMAIL,
        displayName: TEST_USER_DISPLAY_NAME,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTestAccount: true,
        // Add sample user data that reviewers might expect to see
        profile: {
          firstName: 'PlayStore',
          lastName: 'Reviewer',
          // Add any other profile fields your app uses
        },
        // Add sample preferences
        preferences: {
          theme: 'light',
          notifications: true,
        },
        // Add sample onboarding completion
        onboarding: {
          completed: true,
          completedAt: new Date().toISOString(),
        }
      });

      console.log('✅ User profile created in Firestore');
    } else {
      console.log('✅ User profile already exists in Firestore');

      // Update to ensure it's marked as a test account
      await userProfileRef.update({
        isTestAccount: true,
        updatedAt: new Date().toISOString(),
        email: TEST_USER_EMAIL,
        displayName: TEST_USER_DISPLAY_NAME,
      });
      console.log('✅ User profile updated');
    }

    console.log('\n📋 Google Play Console Instructions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Go to: Play Console → Your App → Policy → App access');
    console.log('2. Select: "All or some functionality is restricted"');
    console.log('3. Click: "Add new instruction set"');
    console.log('4. Select: "Login required"');
    console.log('5. Enter the following credentials:');
    console.log('');
    console.log('   Username/Email:', TEST_USER_EMAIL);
    console.log('   Password:', TEST_USER_PASSWORD);
    console.log('');
    console.log('   Additional instructions (optional):');
    console.log('   "This test account has full access to all app features.');
    console.log('   Sample workout programs and data are pre-loaded.');
    console.log('   The account is configured for HYROX training programs."');
    console.log('');
    console.log('6. Click "Save"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ Done! Your test user is ready for Play Store review.');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

// Run the script
createTestUser()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
