# iOS Home Screen Widget Setup Guide

This guide will help you set up the iOS home screen widget for your Life Organizer app.

## Prerequisites

1. **Xcode** (latest version recommended)
2. **Expo Development Build** - Widgets require a custom development build, not Expo Go
3. **Apple Developer Account** (for App Groups capability)
4. **macOS** (required for iOS development)

## Step 1: Create a Development Build

Since widgets require native code, you need to create a development build:

```bash
# Install EAS CLI if you haven't already
npm install -g eas-cli

# Login to Expo
eas login

# Configure your project (if not already done)
eas build:configure

# Create a development build for iOS
eas build --profile development --platform ios
```

## Step 2: Set Up App Group

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Identifiers** → **App Groups**
4. Click the **+** button to create a new App Group
5. Enter:
   - **Description**: Life Organizer Widget
   - **Identifier**: `group.com.mauricio.lifeorganizer`
6. Click **Continue** and **Register**

## Step 3: Add Widget Extension to Xcode Project

1. Open your project in Xcode:
   ```bash
   # After building with EAS, open the project
   open ios/YourApp.xcworkspace
   ```

2. In Xcode:
   - Click **File** → **New** → **Target**
   - Select **Widget Extension**
   - Click **Next**
   - Enter:
     - **Product Name**: `LifeOrganizerWidget`
     - **Organization Identifier**: `com.mauricio`
     - **Bundle Identifier**: `com.mauricio.lifeorganizer.LifeOrganizerWidget`
   - Make sure **Include Configuration Intent** is **unchecked**
   - Click **Finish**
   - When prompted, click **Activate** for the scheme

## Step 4: Configure App Group for Main App

1. In Xcode, select your **main app target** (LifeOrganizerSimple)
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability**
4. Add **App Groups**
5. Check the box for `group.com.mauricio.lifeorganizer`

## Step 5: Configure App Group for Widget Extension

1. In Xcode, select your **widget extension target** (LifeOrganizerWidget)
2. Go to **Signing & Capabilities** tab
3. Click **+ Capability**
4. Add **App Groups**
5. Check the box for `group.com.mauricio.lifeorganizer`

## Step 6: Replace Widget Extension Code

1. In Xcode, navigate to the `LifeOrganizerWidget` folder
2. Delete the default `LifeOrganizerWidget.swift` file
3. Copy the contents from `ios-widget/LifeOrganizerWidget/LifeOrganizerWidget.swift` into a new file in Xcode
4. Update the `Info.plist` for the widget extension with the contents from `ios-widget/LifeOrganizerWidget/Info.plist`

## Step 7: Add Native Module Bridge (Optional but Recommended)

To enable direct data syncing from React Native to the widget:

1. In Xcode, right-click on your main app target
2. Select **New File** → **Swift File**
3. Name it `WidgetDataManager.swift`
4. Copy the contents from `ios-widget/WidgetDataManager.swift`
5. Create a bridging header if needed:
   - Xcode will prompt you to create a bridging header
   - Click **Create Bridging Header**
   - Add: `#import <React/RCTBridgeModule.h>`

6. Create the Objective-C bridge file:
   - Right-click → **New File** → **Objective-C File**
   - Name it `WidgetDataManager.m`
   - Copy contents from `ios-widget/WidgetDataManager.m`

7. Update your `Podfile` to include WidgetKit:
   ```ruby
   # Add this to your Podfile
   pod 'WidgetKit', :modular_headers => true
   ```

8. Run:
   ```bash
   cd ios
   pod install
   ```

## Step 8: Update Bundle Identifier

Make sure the widget extension's bundle identifier follows this pattern:
- Main app: `com.mauricio.lifeorganizer`
- Widget: `com.mauricio.lifeorganizer.LifeOrganizerWidget`

## Step 9: Build and Test

1. In Xcode, select your **main app scheme** (not the widget)
2. Build and run on a device or simulator (iOS 14+)
3. Once the app is running, go to the home screen
4. Long press on an empty area
5. Tap the **+** button in the top-left
6. Search for "Life Organizer"
7. Select the widget size (Small, Medium, or Large)
8. Tap **Add Widget**

## Step 10: Verify Data Sync

1. Open your app
2. Add some tasks or activities for today
3. Check the widget - it should update within a few seconds
4. If the widget doesn't update, check the Xcode console for errors

## Troubleshooting

### Widget shows "No data available"
- Make sure the App Group is configured for both the main app and widget extension
- Verify the App Group identifier matches exactly: `group.com.mauricio.lifeorganizer`
- Check that data is being synced (check console logs in Xcode)

### Widget doesn't appear in widget gallery
- Make sure you've built the widget extension target
- Verify the widget's `Info.plist` is correct
- Check that the widget bundle identifier is correct

### Data not syncing
- Verify the native module is properly linked
- Check Xcode console for errors
- Make sure both app and widget have the App Group capability enabled
- Try restarting the app and widget

### Build errors
- Make sure you're using a development build, not Expo Go
- Verify all dependencies are installed
- Clean build folder: **Product** → **Clean Build Folder** (Shift+Cmd+K)

## Widget Features

The widget displays:
- **Weather**: Current temperature and conditions
- **Tasks**: Up to 5 tasks due today (with priority indicators)
- **Activities**: Up to 5 activities scheduled for today (with times)

### Widget Sizes
- **Small**: Weather + task/activity counts
- **Medium**: Weather + 3 tasks + 2 activities
- **Large**: Full weather + 5 tasks + 5 activities

## Notes

- Widget data refreshes automatically every hour
- Data syncs from the app whenever tasks/activities/weather change
- The widget requires iOS 14 or later
- Widget updates may take a few seconds to appear

## Next Steps

After setup, you can customize the widget:
- Modify colors and styling in `LifeOrganizerWidget.swift`
- Add more data fields
- Create additional widget sizes
- Add interactive elements (requires iOS 17+)

