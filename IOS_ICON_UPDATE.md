# iOS App Icon Update

## What I've Done

✅ Replaced the default Capacitor iOS icon with your HYBRIDX.CLUB logo
- Location: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Source: `public/icon-logo.png`

## iOS Icon Requirements

iOS requires a **1024x1024px** icon that:
- Must be exactly 1024x1024 pixels
- PNG format without transparency (solid background)
- Should not have rounded corners (iOS adds them automatically)
- No alpha channel in the final icon

## Current Status

Your logo has been copied to the iOS icon location. However, the iOS icon should ideally:

1. **Have a white or branded background** (since your logo is black)
2. **Be 1024x1024px** exactly
3. **Have proper padding** around the logo

## iOS vs Android Icons

**Similarities:**
- Both need your black "X" logo
- Both benefit from a white/light background for contrast

**Differences:**
- iOS: Single 1024x1024 image, iOS applies rounded corners
- Android: Adaptive icons with separate foreground/background layers

## Recommended Icon Creation

### Option 1: Use Figma/Photoshop

1. Create 1024x1024px canvas with **white background**
2. Place your logo centered with padding
3. Export as PNG (no transparency)
4. Replace: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`

### Option 2: Use Online Tool

1. Visit: https://www.appicon.co/ or https://icon.kitchen/
2. Upload `public/icon-logo.png`
3. Set background to white (#FFFFFF)
4. Download iOS icon set
5. Replace the iOS icon

### Option 3: Use ImageMagick (Command Line)

If you have ImageMagick installed:

```bash
# Create 1024x1024 icon with white background and centered logo
convert public/icon-logo.png \
  -resize 768x768 \
  -background white \
  -gravity center \
  -extent 1024x1024 \
  ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```

This creates proper padding around your logo on a white background.

## Testing

After updating the icon:

1. **Clean the build:**
   ```bash
   rm -rf ios/App/DerivedData
   ```

2. **Rebuild:**
   ```bash
   npx cap sync ios
   ```

3. **Test in Xcode:**
   - Open `ios/App/App.xcworkspace` in Xcode
   - Run on simulator or device
   - Check the icon on the home screen

## For Both Platforms

For the most professional result, I recommend using an icon generation service that creates all required sizes:

1. **appicon.co** or **icon.kitchen**
2. Upload your logo
3. Set white background
4. Download both Android and iOS icon packs
5. Replace all icons in both platforms

This ensures:
- Proper sizing for all densities
- Correct formatting
- Professional appearance across all devices

## Quick Reference

**Current icon locations:**
- Android: `android/app/src/main/res/mipmap-*/`
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

**Your source logo:**
- `public/icon-logo.png` (black "X" logo)
- `public/full-logo.png` (full logo with text)

**Recommended background:**
- White (#FFFFFF) for maximum contrast with black logo
- Alternative: Light gray (#F3F4F6) for subtle look

---

**Next Steps:**
1. Use icon generation tool to create professional icons
2. Replace icons in both iOS and Android
3. Test on devices
4. Prepare for App Store/Play Store submissions
