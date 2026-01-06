import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  MapPin,
  Bell,
  Navigation,
  Clock,
  Trash2,
  ChevronRight,
  CheckSquare,
  Calendar,
  Utensils,
} from 'lucide-react-native';
import { getThemeColors } from '../theme';
import locationReminderService from '../services/LocationReminderService';

const LocationSettings = ({ theme = 'light', onClose }) => {
  const colors = getThemeColors(theme);
  const [settings, setSettings] = useState(locationReminderService.getSettings());
  const [geofences, setGeofences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    await locationReminderService.initialize();
    setSettings(locationReminderService.getSettings());
    setGeofences(locationReminderService.getGeofences());
    setIsLoading(false);
  };

  const handleSettingChange = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await locationReminderService.saveSettings({ [key]: value });
  };

  const handleRemoveGeofence = async (id, type) => {
    Alert.alert(
      'Remove Location Reminder',
      'Are you sure you want to remove this location reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await locationReminderService.removeGeofence(id, type);
            setGeofences(locationReminderService.getGeofences());
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (geofences.length === 0) return;

    Alert.alert(
      'Clear All Location Reminders',
      'Are you sure you want to remove all location reminders?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await locationReminderService.clearAllGeofences();
            setGeofences([]);
          },
        },
      ]
    );
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'task':
        return <CheckSquare size={18} color="#2563EB" />;
      case 'activity':
        return <Calendar size={18} color="#8B5CF6" />;
      case 'restaurant':
        return <Utensils size={18} color="#EF4444" />;
      default:
        return <MapPin size={18} color={colors.text} />;
    }
  };

  const radiusOptions = [
    { label: '250m', value: 250 },
    { label: '500m', value: 500 },
    { label: '750m', value: 750 },
    { label: '1km', value: 1000 },
    { label: '2km', value: 2000 },
  ];

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    sectionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
      paddingHorizontal: 16,
      fontStyle: 'italic',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    radiusToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 4,
      gap: 2,
    },
    radiusButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    radiusButtonActive: {
      backgroundColor: '#b45309',
    },
    radiusButtonText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    radiusButtonTextActive: {
      color: '#fff',
    },
    frequencyToggle: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      padding: 4,
      gap: 4,
    },
    frequencyButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    frequencyButtonActive: {
      backgroundColor: '#b45309',
    },
    frequencyButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    frequencyButtonTextActive: {
      color: '#fff',
    },
    geofenceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    geofenceContent: {
      flex: 1,
      marginLeft: 12,
    },
    geofenceTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
    },
    geofenceAddress: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    geofenceRadius: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
    deleteButton: {
      padding: 8,
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 32,
      paddingHorizontal: 16,
    },
    emptyText: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12,
    },
    clearAllButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      marginHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#EF4444',
    },
    clearAllText: {
      fontSize: 15,
      fontWeight: '500',
      color: '#EF4444',
    },
  });

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* Main Toggle */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Location Reminders</Text>
        <Text style={dynamicStyles.sectionDescription}>
          Get notified when you're near tasks, activities, or restaurants with addresses.
        </Text>
        <View style={dynamicStyles.settingItem}>
          <View style={dynamicStyles.settingLeft}>
            <MapPin size={20} color="#10B981" />
            <View>
              <Text style={dynamicStyles.settingLabel}>Enable Location Reminders</Text>
              <Text style={dynamicStyles.settingDescription}>
                {settings.enabled ? 'Tracking active' : 'Tracking disabled'}
              </Text>
            </View>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(value) => handleSettingChange('enabled', value)}
            trackColor={{ false: colors.border, true: '#10B981' }}
            thumbColor={settings.enabled ? '#fff' : '#f5f5f4'}
          />
        </View>
      </View>

      {/* Default Radius */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Default Radius</Text>
        <Text style={dynamicStyles.sectionDescription}>
          How close you need to be to trigger a reminder.
        </Text>
        <View style={dynamicStyles.settingItem}>
          <View style={dynamicStyles.settingLeft}>
            <Navigation size={20} color="#2563EB" />
            <Text style={dynamicStyles.settingLabel}>Trigger Distance</Text>
          </View>
          <View style={dynamicStyles.radiusToggle}>
            {radiusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  dynamicStyles.radiusButton,
                  settings.defaultRadius === option.value && dynamicStyles.radiusButtonActive,
                ]}
                onPress={() => handleSettingChange('defaultRadius', option.value)}
              >
                <Text
                  style={[
                    dynamicStyles.radiusButtonText,
                    settings.defaultRadius === option.value && dynamicStyles.radiusButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Open In Setting */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Notification Action</Text>
        <Text style={dynamicStyles.sectionDescription}>
          What happens when you tap a location reminder notification.
        </Text>
        <View style={dynamicStyles.settingItem}>
          <View style={dynamicStyles.settingLeft}>
            <Navigation size={20} color="#8B5CF6" />
            <View>
              <Text style={dynamicStyles.settingLabel}>Open In</Text>
              <Text style={dynamicStyles.settingDescription}>
                {settings.openInMaps ? 'Apple Maps for directions' : 'Life Organizer app'}
              </Text>
            </View>
          </View>
          <View style={dynamicStyles.frequencyToggle}>
            <TouchableOpacity
              style={[
                dynamicStyles.frequencyButton,
                !settings.openInMaps && dynamicStyles.frequencyButtonActive,
              ]}
              onPress={() => handleSettingChange('openInMaps', false)}
            >
              <Text
                style={[
                  dynamicStyles.frequencyButtonText,
                  !settings.openInMaps && dynamicStyles.frequencyButtonTextActive,
                ]}
              >
                App
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                dynamicStyles.frequencyButton,
                settings.openInMaps && dynamicStyles.frequencyButtonActive,
              ]}
              onPress={() => handleSettingChange('openInMaps', true)}
            >
              <Text
                style={[
                  dynamicStyles.frequencyButtonText,
                  settings.openInMaps && dynamicStyles.frequencyButtonTextActive,
                ]}
              >
                Maps
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Reminder Frequency */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Reminder Frequency</Text>
        <Text style={dynamicStyles.sectionDescription}>
          How often to remind you about the same location.
        </Text>
        <View style={dynamicStyles.settingItem}>
          <View style={dynamicStyles.settingLeft}>
            <Clock size={20} color="#F59E0B" />
            <View>
              <Text style={dynamicStyles.settingLabel}>Frequency</Text>
              <Text style={dynamicStyles.settingDescription}>
                {settings.remindFrequency === 'always' ? 'Every time you\'re nearby' : 'Once per day'}
              </Text>
            </View>
          </View>
          <View style={dynamicStyles.frequencyToggle}>
            <TouchableOpacity
              style={[
                dynamicStyles.frequencyButton,
                settings.remindFrequency === 'always' && dynamicStyles.frequencyButtonActive,
              ]}
              onPress={() => handleSettingChange('remindFrequency', 'always')}
            >
              <Text
                style={[
                  dynamicStyles.frequencyButtonText,
                  settings.remindFrequency === 'always' && dynamicStyles.frequencyButtonTextActive,
                ]}
              >
                Always
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                dynamicStyles.frequencyButton,
                settings.remindFrequency === 'once_daily' && dynamicStyles.frequencyButtonActive,
              ]}
              onPress={() => handleSettingChange('remindFrequency', 'once_daily')}
            >
              <Text
                style={[
                  dynamicStyles.frequencyButtonText,
                  settings.remindFrequency === 'once_daily' && dynamicStyles.frequencyButtonTextActive,
                ]}
              >
                Once Daily
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Active Reminders List */}
      <View style={dynamicStyles.section}>
        <Text style={dynamicStyles.sectionTitle}>Active Location Reminders</Text>
        <Text style={dynamicStyles.sectionDescription}>
          {geofences.length} location reminder{geofences.length !== 1 ? 's' : ''} active.
        </Text>

        {geofences.length === 0 ? (
          <View style={dynamicStyles.emptyState}>
            <Bell size={40} color={colors.textMuted} />
            <Text style={dynamicStyles.emptyText}>
              No active location reminders.{'\n'}
              Add reminders when creating tasks, activities, or restaurants with addresses.
            </Text>
          </View>
        ) : (
          <>
            {geofences.map((geofence) => (
              <View key={`${geofence.type}_${geofence.id}`} style={dynamicStyles.geofenceItem}>
                {getTypeIcon(geofence.type)}
                <View style={dynamicStyles.geofenceContent}>
                  <Text style={dynamicStyles.geofenceTitle} numberOfLines={1}>
                    {geofence.title}
                  </Text>
                  {geofence.address && (
                    <Text style={dynamicStyles.geofenceAddress} numberOfLines={1}>
                      {geofence.address}
                    </Text>
                  )}
                  <Text style={dynamicStyles.geofenceRadius}>
                    Radius: {geofence.radius >= 1000 ? `${geofence.radius / 1000}km` : `${geofence.radius}m`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={dynamicStyles.deleteButton}
                  onPress={() => handleRemoveGeofence(geofence.id, geofence.type)}
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={dynamicStyles.clearAllButton}
              onPress={handleClearAll}
            >
              <Text style={dynamicStyles.clearAllText}>Clear All Reminders</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

export default LocationSettings;
