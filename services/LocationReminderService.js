import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

const LOCATION_TASK_NAME = 'location-reminder-background-task';
const GEOFENCE_STORAGE_KEY = '@location_reminders_geofences';
const SETTINGS_STORAGE_KEY = '@location_reminders_settings';
const TRIGGERED_TODAY_KEY = '@location_reminders_triggered_today';

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  defaultRadius: 750, // meters
  openInMaps: false, // false = open in app, true = open in Apple Maps
  remindFrequency: 'always', // 'always' or 'once_daily'
};

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

// Module-level reference to the service instance for the background task
let serviceInstance = null;

class LocationReminderService {
  constructor() {
    this.geofences = [];
    this.settings = DEFAULT_SETTINGS;
    this.isInitialized = false;
    this.lastKnownLocation = null;
    // Store reference for background task access
    serviceInstance = this;
  }

  // Initialize the service
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Load saved settings
      await this.loadSettings();

      // Load saved geofences
      await this.loadGeofences();

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Location permissions not granted');
        return false;
      }

      // Note: Notification handler is set once in services/notificationsHandler.js
      // to prevent "runtime not ready" crashes from duplicate registration

      // TEMP DIAGNOSTIC: Disabled to isolate "runtime not ready" crash
      const DEBUG_DISABLE_LOCATION_BG = true;

      // Start background location tracking if enabled
      if (this.settings.enabled && this.geofences.length > 0 && !DEBUG_DISABLE_LOCATION_BG) {
        await this.startBackgroundTracking();
      } else if (DEBUG_DISABLE_LOCATION_BG) {
        console.log('[DIAGNOSTIC] Background location tracking disabled');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing LocationReminderService:', error);
      return false;
    }
  }

  // Request location permissions
  async requestPermissions() {
    try {
      // Request foreground permission first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }

      // Request background permission for iOS
      if (Platform.OS === 'ios') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission denied');
          // Continue with foreground-only tracking
        }
      }

      // Request notification permissions
      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      if (notificationStatus !== 'granted') {
        console.log('Notification permissions denied');
      }

      return true;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  // Load settings from storage
  async loadSettings() {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
      }
    } catch (error) {
      console.error('Error loading location reminder settings:', error);
    }
  }

  // Save settings to storage
  async saveSettings(newSettings) {
    try {
      this.settings = { ...this.settings, ...newSettings };
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));

      // Handle enabled/disabled state changes
      if (newSettings.enabled !== undefined) {
        if (newSettings.enabled && this.geofences.length > 0) {
          await this.startBackgroundTracking();
        } else if (!newSettings.enabled) {
          await this.stopBackgroundTracking();
        }
      }
    } catch (error) {
      console.error('Error saving location reminder settings:', error);
    }
  }

  // Get current settings
  getSettings() {
    return { ...this.settings };
  }

  // Load geofences from storage
  async loadGeofences() {
    try {
      const savedGeofences = await AsyncStorage.getItem(GEOFENCE_STORAGE_KEY);
      if (savedGeofences) {
        this.geofences = JSON.parse(savedGeofences);
      }
    } catch (error) {
      console.error('Error loading geofences:', error);
    }
  }

  // Save geofences to storage
  async saveGeofences() {
    try {
      await AsyncStorage.setItem(GEOFENCE_STORAGE_KEY, JSON.stringify(this.geofences));
    } catch (error) {
      console.error('Error saving geofences:', error);
    }
  }

  // Add a geofence for an item
  async addGeofence(item) {
    const { id, type, title, location, radius } = item;

    if (!location?.latitude || !location?.longitude) {
      console.log('Cannot add geofence: missing location data');
      return false;
    }

    // Check if geofence already exists
    const existingIndex = this.geofences.findIndex(g => g.id === id && g.type === type);

    const geofence = {
      id,
      type, // 'task', 'activity', or 'restaurant'
      title,
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address || '',
      radius: radius || this.settings.defaultRadius,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      this.geofences[existingIndex] = geofence;
    } else {
      this.geofences.push(geofence);
    }

    await this.saveGeofences();

    // Start tracking if enabled and not already running
    if (this.settings.enabled) {
      await this.startBackgroundTracking();
    }

    return true;
  }

  // Remove a geofence
  async removeGeofence(id, type) {
    this.geofences = this.geofences.filter(g => !(g.id === id && g.type === type));
    await this.saveGeofences();

    // Stop tracking if no more geofences
    if (this.geofences.length === 0) {
      await this.stopBackgroundTracking();
    }

    return true;
  }

  // Get all active geofences
  getGeofences() {
    return [...this.geofences];
  }

  // Get geofences by type
  getGeofencesByType(type) {
    return this.geofences.filter(g => g.type === type);
  }

  // Start background location tracking
  async startBackgroundTracking() {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // Check every minute
          distanceInterval: 100, // Or when moved 100 meters
          foregroundService: {
            notificationTitle: 'Location Reminders Active',
            notificationBody: 'Monitoring locations for reminders',
            notificationColor: '#b45309',
          },
          pausesUpdatesAutomatically: false,
          activityType: Location.ActivityType.Other,
        });
      }
    } catch (error) {
      console.error('Error starting background tracking:', error);
    }
  }

  // Stop background location tracking
  async stopBackgroundTracking() {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }
    } catch (error) {
      console.error('Error stopping background tracking:', error);
    }
  }

  // Check if user is near any geofences
  async checkGeofences(coords) {
    if (!this.settings.enabled || this.geofences.length === 0) return;

    const { latitude, longitude } = coords;
    this.lastKnownLocation = { latitude, longitude };

    // Get today's triggered reminders if frequency is once_daily
    let triggeredToday = [];
    if (this.settings.remindFrequency === 'once_daily') {
      triggeredToday = await this.getTriggeredToday();
    }

    for (const geofence of this.geofences) {
      const distance = calculateDistance(
        latitude,
        longitude,
        geofence.latitude,
        geofence.longitude
      );

      // Check if within radius
      if (distance <= geofence.radius) {
        // Check if already triggered today (for once_daily mode)
        const geofenceKey = `${geofence.type}_${geofence.id}`;
        if (this.settings.remindFrequency === 'once_daily' && triggeredToday.includes(geofenceKey)) {
          continue;
        }

        // Trigger notification
        await this.sendNotification(geofence);

        // Record as triggered today
        if (this.settings.remindFrequency === 'once_daily') {
          await this.recordTriggeredToday(geofenceKey);
        }
      }
    }
  }

  // Get items triggered today
  async getTriggeredToday() {
    try {
      const today = new Date().toISOString().split('T')[0]; // UTC date: YYYY-MM-DD
      const data = await AsyncStorage.getItem(TRIGGERED_TODAY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.date === today) {
          return parsed.items || [];
        }
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  // Record an item as triggered today
  async recordTriggeredToday(geofenceKey) {
    try {
      const today = new Date().toISOString().split('T')[0]; // UTC date: YYYY-MM-DD
      let triggeredToday = await this.getTriggeredToday();
      if (!triggeredToday.includes(geofenceKey)) {
        triggeredToday.push(geofenceKey);
      }
      await AsyncStorage.setItem(TRIGGERED_TODAY_KEY, JSON.stringify({
        date: today,
        items: triggeredToday,
      }));
    } catch (error) {
      console.error('Error recording triggered reminder:', error);
    }
  }

  // Send notification for a geofence
  async sendNotification(geofence) {
    try {
      const typeLabels = {
        task: 'Task',
        activity: 'Activity',
        restaurant: 'Restaurant',
      };

      const notificationContent = {
        title: `Near: ${geofence.title}`,
        body: `You're near your ${typeLabels[geofence.type] || 'reminder'}${geofence.address ? ` at ${geofence.address}` : ''}`,
        data: {
          type: geofence.type,
          id: geofence.id,
          latitude: geofence.latitude,
          longitude: geofence.longitude,
          address: geofence.address,
          openInMaps: this.settings.openInMaps,
        },
        sound: true,
      };

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: null, // Immediate
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  // Handle notification response (tap)
  handleNotificationResponse(response) {
    const data = response.notification.request.content.data;

    if (data.openInMaps && data.latitude && data.longitude) {
      // Open in Apple Maps
      const url = Platform.select({
        ios: `maps:?daddr=${data.latitude},${data.longitude}`,
        android: `geo:${data.latitude},${data.longitude}?q=${data.latitude},${data.longitude}`,
      });
      Linking.openURL(url);
    }
    // If openInMaps is false, the app will open normally and can navigate to the item
    return data;
  }

  // Get current location (for manual checks)
  async getCurrentLocation() {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      this.lastKnownLocation = location.coords;
      return location.coords;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Manual check for nearby items (useful for app foreground)
  async checkNearbyItems() {
    const coords = await this.getCurrentLocation();
    if (coords) {
      await this.checkGeofences(coords);
    }
  }

  // Update geofence radius
  async updateGeofenceRadius(id, type, newRadius) {
    const geofence = this.geofences.find(g => g.id === id && g.type === type);
    if (geofence) {
      geofence.radius = newRadius;
      await this.saveGeofences();
    }
  }

  // Clear all geofences
  async clearAllGeofences() {
    this.geofences = [];
    await this.saveGeofences();
    await this.stopBackgroundTracking();
  }

  // Check if location tracking is running
  async isTrackingActive() {
    try {
      return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const locationReminderService = new LocationReminderService();


// CRITICAL: Define the background task at MODULE LEVEL (not inside a method)
// This is required by Expo's TaskManager - tasks must be defined in the outermost scope
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  // Wrap everything in try/catch to prevent "runtime not ready" crashes
  try {
    if (error) {
      console.error('Background location error:', error);
      return;
    }

    // Early return if service not initialized or no data
    if (!serviceInstance || !data) {
      return;
    }

    const { locations } = data;
    if (!locations || locations.length === 0) {
      return;
    }

    // Reload settings and geofences from storage since background task runs in separate context
    await serviceInstance.loadSettings();
    await serviceInstance.loadGeofences();

    // Check geofences with loaded data
    await serviceInstance.checkGeofences(locations[0].coords);
  } catch (e) {
    // Silently catch errors to prevent crashes in background context
    console.error('Background task error:', e);
  }
});

export default locationReminderService;
