import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Modal,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  X,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Shield,
  Lock,
  Fingerprint,
  Calendar,
  ChevronRight,
  ChevronLeft,
  MapPin,
  DollarSign,
  Lightbulb,
  List,
  Utensils,
  Gift,
  Check,
  GripVertical,
  ChevronDown,
  BookOpen,
  Bell,
} from 'lucide-react-native';
import LocationSettings from './components/LocationSettings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { Picker } from '@react-native-picker/picker';
import { getThemeColors } from './theme';

const SETTINGS_KEYS = {
  THEME: '@life_organizer_theme',
  TAB_VISIBILITY: 'tabVisibility',
};

const DEFAULT_TAB_VISIBILITY = {
  all: false,
  ideas: true,
  food: true,
  todo: true,
  groceries: true,
  gifts: true,
  calendar: true,
};

const DEFAULT_TAB_SETTINGS = {
  today: {
    showWeeklyForecast: false,
  },
  restaurants: {
    showAddressInList: true,
    showPriceInList: true,
    boxView: false,
  },
  ideas: {},
  todo: {
    showAddressInList: true,
  },
  groceries: {
    showPrices: true,
  },
  calendar: {
    defaultView: 'month',
  },
  map: {
    radius: 15,
  },
};

const DEFAULT_TAB_ORDER = ['today', 'calendar', 'todo', 'groceries', 'ideas', 'gifts', 'food', 'all'];

export default function SettingsScreen({
  onClose,
  onThemeChange,
  onTabVisibilityChange,
  theme: themeProp = 'dark',
  isAdmin = false,
  householdId = null,
  permissionMode = 'strict',
  onPermissionModeChange,
  faceIdEnabled = false,
  onFaceIdToggle,
  showAppleCalendar = true,
  onAppleCalendarToggle,
  tabSettings = DEFAULT_TAB_SETTINGS,
  onUpdateTabSettings,
  tabOrder = DEFAULT_TAB_ORDER,
  onTabOrderChange,
}) {
  const [theme, setTheme] = useState(themeProp);
  const [tabVisibility, setTabVisibility] = useState(DEFAULT_TAB_VISIBILITY);
  const [activeTabSettings, setActiveTabSettings] = useState(null);
  const [localTabSettings, setLocalTabSettings] = useState({
    ...DEFAULT_TAB_SETTINGS,
    ...tabSettings,
    today: {
      ...DEFAULT_TAB_SETTINGS.today,
      ...(tabSettings?.today || {}),
    },
    restaurants: {
      ...DEFAULT_TAB_SETTINGS.restaurants,
      ...(tabSettings?.restaurants || {}),
    },
    ideas: {
      ...DEFAULT_TAB_SETTINGS.ideas,
      ...(tabSettings?.ideas || {}),
    },
    todo: {
      ...DEFAULT_TAB_SETTINGS.todo,
      ...(tabSettings?.todo || {}),
    },
    groceries: {
      ...DEFAULT_TAB_SETTINGS.groceries,
      ...(tabSettings?.groceries || {}),
    },
    calendar: {
      ...DEFAULT_TAB_SETTINGS.calendar,
      ...(tabSettings?.calendar || {}),
    },
    map: {
      ...DEFAULT_TAB_SETTINGS.map,
      ...(tabSettings?.map || {}),
    },
  });
  const [localTabOrder, setLocalTabOrder] = useState(Array.isArray(tabOrder) ? tabOrder : DEFAULT_TAB_ORDER);
  const [showDefaultTabPicker, setShowDefaultTabPicker] = useState(false);
  const [pendingDefaultTab, setPendingDefaultTab] = useState(localTabSettings.appLaunch?.defaultTab || 'today');
  
  useEffect(() => {
    setTheme(themeProp);
  }, [themeProp]);

  useEffect(() => {
    setLocalTabSettings({
      ...DEFAULT_TAB_SETTINGS,
      ...tabSettings,
      today: {
        ...DEFAULT_TAB_SETTINGS.today,
        ...(tabSettings?.today || {}),
      },
      restaurants: {
        ...DEFAULT_TAB_SETTINGS.restaurants,
        ...(tabSettings?.restaurants || {}),
      },
      ideas: {
        ...DEFAULT_TAB_SETTINGS.ideas,
        ...(tabSettings?.ideas || {}),
      },
      todo: {
        ...DEFAULT_TAB_SETTINGS.todo,
        ...(tabSettings?.todo || {}),
      },
      groceries: {
        ...DEFAULT_TAB_SETTINGS.groceries,
        ...(tabSettings?.groceries || {}),
      },
      calendar: {
        ...DEFAULT_TAB_SETTINGS.calendar,
        ...(tabSettings?.calendar || {}),
      },
      map: {
        ...DEFAULT_TAB_SETTINGS.map,
        ...(tabSettings?.map || {}),
      },
    });
  }, [tabSettings]);

  useEffect(() => {
    if (Array.isArray(tabOrder)) {
      setLocalTabOrder(tabOrder);
    }
  }, [tabOrder]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setPendingDefaultTab(localTabSettings.appLaunch?.defaultTab || 'today');
  }, [localTabSettings.appLaunch?.defaultTab]);

  const loadSettings = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(SETTINGS_KEYS.THEME);
      if (savedTheme) {
        setTheme(savedTheme);
        onThemeChange(savedTheme);
      }

      const savedTabVisibility = await AsyncStorage.getItem(SETTINGS_KEYS.TAB_VISIBILITY);
      if (savedTabVisibility) {
        const parsed = JSON.parse(savedTabVisibility);
        const mergedVisibility = { ...DEFAULT_TAB_VISIBILITY, ...parsed };
        setTabVisibility(mergedVisibility);
        onTabVisibilityChange(mergedVisibility);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleThemeChange = async (newTheme) => {
    try {
      setTheme(newTheme);
      await AsyncStorage.setItem(SETTINGS_KEYS.THEME, newTheme);
      onThemeChange(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const handleTabVisibilityChange = async (tab, visible) => {
    try {
      const newVisibility = { ...tabVisibility, [tab]: visible };
      setTabVisibility(newVisibility);
      await AsyncStorage.setItem(SETTINGS_KEYS.TAB_VISIBILITY, JSON.stringify(newVisibility));
      onTabVisibilityChange(newVisibility);
    } catch (error) {
      console.error('Error saving tab visibility:', error);
    }
  };

  const handleTabSettingToggle = (tab, key, value) => {
    const updatedSettings = {
      ...localTabSettings,
      [tab]: {
        ...(localTabSettings[tab] || {}),
        [key]: value,
      },
    };

    setLocalTabSettings(updatedSettings);
    if (onUpdateTabSettings) {
      onUpdateTabSettings(tab, { [key]: value });
    }
  };

  const handleTabRowPress = (tab) => {
    setActiveTabSettings(tab);
  };

  const handleClose = () => {
    setActiveTabSettings(null);
    if (onClose) {
      onClose();
    }
  };

  const tabLabels = {
    all: 'All Items',
    ideas: 'Ideas',
    food: 'Food',
    todo: 'To Do',
    groceries: 'Groceries',
    gifts: 'Gifts',
    calendar: 'Calendar',
  };


  // Use centralized theme colors
  const colors = getThemeColors(theme);
  const themeColors = {
    background: colors.background,
    surface: colors.surface,
    surfaceAlt: colors.surfaceElevated,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    border: colors.border,
    borderWarm: colors.borderWarm,
    accent: colors.accent,
    accentSecondary: colors.success,
  };

  const dynamicStyles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
      backgroundColor: themeColors.background,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '600',
      color: themeColors.text,
      letterSpacing: -0.5,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 8,
      letterSpacing: -0.3,
    },
    sectionDescription: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginBottom: 16,
      lineHeight: 20,
      fontStyle: 'italic',
    },
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
      padding: 16,
      marginBottom: 12,
    },
    settingLabel: {
      fontSize: 16,
      color: themeColors.text,
      fontWeight: '500',
    },
    settingPickerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
      gap: 8,
      minWidth: 140,
    },
    settingPickerButtonText: {
      color: themeColors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    themeToggle: {
      flexDirection: 'row',
      backgroundColor: themeColors.surfaceAlt,
      borderRadius: 8,
      padding: 4,
      gap: 4,
    },
    permissionToggle: {
      flexDirection: 'row',
      backgroundColor: themeColors.surfaceAlt,
      borderRadius: 8,
      padding: 4,
      gap: 4,
      width: '100%',
    },
    themeButtonText: {
      fontSize: 14,
      color: themeColors.textSecondary,
      fontWeight: '600',
    },
    themeButtonTextActive: {
      color: '#fff',
    },
    pickerModalContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 20,
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: themeColors.border,
    },
    pickerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    pickerCancelButton: {
      color: themeColors.textSecondary,
      fontSize: 16,
    },
    pickerDoneButton: {
      color: themeColors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    picker: {
      backgroundColor: themeColors.surface,
    },
    pickerItem: {
      color: themeColors.text,
      fontSize: 20,
    },
  });

  const tabDisplayNames = {
    today: 'Today',
    all: 'All Items',
    ideas: 'Ideas',
    food: 'Food',
    todo: 'To Do',
    groceries: 'Groceries',
    gifts: 'Gifts',
    calendar: 'Calendar',
    locationReminders: 'Location Reminders',
  };

  const tabOrderIconMap = {
    today: Sun,
    all: List,
    ideas: Lightbulb,
    food: Utensils,
    todo: Check,
    groceries: List,
    gifts: Gift,
    calendar: Calendar,
  };

  const getVisibleTabs = () => {
    const orderedTabs = localTabOrder.filter(tab => tab === 'today' || tabLabels[tab]);
    const visibleTabs = orderedTabs.filter(tab => tab === 'today' || tabVisibility[tab] !== false);
    return visibleTabs.length ? visibleTabs : ['today'];
  };

  const renderTabSettingsContent = () => {
    if (!activeTabSettings) return null;

    switch (activeTabSettings) {
      case 'today':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Today Tab</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Choose how weather information is displayed on the Today tab.
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Sun size={20} color={themeColors.accent} />
                <Text style={dynamicStyles.settingLabel}>Show Weekly Forecast</Text>
              </View>
              <Switch
                value={localTabSettings.today?.showWeeklyForecast ?? false}
                onValueChange={(value) => handleTabSettingToggle('today', 'showWeeklyForecast', value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={localTabSettings.today?.showWeeklyForecast ? '#fff' : '#f5f5f4'}
              />
            </View>
          </View>
        );
      case 'food':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Food Tab</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Customize restaurant details that appear in list view.
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <MapPin size={20} color="#EF4444" />
                <Text style={dynamicStyles.settingLabel}>Show Address in List View</Text>
              </View>
              <Switch
                value={localTabSettings.restaurants?.showAddressInList !== false}
                onValueChange={(value) => handleTabSettingToggle('restaurants', 'showAddressInList', value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={localTabSettings.restaurants?.showAddressInList !== false ? '#fff' : '#f5f5f4'}
              />
            </View>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <DollarSign size={20} color="#F59E0B" />
                <Text style={dynamicStyles.settingLabel}>Show Price in List View</Text>
              </View>
              <Switch
                value={localTabSettings.restaurants?.showPriceInList !== false}
                onValueChange={(value) => handleTabSettingToggle('restaurants', 'showPriceInList', value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={localTabSettings.restaurants?.showPriceInList !== false ? '#fff' : '#f5f5f4'}
              />
            </View>
    <View style={dynamicStyles.settingItem}>
      <View style={styles.settingLeft}>
        <List size={20} color="#2563EB" />
        <Text style={dynamicStyles.settingLabel}>Use Box Layout</Text>
      </View>
      <Switch
        value={localTabSettings.restaurants?.boxView === true}
        onValueChange={(value) => handleTabSettingToggle('restaurants', 'boxView', value)}
        trackColor={{ false: themeColors.border, true: themeColors.accent }}
        thumbColor={localTabSettings.restaurants?.boxView ? '#fff' : '#f5f5f4'}
      />
    </View>
          </View>
        );
      case 'ideas':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Ideas Tab</Text>
            <View style={[dynamicStyles.settingItem, styles.settingItemCentered]}>
              <Lightbulb size={20} color="#F59E0B" />
              <Text style={dynamicStyles.settingLabel}>More settings coming soon</Text>
            </View>
            <Text style={dynamicStyles.sectionDescription}>
              We're planning additional customization options for your ideas tab.
            </Text>
          </View>
        );
      case 'todo':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>To Do Tab</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Control whether task addresses appear in the To Do list.
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <MapPin size={20} color="#2563EB" />
                <Text style={dynamicStyles.settingLabel}>Show Address in List View</Text>
              </View>
              <Switch
                value={localTabSettings.todo?.showAddressInList !== false}
                onValueChange={(value) => handleTabSettingToggle('todo', 'showAddressInList', value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={localTabSettings.todo?.showAddressInList !== false ? '#fff' : '#f5f5f4'}
              />
            </View>
          </View>
        );
      case 'calendar':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Calendar Tab</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Control which calendar sources appear in the app calendar.
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Calendar size={20} color="#60A5FA" />
                <Text style={dynamicStyles.settingLabel}>Show Apple Calendar Events</Text>
              </View>
              <Switch
                value={showAppleCalendar}
                onValueChange={(value) => onAppleCalendarToggle && onAppleCalendarToggle(value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={showAppleCalendar ? '#fff' : '#f5f5f4'}
              />
            </View>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <Calendar size={20} color="#2563EB" />
                <Text style={dynamicStyles.settingLabel}>Default View</Text>
              </View>
              <View style={dynamicStyles.themeToggle}>
                {[
                  { label: 'Monthly', value: 'month' },
                  { label: 'Weekly', value: 'week' },
                  { label: 'Daily', value: 'day' },
                ].map((option) => {
                  const active =
                    (localTabSettings.calendar?.defaultView || 'month') === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.themeButton, active && styles.themeButtonActive]}
                      onPress={() => handleTabSettingToggle('calendar', 'defaultView', option.value)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          dynamicStyles.themeButtonText,
                          active && dynamicStyles.themeButtonTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        );
      case 'groceries':
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Groceries Tab</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Control whether grocery items include pricing information.
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <DollarSign size={20} color="#10B981" />
                <Text style={dynamicStyles.settingLabel}>Show Prices</Text>
              </View>
              <Switch
                value={localTabSettings.groceries?.showPrices !== false}
                onValueChange={(value) => handleTabSettingToggle('groceries', 'showPrices', value)}
                trackColor={{ false: themeColors.border, true: themeColors.accent }}
                thumbColor={localTabSettings.groceries?.showPrices !== false ? '#fff' : '#f5f5f4'}
              />
            </View>
          </View>
        );
      case 'locationReminders':
        return <LocationSettings theme={theme} onClose={() => setActiveTabSettings(null)} />;
      default:
        return (
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>{tabDisplayNames[activeTabSettings] || 'Tab'} Settings</Text>
            <View style={[dynamicStyles.settingItem, styles.settingItemCentered]}>
              <Text style={dynamicStyles.settingLabel}>No additional settings available yet.</Text>
            </View>
          </View>
        );
    }
  };
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
      <SafeAreaView style={dynamicStyles.safeArea}>
        <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={dynamicStyles.header}>
          {activeTabSettings ? (
            <>
              <TouchableOpacity style={styles.headerButton} onPress={() => setActiveTabSettings(null)}>
                <ChevronLeft size={24} color={themeColors.textSecondary} />
              </TouchableOpacity>
              <Text style={dynamicStyles.headerTitle}>{tabDisplayNames[activeTabSettings]} Settings</Text>
              <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
                <X size={24} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.headerButtonPlaceholder} />
              <Text style={dynamicStyles.headerTitle}>Settings</Text>
              <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
                <X size={24} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView style={dynamicStyles.content}>
          {activeTabSettings ? (
            renderTabSettingsContent()
          ) : (
            <>
              {/* Permission Mode Section - Admin Only */}
              {isAdmin && householdId && (
                <View style={styles.section}>
                  <Text style={dynamicStyles.sectionTitle}>Household Permissions</Text>
                  <Text style={dynamicStyles.sectionDescription}>
                    Control how members can edit and delete items in your household
                  </Text>
                  <View style={dynamicStyles.settingItem}>
                    <View style={styles.settingLeft}>
                      <Shield size={20} color="#F59E0B" />
                      <View style={styles.permissionLabelContainer}>
                        <Text style={dynamicStyles.settingLabel}>Permission Mode</Text>
                        <Text style={permissionStyles.permissionDescription}>
                          {permissionMode === 'strict' 
                            ? 'Only creators and admins can edit/delete' 
                            : 'Anyone can edit, only creators/admins can delete'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View style={dynamicStyles.permissionToggle}>
                    <TouchableOpacity
                      style={[styles.permissionToggleButton, permissionMode === 'strict' && styles.permissionToggleButtonActive]}
                      onPress={() => onPermissionModeChange && onPermissionModeChange('strict')}
                    >
                      <Lock size={18} color={permissionMode === 'strict' ? '#fff' : themeColors.textSecondary} />
                      <Text style={[dynamicStyles.themeButtonText, permissionMode === 'strict' && dynamicStyles.themeButtonTextActive]}>
                        Strict
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.permissionToggleButton, permissionMode === 'collaborative' && styles.permissionToggleButtonActive]}
                      onPress={() => onPermissionModeChange && onPermissionModeChange('collaborative')}
                    >
                      <Shield size={18} color={permissionMode === 'collaborative' ? '#fff' : themeColors.textSecondary} />
                      <Text style={[dynamicStyles.themeButtonText, permissionMode === 'collaborative' && dynamicStyles.themeButtonTextActive]}>
                        Collaborative
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Tab Visibility Section */}
              <View style={styles.section}>
                <Text style={dynamicStyles.sectionTitle}>Tab Visibility</Text>
                <Text style={dynamicStyles.sectionDescription}>
                  Drag to reorder tabs, toggle visibility, or tap for more settings
                </Text>
                <DraggableFlatList
                  data={localTabOrder.filter(tab => tab === 'today' || tabLabels[tab])}
                  keyExtractor={(item) => item}
                  scrollEnabled={false}
                  onDragEnd={({ data }) => {
                    const normalized = [
                      ...data,
                      ...localTabOrder.filter(tab => !data.includes(tab)),
                    ];
                    setLocalTabOrder(normalized);
                    if (onTabOrderChange) {
                      onTabOrderChange(normalized);
                    }
                  }}
                  renderItem={({ item: tab, drag, isActive }) => {
                    const isToday = tab === 'today';
                    const IconComponent = tabOrderIconMap[tab] || List;
                    const isVisible = isToday ? true : tabVisibility[tab] !== false;
                    const displayName = tabDisplayNames[tab] || tabLabels[tab] || tab;

                    return (
                      <View
                        style={[
                          dynamicStyles.settingItem,
                          styles.tabVisibilityRow,
                          isActive && styles.tabOrderItemActive,
                        ]}
                      >
                        <TouchableOpacity
                          onPressIn={drag}
                          activeOpacity={0.7}
                          style={styles.dragHandle}
                        >
                          <GripVertical size={18} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tabVisibilityContent}
                          activeOpacity={0.8}
                          onPress={() => handleTabRowPress(tab)}
                        >
                          <View style={styles.settingLeftContent}>
                            <IconComponent size={20} color={themeColors.text} />
                            <Text style={dynamicStyles.settingLabel}>{displayName}</Text>
                          </View>
                          <ChevronRight size={16} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                        {!isToday && (
                          <Switch
                            value={isVisible}
                            onValueChange={(value) => handleTabVisibilityChange(tab, value)}
                            trackColor={{ false: themeColors.border, true: themeColors.accent }}
                            thumbColor={isVisible ? '#fff' : '#f5f5f4'}
                          />
                        )}
                      </View>
                    );
                  }}
                />
              </View>

              {/* Theme Section */}
              <View style={styles.section}>
                <Text style={dynamicStyles.sectionTitle}>Appearance</Text>
                <View style={dynamicStyles.settingItem}>
                  <View style={styles.settingLeft}>
                    {theme === 'dark' ? (
                      <Moon size={20} color="#60A5FA" />
                    ) : (
                      <Sun size={20} color="#F59E0B" />
                    )}
                    <Text style={dynamicStyles.settingLabel}>Theme</Text>
                  </View>
                  <View style={dynamicStyles.themeToggle}>
                    <TouchableOpacity
                      style={[styles.themeButton, theme === 'light' && styles.themeButtonActive]}
                      onPress={() => handleThemeChange('light')}
                    >
                      <Sun size={18} color={theme === 'light' ? '#fff' : themeColors.textSecondary} />
                      <Text style={[dynamicStyles.themeButtonText, theme === 'light' && dynamicStyles.themeButtonTextActive]}>
                        Light
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.themeButton, theme === 'dark' && styles.themeButtonActive]}
                      onPress={() => handleThemeChange('dark')}
                    >
                      <Moon size={18} color={theme === 'dark' ? '#fff' : themeColors.textSecondary} />
                      <Text style={[dynamicStyles.themeButtonText, theme === 'dark' && dynamicStyles.themeButtonTextActive]}>
                        Dark
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Security Section */}
              <View style={styles.section}>
                <Text style={dynamicStyles.sectionTitle}>Security</Text>
                <Text style={dynamicStyles.sectionDescription}>
                  Enable Face ID to lock the app with biometric authentication
                </Text>
                <View style={dynamicStyles.settingItem}>
                  <View style={styles.settingLeft}>
                    <Fingerprint size={20} color="#8B5CF6" />
                    <Text style={dynamicStyles.settingLabel}>Face ID</Text>
                  </View>
                  <Switch
                    value={faceIdEnabled}
                    onValueChange={(value) => onFaceIdToggle && onFaceIdToggle(value)}
                    trackColor={{ false: themeColors.border, true: themeColors.accent }}
                    thumbColor={faceIdEnabled ? '#fff' : '#f5f5f4'}
                  />
                </View>
              </View>

              {/* Map Settings Section */}
              <View style={styles.section}>
                <Text style={dynamicStyles.sectionTitle}>Map Settings</Text>
                <Text style={dynamicStyles.sectionDescription}>
                  Set the default map radius for Food and Activities maps
                </Text>
                <View style={dynamicStyles.settingItem}>
                  <View style={styles.settingLeft}>
                    <MapPin size={20} color="#10B981" />
                    <Text style={dynamicStyles.settingLabel}>Map Radius</Text>
                  </View>
                  <View style={dynamicStyles.themeToggle}>
                    {[
                      { label: '5 mi', value: 5 },
                      { label: '15 mi', value: 15 },
                      { label: '25 mi', value: 25 },
                      { label: '50 mi', value: 50 },
                    ].map((option) => {
                      const active = (localTabSettings.map?.radius || 15) === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.themeButton, active && styles.themeButtonActive]}
                          onPress={() => handleTabSettingToggle('map', 'radius', option.value)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              dynamicStyles.themeButtonText,
                              active && dynamicStyles.themeButtonTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Location Reminders Section */}
              <View style={styles.section}>
                <Text style={dynamicStyles.sectionTitle}>Location Reminders</Text>
                <Text style={dynamicStyles.sectionDescription}>
                  Get notified when you're near tasks, activities, or restaurants
                </Text>
                <TouchableOpacity
                  style={dynamicStyles.settingItem}
                  onPress={() => setActiveTabSettings('locationReminders')}
                  activeOpacity={0.8}
                >
                  <View style={styles.settingLeft}>
                    <Bell size={20} color="#F59E0B" />
                    <Text style={dynamicStyles.settingLabel}>Manage Location Reminders</Text>
                  </View>
                  <ChevronRight size={20} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>App Launch</Text>
            <Text style={dynamicStyles.sectionDescription}>
              Choose which tab opens when you launch the app
            </Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <List size={20} color="#2563EB" />
                <Text style={dynamicStyles.settingLabel}>Default Tab</Text>
              </View>
              <TouchableOpacity
                style={dynamicStyles.settingPickerButton}
                activeOpacity={0.8}
                onPress={() => {
                  const currentDefault = localTabSettings.appLaunch?.defaultTab || 'today';
                  const visibleTabs = getVisibleTabs();
                  const initialTab = visibleTabs.includes(currentDefault) ? currentDefault : visibleTabs[0] || 'today';
                  setPendingDefaultTab(initialTab);
                  setShowDefaultTabPicker(true);
                }}
              >
                <Text style={dynamicStyles.settingPickerButtonText}>
                  {tabDisplayNames[localTabSettings.appLaunch?.defaultTab || 'today'] ||
                    tabLabels[localTabSettings.appLaunch?.defaultTab || 'today'] ||
                    'Today'}
                </Text>
                <ChevronDown size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>

    <Modal
      visible={showDefaultTabPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDefaultTabPicker(false)}
    >
      <View style={styles.pickerOverlay}>
        <TouchableOpacity
          style={styles.pickerBackdrop}
          activeOpacity={1}
          onPress={() => setShowDefaultTabPicker(false)}
        />
        <View style={dynamicStyles.pickerModalContent}>
          <View style={dynamicStyles.pickerHeader}>
            <TouchableOpacity onPress={() => setShowDefaultTabPicker(false)}>
              <Text style={dynamicStyles.pickerCancelButton}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                handleTabSettingToggle('appLaunch', 'defaultTab', pendingDefaultTab);
                setShowDefaultTabPicker(false);
              }}
            >
              <Text style={dynamicStyles.pickerDoneButton}>Done</Text>
            </TouchableOpacity>
          </View>
          <Picker
            selectedValue={pendingDefaultTab}
            onValueChange={(value) => setPendingDefaultTab(value)}
            style={dynamicStyles.picker}
            itemStyle={dynamicStyles.pickerItem}
          >
            {getVisibleTabs().map((tab) => (
              <Picker.Item
                key={`launch-tab-${tab}`}
                label={tabDisplayNames[tab] || tabLabels[tab] || tab}
                value={tab}
              />
            ))}
          </Picker>
        </View>
      </View>
    </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 32,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonPlaceholder: {
    width: 40,
  },
  settingLeftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  settingLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    flex: 1,
  },
  themeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  themeButtonActive: {
    backgroundColor: '#b45309',
  },
  permissionToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 6,
    flex: 1,
  },
  permissionToggleButtonActive: {
    backgroundColor: '#b45309',
  },
  permissionLabelContainer: {
    flex: 1,
  },
  settingItemCentered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  tabOrderListContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabOrderList: {
    paddingBottom: 12,
  },
  tabOrderItem: {},
  tabOrderItemActive: {
    opacity: 0.8,
  },
  tabOrderItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tabVisibilityRow: {
    justifyContent: 'flex-start',
    gap: 12,
  },
  dragHandle: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  tabVisibilityContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

const permissionStyles = StyleSheet.create({
  permissionDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

