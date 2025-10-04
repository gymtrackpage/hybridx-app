# Dark Mode & Theme System 🎨

## ✨ What's New

A complete theming system with **Dark Mode** and **Color Themes**!

---

## 🌓 Dark Mode Options

### Three Theme Modes

1. **Light Mode** ☀️
   - Always use light theme
   - Clean, bright interface

2. **Dark Mode** 🌙
   - Always use dark theme
   - Easy on the eyes, perfect for night use

3. **Auto Mode** 💻
   - Automatically matches your device settings
   - Switches between light/dark based on system preference
   - Updates instantly when you change system theme

---

## 🎨 Color Themes

### Yellow (Default)
- Vibrant yellow accent color
- High energy, athletic feel
- HSL: 45° 95% 55%

### Hot Pink 💗
- Bold hot pink accent color
- Modern, eye-catching design
- HSL: 330° 100% 60%

**Both color themes work perfectly with light AND dark mode!**

---

## 🛠 Implementation

### 1. Theme Context ([theme-context.tsx](src/contexts/theme-context.tsx))
Manages theme state across the app:
- Saves preferences to localStorage
- Listens to system theme changes (auto mode)
- Applies theme classes to `<html>` element

### 2. CSS Variables ([globals.css](src/app/globals.css))
Smart theming with CSS custom properties:

**Light Mode:**
```css
:root {
  --background: white;
  --foreground: black;
  --accent: yellow;
}
```

**Dark Mode:**
```css
.dark {
  --background: dark-gray;
  --foreground: white;
  --accent: yellow;
}
```

**Hot Pink Theme:**
```css
.theme-pink {
  --accent: hot-pink;
  /* Works in both light & dark! */
}
```

### 3. Theme Switcher ([theme-switcher.tsx](src/components/theme-switcher.tsx))
Beautiful UI in Profile settings with:
- Theme mode selector (Light/Dark/Auto)
- Color theme picker (Yellow/Hot Pink)
- Live preview of theme choices
- Persisted preferences

---

## 🎯 How It Works

### Theme Persistence
1. User selects theme in profile
2. Choice saved to **localStorage**
3. Theme applied immediately
4. **Persists across sessions** ✅

### Auto Mode
1. Checks system preference: `prefers-color-scheme`
2. Applies matching theme
3. **Listens for system changes**
4. Auto-updates when device theme changes

### Color Themes
- Independent from light/dark mode
- Can use Hot Pink in light OR dark mode
- Accent colors adapt to background

---

## 📱 PWA Integration

### Theme Color Meta Tags
```html
<!-- Light mode -->
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)" />

<!-- Dark mode -->
<meta name="theme-color" content="#0A0A0A" media="(prefers-color-scheme: dark)" />
```

Updates PWA toolbar/status bar color to match theme!

---

## 🎨 What Changes with Themes

### Elements Affected:
✅ Background colors  
✅ Text colors  
✅ Card backgrounds  
✅ Button styles  
✅ Border colors  
✅ Chart colors  
✅ Sidebar theme  
✅ Input fields  
✅ **All yellow accents → Pink (when selected)**

### Smart Color Adaptation:
- Charts use theme colors
- Stats widgets adapt colors
- Workout cards themed
- Notifications styled
- Share images match theme

---

## 🧪 Testing Themes

### Test Theme Modes:
1. Go to Profile page
2. See "Theme Mode" section
3. Select Light/Dark/Auto
4. ✅ Theme changes instantly

### Test Auto Mode:
1. Select "Auto" in settings
2. Change device theme (Settings → Display)
3. ✅ App theme updates automatically

### Test Color Themes:
1. Go to "Color Theme" section
2. Select "Hot Pink"
3. ✅ All yellow accents become pink
4. Try in Light and Dark mode
5. ✅ Pink works in both!

---

## 💡 User Experience

### Light Mode (Yellow)
```
☀️ Bright white background
⚡ Vibrant yellow accents
📊 High contrast, energetic
```

### Dark Mode (Yellow)
```
🌙 Dark gray background
⚡ Yellow accents pop
🌃 Easy on eyes, modern
```

### Light Mode (Hot Pink)
```
☀️ Bright white background
💗 Hot pink accents
✨ Bold, modern aesthetic
```

### Dark Mode (Hot Pink)
```
🌙 Dark background
💗 Vibrant pink accents
🎀 Sleek, contemporary vibe
```

---

## 🔧 Technical Details

### Theme Classes Applied:
- **Light**: `<html class="light">`
- **Dark**: `<html class="dark">`
- **Pink**: `<html class="theme-pink">`
- **Dark + Pink**: `<html class="dark theme-pink">`

### Color Values:

**Yellow Accent:**
- Light: `hsl(45, 95%, 55%)`
- Dark: `hsl(45, 95%, 55%)`

**Hot Pink Accent:**
- Light: `hsl(330, 100%, 60%)`
- Dark: `hsl(330, 90%, 55%)`

### localStorage Keys:
- `theme`: 'light' | 'dark' | 'auto'
- `color-theme`: 'yellow' | 'pink'

---

## 📍 Where to Find Theme Settings

**Profile Page** → Scroll down to bottom

You'll see two cards:
1. **Theme Mode** - Choose light/dark/auto
2. **Color Theme** - Choose yellow/pink
3. **Preview** - See how it looks

---

## 🎉 Summary

✅ **3 Theme Modes**: Light, Dark, Auto  
✅ **2 Color Themes**: Yellow, Hot Pink  
✅ **6 Total Combinations** to choose from  
✅ **Instant switching** - no reload needed  
✅ **Persistent preferences** across sessions  
✅ **Auto-sync** with system theme  
✅ **PWA compatible** - status bar adapts  

Your app now has a complete, professional theming system! 🚀
