# iOS App Store Release Setup Guide

This guide walks you through everything needed to build and release your HYBRIDX.CLUB app to the Apple App Store using CodeMagic.

## Prerequisites Checklist

### 1. Apple Developer Account
- [ ] **Enroll in Apple Developer Program** ($99/year)
  - Visit: https://developer.apple.com/programs/
  - Required for submitting apps to the App Store
  - Processing can take 24-48 hours

### 2. App Store Connect Setup
- [ ] **Create App Store Connect account**
  - Visit: https://appstoreconnect.apple.com/
  - Use the same Apple ID as your Developer account

- [ ] **Create your app in App Store Connect**
  1. Log in to App Store Connect
  2. Click "My Apps" → "+" → "New App"
  3. Fill in:
     - Platform: iOS
     - Name: HYBRIDX.CLUB
     - Primary Language: English
     - Bundle ID: `club.hybridx.app` (must match your Capacitor config)
     - SKU: A unique identifier (e.g., `hybridx-club-001`)
  4. Save the **App Store ID** (numeric, found in App Information)
  5. Update `APP_STORE_APP_ID` in `codemagic.yaml` line 172 with this ID

### 3. Required Assets

#### App Icons
You need app icons in multiple sizes. Create these from your logo:

**Required Sizes:**
- 1024x1024px - App Store (PNG, no transparency)
- 180x180px - iPhone (3x)
- 120x120px - iPhone (2x)
- 87x87px - Settings (3x)
- 80x80px - Spotlight (2x)
- 60x60px - Notification (3x)
- 58x58px - Settings (2x)
- 40x40px - Spotlight (2x)
- 29x29px - Settings (1x)

**Placement:**
- Add icons to `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- You can use online tools like https://appicon.co/ to generate all sizes

#### Launch Screen (Splash Screen)
- Already configured in `capacitor.config.ts`
- Add your splash screen image to `ios/App/App/Assets.xcassets/Splash.imageset/`
- Recommended size: 2732x2732px (will be centered/scaled)

#### App Store Screenshots
Required for App Store listing:

**iPhone Screenshots (required):**
- 6.7" display (1290 x 2796 px) - iPhone 15 Pro Max
- 6.5" display (1242 x 2688 px) - iPhone 11 Pro Max

**iPad Screenshots (if supporting iPad):**
- 12.9" display (2048 x 2732 px)

**Tips:**
- You can use iPhone/iPad simulators to capture these
- Show your app's key features
- Need 3-10 screenshots per device size

### 4. App Information for App Store

Prepare the following information:

- **App Name:** HYBRIDX.CLUB
- **Subtitle:** (80 characters max, describes your app)
- **Description:** (4000 characters max)
- **Keywords:** (100 characters, comma-separated)
- **Support URL:** https://app.hybridx.club (or your support page)
- **Marketing URL:** (optional) Your website
- **Privacy Policy URL:** https://app.hybridx.club/privacy (host your PRIVACY_POLICY.md)
- **Category:** Health & Fitness (or appropriate category)
- **Age Rating:** Complete questionnaire in App Store Connect

## Code Signing & Provisioning Setup

### Step 1: Create Certificates in Apple Developer Portal

1. **Go to:** https://developer.apple.com/account/resources/certificates/list

2. **Create iOS Distribution Certificate:**
   - Click "+" to create new certificate
   - Select "Apple Distribution"
   - Follow prompts (you may need to create a Certificate Signing Request on Mac)
   - Download and save the certificate

### Step 2: Register Bundle ID

1. **Go to:** https://developer.apple.com/account/resources/identifiers/list

2. **Register App ID:**
   - Click "+" to register new identifier
   - Select "App IDs" → "App"
   - Description: HYBRIDX.CLUB
   - Bundle ID: `club.hybridx.app` (Explicit)
   - Capabilities: Enable any required (e.g., Push Notifications if needed)

### Step 3: Create Provisioning Profile

1. **Go to:** https://developer.apple.com/account/resources/profiles/list

2. **Create App Store Provisioning Profile:**
   - Click "+" to create new profile
   - Select "App Store" distribution
   - Select your App ID (`club.hybridx.app`)
   - Select your Distribution Certificate
   - Give it a name: "HYBRIDX App Store Profile"
   - Download the provisioning profile

### Step 4: Set Up CodeMagic Code Signing

1. **Log in to CodeMagic:** https://codemagic.io/

2. **Set up App Store Connect Integration:**
   - Go to Teams → Integrations
   - Click "App Store Connect"
   - Add integration named `hybridx_app_store_connect`
   - Follow prompts to connect your Apple Developer account
   - This allows CodeMagic to:
     - Download provisioning profiles
     - Upload builds to TestFlight
     - Submit to App Store

3. **Upload Code Signing Files:**
   - Go to your app → Settings → Code signing identities
   - Upload your iOS Distribution certificate (.p12 file)
   - Upload your App Store provisioning profile
   - CodeMagic will automatically use these during builds

## Building and Releasing

### Trigger a Build

The iOS workflow is configured to trigger on git tags starting with `ios-v`:

```bash
# Create and push an iOS release tag
git tag ios-v1.0.0
git push origin ios-v1.0.0
```

This will:
1. Build your Next.js app
2. Sync with Capacitor iOS
3. Build the `.ipa` file
4. Automatically upload to TestFlight
5. Make available to "Internal Testers" group

### Update Version Numbers

Before each release, update version in Xcode project:

1. Open `ios/App/App.xcodeproj` in Xcode (requires Mac)
2. Select the App target
3. Update **Version** (user-facing, e.g., "1.0.0")
4. **Build number** is auto-incremented by CodeMagic

Or manually edit `ios/App/App/Info.plist`:
```xml
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
```

### TestFlight Testing

After successful build:
1. Builds automatically go to TestFlight
2. Add testers in App Store Connect → TestFlight
3. Testers receive email to install TestFlight app
4. Gather feedback before App Store submission

### Submit to App Store

When ready for public release:

1. **Update codemagic.yaml** (line 228):
   ```yaml
   submit_to_app_store: true  # Change from false
   ```

2. **Complete App Store Connect listing:**
   - Add screenshots
   - Complete description
   - Set pricing (Free/Paid)
   - Add privacy policy URL
   - Complete age rating questionnaire

3. **Submit for Review:**
   - Either triggered automatically by CodeMagic (if `submit_to_app_store: true`)
   - Or manually in App Store Connect

4. **App Review Process:**
   - Apple reviews your app (typically 24-48 hours)
   - They'll test functionality, check guidelines compliance
   - You may receive feedback/requests for changes

## Troubleshooting

### Common Issues

**Build fails with "No provisioning profile":**
- Verify provisioning profile is uploaded to CodeMagic
- Check bundle identifier matches exactly: `club.hybridx.app`

**"App Store Connect API key invalid":**
- Re-authenticate the App Store Connect integration in CodeMagic
- Check API key hasn't expired

**Version already exists:**
- Increment build number or version string
- CodeMagic auto-increments build number, but version must be manually updated

**Missing compliance:**
- If your app uses encryption (HTTPS counts), you need to set export compliance
- Add to `Info.plist`:
  ```xml
  <key>ITSAppUsesNonExemptEncryption</key>
  <false/>
  ```

## Next Steps After This Setup

1. ✅ iOS project generated
2. ✅ CodeMagic workflow configured
3. ⏳ Complete Apple Developer account enrollment
4. ⏳ Create app in App Store Connect
5. ⏳ Generate and upload code signing certificates
6. ⏳ Prepare app icons and screenshots
7. ⏳ Complete App Store listing information
8. ⏳ Trigger first build with `ios-v1.0.0` tag
9. ⏳ Test via TestFlight
10. ⏳ Submit for App Store review

## Useful Links

- **Apple Developer Portal:** https://developer.apple.com/account/
- **App Store Connect:** https://appstoreconnect.apple.com/
- **CodeMagic Documentation:** https://docs.codemagic.io/yaml-code-signing/signing-ios/
- **Capacitor iOS Guide:** https://capacitorjs.com/docs/ios
- **App Store Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/

## Support

If you encounter issues:
- Check CodeMagic build logs for detailed error messages
- Review Apple Developer forums
- Consult Capacitor documentation for iOS-specific issues
