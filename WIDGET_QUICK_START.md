# iOS Widget Quick Start

## Overview
Your Life Organizer app now supports iOS home screen widgets! The widget displays:
- Today's weather
- Tasks due today
- Activities scheduled for today

## Important Notes

⚠️ **Widgets require a custom development build** - They won't work with Expo Go.

⚠️ **You need to manually add the widget extension in Xcode** - The config plugin sets up App Groups, but the widget extension itself must be added in Xcode.

## Quick Setup Steps

1. **Create Development Build**
   ```bash
   eas build --profile development --platform ios
   ```

2. **Set Up App Group in Apple Developer Portal**
   - Go to developer.apple.com
   - Create App Group: `group.com.mauricio.lifeorganizer`

3. **Open Project in Xcode**
   ```bash
   open ios/YourApp.xcworkspace
   ```

4. **Add Widget Extension**
   - File → New → Target → Widget Extension
   - Name: `LifeOrganizerWidget`
   - Copy code from `ios-widget/LifeOrganizerWidget/LifeOrganizerWidget.swift`

5. **Enable App Groups**
   - Main app: Signing & Capabilities → Add App Groups → Check `group.com.mauricio.lifeorganizer`
   - Widget: Same process

6. **Build and Test**
   - Build the app in Xcode
   - Add widget to home screen
   - Test data sync

## Files Created

- `plugins/withIosWidget.js` - Config plugin for App Groups
- `widgetDataSync.js` - Data syncing utility
- `ios-widget/LifeOrganizerWidget/LifeOrganizerWidget.swift` - Widget code
- `ios-widget/WidgetDataManager.swift` - Native module bridge (optional)
- `IOS_WIDGET_SETUP.md` - Detailed setup instructions

## How It Works

1. App syncs data to App Group UserDefaults whenever tasks/activities/weather change
2. Widget reads from App Group UserDefaults
3. Widget refreshes automatically every hour
4. Widget updates when app syncs new data

## Testing

1. Open the app
2. Add a task or activity for today
3. Check the widget - it should update within seconds
4. If not updating, check Xcode console for errors

For detailed instructions, see `IOS_WIDGET_SETUP.md`.

