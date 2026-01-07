import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Bell, MapPin } from 'lucide-react-native';
import { getThemeColors } from '../theme';

const LocationReminderToggle = ({
  enabled,
  onToggle,
  hasLocation,
  theme = 'light',
  style,
}) => {
  const colors = getThemeColors(theme);

  // Don't render if no location is set
  if (!hasLocation) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      <View style={styles.labelContainer}>
        <View style={styles.iconRow}>
          <MapPin size={18} color={colors.success} />
          <Bell size={16} color={colors.warning} style={styles.bellIcon} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Location Reminder</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Notify when nearby
          </Text>
        </View>
      </View>
      <Switch
        value={enabled}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.success }}
        thumbColor={enabled ? "#fff" : colors.surface}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  bellIcon: {
    marginLeft: -6,
    marginTop: -8,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default LocationReminderToggle;
