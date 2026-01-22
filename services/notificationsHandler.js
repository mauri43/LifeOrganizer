// services/notificationsHandler.js
// Single source of truth for notification handler - imported once in index.js
// This prevents "runtime not ready" crashes from duplicate handler registration

import * as Notifications from 'expo-notifications';

// Set exactly once, in a module with no React imports.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
