const { withXcodeProject, withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP_IDENTIFIER = 'group.com.mauricio.lifeorganizer';

/**
 * iOS Widget Config Plugin
 *
 * This plugin:
 * 1. Ensures App Groups entitlement is set for the main app
 * 2. Copies native bridge files (WidgetDataManager, RecipeQueueManager) if needed
 *
 * IMPORTANT: The Widget Extension Xcode target must be added manually in Xcode.
 * This plugin prepares the files but cannot automatically add extension targets.
 *
 * If you've already configured the Widget in Xcode, this plugin
 * will preserve your configuration.
 */
function withIosWidget(config) {
  // Add App Group capability via Info.plist
  config = withInfoPlist(config, (config) => {
    if (!config.modResults.AppGroups) {
      config.modResults.AppGroups = [];
    }
    if (!config.modResults.AppGroups.includes(APP_GROUP_IDENTIFIER)) {
      config.modResults.AppGroups.push(APP_GROUP_IDENTIFIER);
    }
    return config;
  });

  // Ensure App Groups entitlement exists
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults['com.apple.security.application-groups']) {
      config.modResults['com.apple.security.application-groups'] = [];
    }
    if (!config.modResults['com.apple.security.application-groups'].includes(APP_GROUP_IDENTIFIER)) {
      config.modResults['com.apple.security.application-groups'].push(APP_GROUP_IDENTIFIER);
    }
    return config;
  });

  // Copy native bridge files if needed
  config = withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, 'ios');
    const widgetSourcePath = path.join(projectRoot, 'ios-widget');

    // Check if native bridge files already exist in ios/
    const destWidgetManager = path.join(iosPath, 'WidgetDataManager.swift');
    const destRecipeManager = path.join(iosPath, 'RecipeQueueManager.swift');

    // Copy native bridge files if they don't exist
    const bridgeFiles = [
      'WidgetDataManager.swift',
      'WidgetDataManager.m',
      'RecipeQueueManager.swift',
      'RecipeQueueManager.m',
    ];

    let copiedAny = false;
    bridgeFiles.forEach((file) => {
      const srcPath = path.join(widgetSourcePath, file);
      const destPath = path.join(iosPath, file);

      if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[withIosWidget] Copied ${file} to ios/`);
        copiedAny = true;
      }
    });

    // Copy Widget extension folder if needed
    const widgetExtSourcePath = path.join(widgetSourcePath, 'LifeOrganizerWidget');
    const widgetExtDestPath = path.join(iosPath, 'LifeOrganizerWidget');
    const destWidgetSwift = path.join(widgetExtDestPath, 'LifeOrganizerWidget.swift');

    if (fs.existsSync(widgetExtSourcePath) && !fs.existsSync(destWidgetSwift)) {
      console.log('[withIosWidget] Copying LifeOrganizerWidget folder...');

      if (!fs.existsSync(widgetExtDestPath)) {
        fs.mkdirSync(widgetExtDestPath, { recursive: true });
      }

      // Copy widget files
      const widgetFiles = fs.readdirSync(widgetExtSourcePath);
      widgetFiles.forEach((file) => {
        const srcPath = path.join(widgetExtSourcePath, file);
        const destPath = path.join(widgetExtDestPath, file);

        if (fs.statSync(srcPath).isFile() && !fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[withIosWidget] Copied ${file}`);
          copiedAny = true;
        }
      });
    }

    if (copiedAny) {
      console.log('\n========================================');
      console.log('WIDGET EXTENSION SETUP');
      console.log('========================================');
      console.log('Files copied to ios/');
      console.log('');
      console.log('If not already configured in Xcode:');
      console.log('1. Open ios/LifeOrganizerSimple.xcworkspace');
      console.log('2. File > New > Target > Widget Extension');
      console.log('3. Name it "LifeOrganizerWidget"');
      console.log('4. Replace auto-generated files with the copied ones');
      console.log('5. Add App Groups: ' + APP_GROUP_IDENTIFIER);
      console.log('6. Add WidgetDataManager.swift/.m to main app target');
      console.log('7. Add RecipeQueueManager.swift/.m to main app target');
      console.log('========================================\n');
    } else if (fs.existsSync(destWidgetManager)) {
      console.log('[withIosWidget] Widget already configured, preserving existing setup.');
    }

    return config;
  });

  return config;
}

module.exports = withIosWidget;
