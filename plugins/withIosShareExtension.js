const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const APP_GROUP_IDENTIFIER = 'group.com.mauricio.lifeorganizer';
const EXTENSION_NAME = 'ShareExtension';

/**
 * iOS Share Extension Config Plugin
 *
 * This plugin:
 * 1. Ensures App Groups entitlement is set for the main app
 * 2. Copies Share Extension source files to ios/ShareExtension/ if they don't exist
 *
 * IMPORTANT: The Share Extension Xcode target must be added manually in Xcode.
 * This plugin prepares the files but cannot automatically add extension targets.
 *
 * If you've already configured the Share Extension in Xcode, this plugin
 * will preserve your configuration.
 */
function withIosShareExtension(config) {
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

  // Copy Share Extension files if needed
  config = withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, 'ios');
    const extensionDestPath = path.join(iosPath, EXTENSION_NAME);
    const extensionSourcePath = path.join(projectRoot, 'ios-share-extension');

    // Only copy files if the destination doesn't have the target configured
    // (Check if ShareViewController.swift exists in the ios/ShareExtension folder)
    const destSwiftFile = path.join(extensionDestPath, 'ShareViewController.swift');

    if (!fs.existsSync(destSwiftFile) && fs.existsSync(extensionSourcePath)) {
      console.log('[withIosShareExtension] Copying Share Extension source files...');

      // Create extension directory
      if (!fs.existsSync(extensionDestPath)) {
        fs.mkdirSync(extensionDestPath, { recursive: true });
      }

      // Copy extension files
      const filesToCopy = [
        'ShareViewController.swift',
        'Info.plist',
        'ShareExtension.entitlements',
      ];

      filesToCopy.forEach((file) => {
        const srcPath = path.join(extensionSourcePath, file);
        const destPath = path.join(extensionDestPath, file);

        if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath);
          console.log(`[withIosShareExtension] Copied ${file}`);
        }
      });

      console.log('\n========================================');
      console.log('SHARE EXTENSION SETUP');
      console.log('========================================');
      console.log('Files copied to ios/ShareExtension/');
      console.log('');
      console.log('If not already configured in Xcode:');
      console.log('1. Open ios/LifeOrganizerSimple.xcworkspace');
      console.log('2. File > New > Target > Share Extension');
      console.log('3. Name it "ShareExtension"');
      console.log('4. Replace auto-generated files with the copied ones');
      console.log('5. Add App Groups: ' + APP_GROUP_IDENTIFIER);
      console.log('========================================\n');
    } else if (fs.existsSync(destSwiftFile)) {
      console.log('[withIosShareExtension] Share Extension already configured, preserving existing setup.');
    }

    return config;
  });

  return config;
}

module.exports = withIosShareExtension;
