# Android App Icon Fix Guide

## Issue
The Android app icon currently has a **black background with a black "X" logo**, making it invisible or very hard to see on most launchers.

## What I've Fixed

✅ Changed the adaptive icon background from black (#000000) to white (#FFFFFF) in:
- `android/app/src/main/res/drawable/ic_launcher_background.xml`

This fixes the icon on **modern Android devices** (API 26+) that support adaptive icons.

## What Still Needs Fixing

The PNG background files for older Android versions still have black backgrounds at:
- `android/app/src/main/res/mipmap-*/ic_launcher_background.png` (all densities)

## Recommended Solutions

### Option 1: Use Android Studio (Recommended - Most Professional)

1. **Open the project in Android Studio:**
   ```bash
   # On Mac/Linux
   open -a "Android Studio" android/

   # On Windows
   # Open Android Studio and select "Open an existing project"
   # Navigate to the android/ folder
   ```

2. **Generate new icons using Asset Studio:**
   - Right-click on `app` folder in Android Studio
   - Select: **New → Image Asset**
   - Select **Launcher Icons (Adaptive and Legacy)**
   - For the **Foreground Layer:**
     - Path: Select `/home/user/studio/public/icon-logo.png`
     - Resize: Adjust so the "X" logo is centered and sized appropriately
   - For the **Background Layer:**
     - Select **Color**
     - Choose: **#FFFFFF** (white) or **#F3F4F6** (light gray)
   - Preview the icons across different device shapes
   - Click **Next** → **Finish**

3. **Verify the generated icons:**
   - Check all mipmap folders have been updated
   - Test on an Android device or emulator

### Option 2: Use Capacitor Assets Tool

1. **Create a resources folder:**
   ```bash
   mkdir -p resources
   ```

2. **Add your icon:**
   - Copy `public/icon-logo.png` to `resources/icon.png`
   - Make sure it's at least 1024x1024px
   - Ensure it has a transparent background (the logo itself)

3. **Create a background:**
   The icon should be designed for a white or light background since your logo is black.

   If needed, edit `icon-logo.png` to add padding and a white background using an image editor.

4. **Generate assets:**
   ```bash
   npx @capacitor/assets generate --android --iconBackgroundColor '#FFFFFF'
   ```

### Option 3: Manual Replacement (Quick Fix)

Create white background PNGs manually:

1. **Use an online tool like:**
   - https://www.appicon.co/
   - https://icon.kitchen/
   - https://easyappicon.com/

2. **Upload your logo:**
   - Use `public/icon-logo.png`
   - Set background to white (#FFFFFF)
   - Download the Android icon pack

3. **Replace the files:**
   - Extract the downloaded icons
   - Copy all `mipmap-*` folders
   - Replace in `android/app/src/main/res/`

## Current Background Color

I've set the XML background to **white (#FFFFFF)** which works well with your black "X" logo.

### Alternative Background Colors:

If you prefer a different look:

**Light Gray (subtle):**
```xml
android:fillColor="#F3F4F6"
```

**Your Brand Green (if you want colored background):**
```xml
android:fillColor="#10B981"
```

**Gradient (requires more complex XML):**
You can create a gradient background for a more modern look.

## Testing the Icon

After making changes:

1. **Rebuild the app:**
   ```bash
   cd android
   ./gradlew clean
   ./gradlew bundleRelease
   ```

2. **Test on device:**
   - Install the new APK/AAB
   - Check the icon on your launcher
   - Test on both light and dark launcher themes

3. **Check different Android versions:**
   - Modern (API 26+): Uses adaptive icon
   - Legacy (API < 26): Uses static PNG icon

## For Next Release

Make sure to:
1. Update all icon files before building
2. Test on multiple Android devices/emulators
3. Check both light and dark launcher themes
4. Verify in Play Store listing preview

## Quick Command Reference

```bash
# Clean build
cd android && ./gradlew clean

# Build release AAB
cd android && ./gradlew bundleRelease

# Generate assets (if using Capacitor tool)
npx @capacitor/assets generate --android --iconBackgroundColor '#FFFFFF'
```

---

**Status:**
- ✅ XML background changed to white
- ⏳ PNG backgrounds need manual update
- 📱 Test on device after next build

**Priority:** High - This affects the first impression of your app in the Play Store and on users' devices.
