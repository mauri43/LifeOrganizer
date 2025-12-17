# iOS Extensions Setup Guide

This app includes two iOS extensions that require special handling:

1. **Share Extension** - Allows saving recipes directly from Instagram's share sheet
2. **Widget Extension** - Displays tasks, activities, and weather on the home screen

## Important: Preserving Extensions Across Builds

The `ios/` folder is **NOT gitignored** because it contains manually configured Xcode targets. Running `npx expo prebuild --clean` will **DELETE** your extension configurations.

### Safe Commands

```bash
# Safe - preserves ios/ folder
npx expo prebuild

# Safe - only updates dependencies
cd ios && pod install

# Safe - run on device/simulator
npx expo run:ios
```

### Dangerous Commands

```bash
# DANGER - will delete your extension configurations!
npx expo prebuild --clean

# If you must use --clean, you'll need to reconfigure extensions in Xcode
```

## Folder Structure

```
LifeOrganizerSimple/
├── ios/                          # Xcode project (keep in git!)
│   ├── LifeOrganizerSimple/      # Main app
│   ├── ShareExtension/           # Share Extension target
│   ├── LifeOrganizerWidget/      # Widget Extension target
│   ├── RecipeQueueManager.swift  # Native bridge (in main app target)
│   ├── RecipeQueueManager.m
│   ├── WidgetDataManager.swift   # Native bridge (in main app target)
│   └── WidgetDataManager.m
├── ios-share-extension/          # Share Extension source files
│   ├── ShareViewController.swift
│   ├── Info.plist
│   └── ShareExtension.entitlements
├── ios-widget/                   # Widget source files
│   ├── LifeOrganizerWidget/
│   │   ├── LifeOrganizerWidget.swift
│   │   └── Info.plist
│   ├── RecipeQueueManager.swift
│   ├── RecipeQueueManager.m
│   ├── WidgetDataManager.swift
│   └── WidgetDataManager.m
└── plugins/                      # Expo config plugins
    ├── withIosShareExtension.js
    └── withIosWidget.js
```

## Extension Details

### Share Extension

- **Target Name:** ShareExtension
- **Bundle ID:** com.mauricio.lifeorganizer.ShareExtension
- **App Group:** group.com.mauricio.lifeorganizer
- **Purpose:** Captures Instagram URLs and queues them for recipe extraction

**How it works:**
1. User shares a link from Instagram
2. Share Extension saves URL to App Group UserDefaults
3. Sends "Recipe queued" notification
4. When main app opens, it processes the queue and fetches recipes

### Widget Extension

- **Target Name:** LifeOrganizerWidget
- **Bundle ID:** com.mauricio.lifeorganizer.LifeOrganizerWidget
- **App Group:** group.com.mauricio.lifeorganizer
- **Supported Sizes:** Small, Medium, Large

**Features:**
- Shows today's weather
- Shows today's tasks with priority colors
- Shows today's activities with times

## Native Bridge Modules

These files allow React Native to communicate with native code:

### RecipeQueueManager
- `getQueuedUrls()` - Get URLs queued by Share Extension
- `removeUrl(url)` - Remove processed URL from queue
- `clearQueue()` - Clear all queued URLs

### WidgetDataManager
- `setWidgetData(json)` - Update widget data and refresh timelines
- `getWidgetData()` - Read current widget data

## Rebuilding After Clean Prebuild

If you accidentally run `npx expo prebuild --clean` and lose your extensions:

### Option 1: Restore from Git
```bash
git checkout -- ios/
```

### Option 2: Manually Reconfigure in Xcode

1. Open `ios/LifeOrganizerSimple.xcworkspace`

2. **Add Share Extension:**
   - File → New → Target → Share Extension
   - Name: `ShareExtension`
   - Delete auto-generated `ShareViewController.swift`
   - Add files from `ios-share-extension/` to the target
   - Add App Groups capability: `group.com.mauricio.lifeorganizer`

3. **Add Widget Extension:**
   - File → New → Target → Widget Extension
   - Name: `LifeOrganizerWidget`
   - Delete auto-generated files
   - Add files from `ios-widget/LifeOrganizerWidget/` to the target
   - Add App Groups capability: `group.com.mauricio.lifeorganizer`

4. **Add Native Bridge to Main App:**
   - Add `RecipeQueueManager.swift` and `.m` to main app target
   - Add `WidgetDataManager.swift` and `.m` to main app target
   - Create bridging header if prompted

5. **Configure Signing:**
   - All three targets need the same Team
   - Enable "Automatically manage signing"

## Testing

### Share Extension
1. Build and run on device
2. Open Safari, go to an Instagram post
3. Tap Share → find "Save Recipe"
4. Should show "Recipe queued!" notification

### Widget
1. Build and run on device
2. Long press home screen → tap +
3. Search "Life Organizer"
4. Add widget to home screen

## Troubleshooting

### "No such module 'React'"
```bash
cd ios && pod install
```

### Share Extension not appearing
- Check bundle ID is correct
- Rebuild the app
- Check Info.plist activation rules

### Widget shows "No data"
- Make sure app has been opened at least once
- Check App Group identifier matches
- Run main app to sync data

### Signing errors
- Ensure all targets use the same Team
- Check App Group is added to all targets
