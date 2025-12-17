import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const APP_GROUP_IDENTIFIER = 'group.com.mauricio.lifeorganizer';
const WIDGET_DATA_KEY = 'widgetData';

// For iOS, we'll use a native module to write to App Group UserDefaults
// For now, we'll use AsyncStorage and create a bridge

/**
 * Sync today's data to widget
 * This function should be called whenever tasks or activities are updated
 */
export const syncWidgetData = async (data) => {
  if (Platform.OS !== 'ios') {
    return; // Widgets are iOS-only
  }

  try {
    const widgetData = {
      date: new Date().toISOString(),
      activities: data.activities || [],
      tasks: data.tasks || [],
      weather: data.weather || null,
      lastUpdated: new Date().toISOString(),
    };

    // Store in AsyncStorage (will be synced to App Group via native module)
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));
    
    // Also try to write directly to App Group container if native module is available
    if (NativeModules?.WidgetDataManager) {
      try {
        await NativeModules.WidgetDataManager.setWidgetData(JSON.stringify(widgetData));
      } catch (nativeError) {
        console.log('Native module not available, using AsyncStorage fallback');
      }
    }
    
    console.log('Widget data synced successfully');
  } catch (error) {
    console.error('Error syncing widget data:', error);
  }
};

/**
 * Get widget data structure from app state
 */
export const prepareWidgetData = (activities, tasks, weatherData) => {
  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  // Filter today's activities
  const todayActivities = activities
    .filter(activity => activity.date === todayDateStr)
    .map(activity => ({
      id: activity.id,
      title: activity.title || activity.name,
      time: activity.time || '',
      notes: activity.notes || '',
    }))
    .slice(0, 5); // Limit to 5 for widget

  // Filter today's tasks
  const todayTasks = tasks
    .filter(task => task.dueDate === todayDateStr && !task.completed)
    .map(task => ({
      id: task.id,
      title: task.title || task.name,
      priority: task.priority || 'medium',
      completed: false,
    }))
    .slice(0, 5); // Limit to 5 for widget

  // Prepare weather data
  const weather = weatherData ? {
    temp: Math.round(weatherData.main.temp),
    description: weatherData.weather[0]?.description || '',
    icon: weatherData.weather[0]?.main || 'clouds',
  } : null;

  return {
    activities: todayActivities,
    tasks: todayTasks,
    weather,
  };
};

