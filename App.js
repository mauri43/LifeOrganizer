import { useState, useEffect, useRef, useCallback } from 'react';

// Speech recognition will be loaded lazily after app mounts
let ExpoSpeechRecognitionModule = null;
let speechRecognitionAvailable = false;

// No-op hook that does nothing (used when speech recognition isn't available)
const useSpeechRecognitionEvent = (_event, _callback) => {
  // This is intentionally empty - it's a fallback when the module isn't loaded
};
import { onAuthStateChanged } from 'firebase/auth';
import { useFonts } from 'expo-font';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
} from '@expo-google-fonts/source-sans-3';
import { doc, getDoc, collection, addDoc, deleteDoc, updateDoc, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as ExpoCalendar from 'expo-calendar';
import * as Clipboard from 'expo-clipboard';
import HouseholdSetup from './HouseholdSetup';
import { auth, db, functions } from './firebase';
import AuthScreen from './AuthScreen';
import ProfileScreen from './ProfileScreen';
import UserProfileSetup from './UserProfileSetup';
import SettingsScreen from './SettingsScreen';
import { syncWidgetData, prepareWidgetData } from './widgetDataSync';
import { ThemeProvider, useTheme } from './ThemeContext';
import { lightColors, darkColors, getThemeColors, getCategoryColor as getThemeCategoryColor, getPriorityColor as getThemePriorityColor } from './theme';
import { processRecipeQueue } from './recipeQueueProcessor';
import DraggableFlatList from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import FireworkEffect from './FireworkEffect';
import LocationReminderToggle from './components/LocationReminderToggle';
import locationReminderService from './services/LocationReminderService';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Linking,
  Alert,
  AppState,
  Image,
  ActivityIndicator,
  Share,
  Switch,
  Keyboard,
  Animated,
  Pressable,
} from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import {
  Plus,
  Search,
  Calendar,
  Utensils,
  Lightbulb,
  Check,
  Trash2,
  MapPin,
  List,
  Clock,
  X,
  Gift,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Wind,
  Droplet,
  Star,
  BookOpen,
  ExternalLink,
  ShoppingCart,
  ShoppingBag,
  MoreVertical,
  Pencil,
  Share2,
  Home,
  Settings,
  Square,
  Map as MapIcon,
  Menu,
  Tag,
  SlidersHorizontal,
  Mic,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const TAB_ORDER_STORAGE_KEY = 'tabOrder';
const CALENDAR_MINUTE_HEIGHT = 1.05;
const CALENDAR_TIMELINE_HEIGHT = 24 * 60 * CALENDAR_MINUTE_HEIGHT;
const CALENDAR_HOUR_HEIGHT = 60 * CALENDAR_MINUTE_HEIGHT;
const CALENDAR_WEEK_COLUMN_WIDTH = 120;

// Available colors for idea tags
const TAG_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#64748b', // slate
];

// Note: Notification handler is set once in services/notificationsHandler.js
// to prevent "runtime not ready" crashes from duplicate registration

export default function App() {
  // Load custom fonts (non-blocking, falls back to system fonts)
  useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium_Italic,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
  });

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isFaceIdEnabled, setIsFaceIdEnabled] = useState(false);
  const [isFaceIdAuthenticated, setIsFaceIdAuthenticated] = useState(true); // Default to true for initial access

  const [todoItemType, setTodoItemType] = useState('task'); // 'task' or 'activity'
  const [activeTab, setActiveTab] = useState('today'); // Default to 'today', updated by useEffect when settings load
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurantViewMode, setRestaurantViewMode] = useState('list');
  const [restaurantEditMode, setRestaurantEditMode] = useState(false);
  const [foodViewMode, setFoodViewMode] = useState('restaurants'); // 'restaurants' or 'recipes'
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [todoViewMode, setTodoViewMode] = useState('list'); // list or map
  const [todoFilter, setTodoFilter] = useState('tasks'); // tasks or activities
  const [todoTimeFilter, setTodoTimeFilter] = useState('all'); // all, today, upcoming, overdue
  const [ideaFilter, setIdeaFilter] = useState('all'); // all, personal, or household
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddForm, setShowAddForm] = useState(false);
  const [addItemType, setAddItemType] = useState('ideas');
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [dateFieldType, setDateFieldType] = useState('date');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [items, setItems] = useState([]);
  const [activities, setActivities] = useState([]);
  const [giftIdeas, setGiftIdeas] = useState([]);
  const [people, setPeople] = useState([]); // People with birthdays
  const [personalItems, setPersonalItems] = useState([]);
  const [personalTasks, setPersonalTasks] = useState([]);
  const [personalActivities, setPersonalActivities] = useState([]);
  const [personalIdeas, setPersonalIdeas] = useState([]);
  const [giftViewMode, setGiftViewMode] = useState('others'); // 'others' | 'personal'
  const [shopMode, setShopMode] = useState('grocery'); // 'grocery' | 'other'
  const [personalWishlist, setPersonalWishlist] = useState([]); // User's personal wishlist
  const [otherShopItems, setOtherShopItems] = useState([]); // Non-grocery shop items
  const [editingPerson, setEditingPerson] = useState(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [birthdayDate, setBirthdayDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedBirthdayDay, setSelectedBirthdayDay] = useState(new Date().getDate());
  const [showPersonProfile, setShowPersonProfile] = useState(false);
  const [profilePerson, setProfilePerson] = useState(null);
  const [personClothingSize, setPersonClothingSize] = useState('');
  const [personShoeSize, setPersonShoeSize] = useState('');
  const [ideaScope, setIdeaScope] = useState('personal'); // 'household' | 'personal'
  const [taskScope, setTaskScope] = useState('personal'); // 'household' | 'personal'
  const [activityScope, setActivityScope] = useState('personal'); // 'household' | 'personal'

  // Idea tags state
  const [ideaTags, setIdeaTags] = useState([]);
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);
  const [ideaSortMode, setIdeaSortMode] = useState('recent'); // 'recent', 'oldest', 'grouped'
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');

  // Voice recording state for ideas
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voiceTranscriptRef = useRef('');
  const shouldProcessVoiceRef = useRef(false);

  const [hasProfile, setHasProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [currentUserName, setCurrentUserName] = useState('');

  const [showFirework, setShowFirework] = useState(false);
  const scheduledNotificationsRef = useRef({});
  const [userLocation, setUserLocation] = useState(null);
  const [showRestaurantDetails, setShowRestaurantDetails] = useState(false);
  const [restaurantDetails, setRestaurantDetails] = useState(null);
  const [loadingRestaurantDetails, setLoadingRestaurantDetails] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [newRecipeUrl, setNewRecipeUrl] = useState('');
  const [newRecipeTags, setNewRecipeTags] = useState([]);
  const [isExtractingRecipe, setIsExtractingRecipe] = useState(false);
  const [isAddingRecipeToGroceries, setIsAddingRecipeToGroceries] = useState(false);
  const [isClearingGroceries, setIsClearingGroceries] = useState(false);
  const [showGroceryQuickActions, setShowGroceryQuickActions] = useState(false);
  const [recipeExtractionError, setRecipeExtractionError] = useState('');
  const [allowManualRecipeEntry, setAllowManualRecipeEntry] = useState(false);
  const [manualRecipeTitle, setManualRecipeTitle] = useState('');
  const [manualRecipeDescription, setManualRecipeDescription] = useState('');
  const [manualRecipeIngredients, setManualRecipeIngredients] = useState('');
  const [manualRecipeSteps, setManualRecipeSteps] = useState('');
  const [manualRecipeRawCaption, setManualRecipeRawCaption] = useState('');
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [editingRecipeOriginal, setEditingRecipeOriginal] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showActivityActions, setShowActivityActions] = useState(false);
  const [appleCalendarEvents, setAppleCalendarEvents] = useState([]);
  const [showAppleCalendar, setShowAppleCalendar] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherForecast, setWeatherForecast] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const hasSelectedRecipeVideo = Boolean(selectedRecipe?.videoUrl || selectedRecipe?.sourceUrl);
  const hasSelectedRecipeIngredients =
    Array.isArray(selectedRecipe?.ingredients) && selectedRecipe.ingredients.length > 0;
  const manualRecipeReady =
    manualRecipeTitle.trim().length > 0 &&
    manualRecipeIngredients.trim().length > 0 &&
    manualRecipeSteps.trim().length > 0;

  // Check if any recipe field has changed when editing
  const recipeHasChanges = (() => {
    if (!editingRecipeId || !editingRecipeOriginal) return false;
    const orig = editingRecipeOriginal;

    // Helper to format ingredient (same logic as formatIngredientLine)
    const formatIngredient = (ingredient) => {
      if (!ingredient) return '';
      if (typeof ingredient === 'string') return ingredient;
      const parts = [ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean);
      return parts.join(' ').trim();
    };

    // Compare title
    if (manualRecipeTitle !== (orig.title || '')) return true;

    // Compare description
    if (manualRecipeDescription !== (orig.description || '')) return true;

    // Compare URL
    const origUrl = orig.sourceUrl || orig.videoUrl || '';
    if (newRecipeUrl !== origUrl) return true;

    // Compare tags (order doesn't matter)
    const origTags = Array.isArray(orig.tags) ? [...orig.tags].sort() : [];
    const newTags = [...newRecipeTags].sort();
    if (JSON.stringify(origTags) !== JSON.stringify(newTags)) return true;

    // Compare ingredients - use same format as edit form population
    const origIngredients = Array.isArray(orig.ingredients)
      ? orig.ingredients.map(ingredient => formatIngredient(ingredient)).join('\n')
      : '';
    if (manualRecipeIngredients !== origIngredients) return true;

    // Compare steps - use same format as edit form population
    const origSteps = Array.isArray(orig.steps)
      ? orig.steps.map(step => typeof step === 'string' ? step : String(step)).join('\n')
      : '';
    if (manualRecipeSteps !== origSteps) return true;

    return false;
  })();

  const [showRecipeActions, setShowRecipeActions] = useState(false);

  const resetManualRecipeFields = () => {
    setAllowManualRecipeEntry(false);
    setManualRecipeTitle('');
    setManualRecipeDescription('');
    setManualRecipeIngredients('');
    setManualRecipeSteps('');
    setManualRecipeRawCaption('');
  };

  const copyCaptionToManualForm = (payload = {}, message, fallbackUrl = '') => {
    const caption = payload.rawCaption || '';
    const suggestedDescription = payload.suggestedDescription || payload.description || '';
    const bestUrl = payload.sourceUrl || payload.videoUrl || fallbackUrl || '';

    setAllowManualRecipeEntry(true);
    setManualRecipeTitle('');
    setManualRecipeDescription('');
    setManualRecipeIngredients('');
    setManualRecipeSteps('');
    setManualRecipeRawCaption(caption || suggestedDescription || '');
    if (bestUrl) {
      setNewRecipeUrl(bestUrl);
    }
    if (typeof message === 'string' && message.length > 0) {
      setRecipeExtractionError(message);
    }
  };


  const [newItem, setNewItem] = useState({
    title: '',
    notes: '',
    address: '',
    cuisine: '',
    priceRange: '',
    dueDate: '',
    date: '',
    time: '',
    activityCategory: '',
    person: '',
    occasion: '',
    budget: '',
    link: '',
    activityAddress: '',
    priority: 'medium',
    price: '',
    reminderTime: '1 hour before',
    placeId: '',
    locationReminder: true, // Default ON for new items with addresses
    tagIds: [], // Tags for ideas
  });

  const [householdId, setHouseholdId] = useState(null);
  const [checkingHousehold, setCheckingHousehold] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [showHouseholdSetup, setShowHouseholdSetup] = useState(false);
  const [skippedHousehold, setSkippedHousehold] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissionMode, setPermissionMode] = useState('strict'); // 'strict' | 'collaborative'
  const [expandedCategories, setExpandedCategories] = useState({
    ideas: true,
    restaurants: true,
    todo: true,
    activities: true,
    groceries: true,
  });
  const [expandedTasks, setExpandedTasks] = useState({}); // Track which tasks show subtasks
  const [editingSubtask, setEditingSubtask] = useState(null); // { taskId, subtaskId }
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [expandedGroceryCategories, setExpandedGroceryCategories] = useState({
    produce: true,
    dairy: true,
    meat: true,
    bakery: true,
    pantry: true,
    frozen: true,
    beverages: true,
    household: true,
    other: true,
  });
  const [theme, setTheme] = useState('light');
  const [showSettings, setShowSettings] = useState(false);
  const [tabVisibility, setTabVisibility] = useState({
    all: false,
    ideas: true,
    food: true,
    todo: true,
    groceries: true,
    gifts: true,
    calendar: true,
  });
  const DEFAULT_TAB_ORDER = ['today', 'calendar', 'todo', 'groceries', 'ideas', 'gifts', 'food', 'all'];
  const [tabOrder, setTabOrder] = useState(DEFAULT_TAB_ORDER);

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
      defaultView: 'week',
    },
    appLaunch: {
      defaultTab: 'today',
    },
    map: {
      radius: 15,
    },
  };

  const [tabSettings, setTabSettings] = useState(DEFAULT_TAB_SETTINGS);
  const [calendarView, setCalendarView] = useState(tabSettings?.calendar?.defaultView || 'month');

  const updateTabSettings = (tab, updates) => {
    setTabSettings((prevSettings) => {
      const normalizedPrev = {
        ...DEFAULT_TAB_SETTINGS,
        ...prevSettings,
      };
      const updatedTabSettings = {
        ...normalizedPrev,
        [tab]: {
          ...(normalizedPrev[tab] || {}),
          ...updates,
        },
      };

      AsyncStorage.setItem('tabSettings', JSON.stringify(updatedTabSettings)).catch((error) => {
        console.error('Error saving tab settings:', error);
      });

      return updatedTabSettings;
    });
    if (tab === 'calendar' && updates && Object.prototype.hasOwnProperty.call(updates, 'defaultView')) {
      setCalendarView(updates.defaultView || 'month');
    }
  };

  useEffect(() => {
    setCalendarView(tabSettings?.calendar?.defaultView || 'month');
  }, [tabSettings?.calendar?.defaultView]);

  useEffect(() => {
    const defaultTab = tabSettings?.appLaunch?.defaultTab || 'today';
    // 'today' is always visible, so handle it specially
    if (defaultTab === 'today') {
      setActiveTab('today');
    } else if (tabOrder.includes(defaultTab) && tabVisibility[defaultTab] !== false) {
      setActiveTab(defaultTab);
    } else {
      setActiveTab('today');
    }
  }, [tabSettings?.appLaunch?.defaultTab, tabOrder, tabVisibility]);

  useEffect(() => {
    if (activeTab !== 'groceries') {
      setShowGroceryQuickActions(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedRecipe) {
      setShowRecipeActions(false);
    }
  }, [selectedRecipe]);

  const handleTabOrderChange = (newOrder) => {
    const incomingOrder = Array.isArray(newOrder) ? newOrder : [];
    const normalizedOrder = [...incomingOrder, ...DEFAULT_TAB_ORDER.filter(tab => !incomingOrder.includes(tab))];
    setTabOrder(normalizedOrder);
    AsyncStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(normalizedOrder)).catch((error) => {
      console.error('Error saving tab order:', error);
    });
  };

  // Schedule notification for an activity
  const scheduleActivityNotification = async (activityId, title, date, time, reminderTime = '1 hour before') => {
    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      // Parse date and time
      const [hours, minutes] = time.split(':').map(Number);
      const activityDate = new Date(date);
      activityDate.setHours(hours, minutes, 0, 0);
      
      // Calculate notification time based on reminder time
      const notificationTime = new Date(activityDate);
      
      if (reminderTime === '15 min before') {
        notificationTime.setMinutes(notificationTime.getMinutes() - 15);
      } else if (reminderTime === '1 hour before') {
        notificationTime.setHours(notificationTime.getHours() - 1);
      } else if (reminderTime === '1 day before') {
        notificationTime.setDate(notificationTime.getDate() - 1);
      } else if (reminderTime === '3 days before') {
        notificationTime.setDate(notificationTime.getDate() - 3);
      } else if (reminderTime === '1 week before') {
        notificationTime.setDate(notificationTime.getDate() - 7);
      }

      // Only schedule if notification time is in the future
      const now = new Date();
      
      if (notificationTime <= now) {
        console.log('Activity time is in the past or too close, not scheduling notification');
        return;
      }

      // Cancel any existing notification for this activity
      if (scheduledNotificationsRef.current[activityId]) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationsRef.current[activityId]);
      }

      // Format the reminder text for the notification body
      let reminderText = reminderTime;
      if (reminderTime === '1 hour before') {
        reminderText = '1 hour';
      } else if (reminderTime === '15 min before') {
        reminderText = '15 minutes';
      } else if (reminderTime === '1 day before') {
        reminderText = '1 day';
      } else if (reminderTime === '3 days before') {
        reminderText = '3 days';
      } else if (reminderTime === '1 week before') {
        reminderText = '1 week';
      }

      // Schedule the new notification
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Activity Reminder',
          body: `${title} starts in ${reminderText} at ${time}`,
          sound: true,
          data: { activityId },
        },
        trigger: notificationTime,
      });

      // Store the notification ID
      scheduledNotificationsRef.current[activityId] = notificationId;
      console.log(`Scheduled notification for activity ${activityId} at ${notificationTime}`);
    } catch (error) {
      console.error('Error scheduling notification:', error);
    }
  };

  // Cancel notification for an activity
  const cancelActivityNotification = async (activityId) => {
    try {
      if (scheduledNotificationsRef.current[activityId]) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationsRef.current[activityId]);
        delete scheduledNotificationsRef.current[activityId];
        console.log(`Cancelled notification for activity ${activityId}`);
      }
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  };

  // Schedule birthday notification (1 week before)
  const scheduleBirthdayNotification = async (personName, birthday) => {
    try {
      // Request notification permissions
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
        return;
      }

      // Parse birthday string (YYYY-MM-DD) to avoid timezone issues
      const [year, month, day] = birthday.split('-').map(Number);
      const birthdayDate = new Date(year, month - 1, day);
      const thisYear = new Date();
      thisYear.setMonth(birthdayDate.getMonth());
      thisYear.setDate(birthdayDate.getDate());
      
      // If birthday has already passed this year, schedule for next year
      if (thisYear < new Date()) {
        thisYear.setFullYear(thisYear.getFullYear() + 1);
      }
      
      // Calculate notification time (1 week before)
      const notificationTime = new Date(thisYear);
      notificationTime.setDate(notificationTime.getDate() - 7);

      // Only schedule if notification time is in the future
      const now = new Date();
      if (notificationTime <= now) {
        // If notification time has passed, schedule for next year
        notificationTime.setFullYear(notificationTime.getFullYear() + 1);
      }

      const notificationId = `birthday_${personName}_${birthdayDate.getTime()}`;
      
      // Cancel any existing notification for this person
      if (scheduledNotificationsRef.current[notificationId]) {
        await Notifications.cancelScheduledNotificationAsync(scheduledNotificationsRef.current[notificationId]);
      }

      // Schedule the notification
      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Birthday Reminder',
          body: `${personName}'s birthday is in 1 week!`,
          sound: true,
          data: { personName, birthday },
        },
        trigger: notificationTime,
      });

      // Store the notification ID
      scheduledNotificationsRef.current[notificationId] = scheduledId;
      console.log(`Scheduled birthday notification for ${personName} at ${notificationTime}`);
    } catch (error) {
      console.error('Error scheduling birthday notification:', error);
    }
  };

  // Save birthday for a person
  const saveBirthday = async () => {
    if (!editingPerson) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // Use birthdayDate directly - format as YYYY-MM-DD using local date parts to avoid timezone issues
      const year = birthdayDate.getFullYear();
      const month = String(birthdayDate.getMonth() + 1).padStart(2, '0');
      const day = String(birthdayDate.getDate()).padStart(2, '0');
      const birthdayStr = `${year}-${month}-${day}`;
      
      // Check if person already exists
      const existingPerson = people.find(p => p.name === editingPerson.name);
      
      if (existingPerson) {
        // Update existing person
        await updateDoc(doc(db, 'users', currentUser.uid, 'people', existingPerson.id), {
          birthday: birthdayStr
        });
      } else {
        // Create new person document
        await addDoc(collection(db, 'users', currentUser.uid, 'people'), {
          name: editingPerson.name,
          birthday: birthdayStr
        });
      }

      // Schedule notification
      await scheduleBirthdayNotification(editingPerson.name, birthdayStr);
      
      setShowBirthdayPicker(false);
      setEditingPerson(null);
      Alert.alert('Success', `Birthday saved for ${editingPerson.name}`);
    } catch (error) {
      console.error('Error saving birthday:', error);
      Alert.alert('Error', 'Failed to save birthday');
    }
  };

  // Save person profile (birthday, sizes)
  const savePersonProfile = async () => {
    if (!profilePerson) return;

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const year = birthdayDate.getFullYear();
      const month = String(birthdayDate.getMonth() + 1).padStart(2, '0');
      const day = String(birthdayDate.getDate()).padStart(2, '0');
      const birthdayStr = `${year}-${month}-${day}`;

      const profileData = {
        name: profilePerson.name,
        birthday: birthdayStr,
        clothingSize: personClothingSize,
        shoeSize: personShoeSize,
      };

      const existingPerson = people.find(p => p.name === profilePerson.name);

      if (existingPerson) {
        await updateDoc(doc(db, 'users', currentUser.uid, 'people', existingPerson.id), profileData);
      } else {
        await addDoc(collection(db, 'users', currentUser.uid, 'people'), profileData);
      }

      await scheduleBirthdayNotification(profilePerson.name, birthdayStr);

      setShowPersonProfile(false);
      setProfilePerson(null);
      Alert.alert('Success', `Profile saved for ${profilePerson.name}`);
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile');
    }
  };

  // Open person profile modal
  const openPersonProfile = (person) => {
    const existingPerson = people.find(p => p.name === person.name);
    setProfilePerson(person);

    if (existingPerson?.birthday) {
      const [year, month, day] = existingPerson.birthday.split('-').map(Number);
      setBirthdayDate(new Date(year, month - 1, day));
    } else if (person.birthday) {
      const [year, month, day] = person.birthday.split('-').map(Number);
      setBirthdayDate(new Date(year, month - 1, day));
    } else {
      setBirthdayDate(new Date());
    }

    setPersonClothingSize(existingPerson?.clothingSize || person.clothingSize || '');
    setPersonShoeSize(existingPerson?.shoeSize || person.shoeSize || '');
    setShowPersonProfile(true);
  };

  // Listen for authentication state changes
  useEffect(() => {
    // Check if user is authenticated
    const currentUser = user || auth.currentUser;
      if (!currentUser) {
      setItems([]);
      setActivities([]);
      setGiftIdeas([]);
      setPeople([]);
      setPersonalItems([]);
      setPersonalTasks([]);
      setPersonalActivities([]);
      setPersonalIdeas([]);
      return;
    }

    // Listen to people with birthdays (user-specific)
    const peopleQuery = query(collection(db, 'users', currentUser.uid, 'people'));
    const unsubscribePeople = onSnapshot(peopleQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const peopleData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPeople(peopleData);
    });

    // Listen to gift ideas (user-specific, always available even without household)
    const giftIdeasQuery = query(collection(db, 'users', currentUser.uid, 'giftIdeas'));
    const unsubscribeGiftIdeas = onSnapshot(giftIdeasQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const giftIdeasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGiftIdeas(giftIdeasData);
    });
  
    // Listen to personal shopping list (user-specific, always available even without household)
    const personalQuery = query(collection(db, 'users', currentUser.uid, 'personalList'));
    const unsubscribePersonal = onSnapshot(personalQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const personalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonalItems(personalData);
    });

    // Listen to personal tasks (user-specific, always available even without household)
    const personalTasksQuery = query(collection(db, 'users', currentUser.uid, 'personalTasks'));
    const unsubscribePersonalTasks = onSnapshot(personalTasksQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const personalTasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonalTasks(personalTasksData);
    });

    // Listen to personal activities (user-specific, always available even without household)
    const personalActivitiesQuery = query(collection(db, 'users', currentUser.uid, 'personalActivities'));
    const unsubscribePersonalActivities = onSnapshot(personalActivitiesQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const personalActivitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonalActivities(personalActivitiesData);
    });

    // Listen to personal ideas (user-specific, always available even without household)
    const personalIdeasQuery = query(collection(db, 'users', currentUser.uid, 'personalIdeas'));
    const unsubscribePersonalIdeas = onSnapshot(personalIdeasQuery, (snapshot) => {
      // Check if user is still authenticated
      if (!auth.currentUser) return;
      const personalIdeasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPersonalIdeas(personalIdeasData);
    });

    // Listen to idea tags (user-specific)
    const ideaTagsQuery = query(collection(db, 'users', currentUser.uid, 'ideaTags'));
    const unsubscribeIdeaTags = onSnapshot(ideaTagsQuery, (snapshot) => {
      if (!auth.currentUser) return;
      const tagsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIdeaTags(tagsData);
    });

    let unsubscribeItems = null;
    let unsubscribeActivities = null;
    let unsubscribeRecipes = null;
    let householdUnsubscribe = null;

    if (!householdId) {
      setItems([]);
      setActivities([]);
      setRecipes([]);
    } else {
      // Listen to household document for permission mode changes
      const householdUnsubscribe = onSnapshot(doc(db, 'households', householdId), (householdSnapshot) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return; // Don't process if user is logged out
        
        if (householdSnapshot.exists()) {
          const householdData = householdSnapshot.data();
          const admins = householdData.admins || [];
          setIsAdmin(admins.includes(currentUser.uid));
          setPermissionMode(householdData.permissionMode || 'strict');
        }
      });

      // Listen to items
      const itemsQuery = query(
        collection(db, 'households', householdId, 'items')
      );
      unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
        // Check if user is still authenticated
        if (!auth.currentUser) return;
        const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by order field
        itemsData.sort((a, b) => (a.order || 0) - (b.order || 0));
        setItems(itemsData);
      });
    
      // Listen to activities
      const activitiesQuery = query(
        collection(db, 'households', householdId, 'activities')
      );
      unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
        // Check if user is still authenticated
        if (!auth.currentUser) return;
        const activitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        activitiesData.sort((a, b) => (a.order || 0) - (b.order || 0)); // ADD THIS
        setActivities(activitiesData);
      });

      // Listen to recipes
      const recipesQuery = query(
        collection(db, 'households', householdId, 'recipes')
      );
      unsubscribeRecipes = onSnapshot(recipesQuery, (snapshot) => {
        if (!auth.currentUser) return;
        const recipesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        recipesData.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
        setRecipes(recipesData);
      });

      // Check admin status and permission mode (initial load)
      (async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return; // Don't check admin status if user is logged out
          
          const householdDoc = await getDoc(doc(db, 'households', householdId));
          if (householdDoc.exists()) {
            const householdData = householdDoc.data();
            const admins = householdData.admins || [];
            setIsAdmin(admins.includes(currentUser.uid));
            // Get permission mode (defaults to 'strict' if not set)
            setPermissionMode(householdData.permissionMode || 'strict');
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      })();
    }

    return () => {
      if (unsubscribeItems) unsubscribeItems();
      if (unsubscribeActivities) unsubscribeActivities();
      if (unsubscribeRecipes) unsubscribeRecipes();
      if (householdUnsubscribe) householdUnsubscribe();
      unsubscribePeople();
      unsubscribeGiftIdeas();
      unsubscribePersonal();
      unsubscribePersonalTasks();
      unsubscribePersonalActivities();
      unsubscribePersonalIdeas();
      unsubscribeIdeaTags();
    };
  }, [householdId, user]);

  // Process shared recipe URLs from iOS Share Extension
  useEffect(() => {
    if (user && householdId && Platform.OS === 'ios') {
      // Process any queued recipe URLs when app opens
      processRecipeQueue(functions, db, householdId);
    }
  }, [user, householdId]);

  useEffect(() => {
  }, [showDatePicker]);
  
  useEffect(() => {
  }, [showTimePicker]);
  
  useEffect(() => {
  }, [dateFieldType]);

  // Get user's current location
  useEffect(() => {
    const getUserLocation = async () => {
      try {
        // Request location permissions
        let status;
        try {
          const result = await Location.requestForegroundPermissionsAsync();
          status = result.status;
        } catch (permError) {
          console.log('Location permission error (may need native rebuild):', permError.message);
          return;
        }
        if (status !== 'granted') {
          console.log('Location permission denied');
          return;
        }

        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };

    getUserLocation();
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      if (!userLocation) return;
      
      try {
        setWeatherLoading(true);
        // REPLACE 'YOUR_OPENWEATHER_API_KEY' WITH YOUR ACTUAL API KEY
        const OPENWEATHER_API_KEY = '928243ea20e678dd72650ce79e3bb699';
        
        if (OPENWEATHER_API_KEY === 'YOUR_OPENWEATHER_API_KEY') {
          console.error('OpenWeather API key not set! Please add your API key.');
          setWeatherLoading(false);
          return;
        }

        const { latitude, longitude } = userLocation;
        const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=imperial`;
        const forecastUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHER_API_KEY}&units=imperial&exclude=minutely,hourly,alerts`;
        
        const [currentResponse, forecastResponse] = await Promise.all([
          fetch(currentWeatherUrl),
          fetch(forecastUrl),
        ]);

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();
        
        if (currentData.cod === 200) {
          setWeatherData(currentData);
        } else {
          console.error('Weather API error:', currentData.message || currentData);
          setWeatherData(null);
        }

        if (!forecastData.cod && forecastData.daily) {
          setWeatherForecast(forecastData);
        } else {
          if (forecastData.message) {
            console.error('Weather forecast error:', forecastData.message);
          }
          setWeatherForecast(null);
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
        setWeatherForecast(null);
      } finally {
        setWeatherLoading(false);
      }
    };

    if (userLocation) {
      fetchWeather();
      // Refresh weather every 30 minutes
      const interval = setInterval(fetchWeather, 30 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [userLocation]);

  // Sync widget data whenever relevant data changes
  useEffect(() => {
    if (!user || Platform.OS !== 'ios') return;

    const syncData = async () => {
      try {
        // Get all activities (household + personal + Apple Calendar)
        const allActivities = [
          ...activities,
          ...personalActivities,
          ...(showAppleCalendar ? appleCalendarEvents : [])
        ];

        // Get all tasks (household + personal, only incomplete)
        const allTasks = [
          ...items.filter(item => item.category === 'todo' && !item.date && !item.completed),
          ...personalTasks.filter(task => !task.completed)
        ];

        const widgetData = prepareWidgetData(allActivities, allTasks, weatherData);
        await syncWidgetData(widgetData);
      } catch (error) {
        console.error('Error syncing widget data:', error);
      }
    };

    // Debounce sync to avoid too frequent updates
    const timeoutId = setTimeout(syncData, 500);
    return () => clearTimeout(timeoutId);
  }, [items, activities, personalTasks, personalActivities, weatherData, appleCalendarEvents, showAppleCalendar, user]);

  // Fetch Apple Calendar events
  useEffect(() => {
    const fetchAppleCalendarEvents = async () => {
      try {
        // Request calendar permissions
        const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
        if (status !== 'granted') {
          console.log('Calendar permission denied');
          return;
        }

        // Get all calendars
        const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
        
        // Get current date range (3 months back, 2 years forward for birthdays compatibility)
        const now = new Date();
        const startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 3);
        const endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 2);

        // Fetch events from all calendars
        const events = await ExpoCalendar.getEventsAsync(
          calendars.map(cal => cal.id),
          startDate,
          endDate
        );

        // Format events to match our activity structure
        const formattedEvents = events.map(event => ({
          id: event.id,
          title: event.title || 'Untitled Event',
          date: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : null,
          time: event.startDate ? new Date(event.startDate).toTimeString().slice(0, 5) : null,
          notes: event.notes || null,
          location: event.location || null,
          isAppleCalendar: true,
          calendarId: event.calendarId,
        })).filter(event => event.date); // Only include events with dates

        setAppleCalendarEvents(formattedEvents);
      } catch (error) {
        console.error('Error fetching Apple Calendar events:', error);
      }
    };

    if (showAppleCalendar) {
      fetchAppleCalendarEvents();
    } else {
      setAppleCalendarEvents([]);
    }
  }, [showAppleCalendar]);

  // Load settings on app start
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load saved theme preference (defaults to 'light')
        const savedTheme = await AsyncStorage.getItem('@life_organizer_theme');
        if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
          setTheme(savedTheme);
        }

        const savedTabVisibility = await AsyncStorage.getItem('tabVisibility');
        if (savedTabVisibility) {
          try {
            const parsedVisibility = JSON.parse(savedTabVisibility);
            const mergedVisibility = {
              all: false,
              ideas: true,
              restaurants: true,
              todo: true,
              groceries: true,
              gifts: true,
              calendar: true,
              ...parsedVisibility,
            };
            setTabVisibility(mergedVisibility);
          } catch (visibilityError) {
            console.error('Error parsing tab visibility:', visibilityError);
          }
        }

        const savedTabSettings = await AsyncStorage.getItem('tabSettings');
        if (savedTabSettings) {
          try {
            const parsedTabSettings = JSON.parse(savedTabSettings);
            const mergedTabSettings = {
              ...DEFAULT_TAB_SETTINGS,
              ...parsedTabSettings,
              today: {
                ...DEFAULT_TAB_SETTINGS.today,
                ...(parsedTabSettings?.today || {}),
              },
              restaurants: {
                ...DEFAULT_TAB_SETTINGS.restaurants,
                ...(parsedTabSettings?.restaurants || {}),
              },
              ideas: {
                ...DEFAULT_TAB_SETTINGS.ideas,
                ...(parsedTabSettings?.ideas || {}),
              },
              todo: {
                ...DEFAULT_TAB_SETTINGS.todo,
                ...(parsedTabSettings?.todo || {}),
              },
              groceries: {
                ...DEFAULT_TAB_SETTINGS.groceries,
                ...(parsedTabSettings?.groceries || {}),
              },
              map: {
                ...DEFAULT_TAB_SETTINGS.map,
                ...(parsedTabSettings?.map || {}),
              },
              calendar: {
                ...DEFAULT_TAB_SETTINGS.calendar,
                ...(parsedTabSettings?.calendar || {}),
              },
              appLaunch: {
                ...DEFAULT_TAB_SETTINGS.appLaunch,
                ...(parsedTabSettings?.appLaunch || {}),
              },
            };
            setTabSettings(mergedTabSettings);
          } catch (parseError) {
            console.error('Error parsing tab settings:', parseError);
            setTabSettings(DEFAULT_TAB_SETTINGS);
          }
        } else {
          setTabSettings(DEFAULT_TAB_SETTINGS);
        }

        const savedTabOrder = await AsyncStorage.getItem(TAB_ORDER_STORAGE_KEY);
        if (savedTabOrder) {
          try {
            const parsedOrder = JSON.parse(savedTabOrder);
            if (Array.isArray(parsedOrder)) {
              const normalizedOrder = [...parsedOrder, ...DEFAULT_TAB_ORDER.filter(tab => !parsedOrder.includes(tab))];
              setTabOrder(normalizedOrder);
            } else {
              setTabOrder(DEFAULT_TAB_ORDER);
            }
          } catch (orderError) {
            console.error('Error parsing tab order:', orderError);
            setTabOrder(DEFAULT_TAB_ORDER);
          }
        } else {
          setTabOrder(DEFAULT_TAB_ORDER);
        }

        // Load Face ID preference
        const savedShowAppleCalendar = await AsyncStorage.getItem('showAppleCalendar');
        if (savedShowAppleCalendar !== null) {
          setShowAppleCalendar(JSON.parse(savedShowAppleCalendar));
        }
        // Note: Weather API key is hardcoded in the fetchWeather function
        const savedFaceIdEnabled = await AsyncStorage.getItem('faceIdEnabled');
        if (savedFaceIdEnabled === 'true') {
          setIsFaceIdEnabled(true);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Initialize location reminder service - deferred until app is active to prevent "runtime not ready" crashes
  useEffect(() => {
    let isMounted = true;

    const initLocationReminders = async () => {
      try {
        // Small delay to ensure runtime is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));
        if (isMounted) {
          await locationReminderService.initialize();
        }
      } catch (error) {
        console.error('Error initializing location reminders:', error);
      }
    };

    // Only initialize when app is active
    if (AppState.currentState === 'active') {
      initLocationReminders();
    } else {
      // Wait for app to become active
      const subscription = AppState.addEventListener('change', (nextState) => {
        if (nextState === 'active' && isMounted) {
          initLocationReminders();
          subscription.remove();
        }
      });
      return () => {
        isMounted = false;
        subscription.remove();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const defaultView = tabSettings?.calendar?.defaultView || 'week';
    setCalendarView(defaultView);
  }, [tabSettings?.calendar?.defaultView]);

  useEffect(() => {
    if (activeTab === 'calendar') {
      const defaultView = tabSettings?.calendar?.defaultView || 'week';
      setCalendarView(defaultView);
    }
  }, [activeTab, tabSettings?.calendar?.defaultView]);

  // Handle Face ID authentication on app start or when Face ID is enabled
  useEffect(() => {
    const checkAndAuthenticate = async () => {
      // Only show Face ID if user is logged in and Face ID is enabled
      if (!user || !isFaceIdEnabled) {
        setIsFaceIdAuthenticated(true); // Allow app access
        return;
      }

      // Immediately require authentication when user is detected and Face ID is enabled
      setIsFaceIdAuthenticated(false);

      try {
        // Check if device supports biometric authentication
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
          console.log('Biometric authentication not available');
          setIsFaceIdAuthenticated(true);
          // Disable Face ID if hardware not available
          setIsFaceIdEnabled(false);
          await AsyncStorage.setItem('faceIdEnabled', 'false');
          return;
        }

        // Check if biometric records are enrolled
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) {
          console.log('No biometric records found');
          setIsFaceIdAuthenticated(true);
          // Disable Face ID if no biometrics enrolled
          setIsFaceIdEnabled(false);
          await AsyncStorage.setItem('faceIdEnabled', 'false');
          return;
        }

        // Authenticate with Face ID
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Life Organizer',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false, // Allow passcode fallback if Face ID fails
        });

        if (result.success) {
          setIsFaceIdAuthenticated(true);
        } else {
          // User cancelled or failed - disable Face ID to prevent lockout
          console.log('Face ID authentication failed or cancelled:', result.error);
          setIsFaceIdEnabled(false);
          setIsFaceIdAuthenticated(true);
          await AsyncStorage.setItem('faceIdEnabled', 'false');
          Alert.alert(
            'Face ID Disabled',
            'Face ID authentication was cancelled or failed. Face ID has been disabled. You can re-enable it in Settings.',
            [{ text: 'OK' }]
          );
        }
      } catch (error) {
        console.error('Face ID error:', error);
        // Allow access if error occurs and disable Face ID
        setIsFaceIdAuthenticated(true);
        setIsFaceIdEnabled(false);
        await AsyncStorage.setItem('faceIdEnabled', 'false');
      }
    };

    // Only check Face ID after user is set
    if (user !== null) {
      checkAndAuthenticate();
    }
  }, [user, isFaceIdEnabled]);

  // Handle app state changes to re-authenticate when returning from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && user && isFaceIdEnabled && !isFaceIdAuthenticated) {
        // User returned to app and needs to authenticate
        const authenticate = async () => {
          try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            if (!hasHardware) {
              setIsFaceIdAuthenticated(true);
              setIsFaceIdEnabled(false);
              await AsyncStorage.setItem('faceIdEnabled', 'false');
              return;
            }

            const isEnrolled = await LocalAuthentication.isEnrolledAsync();
            if (!isEnrolled) {
              setIsFaceIdAuthenticated(true);
              setIsFaceIdEnabled(false);
              await AsyncStorage.setItem('faceIdEnabled', 'false');
              return;
            }

            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock Life Organizer',
              cancelLabel: 'Cancel',
              disableDeviceFallback: false, // Allow passcode fallback
            });

            if (result.success) {
              setIsFaceIdAuthenticated(true);
            } else {
              // Disable Face ID if authentication fails to prevent lockout
              setIsFaceIdEnabled(false);
              setIsFaceIdAuthenticated(true);
              await AsyncStorage.setItem('faceIdEnabled', 'false');
            }
          } catch (error) {
            console.error('Face ID error:', error);
            setIsFaceIdAuthenticated(true);
            setIsFaceIdEnabled(false);
            await AsyncStorage.setItem('faceIdEnabled', 'false');
          }
        };
        authenticate();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [user, isFaceIdEnabled, isFaceIdAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setAuthLoading(false);
      
      if (user) {
        setCheckingHousehold(true);
        setCheckingProfile(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Check if user has name and username
            if (userData.name && userData.username) {
              setHasProfile(true);
              setCurrentUserName(userData.name);
            } else {
              setHasProfile(false);
              setCurrentUserName('');
            }
            // Check household
            if (userData.householdId) {
              setHouseholdId(userData.householdId);
            } else {
              setHouseholdId(null);
            }
          } else {
            setHasProfile(false);
            setHouseholdId(null);
            setCurrentUserName('');
          }
        } catch (error) {
          console.error('Error checking user data:', error);
          setHasProfile(false);
          setHouseholdId(null);
        } finally {
          setCheckingHousehold(false);
          setCheckingProfile(false);
        }
      } else {
        setHasProfile(false);
        setHouseholdId(null);
        setCheckingHousehold(false);
        setCheckingProfile(false);
      }
    });
  
    return unsubscribe;
  }, []);

  // Show loading while auth/profile/household loading
  if (authLoading || checkingProfile || checkingHousehold) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
      </GestureHandlerRootView>
    );
  }
  // Show Face ID lock screen if authentication required
  if (user && isFaceIdEnabled && !isFaceIdAuthenticated) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Authenticating...</Text>
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}
  // Show auth screen if not logged in
  if (!user) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthScreen onAuthSuccess={() => setUser(auth.currentUser)} theme={theme} />
      </GestureHandlerRootView>
    );
  }
  // Show profile setup if user doesn't have profile
  if (!hasProfile && !checkingProfile) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UserProfileSetup
          theme={theme}
          onComplete={() => {
            setHasProfile(true);
            // Ensure household check state is ready for new users
            setCheckingHousehold(false);
            setSkippedHousehold(false);
          }}
        />
      </GestureHandlerRootView>
    );
  }
  if (!householdId && !checkingHousehold && !showHouseholdSetup && !skippedHousehold) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <HouseholdSetup theme={theme} onHouseholdSet={(id) => {
      if (id) {
        setHouseholdId(id);
        const currentUser = auth.currentUser;
        if (currentUser) {
          updateDoc(doc(db, 'users', currentUser.uid), {
            householdId: id,
          }, { merge: true });
        }
        setSkippedHousehold(false);
      } else {
        // user chose to skip
        setSkippedHousehold(true);
      }
        }} allowSkip={true} />
      </GestureHandlerRootView>
    );
  }

  if (showHouseholdSetup) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <HouseholdSetup theme={theme} onHouseholdSet={(id) => {
      setShowHouseholdSetup(false);
      if (id) {
        setHouseholdId(id);
        setSkippedHousehold(false);
        const currentUser = auth.currentUser;
        if (currentUser) {
          updateDoc(doc(db, 'users', currentUser.uid), {
            householdId: id,
          }, { merge: true });
        }
      }
        }} allowSkip={false} />
      </GestureHandlerRootView>
    );
  }



  // Combine people from giftIdeas and people collection
  const allPeopleNames = [...new Set(giftIdeas.map(gift => gift.person))];
  const peopleMap = new Map(people.map(p => [p.name, p]));
  // Merge people, prioritizing people collection data (with birthdays)
  const allPeople = allPeopleNames.map(name => {
    const personData = peopleMap.get(name);
    return personData ? { name: personData.name, birthday: personData.birthday } : { name };
  });

  const addItem = async () => {
    if (!newItem.title.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to add items');
      setIsSubmitting(false);
      return;
    }
    
    try {
      let category = addItemType;
      if (addItemType === 'activities') {
        if (!newItem.date || !newItem.time) {
          Alert.alert('Error', 'Please select both date and time for activities');
          setIsSubmitting(false);
          return;
        }
  
        const activityData = {
          title: newItem.title,
          date: newItem.date,
          endDate: newItem.endDate || null,
          time: newItem.time,
          category: newItem.activityCategory || 'general',
          notes: newItem.notes,
          reminderTime: newItem.reminderTime || '1 hour before',
          createdAt: new Date().toISOString(),
        };
  
        if (newItem.activityLatitude && newItem.activityLongitude) {
          activityData.location = {
            address: newItem.activityAddress,
            latitude: newItem.activityLatitude,
            longitude: newItem.activityLongitude,
          };
        }
  
        if (!householdId) {
          Alert.alert('Error', 'You need to join or create a household to add activities');
          return;
        }
        const docRef = await addDoc(collection(db, 'households', householdId, 'activities'), activityData);
        // Schedule notification
        await scheduleActivityNotification(docRef.id, activityData.title, activityData.date, activityData.time, activityData.reminderTime);

        // Add location reminder if enabled and has location
        if (newItem.locationReminder && activityData.location) {
          await locationReminderService.addGeofence({
            id: docRef.id,
            type: 'activity',
            title: activityData.title,
            location: activityData.location,
          });
        }

      } else if (addItemType === 'gifts') {
        if (!newItem.person.trim()) {
          Alert.alert('Error', 'Please enter a person\'s name');
          setIsSubmitting(false);
          return;
        }
  
        const giftData = {
          person: newItem.person,
          idea: newItem.title,
          budget: newItem.budget,
          link: newItem.link || '',
          notes: newItem.notes,
          completed: false,
          createdAt: new Date().toISOString(),
        };
  
        await addDoc(collection(db, 'users', currentUser.uid, 'giftIdeas'), giftData);
        
      } else if (addItemType === 'personal') {
        const personalData = {
          title: newItem.title,
          budget: newItem.budget || '',
          link: newItem.link || '',
          notes: newItem.notes,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        await addDoc(collection(db, 'users', currentUser.uid, 'personalList'), personalData);

      } else if (addItemType === 'wishlist') {
        // Personal wishlist item
        const wishlistItem = {
          id: Date.now().toString(),
          title: newItem.title,
          notes: newItem.notes || '',
          price: newItem.price || '',
          link: newItem.link || '',
          purchased: false,
          createdAt: new Date().toISOString(),
        };
        setPersonalWishlist(prev => [...prev, wishlistItem]);

      } else if (addItemType === 'otherShop') {
        // Other store shopping item
        const otherItem = {
          id: Date.now().toString(),
          title: newItem.title,
          store: newItem.notes || '', // Use notes field for store name
          price: newItem.price ? parseFloat(newItem.price) : null,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        setOtherShopItems(prev => [...prev, otherItem]);

      } else if (addItemType === 'todo') {
        // Check if creating task or activity
        if (todoItemType === 'activity') {
          // Create as activity
          if (!newItem.date) {
            Alert.alert('Error', 'Please select a date for the activity');
            setIsSubmitting(false);
            return;
          }
          
          if (!newItem.activityAddress) {
            Alert.alert('Error', 'Please enter an address for the activity');
            setIsSubmitting(false);
            return;
          }
  
          const activityData = {
            title: newItem.title,
            date: newItem.date,
            endDate: newItem.endDate || null,
            time: newItem.time || '12:00', // Default time if not provided
            category: 'general',
            notes: newItem.notes,
            reminderTime: newItem.reminderTime || '1 hour before',
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid, // Track creator
          };
  
          if (newItem.activityLatitude && newItem.activityLongitude) {
            activityData.location = {
              address: newItem.activityAddress,
              latitude: newItem.activityLatitude,
              longitude: newItem.activityLongitude,
            };
          }
  
          // Save to personal or household based on scope
          if (activityScope === 'personal') {
            const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'personalActivities'), activityData);
            // Schedule notification
            await scheduleActivityNotification(docRef.id, activityData.title, activityData.date, activityData.time, activityData.reminderTime);
            // Add location reminder if enabled and has location
            if (newItem.locationReminder && activityData.location) {
              await locationReminderService.addGeofence({
                id: docRef.id,
                type: 'activity',
                title: activityData.title,
                location: activityData.location,
              });
            }
          } else {
            if (!householdId) {
              Alert.alert('Error', 'You need to join or create a household to add household activities');
              setIsSubmitting(false);
              return;
            }
            const docRef = await addDoc(collection(db, 'households', householdId, 'activities'), activityData);
            // Schedule notification
            await scheduleActivityNotification(docRef.id, activityData.title, activityData.date, activityData.time, activityData.reminderTime);
            // Add location reminder if enabled and has location
            if (newItem.locationReminder && activityData.location) {
              await locationReminderService.addGeofence({
                id: docRef.id,
                type: 'activity',
                title: activityData.title,
                location: activityData.location,
              });
            }
          }
        } else {
          // Create as task
          const itemData = {
            title: newItem.title,
            category: 'todo',
            notes: newItem.notes,
            completed: false,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid, // Track creator
          };
  
          if (newItem.dueDate) {
            itemData.dueDate = newItem.dueDate;
          }
          itemData.priority = newItem.priority || 'medium';
          
          // Save location for tasks
          if (newItem.activityLatitude && newItem.activityLongitude) {
            itemData.location = {
              address: newItem.activityAddress,
              latitude: newItem.activityLatitude,
              longitude: newItem.activityLongitude,
            };
          }

          // Save to personal or household based on scope
          if (taskScope === 'personal') {
            const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'personalTasks'), itemData);
            // Add location reminder if enabled and has location
            if (newItem.locationReminder && itemData.location) {
              await locationReminderService.addGeofence({
                id: docRef.id,
                type: 'task',
                title: itemData.title,
                location: itemData.location,
              });
            }
          } else {
            if (!householdId) {
              Alert.alert('Error', 'You need to join or create a household to add household tasks');
              setIsSubmitting(false);
              return;
            }
            itemData.order = items.length;
            const docRef = await addDoc(collection(db, 'households', householdId, 'items'), itemData);
            // Add location reminder if enabled and has location
            if (newItem.locationReminder && itemData.location) {
              await locationReminderService.addGeofence({
                id: docRef.id,
                type: 'task',
                title: itemData.title,
                location: itemData.location,
              });
            }
          }
        }
      } else {
        // All other categories (restaurants, groceries, ideas, etc.)
        // For ideas: support personal vs household scope
        if (category === 'ideas' && ideaScope === 'personal') {
          const personalIdeaData = {
            title: newItem.title,
            notes: newItem.notes,
            createdAt: new Date().toISOString(),
            completed: false,
            tagIds: newItem.tagIds || [],
          };
          await addDoc(collection(db, 'users', currentUser.uid, 'personalIdeas'), personalIdeaData);
        } else {
          const itemData = {
            title: newItem.title,
            category: category,
            notes: newItem.notes,
            completed: false,
            createdAt: new Date().toISOString(),
            order: items.length,
            createdBy: currentUser.uid, // Track creator
          };
        
          if (category === 'groceries' && newItem.price) {
            itemData.price = parseFloat(newItem.price) || 0;
          }
  
          if (category === 'restaurants' && newItem.latitude && newItem.longitude) {
            itemData.location = {
              address: newItem.address,
              latitude: newItem.latitude,
              longitude: newItem.longitude,
            };
            itemData.cuisine = newItem.cuisine;
            itemData.priceRange = newItem.priceRange;
            if (newItem.placeId) {
              itemData.placeId = newItem.placeId;
            }
          }
  
          if (!householdId) {
            Alert.alert('Error', 'You need to join or create a household to add this item');
            setIsSubmitting(false);
            return;
          }
          const docRef = await addDoc(collection(db, 'households', householdId, 'items'), itemData);

          // Add location reminder for restaurants if enabled and has location
          if (category === 'restaurants' && newItem.locationReminder && itemData.location) {
            await locationReminderService.addGeofence({
              id: docRef.id,
              type: 'restaurant',
              title: itemData.title,
              location: itemData.location,
            });
          }
        }
      }

      setNewItem({
        title: '',
        notes: '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: '',
        link: '',
        activityAddress: '',
        priority: 'medium',
        price: '',
        reminderTime: '1 hour before',
        placeId: '',
        locationReminder: true,
      });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setIsSubmitting(false);
    }
  
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  const formatTime = (time) => {
    if (!time) return '';
    // If time is already in "HH:MM" format, convert to 12-hour format
    if (typeof time === 'string' && time.includes(':')) {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const mins = minutes || '00';
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${mins.padStart(2, '0')} ${ampm}`;
    }
    return time;
  };

  const openEditForm = (item, type = 'item') => {
    setIsEditMode(true);
    setEditingItem({ ...item, type });
    // Clear address suggestions when opening form
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    
    if (type === 'activity') {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: item.date || '',
        endDate: item.endDate || '',
        time: item.time || '',
        activityCategory: item.category || '',
        person: '',
        occasion: '',
        budget: '',
        activityAddress: item.location?.address || item.address || '',
        activityLatitude: item.location?.latitude,
        activityLongitude: item.location?.longitude,
        reminderTime: item.reminderTime || '1 hour before',
      });
      setAddItemType('activities');
    } else if (type === 'gift') {
      setNewItem({
        title: item.idea,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: '',
        time: '',
        activityCategory: '',
        person: item.person || '',
        occasion: '',
        budget: item.budget || '',
        link: item.link || '',
        activityAddress: '',
        tagIds: [],
      });
      setAddItemType('gifts');
    } else if (type === 'personal') {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: item.budget || '',
        link: item.link || '',
        activityAddress: '',
        tagIds: [],
      });
      setAddItemType('personal');
    } else if (type === 'personalTask') {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: item.dueDate || '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: '',
        link: '',
        activityAddress: item.location?.address || '',
        activityLatitude: item.location?.latitude,
        activityLongitude: item.location?.longitude,
        priority: item.priority || 'medium',
      });
      setAddItemType('todo');
      setTodoItemType('task');
      setTaskScope('personal');
    } else if (type === 'personalActivity') {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: item.date || '',
        endDate: item.endDate || '',
        time: item.time || '',
        activityCategory: item.category || '',
        person: '',
        occasion: '',
        budget: '',
        link: '',
        activityAddress: item.location?.address || '',
        activityLatitude: item.location?.latitude,
        activityLongitude: item.location?.longitude,
        reminderTime: item.reminderTime || '1 hour before',
      });
      setAddItemType('todo');
      setTodoItemType('activity');
      setActivityScope('personal');
    } else if (type === 'personalIdea') {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: '',
        link: '',
        activityAddress: '',
        tagIds: item.tagIds || [],
      });
      setAddItemType('ideas');
      setIdeaScope('personal');
    } else {
      setNewItem({
        title: item.title,
        notes: item.notes || '',
        address: item.location?.address || '',
        cuisine: item.cuisine || '',
        priceRange: item.priceRange || '',
        dueDate: item.dueDate || '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: '',
        activityAddress: item.category === 'todo' ? (item.location?.address || '') : '',
        activityLatitude: item.category === 'todo' ? item.location?.latitude : undefined,
        activityLongitude: item.category === 'todo' ? item.location?.longitude : undefined,
        latitude: item.location?.latitude,
        longitude: item.location?.longitude,
        priority: item.priority || 'medium',
        tagIds: item.tagIds || [],
      });
      
      // Check if this is a personal idea - check both isPersonal flag and if ID exists in personalIdeas
      const isPersonalIdea = item.category === 'ideas' && (item.isPersonal || personalIdeas.some(pi => pi.id === item.id));
      if (isPersonalIdea) {
        setEditingItem({ ...item, type: 'personalIdea', isPersonal: true });
        setIdeaScope('personal');
      } else {
        setEditingItem({ ...item, type: 'item' });
        if (item.category === 'ideas') {
          setIdeaScope('household');
        }
      }
      
      setAddItemType(item.category);
    }
    setShowAddForm(true);
  };

  const saveEditedItem = async () => {
    if (!newItem.title.trim() || !editingItem) return;

    // Check if user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to edit items');
      return;
    }

    // Check permissions for household items
    if (editingItem.category && !editingItem.isPersonal && editingItem.type !== 'personal' && !editingItem.isGift && editingItem.type !== 'gift' && editingItem.type !== 'personalTask' && editingItem.type !== 'personalActivity' && editingItem.type !== 'personalIdea') {
      // In strict mode, only creator or admin can edit
      // In collaborative mode, anyone can edit
      if (permissionMode === 'strict') {
        if (!isAdmin && editingItem.createdBy !== currentUser.uid) {
          Alert.alert('Permission Denied', 'You can only edit items you created');
          return;
        }
      }
      // In collaborative mode, no check needed - anyone can edit
    }
  
    try {
      // Handle gifts - no household required
      if (editingItem.isGift || editingItem.type === 'gift') {
        const giftData = {
          person: newItem.person,
          idea: newItem.title,
          budget: newItem.budget,
          link: newItem.link || '',
          notes: newItem.notes,
        };
  
        await updateDoc(doc(db, 'users', currentUser.uid, 'giftIdeas', editingItem.id), giftData);
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          tagIds: [],
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }
      
      // Handle personal items - no household required
      if (editingItem.type === 'personal') {
        const personalData = {
          title: newItem.title,
          budget: newItem.budget || '',
          link: newItem.link || '',
          notes: newItem.notes,
        };
  
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalList', editingItem.id), personalData);
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          tagIds: [],
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }
      
      // Handle personal ideas FIRST - check both type and isPersonal flag (before personal tasks)
      if (editingItem.type === 'personalIdea' || (editingItem.category === 'ideas' && editingItem.isPersonal)) {
        const ideaData = {
          title: newItem.title,
          notes: newItem.notes,
          tagIds: newItem.tagIds || [],
        };
  
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', editingItem.id), ideaData);
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          tagIds: [],
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }
      
      // Handle personal tasks (check type is personalTask or category is todo with isPersonal)
      if (editingItem.type === 'personalTask' || (editingItem.category === 'todo' && editingItem.isPersonal)) {
        const taskData = {
          title: newItem.title,
          notes: newItem.notes,
        };
        if (newItem.dueDate) {
          taskData.dueDate = newItem.dueDate;
        }
        taskData.priority = newItem.priority || editingItem.priority || 'medium';
        
        if (newItem.activityLatitude && newItem.activityLongitude) {
          taskData.location = {
            address: newItem.activityAddress,
            latitude: newItem.activityLatitude,
            longitude: newItem.activityLongitude,
          };
        } else if (editingItem.location) {
          taskData.location = editingItem.location;
        }
  
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', editingItem.id), taskData);
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          tagIds: [],
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }
      
      // Handle personal activities
      if (editingItem.type === 'personalActivity') {
        const activityData = {
          title: newItem.title,
          date: newItem.date,
          endDate: newItem.endDate || null,
          time: newItem.time,
          category: newItem.activityCategory || editingItem.category || 'general',
          notes: newItem.notes,
          reminderTime: newItem.reminderTime || editingItem.reminderTime || '1 hour before',
        };
  
        if (newItem.activityLatitude && newItem.activityLongitude) {
          activityData.location = {
            address: newItem.activityAddress,
            latitude: newItem.activityLatitude,
            longitude: newItem.activityLongitude,
          };
        } else if (editingItem.location) {
          activityData.location = editingItem.location;
        }
  
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalActivities', editingItem.id), activityData);
        // Reschedule notification
        await scheduleActivityNotification(editingItem.id, activityData.title, activityData.date, activityData.time, activityData.reminderTime);
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          tagIds: [],
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      }
      
      // All other items require household
      if (!householdId) {
        Alert.alert('Error', 'No household found');
        return;
      }
  
      // Check if it's an activity - either type is 'activity' or category is 'activities' or it has a date field
      if (editingItem.type === 'activity' || editingItem.category === 'activities' || editingItem.date) {
        const activityData = {
          title: newItem.title,
          date: newItem.date,
          endDate: newItem.endDate || null,
          time: newItem.time,
          category: newItem.activityCategory || editingItem.category,
          notes: newItem.notes,
          reminderTime: newItem.reminderTime || editingItem.reminderTime || '1 hour before',
        };
  
        if (newItem.activityLatitude && newItem.activityLongitude) {
          activityData.location = {
            address: newItem.activityAddress,
            latitude: newItem.activityLatitude,
            longitude: newItem.activityLongitude,
          };
        } else if (editingItem.location) {
          activityData.location = editingItem.location;
        }
  
        await updateDoc(doc(db, 'households', householdId, 'activities', editingItem.id), activityData);
        // Reschedule notification
        await scheduleActivityNotification(editingItem.id, activityData.title, activityData.date, activityData.time, activityData.reminderTime);
        
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          link: '',
          activityAddress: '',
          activityLatitude: null,
          activityLongitude: null,
          priority: 'medium',
          price: '',
          reminderTime: '1 hour before',
        });
        setShowAddForm(false);
        setIsEditMode(false);
        setEditingItem(null);
        return;
      } else {
        const itemData = {
          title: newItem.title,
          notes: newItem.notes,
        };
        if (editingItem.category === 'groceries' && newItem.price) {
          itemData.price = parseFloat(newItem.price) || 0;
        }
  
        if (editingItem.category === 'restaurants') {
          if (newItem.latitude && newItem.longitude) {
            itemData.location = {
              address: newItem.address,
              latitude: newItem.latitude,
              longitude: newItem.longitude,
            };
          } else if (editingItem.location) {
            itemData.location = editingItem.location;
          }
          itemData.cuisine = newItem.cuisine;
          itemData.priceRange = newItem.priceRange;
        }
  
        if (editingItem.category === 'todo') {
          if (newItem.dueDate) {
            itemData.dueDate = newItem.dueDate;
          }
          itemData.priority = newItem.priority || editingItem.priority || 'medium';

          // Preserve or update task location
          if (newItem.activityLatitude && newItem.activityLongitude) {
            itemData.location = {
              address: newItem.activityAddress,
              latitude: newItem.activityLatitude,
              longitude: newItem.activityLongitude,
            };
          } else if (editingItem.location) {
            itemData.location = editingItem.location;
          }
        }
  
        await updateDoc(doc(db, 'households', householdId, 'items', editingItem.id), itemData);
      }
  
      setNewItem({
        title: '',
        notes: '',
        address: '',
        cuisine: '',
        priceRange: '',
        dueDate: '',
        date: '',
        time: '',
        activityCategory: '',
        person: '',
        occasion: '',
        budget: '',
        link: '',
        activityAddress: '',
        priority: 'medium',
        price: '',
        reminderTime: '1 hour before',
      });
      setShowAddForm(false);
      setIsEditMode(false);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const deleteItem = async (id, category) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to delete items');
      return;
    }

    try {
      // Remove location reminder geofence if it exists
      const typeMap = {
        'activities': 'activity',
        'personalActivities': 'activity',
        'restaurants': 'restaurant',
        'items': 'task', // default for items/tasks
      };
      const geofenceType = typeMap[category] || 'task';
      try {
        await locationReminderService.removeGeofence(id, geofenceType);
      } catch (e) {
        // Silently ignore if geofence doesn't exist
      }

      // First check for personal ideas (can be called without category from ideas tab)
      const personalIdea = personalIdeas.find(i => i.id === id);
      if (personalIdea || category === 'ideas') {
        if (personalIdea) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', id));
          return;
        }
        // If category is 'ideas' but not found in personalIdeas, check household ideas
        if (householdId) {
          const idea = items.find(i => i.id === id && i.category === 'ideas');
          if (idea) {
            await deleteDoc(doc(db, 'households', householdId, 'items', id));
          }
        }
        return;
      }
      
      if (category === 'activities' || category === 'personalActivities') {
        // Cancel notification
        await cancelActivityNotification(id);
        // Check if it's a personal activity
        const personalActivity = personalActivities.find(a => a.id === id);
        if (personalActivity || category === 'personalActivities') {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'personalActivities', id));
        } else {
          if (!householdId) return;
          await deleteDoc(doc(db, 'households', householdId, 'activities', id));
        }
      } else if (category === 'gift') {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'giftIdeas', id));
      } else if (category === 'personal') {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'personalList', id));
      } else if (category === 'items') {
        // Check if it's a personal task
        const personalTask = personalTasks.find(t => t.id === id);
        if (personalTask) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'personalTasks', id));
        } else {
          if (!householdId) return;
          await deleteDoc(doc(db, 'households', householdId, 'items', id));
        }
      } else {
        // Default case - check personal items first, then household
        // Check personal tasks
        const personalTask = personalTasks.find(t => t.id === id);
        if (personalTask) {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'personalTasks', id));
          return;
        }
        
        if (!householdId) return;
        await deleteDoc(doc(db, 'households', householdId, 'items', id));
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  // Tag management functions
  const addIdeaTag = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !newTagName.trim()) return;
    
    try {
      await addDoc(collection(db, 'users', currentUser.uid, 'ideaTags'), {
        name: newTagName.trim(),
        color: newTagColor,
        createdAt: new Date().toISOString(),
      });
      setNewTagName('');
      setNewTagColor('#6366f1');
    } catch (error) {
      console.error('Error adding tag:', error);
      Alert.alert('Error', 'Failed to add tag');
    }
  };

  const updateIdeaTag = async (tagId, updates) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    try {
      await updateDoc(doc(db, 'users', currentUser.uid, 'ideaTags', tagId), updates);
      setEditingTag(null);
    } catch (error) {
      console.error('Error updating tag:', error);
      Alert.alert('Error', 'Failed to update tag');
    }
  };

  const deleteIdeaTag = async (tagId) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    Alert.alert(
      'Delete Tag',
      'Are you sure you want to delete this tag? It will be removed from all ideas.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the tag
              await deleteDoc(doc(db, 'users', currentUser.uid, 'ideaTags', tagId));
              
              // Remove tag from all personal ideas that have it
              const ideasWithTag = personalIdeas.filter(idea => 
                idea.tagIds && idea.tagIds.includes(tagId)
              );
              
              for (const idea of ideasWithTag) {
                await updateDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', idea.id), {
                  tagIds: idea.tagIds.filter(id => id !== tagId)
                });
              }
            } catch (error) {
              console.error('Error deleting tag:', error);
              Alert.alert('Error', 'Failed to delete tag');
            }
          }
        }
      ]
    );
  };

  const toggleComplete = (id, category) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update items');
      return;
    }

    // Don't await the Firebase updates - let them happen in the background
    // The onSnapshot listeners will update the UI when Firebase responds
    
    // First check for personal ideas (can be called without category from ideas tab)
    const personalIdea = personalIdeas.find(i => i.id === id);
    if (personalIdea || category === 'ideas') {
      if (personalIdea) {
        updateDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', id), {
          completed: !personalIdea.completed
        }).catch(error => {
          console.error('Error toggling personal idea:', error);
          Alert.alert('Error', 'Failed to update idea');
        });
        return;
      }
      // If category is 'ideas' but not found in personalIdeas, check household ideas
      if (householdId) {
        const idea = items.find(i => i.id === id && i.category === 'ideas');
        if (idea) {
          updateDoc(doc(db, 'households', householdId, 'items', id), {
            completed: !idea.completed
          }).catch(error => {
            console.error('Error toggling idea:', error);
            Alert.alert('Error', 'Failed to update idea');
          });
        }
      }
      return;
    }
    
      if (category === 'gift' || category === 'gifts') {
        const gift = giftIdeas.find(g => g.id === id);
        if (gift) {
        updateDoc(doc(db, 'users', currentUser.uid, 'giftIdeas', id), {
            completed: !gift.completed
        }).catch(error => {
          console.error('Error toggling gift:', error);
          Alert.alert('Error', 'Failed to update gift');
          });
        }
      } else if (category === 'personal') {
        const personalItem = personalItems.find(p => p.id === id);
        if (personalItem) {
        updateDoc(doc(db, 'users', currentUser.uid, 'personalList', id), {
            completed: !personalItem.completed
        }).catch(error => {
          console.error('Error toggling personal item:', error);
          Alert.alert('Error', 'Failed to update item');
          });
        }
      } else if (category === 'activities') {
        // Check if it's a personal activity
        const personalActivity = personalActivities.find(a => a.id === id);
        if (personalActivity) {
        updateDoc(doc(db, 'users', currentUser.uid, 'personalActivities', id), {
            completed: !personalActivity.completed
        }).catch(error => {
          console.error('Error toggling personal activity:', error);
          Alert.alert('Error', 'Failed to update activity');
          });
        } else {
          if (!householdId) return;
          const activity = activities.find(a => a.id === id);
          if (activity) {
          updateDoc(doc(db, 'households', householdId, 'activities', id), {
              completed: !activity.completed
          }).catch(error => {
            console.error('Error toggling activity:', error);
            Alert.alert('Error', 'Failed to update activity');
            });
          }
        }
      } else if (category === 'items') {
        // Check if it's a personal task
        const personalTask = personalTasks.find(t => t.id === id);
        if (personalTask) {
          // Fire firework immediately if marking as complete
          if (!personalTask.completed) {
            setShowFirework(true);
          }
          updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', id), {
            completed: !personalTask.completed
          }).catch(error => {
            console.error('Error toggling personal task:', error);
            Alert.alert('Error', 'Failed to update task');
          });
        } else {
          if (!householdId) return;
          const item = items.find(i => i.id === id);
          if (item) {
            // Fire firework immediately if marking as complete (but not for groceries)
            if (!item.completed && item.category !== 'groceries') {
              setShowFirework(true);
            }
            // Track lastCompleted for grocery items (for frequent items feature)
            const updateData = { completed: !item.completed };
            if (item.category === 'groceries' && !item.completed) {
              updateData.lastCompleted = new Date().toISOString();
            }
            updateDoc(doc(db, 'households', householdId, 'items', id), updateData).catch(error => {
              console.error('Error toggling item:', error);
              Alert.alert('Error', 'Failed to update item');
            });
          }
        }
      } else {
      // Default case - check personal items first, then household
      // Check personal tasks
      const personalTask = personalTasks.find(t => t.id === id);
      if (personalTask) {
        if (!personalTask.completed) {
          setShowFirework(true);
        }
        updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', id), {
          completed: !personalTask.completed
        }).catch(error => {
          console.error('Error toggling personal task:', error);
          Alert.alert('Error', 'Failed to update task');
        });
        return;
      }
      
        if (!householdId) return;
        const item = items.find(i => i.id === id);
        if (item) {
        // Fire firework immediately if marking as complete (but not for groceries)
        if (!item.completed && item.category !== 'groceries') {
          setShowFirework(true);
        }
        // Track lastCompleted for grocery items (for frequent items feature)
        const updateData = { completed: !item.completed };
        if (item.category === 'groceries' && !item.completed) {
          updateData.lastCompleted = new Date().toISOString();
        }
        updateDoc(doc(db, 'households', householdId, 'items', id), updateData).catch(error => {
          console.error('Error toggling item:', error);
          Alert.alert('Error', 'Failed to update item');
          });
        }
      }
  };

  const toggleIdeaFavorite = async (item) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const newFavorited = !item.favorited;

    if (item.isPersonal) {
      // Personal idea
      updateDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', item.id), {
        favorited: newFavorited
      }).catch(error => {
        console.error('Error toggling idea favorite:', error);
      });
    } else if (householdId) {
      // Household idea
      updateDoc(doc(db, 'households', householdId, 'items', item.id), {
        favorited: newFavorited
      }).catch(error => {
        console.error('Error toggling idea favorite:', error);
      });
    }
  };

  // Calculate distance between two coordinates in miles (Haversine formula)
  const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toggleVisited = async (id) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update items');
      return;
    }

    if (!householdId) return;

    const restaurant = items.find(i => i.id === id && i.category === 'restaurants');
    if (restaurant) {
      try {
        await updateDoc(doc(db, 'households', householdId, 'items', id), {
          visited: !restaurant.visited
        });
    } catch (error) {
        console.error('Error toggling visited status:', error);
        Alert.alert('Error', 'Failed to update visited status');
      }
    }
  };

  const toggleFavorite = async (id) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update items');
      return;
    }

    if (!householdId) return;

    const restaurant = items.find(i => i.id === id && i.category === 'restaurants');
    if (restaurant) {
      try {
        await updateDoc(doc(db, 'households', householdId, 'items', id), {
          favorited: !restaurant.favorited
        });
      } catch (error) {
        console.error('Error toggling favorite status:', error);
        Alert.alert('Error', 'Failed to update favorite status');
      }
    }
  };

  const toggleHappyHour = async (id) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to update items');
      return;
    }

    if (!householdId) return;

    const restaurant = items.find(i => i.id === id && i.category === 'restaurants');
    if (restaurant) {
      try {
        await updateDoc(doc(db, 'households', householdId, 'items', id), {
          happyHour: !restaurant.happyHour
        });
      } catch (error) {
        console.error('Error toggling happy hour status:', error);
        Alert.alert('Error', 'Failed to update happy hour status');
      }
    }
  };

  // Helper function to calculate progress percentage
  const getTaskProgress = (task) => {
    if (!task.subtasks || task.subtasks.length === 0) return null;
    const completed = task.subtasks.filter(st => st.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  };

  // Check if all subtasks are completed and auto-complete parent
  const checkAndAutoCompleteParent = async (task) => {
    if (!task.subtasks || task.subtasks.length === 0) return;
    const allCompleted = task.subtasks.every(st => st.completed);
    if (allCompleted && !task.completed) {
      // Auto-complete parent task
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      // Check if it's a personal task
      const personalTask = personalTasks.find(t => t.id === task.id);
      const householdTask = items.find(t => t.id === task.id);
      
      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', task.id), {
          completed: true
        }).catch(error => {
          console.error('Error auto-completing task:', error);
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) return;
        await updateDoc(doc(db, 'households', householdId, 'items', task.id), {
          completed: true
        }).catch(error => {
          console.error('Error auto-completing task:', error);
        });
      }
    }
  };

  // Add subtask
  const addSubtask = async (taskId, title) => {
    if (!title.trim()) return;
    
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check personal tasks first, then household items
    const personalTask = personalTasks.find(t => t.id === taskId);
    const householdTask = items.find(t => t.id === taskId);
    const task = personalTask || householdTask;
    
    if (!task) {
      console.error('Task not found:', taskId);
      Alert.alert('Error', 'Task not found');
      return;
    }

    const newSubtask = {
      id: Date.now().toString(),
      title: title.trim(),
      completed: false,
      order: (task.subtasks || []).length
    };

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];

    try {
      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', taskId), {
          subtasks: updatedSubtasks
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) {
          Alert.alert('Error', 'Household not found');
          return;
        }
        await updateDoc(doc(db, 'households', householdId, 'items', taskId), {
          subtasks: updatedSubtasks
        });
      }
      setNewSubtaskTitle('');
    } catch (error) {
      console.error('Error adding subtask:', error);
      Alert.alert('Error', `Failed to add subtask: ${error.message}`);
    }
  };

  // Update subtask
  const updateSubtask = async (taskId, subtaskId, updates) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check personal tasks first, then household items
    const personalTask = personalTasks.find(t => t.id === taskId);
    const householdTask = items.find(t => t.id === taskId);
    const task = personalTask || householdTask;
    
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, ...updates } : st
    );

    try {
      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', taskId), {
          subtasks: updatedSubtasks
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) return;
        await updateDoc(doc(db, 'households', householdId, 'items', taskId), {
          subtasks: updatedSubtasks
        });
      }

      // Check if all subtasks are completed
      const updatedTask = { ...task, subtasks: updatedSubtasks };
      await checkAndAutoCompleteParent(updatedTask);
    } catch (error) {
      console.error('Error updating subtask:', error);
      Alert.alert('Error', 'Failed to update subtask');
    }
  };

  // Delete subtask
  const deleteSubtask = async (taskId, subtaskId) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check personal tasks first, then household items
    const personalTask = personalTasks.find(t => t.id === taskId);
    const householdTask = items.find(t => t.id === taskId);
    const task = personalTask || householdTask;
    
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);

    try {
      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', taskId), {
          subtasks: updatedSubtasks
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) return;
        await updateDoc(doc(db, 'households', householdId, 'items', taskId), {
          subtasks: updatedSubtasks
        });
      }
    } catch (error) {
      console.error('Error deleting subtask:', error);
      Alert.alert('Error', 'Failed to delete subtask');
    }
  };

  // Toggle subtask completion
  const toggleSubtaskComplete = async (taskId, subtaskId) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Check personal tasks first, then household items
    const personalTask = personalTasks.find(t => t.id === taskId);
    const householdTask = items.find(t => t.id === taskId);
    const task = personalTask || householdTask;
    
    if (!task || !task.subtasks) return;

    const subtask = task.subtasks.find(st => st.id === subtaskId);
    if (!subtask) return;

    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    try {
      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', taskId), {
          subtasks: updatedSubtasks
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) return;
        await updateDoc(doc(db, 'households', householdId, 'items', taskId), {
          subtasks: updatedSubtasks
        });
      }

      // Check if all subtasks are completed
      const updatedTask = { ...task, subtasks: updatedSubtasks };
      await checkAndAutoCompleteParent(updatedTask);
    } catch (error) {
      console.error('Error toggling subtask:', error);
      Alert.alert('Error', 'Failed to update subtask');
    }
  };

  // Reorder subtasks
  const reorderSubtasks = async (taskId, newSubtasks) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      // Check personal tasks first, then household items
      const personalTask = personalTasks.find(t => t.id === taskId);
      const householdTask = items.find(t => t.id === taskId);
      const task = personalTask || householdTask;
      
      if (!task) return;

      if (personalTask) {
        // It's a personal task
        await updateDoc(doc(db, 'users', currentUser.uid, 'personalTasks', taskId), {
          subtasks: newSubtasks
        });
      } else if (householdTask) {
        // It's a household task
        if (!householdId) return;
        await updateDoc(doc(db, 'households', householdId, 'items', taskId), {
          subtasks: newSubtasks
        });
      }
    } catch (error) {
      console.error('Error reordering subtasks:', error);
      Alert.alert('Error', 'Failed to reorder subtasks');
    }
  };

  // Circular Progress Component Helper
  const CircularProgress = ({ percentage, size = 32 }) => {
    const progressColor = percentage === 100 ? '#10B981' : '#3B82F6';
    const strokeWidth = 3;
    
    return (
      <View style={[styles.progressCircleContainer, { width: size, height: size }]}>
        <View style={[styles.progressCircleBackground, { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: '#e5e7eb',
        }]} />
        <View style={[styles.progressCircleFill, {
          width: size - strokeWidth * 2,
          height: size - strokeWidth * 2,
          borderRadius: (size - strokeWidth * 2) / 2,
          backgroundColor: progressColor,
          opacity: percentage / 100,
        }]} />
        <View style={styles.progressCircleText}>
          <Text style={[styles.progressCircleTextValue, { color: progressColor }]}>{percentage}%</Text>
        </View>
      </View>
    );
  };

  const getFilteredItems = () => {
    // Include personal tasks when on todo tab
    let filtered = [...items];
    if (activeTab === 'todo' && (todoFilter === 'all' || todoFilter === 'tasks')) {
      // Add personal tasks, marking them with isPersonal flag and category
      const personalTasksList = personalTasks.map(task => ({ ...task, category: 'todo', isPersonal: true }));
      filtered = [...filtered, ...personalTasksList];
    }
    
    // Include personal ideas when on ideas tab
    if (activeTab === 'ideas') {
      // Add personal ideas with category and isPersonal flag
      const personalIdeasList = personalIdeas.map(idea => ({ ...idea, category: 'ideas', isPersonal: true }));
      filtered = [...filtered, ...personalIdeasList];
    }
  
    // Filter by active tab
    if (activeTab !== 'all') {
      if (activeTab === 'food') {
        // Food tab includes both 'food' and 'restaurants' categories
        filtered = filtered.filter(item => item.category === 'food' || item.category === 'restaurants');
      } else {
        filtered = filtered.filter(item => item.category === activeTab);
      }
    }
  
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // For ideas tab, apply filter and sort
    if (activeTab === 'ideas') {
      // Apply personal/household filter
      if (ideaFilter === 'household') {
        filtered = filtered.filter(item => !item.isPersonal);
      } else if (ideaFilter === 'personal') {
        filtered = filtered.filter(item => item.isPersonal);
      }

      // Apply tag filter (if any tags are selected, show ideas that have ANY of the selected tags)
      if (selectedTagFilters.length > 0) {
        filtered = filtered.filter(item => {
          const itemTags = item.tagIds || [];
          return selectedTagFilters.some(tagId => itemTags.includes(tagId));
        });
      }

      // Apply sorting
      if (ideaSortMode === 'recent') {
        filtered = filtered.sort((a, b) => {
          // Favorited first, then by createdAt descending
          if (a.favorited && !b.favorited) return -1;
          if (!a.favorited && b.favorited) return 1;
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
      } else if (ideaSortMode === 'oldest') {
        filtered = filtered.sort((a, b) => {
          // Favorited first, then by createdAt ascending
          if (a.favorited && !b.favorited) return -1;
          if (!a.favorited && b.favorited) return 1;
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateA - dateB;
        });
      } else if (ideaSortMode === 'grouped') {
        // Sort by first tag, then by createdAt
        filtered = filtered.sort((a, b) => {
          if (a.favorited && !b.favorited) return -1;
          if (!a.favorited && b.favorited) return 1;
          const tagA = (a.tagIds && a.tagIds[0]) || 'zzz'; // Items without tags go last
          const tagB = (b.tagIds && b.tagIds[0]) || 'zzz';
          if (tagA !== tagB) return tagA.localeCompare(tagB);
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
      }
    }
  
    // For todo tab, apply filter
    if (activeTab === 'todo') {
      if (todoFilter === 'tasks') {
        filtered = filtered.filter(item => item.category === 'todo' || item.isPersonal);
      } else if (todoFilter === 'activities') {
        filtered = []; // Activities come from separate collection, handled below
      }
    }
  
    return filtered;
  };
  
  const getFilteredActivities = () => {
    // Allow activities for 'all' tab or 'todo' tab (when not filtering to tasks only)
    if (activeTab !== 'todo' && activeTab !== 'all') return [];
    if (activeTab === 'todo' && todoFilter === 'tasks') return [];
    
    // Include both household and personal activities
    let filtered = [...activities];
    const personalActivitiesList = personalActivities.map(activity => ({ ...activity, isPersonal: true }));
    filtered = [...filtered, ...personalActivitiesList];
    
    if (searchQuery) {
      filtered = filtered.filter(activity =>
        activity.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getCategoryIcon = (category) => {
    const iconProps = { size: 16, color: '#fff' };
    switch(category) {
      case 'restaurants': return <Utensils {...iconProps} />;
      case 'ideas': return <Lightbulb {...iconProps} />;
      case 'groceries': return <List {...iconProps} />;
      case 'todo': return <Check {...iconProps} />;
      default: return <List {...iconProps} />;
    }
  };

  const handleAddClick = () => {
    if (showGroceryQuickActions) {
      setShowGroceryQuickActions(false);
    }

    // Handle Food tab separately - recipes have their own form
    if (activeTab === 'food') {
      if (foodViewMode === 'recipes') {
        handleOpenRecipeForm();
        return;
      } else {
        // Restaurants use the standard add form
        setNewItem({
          title: '',
          notes: '',
          address: '',
          cuisine: '',
          priceRange: '',
          dueDate: '',
          date: '',
          time: '',
          activityCategory: '',
          person: '',
          occasion: '',
          budget: '',
          activityAddress: '',
          activityLatitude: null,
          activityLongitude: null,
          latitude: null,
          longitude: null,
          link: '',
          priority: 'medium',
          price: '',
          reminderTime: '1 hour before',
          placeId: '',
        });
        setIsEditMode(false);
        setEditingItem(null);
        setAddItemType('restaurants');
        setShowAddressSuggestions(false);
        setAddressSuggestions([]);
        setShowAddForm(true);
        return;
      }
    }

    let type = activeTab;
    if (activeTab === 'all') type = 'ideas';
    if (activeTab === 'todo') type = 'todo';
    if (activeTab === 'calendar') type = 'activities';
    if (activeTab === 'gifts') type = giftViewMode === 'personal' ? 'wishlist' : 'gifts';
    if (activeTab === 'groceries') type = shopMode === 'other' ? 'otherShop' : 'groceries';

    const defaultPerson = type === 'gifts' && selectedPerson ? selectedPerson : '';
    
    // Clear all fields for new item
    setNewItem({
      title: '',
      notes: '',
      address: '',
      cuisine: '',
      priceRange: '',
      dueDate: '',
      date: '',
      time: '',
      activityCategory: '',
      person: defaultPerson,
      occasion: '',
      budget: '',
      activityAddress: '',
      activityLatitude: null,
      activityLongitude: null,
      link: '',
      priority: 'medium',
      price: '',
      reminderTime: '1 hour before',
      placeId: '',
    });
    setIsEditMode(false);
    setEditingItem(null);
    setAddItemType(type);
    if (type === 'ideas') setIdeaScope('personal');
    if (type === 'todo') {
      setTaskScope('personal');
      setActivityScope('personal');
      setTodoItemType('task');
    }
    // Clear address suggestions when opening form
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
    setShowAddForm(true);
  };

  // Voice recording functions for Ideas tab
  // Event listener subscriptions stored for cleanup
  const speechListenersRef = useRef([]);

  const cleanupSpeechListeners = () => {
    speechListenersRef.current.forEach(sub => {
      if (sub && typeof sub.remove === 'function') {
        sub.remove();
      }
    });
    speechListenersRef.current = [];
  };

  const startVoiceRecording = async () => {
    // Lazy load the speech recognition module
    if (!ExpoSpeechRecognitionModule) {
      try {
        const speechModule = null; // require('expo-speech-recognition'); DISABLED
        if (speechModule?.ExpoSpeechRecognitionModule) {
          ExpoSpeechRecognitionModule = speechModule.ExpoSpeechRecognitionModule;
          speechRecognitionAvailable = true;
        }
      } catch (e) {
        console.log('Failed to load speech recognition:', e.message);
      }
    }

    if (!ExpoSpeechRecognitionModule) {
      Alert.alert('Not Available', 'Speech recognition is not available on this device. Please make sure Siri & Dictation are enabled in Settings.');
      return;
    }

    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Please grant microphone and speech recognition permissions to use voice input.');
        return;
      }

      setIsVoiceRecording(true);
      setVoiceTranscript('');
      voiceTranscriptRef.current = '';
      shouldProcessVoiceRef.current = true;

      // Clean up any existing listeners
      cleanupSpeechListeners();

      // Set up event listeners using addListener
      const resultSub = ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const transcript = event.results[0]?.transcript || '';
        setVoiceTranscript(transcript);
        voiceTranscriptRef.current = transcript;
      });

      const endSub = ExpoSpeechRecognitionModule.addListener('end', () => {
        if (shouldProcessVoiceRef.current) {
          shouldProcessVoiceRef.current = false;
          pulseAnim.stopAnimation();
          pulseAnim.setValue(1);
          setIsVoiceRecording(false);

          const finalTranscript = voiceTranscriptRef.current.trim();
          if (finalTranscript) {
            setNewItem({
              title: finalTranscript,
              notes: '',
              address: '',
              cuisine: '',
              priceRange: '',
              dueDate: '',
              date: '',
              time: '',
              activityCategory: '',
              person: '',
              occasion: '',
              budget: '',
              activityAddress: '',
              activityLatitude: null,
              activityLongitude: null,
              link: '',
              priority: 'medium',
              price: '',
              reminderTime: '1 hour before',
              placeId: '',
              tagIds: [],
            });
            setIsEditMode(false);
            setEditingItem(null);
            setAddItemType('ideas');
            setIdeaScope('personal');
            setShowAddressSuggestions(false);
            setAddressSuggestions([]);
            setShowAddForm(true);
          }
          setVoiceTranscript('');
          voiceTranscriptRef.current = '';
          cleanupSpeechListeners();
        }
      });

      const errorSub = ExpoSpeechRecognitionModule.addListener('error', (event) => {
        console.error('Speech recognition error:', event.error);
        pulseAnim.stopAnimation();
        pulseAnim.setValue(1);
        setIsVoiceRecording(false);
        setVoiceTranscript('');
        if (event.error !== 'no-speech') {
          Alert.alert('Error', 'Speech recognition failed. Please try again.');
        }
        cleanupSpeechListeners();
      });

      speechListenersRef.current = [resultSub, endSub, errorSub];

      // Start pulsing animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch (error) {
      console.error('Error starting voice recording:', error);
      Alert.alert('Error', 'Failed to start voice recording. Please try again.');
      setIsVoiceRecording(false);
      cleanupSpeechListeners();
    }
  };

  const stopVoiceRecording = () => {
    if (ExpoSpeechRecognitionModule) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        console.log('Error stopping speech recognition:', e);
      }
    }
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setIsVoiceRecording(false);
    cleanupSpeechListeners();
  };

  const handleReorderItems = async (data) => {
    // Update local state immediately
    setItems(data);
    
    // Update order in Firebase
    try {
      const batch = [];
      data.forEach((item, index) => {
        if (item.id) {
          batch.push(
            updateDoc(doc(db, 'households', householdId, 'items', item.id), {
              order: index
            })
          );
        }
      });
      await Promise.all(batch);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleReorderActivities = async (data) => {
    // Update local state immediately
    setActivities(data);
    
    // Update order in Firebase
    try {
      const batch = [];
      data.forEach((activity, index) => {
        if (activity.id) {
          batch.push(
            updateDoc(doc(db, 'households', householdId, 'activities', activity.id), {
              order: index
            })
          );
        }
      });
      await Promise.all(batch);
    } catch (error) {
      console.error('Error updating activity order:', error);
    }
  };

  // Grocery category inference - smart categorization from item title
  const inferGrocerySubcategory = (title) => {
    if (!title) return 'other';
    const t = title.toLowerCase();

    // Produce - fruits and vegetables
    if (/\b(apple|banana|orange|lemon|lime|grape|berry|berries|strawberr|blueberr|raspberr|melon|watermelon|cantaloupe|peach|pear|plum|mango|pineapple|kiwi|avocado|tomato|lettuce|spinach|kale|arugula|cabbage|broccoli|cauliflower|carrot|celery|cucumber|pepper|onion|garlic|potato|sweet potato|corn|pea|bean|green bean|zucchini|squash|eggplant|mushroom|asparagus|artichoke|beet|radish|turnip|parsnip|leek|scallion|shallot|ginger|cilantro|parsley|basil|mint|dill|rosemary|thyme|oregano|salad|fruit|vegetable|veggie|produce)\b/.test(t)) {
      return 'produce';
    }
    // Dairy (note: ice cream is in frozen, not dairy)
    if (/\b(milk|cheese|yogurt|butter|cream|sour cream|cottage cheese|cream cheese|egg|eggs|half and half|whipping cream|dairy)\b/.test(t)) {
      return 'dairy';
    }
    // Meat & Seafood
    if (/\b(chicken|beef|pork|steak|ground beef|ground turkey|turkey|lamb|veal|bacon|sausage|ham|hot dog|deli|salami|pepperoni|fish|salmon|tuna|shrimp|crab|lobster|scallop|tilapia|cod|halibut|seafood|meat)\b/.test(t)) {
      return 'meat';
    }
    // Bakery
    if (/\b(bread|bagel|muffin|croissant|donut|doughnut|cake|cookie|pastry|pie|roll|bun|tortilla|pita|naan|baguette|sourdough|brioche|bakery)\b/.test(t)) {
      return 'bakery';
    }
    // Frozen
    if (/\b(frozen|ice cream|popsicle|frozen pizza|frozen dinner|frozen vegetable|frozen fruit|tv dinner)\b/.test(t)) {
      return 'frozen';
    }
    // Beverages
    if (/\b(water|juice|soda|pop|cola|coffee|tea|beer|wine|liquor|vodka|whiskey|rum|gin|champagne|sparkling|energy drink|gatorade|lemonade|smoothie|drink|beverage)\b/.test(t)) {
      return 'beverages';
    }
    // Household
    if (/\b(paper towel|toilet paper|tissue|napkin|soap|dish soap|laundry|detergent|bleach|cleaner|wipe|sponge|trash bag|garbage bag|foil|aluminum foil|plastic wrap|saran|ziploc|bag|light bulb|battery|candle|air freshener|household)\b/.test(t)) {
      return 'household';
    }
    // Pantry (canned goods, dry goods, condiments)
    if (/\b(pasta|noodle|rice|flour|sugar|salt|pepper|spice|oil|olive oil|vegetable oil|vinegar|soy sauce|ketchup|mustard|mayo|mayonnaise|sauce|salsa|dressing|cereal|oatmeal|granola|cracker|chip|pretzel|popcorn|nut|almond|peanut|cashew|can|canned|soup|broth|stock|bean|lentil|chickpea|tuna|jam|jelly|honey|syrup|peanut butter|nutella|cocoa|chocolate|baking|yeast|baking powder|baking soda|vanilla|extract)\b/.test(t)) {
      return 'pantry';
    }

    return 'other';
  };

  const getGrocerySubcategory = (item) => {
    // Use stored subcategory if exists, otherwise infer from title
    if (!item) return 'other';
    return item.subcategory || inferGrocerySubcategory(item.title);
  };

  const handleReorderCategory = async (category, data) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('User not authenticated');
      return;
    }

    // Update local state immediately (replaces items with reordered subset to match existing pattern)
    if (category === 'ideas') {
      // For ideas, update the appropriate state based on whether items are personal or household
      const householdIdeas = data.filter(item => !item.isPersonal);
      
      // Update items state with household ideas
      setItems(householdIdeas);
      
      // Don't update personalIdeas state here - let Firebase listener update it
    } else {
    setItems(data);
    }

    try {
      const batch = [];
      
      if (category === 'ideas') {
        // Separate personal and household ideas and reindex separately
        const householdIdeas = data.filter(item => !item.isPersonal);
        const personalIdeas = data.filter(item => item.isPersonal);
        
        // Update household ideas with their own indices
        householdIdeas.forEach((item, index) => {
          if (item.id && householdId) {
            batch.push(
              updateDoc(doc(db, 'households', householdId, 'items', item.id), {
                order: index,
              })
            );
          }
        });
        
        // Update personal ideas with their own indices
        personalIdeas.forEach((item, index) => {
          if (item.id) {
            batch.push(
              updateDoc(doc(db, 'users', currentUser.uid, 'personalIdeas', item.id), {
                order: index,
              })
            );
          }
        });
      } else {
        // For other categories, just use the provided order
      data.forEach((item, index) => {
        if (item.id) {
            if (!householdId) {
              console.error('No household found for household item');
              return;
            }
          batch.push(
            updateDoc(doc(db, 'households', householdId, 'items', item.id), {
              order: index,
            })
          );
        }
      });
      }
      
      await Promise.all(batch);
    } catch (error) {
      console.error('Error updating category order:', error);
    }
  };

  const formatDate = (dateString) => {
    // Parse date string as local date to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDateChange = (event, selectedDate) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    if (event?.type === 'set' && selectedTime) {
      setTempDate(selectedTime);
    } else if (event?.type === 'dismissed') {
      setShowTimePicker(false);
    }
  };

  const openDatePicker = (fieldType) => {
    // Dismiss keyboard first so picker is visible
    Keyboard.dismiss();

    setDateFieldType(fieldType);

    // Helper to parse date string as local date
    const parseLocalDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const currentDate = fieldType === 'activityDate' && newItem.date
      ? parseLocalDate(newItem.date)
      : fieldType === 'activityEndDate' && newItem.endDate
      ? parseLocalDate(newItem.endDate)
      : fieldType === 'dueDate' && newItem.dueDate
      ? parseLocalDate(newItem.dueDate)
      : new Date();
    setTempDate(currentDate);
    setShowDatePicker(true);
  };

  const openTimePicker = () => {
    // Dismiss keyboard first so picker is visible
    Keyboard.dismiss();

    const now = new Date();
    if (newItem.time) {
      const [hours, minutes] = newItem.time.split(':');
      now.setHours(parseInt(hours) || 0, parseInt(minutes) || 0);
    }
    setTempDate(now);
    setShowTimePicker(true);
  };

  const openReminderPicker = () => {
    setShowReminderPicker(true);
  };

  const searchAddress = async (query) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    setIsSearchingAddress(true);
    try {
      // REPLACE 'YOUR_GOOGLE_API_KEY' WITH YOUR ACTUAL API KEY
      const GOOGLE_API_KEY = 'AIzaSyDRmth4yf8fFc2Mplcm0RFmN4qsGzAf44M';
      
      console.log('Searching for:', query);
      
      // Check if API key is set
      if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
        console.error('Google API key not set! Please add your API key.');
        Alert.alert('API Key Missing', 'Please add your Google Places API key to the code.');
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setIsSearchingAddress(false);
        return;
      }
      
      // Using Google Places Autocomplete API - restricted to US only
      const autocompleteUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:us&key=${GOOGLE_API_KEY}`;
      
      console.log('Fetching from Google Places...');
      const response = await fetch(autocompleteUrl);
      const data = await response.json();
      
      console.log('Google Places response:', data.status);
      
      if (data.status === 'REQUEST_DENIED') {
        console.error('API Key Error:', data.error_message);
        Alert.alert('API Error', data.error_message || 'Please check your API key and ensure Places API is enabled.');
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
        setIsSearchingAddress(false);
        return;
      }
      
      if (data.status === 'OK' && data.predictions && data.predictions.length > 0) {
        console.log('Found predictions:', data.predictions.length);
        
        // For each prediction, get the place details to retrieve coordinates
        // Store place_id so we can fetch full details when selected
        const suggestionsPromises = data.predictions.slice(0, 5).map(async (prediction) => {
          try {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry,formatted_address,name&key=${GOOGLE_API_KEY}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            if (detailsData.status === 'OK' && detailsData.result && detailsData.result.geometry) {
              // Extract restaurant name from prediction (main_text is the primary name)
              const placeName = detailsData.result.name ||
                               prediction.structured_formatting?.main_text ||
                               prediction.description.split(',')[0];

              // Use formatted_address from details (includes street number)
              // Fall back to prediction.description if not available
              const fullAddress = detailsData.result.formatted_address || prediction.description;

              // Display name combines place name + address (e.g., "The White House, 1600 Pennsylvania Ave...")
              const displayName = placeName ? `${placeName}, ${fullAddress}` : fullAddress;

              return {
                name: displayName, // Place name + address for display in autocomplete
                fullAddress: fullAddress, // Full address with street number for saving/maps
                placeName: placeName, // Restaurant name only
                placeId: prediction.place_id,
                latitude: detailsData.result.geometry.location.lat,
                longitude: detailsData.result.geometry.location.lng
              };
            }
            return null;
          } catch (error) {
            console.error('Error fetching place details:', error);
            return null;
          }
        });
        
        const suggestions = (await Promise.all(suggestionsPromises)).filter(s => s !== null);
        console.log('Final suggestions:', suggestions.length);
        setAddressSuggestions(suggestions);
        setShowAddressSuggestions(suggestions.length > 0);
      } else {
        console.log('No predictions found');
        setAddressSuggestions([]);
        setShowAddressSuggestions(false);
      }
    } catch (error) {
      console.error('Address search error:', error);
      Alert.alert('Search Error', 'Unable to search addresses. Check console for details.');
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleAddressSelect = async (suggestion, isActivity = false) => {
    const GOOGLE_API_KEY = 'AIzaSyDRmth4yf8fFc2Mplcm0RFmN4qsGzAf44M';
    
    // If this is for a restaurant (not activity), fetch full place details to get cuisine and price
    let restaurantName = suggestion.placeName || suggestion.name.split(',')[0];
    let cuisine = '';
    let priceRange = '';
    
    if (!isActivity && suggestion.placeId) {
      try {
        // Fetch full place details including types, price_level, and editorial_summary (might contain cuisine info)
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.placeId}&fields=name,types,price_level,formatted_address,editorial_summary&key=${GOOGLE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        const detailsData = await detailsResponse.json();
        
        if (detailsData.status === 'OK' && detailsData.result) {
          // Get restaurant name
          restaurantName = detailsData.result.name || restaurantName;
          
          // PRIORITY 1: Extract cuisine from text before "Restaurant" in name or description
          // This matches what Google Maps shows (e.g., "Mexican Restaurant", "New American Restaurant")
          // List of valid cuisine types - only extract if it matches one of these
          const validCuisines = [
            'american', 'new american', 'continental american',
            'italian', 'mexican', 'chinese', 'japanese', 'indian', 'thai',
            'korean', 'vietnamese', 'french', 'greek', 'spanish', 'german',
            'turkish', 'brazilian', 'moroccan', 'lebanese', 'ethiopian',
            'mediterranean', 'middle eastern', 'asian', 'latin american',
            'tex-mex', 'tex mex', 'southern', 'cajun', 'creole',
            'seafood', 'sushi', 'steakhouse', 'bbq', 'barbecue',
            'pizza', 'bakery', 'cafe', 'deli', 'sandwich'
          ];
          
          // Descriptive words to ignore when extracting
          const ignoreWords = [
            'authentic', 'traditional', 'fine', 'casual', 'upscale', 'family',
            'style', 'style', 'fresh', 'gourmet', 'fusion', 'modern', 'classic',
            'famous', 'popular', 'local', 'regional', 'contemporary', 'upmarket',
            'a', 'an', 'the', 'best', 'great', 'top', 'premium', 'exclusive'
          ];
          
          const extractCuisineFromText = (text) => {
            if (!text) return null;
            
            // Look for patterns like "X Restaurant", "X Restaurant & Bar", etc.
            const restaurantPattern = /\b(.+?)\s+restaurant\b/i;
            const match = text.match(restaurantPattern);
            
            if (match && match[1]) {
              let cuisineText = match[1].trim().toLowerCase();
              
              // Split into words and filter out descriptive words
              const words = cuisineText.split(/\s+/);
              const filteredWords = words.filter(word => {
                const cleanWord = word.replace(/[^a-z-]/g, '');
                return cleanWord.length > 0 && !ignoreWords.includes(cleanWord);
              });
              
              // ONLY take the LAST 3 words maximum before "Restaurant"
              // This prevents grabbing long descriptions
              const candidateWords = filteredWords.slice(-3); // Take last 3 words max
              
              // Try combinations starting from longest (3 words) down to 1 word
              for (let i = Math.min(3, candidateWords.length); i >= 1; i--) {
                const combo = candidateWords.slice(-i).join(' ');
                if (validCuisines.includes(combo)) {
                  return capitalizeCuisine(combo);
                }
              }
              
              // Try each word individually (from the last few words only)
              for (const word of candidateWords) {
                const cleanWord = word.replace(/[^a-z-]/g, '');
                if (validCuisines.includes(cleanWord)) {
                  return capitalizeCuisine(cleanWord);
                }
              }
            }
            return null;
          };
          
          // Helper function to capitalize cuisine properly
          const capitalizeCuisine = (cuisine) => {
            // Handle special cases like "New American", "Tex-Mex"
            if (cuisine.includes('-')) {
              return cuisine.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('-');
            }
            if (cuisine.includes(' ')) {
              return cuisine.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            }
            return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
          };
          
          // Helper function to extract cuisine directly from restaurant name
          // Checks if any words in the name match valid cuisine types
          const extractCuisineFromName = (name) => {
            if (!name) return null;
            
            const nameLower = name.toLowerCase();
            const words = nameLower.split(/\s+/);
            
            // Try to find cuisine matches in the name
            // Check multi-word cuisines first (like "New American", "Tex-Mex")
            for (let i = words.length; i >= 1; i--) {
              for (let j = 0; j <= words.length - i; j++) {
                const combo = words.slice(j, j + i).join(' ');
                const cleanCombo = combo.replace(/[^a-z\s-]/g, '').trim();
                
                // Try exact match
                if (validCuisines.includes(cleanCombo)) {
                  return capitalizeCuisine(cleanCombo);
                }
                
                // Try with hyphen variations (e.g., "tex mex" vs "tex-mex")
                const hyphenCombo = cleanCombo.replace(/\s+/g, '-');
                if (validCuisines.includes(hyphenCombo)) {
                  return capitalizeCuisine(hyphenCombo);
                }
              }
            }
            
            // Check individual words
            for (const word of words) {
              const cleanWord = word.replace(/[^a-z-]/g, '');
              if (validCuisines.includes(cleanWord)) {
                return capitalizeCuisine(cleanWord);
              }
            }
            
            return null;
          };
          
          // PRIORITY 1: Try extracting from "X Restaurant" pattern
          cuisine = extractCuisineFromText(restaurantName);
          
          // PRIORITY 2: If no pattern match, try extracting cuisine directly from name
          // This handles cases like "Das Ethiopian", "Mama's Italian", etc.
          if (!cuisine) {
            cuisine = extractCuisineFromName(restaurantName);
          }
          
          // PRIORITY 3: Try from suggestion name (autocomplete result)
          if (!cuisine) {
            cuisine = extractCuisineFromText(suggestion.name);
            if (!cuisine) {
              cuisine = extractCuisineFromName(suggestion.name);
            }
          }
          
          // Don't check formatted_address or editorial_summary - they often have descriptions, not cuisine
          
          // Extract cuisine from types (restaurant types like "restaurant", "food", "meal_takeaway", etc.)
          const types = detailsData.result.types || [];
          
          // Comprehensive cuisine mapping - check for both exact matches and partial matches
          const cuisineMap = {
            // Exact matches
            'italian_restaurant': 'Italian',
            'chinese_restaurant': 'Chinese',
            'mexican_restaurant': 'Mexican',
            'japanese_restaurant': 'Japanese',
            'indian_restaurant': 'Indian',
            'thai_restaurant': 'Thai',
            'american_restaurant': 'American',
            'pizza_restaurant': 'Pizza',
            'seafood_restaurant': 'Seafood',
            'steak_house': 'Steakhouse',
            'french_restaurant': 'French',
            'greek_restaurant': 'Greek',
            'mediterranean_restaurant': 'Mediterranean',
            'sushi_restaurant': 'Sushi',
            'korean_restaurant': 'Korean',
            'vietnamese_restaurant': 'Vietnamese',
            'spanish_restaurant': 'Spanish',
            'german_restaurant': 'German',
            'turkish_restaurant': 'Turkish',
            'brazilian_restaurant': 'Brazilian',
            'moroccan_restaurant': 'Moroccan',
            'lebanese_restaurant': 'Lebanese',
            'ethiopian_restaurant': 'Ethiopian',
            'middle_eastern_restaurant': 'Middle Eastern',
            'asian_restaurant': 'Asian',
            'latin_american_restaurant': 'Latin American',
            'cafe': 'Cafe',
            'bakery': 'Bakery',
            'bar': 'Bar',
            'pub': 'Pub',
            'fast_food_restaurant': 'Fast Food',
            'bbq_restaurant': 'BBQ',
            'southern_restaurant': 'Southern',
            'tex_mex_restaurant': 'Tex-Mex',
          };
          
          // PRIORITY 2: Try exact matches from types array
          if (!cuisine) {
            for (const type of types) {
              if (cuisineMap[type]) {
                cuisine = cuisineMap[type];
                break;
              }
            }
          }
          
          // PRIORITY 3: Try partial matches (type contains cuisine keyword)
          if (!cuisine) {
            const cuisineKeywords = {
              'italian': 'Italian',
              'chinese': 'Chinese',
              'mexican': 'Mexican',
              'japanese': 'Japanese',
              'indian': 'Indian',
              'thai': 'Thai',
              'american': 'American',
              'pizza': 'Pizza',
              'seafood': 'Seafood',
              'steak': 'Steakhouse',
              'french': 'French',
              'greek': 'Greek',
              'mediterranean': 'Mediterranean',
              'sushi': 'Sushi',
              'korean': 'Korean',
              'vietnamese': 'Vietnamese',
              'spanish': 'Spanish',
              'german': 'German',
              'turkish': 'Turkish',
              'brazilian': 'Brazilian',
              'moroccan': 'Moroccan',
              'lebanese': 'Lebanese',
              'ethiopian': 'Ethiopian',
              'middle_eastern': 'Middle Eastern',
              'asian': 'Asian',
              'latin': 'Latin American',
              'bbq': 'BBQ',
              'barbecue': 'BBQ',
              'southern': 'Southern',
              'tex': 'Tex-Mex',
            };
            
            for (const type of types) {
              for (const [keyword, cuisineName] of Object.entries(cuisineKeywords)) {
                if (type.toLowerCase().includes(keyword)) {
                  cuisine = cuisineName;
                  break;
                }
              }
              if (cuisine) break;
            }
          }
          
          // PRIORITY 4: Try keyword matching in restaurant name as fallback
          if (!cuisine) {
            const nameLower = restaurantName.toLowerCase();
            const nameCuisineMap = {
              'pizza': 'Pizza',
              'italian': 'Italian',
              'china': 'Chinese',
              'chinese': 'Chinese',
              'mexican': 'Mexican',
              'japanese': 'Japanese',
              'sushi': 'Sushi',
              'thai': 'Thai',
              'indian': 'Indian',
              'korean': 'Korean',
              'vietnamese': 'Vietnamese',
              'french': 'French',
              'greek': 'Greek',
              'mediterranean': 'Mediterranean',
              'seafood': 'Seafood',
              'steak': 'Steakhouse',
              'bbq': 'BBQ',
              'barbecue': 'BBQ',
            };
            
            for (const [keyword, cuisineName] of Object.entries(nameCuisineMap)) {
              if (nameLower.includes(keyword)) {
                cuisine = cuisineName;
                break;
              }
            }
          }
          
          // If still no cuisine, leave it empty (don't default to "Restaurant")
          // User can fill it in manually
          
          // Map price_level to price range
          // price_level: 0 = Free, 1 = Inexpensive, 2 = Moderate, 3 = Expensive, 4 = Very Expensive
          const priceLevel = detailsData.result.price_level;
          if (priceLevel !== undefined) {
            const priceMap = {
              0: 'Free',
              1: '$',
              2: '$$',
              3: '$$$',
              4: '$$$$'
            };
            priceRange = priceMap[priceLevel] || '';
          }
        }
      } catch (error) {
        console.error('Error fetching restaurant details:', error);
        // Continue with basic info if details fetch fails
      }
    }
    
    if (isActivity) {
      setNewItem({
        ...newItem,
        activityAddress: suggestion.fullAddress || suggestion.name,
        activityLatitude: suggestion.latitude,
        activityLongitude: suggestion.longitude
      });
    } else {
      // For restaurants, auto-fill title, cuisine, and price range
      setNewItem({
        ...newItem,
        title: restaurantName,
        address: suggestion.fullAddress || suggestion.name,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        cuisine: cuisine,
        priceRange: priceRange,
        placeId: suggestion.placeId || ''
      });
    }
    setShowAddressSuggestions(false);
    setAddressSuggestions([]);
  };

  const fetchRestaurantDetails = async (restaurant) => {
    const GOOGLE_API_KEY = 'AIzaSyDRmth4yf8fFc2Mplcm0RFmN4qsGzAf44M';
    setLoadingRestaurantDetails(true);
    
    try {
      let placeId = restaurant.placeId;
      
      // If no placeId stored, search for the restaurant by name and address
      if (!placeId && restaurant.title && restaurant.location) {
        const searchQuery = `${restaurant.title} ${restaurant.location.address}`;
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`;
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (searchData.status === 'OK' && searchData.results && searchData.results.length > 0) {
          placeId = searchData.results[0].place_id;
        }
      }
      
      if (!placeId) {
        throw new Error('Could not find restaurant in Google Places');
      }
      
      // Fetch full place details
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,opening_hours,rating,user_ratings_total,price_level,types,photos,website,editorial_summary,geometry&key=${GOOGLE_API_KEY}`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();
      
      if (detailsData.status === 'OK' && detailsData.result) {
        const result = detailsData.result;
        
        // Format hours
        let hours = null;
        if (result.opening_hours && result.opening_hours.weekday_text) {
          hours = result.opening_hours.weekday_text;
        } else if (result.opening_hours && result.opening_hours.periods) {
          // Format periods into readable hours
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          hours = result.opening_hours.periods.map(period => {
            const dayName = dayNames[period.open.day];
            const openTime = formatTimeFromPlace(period.open.time);
            const closeTime = period.close ? formatTimeFromPlace(period.close.time) : 'Open 24 hours';
            return `${dayName}: ${openTime} - ${closeTime}`;
          });
        }
        
        // Get photo URL if available
        let photoUrl = null;
        if (result.photos && result.photos.length > 0) {
          const photoRef = result.photos[0].photo_reference;
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoRef}&key=${GOOGLE_API_KEY}`;
        }
        
        // Extract cuisine from types
        let cuisine = restaurant.cuisine || '';
        if (!cuisine && result.types) {
          const cuisineTypes = result.types.filter(type => type.includes('restaurant') || type.includes('food'));
          if (cuisineTypes.length > 0) {
            // Use the same cuisine extraction logic from handleAddressSelect
            const cuisineMap = {
              'italian_restaurant': 'Italian',
              'chinese_restaurant': 'Chinese',
              'mexican_restaurant': 'Mexican',
              'japanese_restaurant': 'Japanese',
              'indian_restaurant': 'Indian',
              'thai_restaurant': 'Thai',
              'american_restaurant': 'American',
              'pizza_restaurant': 'Pizza',
              'seafood_restaurant': 'Seafood',
              'steak_house': 'Steakhouse',
              'french_restaurant': 'French',
              'greek_restaurant': 'Greek',
              'ethiopian_restaurant': 'Ethiopian',
            };
            for (const type of cuisineTypes) {
              if (cuisineMap[type]) {
                cuisine = cuisineMap[type];
                break;
              }
            }
          }
        }
        
        // Format price level
        let priceRange = restaurant.priceRange || '';
        if (!priceRange && result.price_level !== undefined) {
          const priceMap = {
            0: 'Free',
            1: '$',
            2: '$$',
            3: '$$$',
            4: '$$$$'
          };
          priceRange = priceMap[result.price_level] || '';
        }
        
        setRestaurantDetails({
          restaurantId: restaurant.id,
          visited: restaurant.visited || false,
          favorited: restaurant.favorited || false,
          happyHour: restaurant.happyHour || false,
          name: result.name || restaurant.title,
          address: result.formatted_address || restaurant.location?.address,
          phone: result.formatted_phone_number || '',
          hours: hours,
          rating: result.rating || null,
          reviewCount: result.user_ratings_total || 0,
          priceRange: priceRange,
          cuisine: cuisine,
          website: result.website || '',
          summary: result.editorial_summary?.overview || '',
          photoUrl: photoUrl,
          latitude: result.geometry?.location?.lat || restaurant.location?.latitude,
          longitude: result.geometry?.location?.lng || restaurant.location?.longitude,
        });
        setShowRestaurantDetails(true);
      } else {
        throw new Error('Failed to fetch restaurant details');
      }
    } catch (error) {
      console.error('Error fetching restaurant details:', error);
      Alert.alert('Error', 'Unable to load restaurant details. Please try again later.');
    } finally {
      setLoadingRestaurantDetails(false);
    }
  };

  const formatTimeFromPlace = (timeString) => {
    // Google Places API returns time as "HHMM" format (e.g., "0900" for 9:00 AM)
    if (timeString && timeString.length === 4) {
      const hours = parseInt(timeString.substring(0, 2), 10);
      const minutes = timeString.substring(2, 4);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    }
    return timeString;
  };

  const handleMapPress = (event, item = null) => {
    const coordinate = event?.nativeEvent?.coordinate || event?.coordinate;
    
    // If item is provided and has an address (for restaurants/places), use the address/name
    // Otherwise, fall back to coordinates
    let query;
    if (item && item.location && item.location.address) {
      // Use the place name/address - Apple Maps will search for it
      query = encodeURIComponent(item.location.address);
    } else if (coordinate) {
      // Fall back to coordinates
      query = `${coordinate.latitude},${coordinate.longitude}`;
    } else {
      return;
    }
    
    const url = Platform.select({
      ios: `maps://?q=${query}`,
      android: `geo:0,0?q=${query}`
    });
    
    Alert.alert(
      'Open in Maps',
      'Would you like to open this location in Apple Maps?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open', onPress: () => Linking.openURL(url) }
      ]
    );
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getActivitiesForDay = (day, referenceDate = selectedDate) => {
    const { year, month } = getDaysInMonth(referenceDate);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const householdActivities = activities.filter(activity => activity.date === dateStr);
    const personalActs = personalActivities.filter(activity => activity.date === dateStr);
    
    // Get birthdays for this day - show for current year and next 5 years
    const currentYear = year;
    const birthdays = [];
    people.forEach(person => {
      if (!person.birthday) return;
      // Parse birthday string (YYYY-MM-DD) to avoid timezone issues
      const [bYear, bMonth, bDay] = person.birthday.split('-').map(Number);
      if ((bMonth - 1) === month && bDay === day) {
        // Show birthday for current year and next 5 years
        for (let y = 0; y <= 5; y++) {
          const birthdayYear = currentYear + y;
          const birthdayDateStr = `${birthdayYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          birthdays.push({
            id: `birthday_${person.name}_${person.birthday}_${birthdayYear}`,
            title: `${person.name}'s Birthday`,
            date: birthdayDateStr,
            isBirthday: true,
            year: birthdayYear
          });
        }
      }
    });
    
    // Filter birthdays to only show ones matching the current date
    const matchingBirthdays = birthdays.filter(b => b.date === dateStr);
    
    // Get Apple Calendar events for this day (if enabled)
    const appleCalendarEventsForDay = showAppleCalendar 
      ? appleCalendarEvents.filter(event => event.date === dateStr)
      : [];
    
    return [...householdActivities, ...personalActs, ...matchingBirthdays, ...appleCalendarEventsForDay];
  };

  const getActivitiesForDate = (dateObj) => {
    if (!(dateObj instanceof Date)) return [];
    return getActivitiesForDay(dateObj.getDate(), dateObj);
  };

  const isSameDay = (dateA, dateB) => {
    return (
      dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate()
    );
  };

  const getWeekDates = (referenceDate) => {
    const weekStart = new Date(referenceDate);
    weekStart.setDate(referenceDate.getDate() - referenceDate.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
  };

  const parseTimeToMinutes = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return null;
    const [hours, minutes] = timeString.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
  };

  const getEventDurationMinutes = (event) => {
    if (event.durationMinutes && Number.isFinite(event.durationMinutes)) {
      return Math.max(15, event.durationMinutes);
    }
    return 60;
  };

  const getEventColor = (event) => {
    if (event.isBirthday) return '#EC4899';
    if (event.isAppleCalendar) return '#60A5FA';
    if (event.category === 'restaurants') return '#F59E0B';
    return '#10B981';
  };

  const getEventBackgroundColor = (event) => {
    if (event.isBirthday) return 'rgba(236, 72, 153, 0.18)';
    if (event.isAppleCalendar) return 'rgba(96, 165, 250, 0.18)';
    if (event.category === 'restaurants') return 'rgba(245, 158, 11, 0.18)';
    return 'rgba(16, 185, 129, 0.18)';
  };

  const formatHourLabel = (hour) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${period}`;
  };

  const handleSelectDate = (date) => {
    if (!(date instanceof Date)) return;
    setSelectedDate(date);
    setSelectedDay(date.getDate());
  };

  const handleSelectDay = (day) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(day);
    handleSelectDate(newDate);
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(selectedDate);
    const days = [];
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayActivities = getActivitiesForDay(day);
      const isToday = isCurrentMonth && day === today.getDate();
      
      days.push(
        <TouchableOpacity
          key={day}
          style={[styles.calendarDay, isToday && styles.calendarDayToday]}
          onPress={() => handleSelectDay(day)}
        >
          <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday]}>
            {day}
          </Text>
          {dayActivities.slice(0, 2).map(activity => (
            <View key={activity.id} style={styles.calendarActivity}>
              <Text style={styles.calendarActivityText} numberOfLines={1}>
                {activity.time ? `${activity.time} ` : ''}{activity.title}
              </Text>
            </View>
          ))}
          {dayActivities.length > 2 && (
            <Text style={styles.calendarMoreText}>+{dayActivities.length - 2} more</Text>
          )}
        </TouchableOpacity>
      );
    }
    
    return days;
  };

  const renderCalendarCompact = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(selectedDate);
    const days = [];
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<View key={`empty-${i}`} style={dynamicStyles.calendarDayCompactEmpty} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayActivities = getActivitiesForDay(day);
      const isToday = isCurrentMonth && day === today.getDate();
      const isSelected = selectedDay === day;

      days.push(
        <TouchableOpacity
          key={day}
          style={[dynamicStyles.calendarDayCompact, isToday && dynamicStyles.calendarDayCompactToday, isSelected && dynamicStyles.calendarDayCompactSelected]}
          onPress={() => handleSelectDay(day)}
        >
          <Text style={[dynamicStyles.calendarDayCompactText, isToday && dynamicStyles.calendarDayCompactTextToday, isSelected && dynamicStyles.calendarDayCompactTextSelected]}>
            {day}
          </Text>
          {dayActivities.length > 0 && (
            <View style={styles.calendarDayDots}>
              {dayActivities.slice(0, 3).map((_, idx) => (
                <View key={idx} style={[styles.calendarDayDot, { backgroundColor: '#60A5FA' }]} />
              ))}
              {dayActivities.length > 3 && (
                <View style={[styles.calendarDayDot, { backgroundColor: '#9CA3AF' }]} />
              )}
            </View>
          )}
        </TouchableOpacity>
      );
    }
    
    return days;
  };

  const changeMonth = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + direction);
    newDate.setDate(1);
    handleSelectDate(newDate);
  };

  const changeWeek = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    handleSelectDate(newDate);
  };

  const changeDay = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    handleSelectDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    handleSelectDate(today);
  };
  const filteredItems = getFilteredItems();

  // Helper function to get weather icon
  const getWeatherIcon = (weatherMain, size = 64) => {
    const iconSize = size;
    switch (weatherMain?.toLowerCase()) {
      case 'clear':
        return <Sun size={iconSize} color="#F59E0B" />;
      case 'clouds':
        return <Cloud size={iconSize} color="#9CA3AF" />;
      case 'rain':
      case 'drizzle':
        return <CloudRain size={iconSize} color="#60A5FA" />;
      case 'snow':
        return <CloudSnow size={iconSize} color="#E5E7EB" />;
      default:
        return <Cloud size={iconSize} color="#9CA3AF" />;
    }
  };

  // Get today's date string
  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Get formatted date for display (e.g., "THURSDAY, DECEMBER 12")
  const getFormattedTodayDate = () => {
    const today = new Date();
    return today.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  };

  // Get time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get user's first name from profile
  const getUserFirstName = () => {
    if (currentUserName) {
      return currentUserName.split(' ')[0];
    }
    return 'there'; // Default greeting
  };

  // Get today's activities and tasks
  const getTodayItems = () => {
    const todayDateStr = getTodayDateString();
    
    // Get today's activities
    const todayActivities = [
      ...activities.filter(activity => activity.date === todayDateStr),
      ...personalActivities.filter(activity => activity.date === todayDateStr),
      ...(showAppleCalendar ? appleCalendarEvents.filter(event => event.date === todayDateStr) : [])
    ];

    // Get today's tasks (due today)
    const allTasks = [
      ...items.filter(item => item.category === 'todo' && !item.date && item.dueDate === todayDateStr && !item.completed),
      ...personalTasks.filter(task => task.dueDate === todayDateStr && !task.completed)
    ];

    return { activities: todayActivities, tasks: allTasks };
  };

  const getFilteredTodoItems = () => {
    const todayDateStr = getTodayDateString();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Combine all tasks
    let allTasks = [];
    if (todoFilter === 'tasks') {
      allTasks = [
        ...items.filter(item => item.category === 'todo' && !item.date),
        ...personalTasks.map(task => ({ ...task, isPersonal: true }))
      ];
    } else if (todoFilter === 'activities') {
      allTasks = [
        ...activities,
        ...personalActivities.map(activity => ({ ...activity, isPersonal: true }))
      ];
    }

    // Helper to parse date string as local date
    const parseLocalDate = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    // Apply time filter
    if (todoTimeFilter === 'today') {
      allTasks = allTasks.filter(task => task.dueDate === todayDateStr || task.date === todayDateStr);
    } else if (todoTimeFilter === 'current') {
      // Current: activities happening today OR activities where today falls within start-end date range
      allTasks = allTasks.filter(task => {
        const startDateStr = task.date;
        const endDateStr = task.endDate;

        if (!startDateStr) return false;

        // If it's happening exactly today
        if (startDateStr === todayDateStr) return true;

        // If there's an end date, check if today falls within the range
        if (endDateStr) {
          const startDate = parseLocalDate(startDateStr);
          const endDate = parseLocalDate(endDateStr);
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          return today >= startDate && today <= endDate;
        }

        return false;
      });
    } else if (todoTimeFilter === 'upcoming') {
      allTasks = allTasks.filter(task => {
        if (!task.dueDate && !task.date) return false;
        const taskDate = parseLocalDate(task.dueDate || task.date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate > today;
      });
    } else if (todoTimeFilter === 'overdue') {
      allTasks = allTasks.filter(task => {
        if (!task.dueDate && !task.date) return false;
        if (task.completed) return false;
        const taskDate = parseLocalDate(task.dueDate || task.date);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate < today;
      });
    }

    // Categorize tasks
    const overdue = [];
    const todayTasks = [];
    const upcoming = [];
    const current = [];
    const noDate = [];
    const allCurrent = []; // All activities that are currently happening (for 'current' filter)

    allTasks.forEach(task => {
      const taskDateStr = task.dueDate || task.date;
      const endDateStr = task.endDate;

      if (!taskDateStr) {
        noDate.push(task);
      } else if (taskDateStr === todayDateStr) {
        todayTasks.push(task);
        allCurrent.push(task); // Also add to allCurrent
      } else {
        const taskDate = parseLocalDate(taskDateStr);
        taskDate.setHours(0, 0, 0, 0);

        // Handle multi-day events with end date
        if (endDateStr) {
          const endDate = parseLocalDate(endDateStr);
          endDate.setHours(23, 59, 59, 999);

          if (today >= taskDate && today <= endDate) {
            // Today is within the event range - it's current
            current.push(task);
            allCurrent.push(task); // Also add to allCurrent
          } else if (taskDate > today) {
            // Event starts in the future
            upcoming.push(task);
          } else if (endDate < today && !task.completed) {
            // Event has completely ended
            overdue.push(task);
          }
        } else {
          // Single-day event (no end date)
          if (taskDate < today && !task.completed) {
            overdue.push(task);
          } else if (taskDate > today) {
            upcoming.push(task);
          }
        }
      }
    });

    return { overdue, today: todayTasks, upcoming, current, allCurrent, noDate };
  };

  const shouldShowLocationForItem = (item) => {
    if (!item || !item.location || !item.location.address) {
      return false;
    }

    if (item.category === 'restaurants') {
      return tabSettings.restaurants?.showAddressInList !== false;
    }

    if (item.category === 'todo') {
      if (activeTab === 'todo') {
        return tabSettings.todo?.showAddressInList !== false;
      }
      return true;
    }

    return true;
  };

  const shouldShowPriceForItem = (item) => {
    if (item?.category === 'restaurants') {
      return tabSettings.restaurants?.showPriceInList !== false;
    }
    if (item?.category === 'groceries') {
      return tabSettings.groceries?.showPrices !== false;
    }
    return true;
  };

  const handleOpenRecipeForm = () => {
    setNewRecipeUrl('');
    setNewRecipeTags([]);
    setRecipeExtractionError('');
    resetManualRecipeFields();
    setEditingRecipeId(null);
    setEditingRecipeOriginal(null);
    setShowRecipeForm(true);
  };

  const normalizeIngredients = (input) => {
    if (!Array.isArray(input)) return [];
    return input
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return { name: item };
        }
        if (typeof item === 'object') {
          return {
            name: item.name || item.ingredient || item.item || '',
            quantity: item.quantity || item.amount || '',
            unit: item.unit || item.measure || '',
          };
        }
        return { name: String(item) };
      })
      .filter((ing) => ing && ing.name);
  };

  const normalizeSteps = (input) => {
    if (!input) return [];
    if (Array.isArray(input)) {
      return input
        .map((step) => {
          if (!step) return '';
          if (typeof step === 'string') return step;
          if (typeof step === 'object') {
            return step.step || step.instruction || step.text || '';
          }
          return String(step);
        })
        .filter(Boolean);
    }
    if (typeof input === 'string') {
      return input
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }
    return [];
  };

  const addRecipeFromUrl = async () => {
    const url = newRecipeUrl.trim();

    if (!url) {
      setRecipeExtractionError('Please paste a TikTok or Instagram link.');
      return;
    }

    if (!householdId) {
      Alert.alert('Household required', 'Join or create a household before saving recipes.');
      return;
    }

    try {
      setIsExtractingRecipe(true);
      setRecipeExtractionError('');

      const callable = httpsCallable(functions, 'extractRecipe');
      const response = await callable({ url });
      const data = response?.data || {};
      const recipePayload =
        data.recipe || (!data.manualEntryRequired ? data : null);

      if (
        data.manualEntryRequired ||
        !recipePayload ||
        Object.keys(recipePayload).length === 0
      ) {
        copyCaptionToManualForm(
          data,
          'Could not auto-extract this caption. We pasted it below so you can add it manually.',
          url
        );
        return;
      }

      const ingredients = normalizeIngredients(recipePayload.ingredients);
      const steps = normalizeSteps(recipePayload.steps || recipePayload.instructions);

      const recipeDoc = {
        title: '',
        sourceUrl: recipePayload.sourceUrl || url,
        sourceName: recipePayload.sourceName || recipePayload.author || '',
        thumbnail: recipePayload.thumbnail || recipePayload.image || '',
        videoUrl: recipePayload.videoUrl || recipePayload.sourceUrl || url,
        description: recipePayload.description || '',
        ingredients,
        steps,
        tags: [...new Set([...(Array.isArray(recipePayload.tags) ? recipePayload.tags : []), ...newRecipeTags])],
        createdAt: new Date().toISOString(),
        favorited: false,
      };

      await addDoc(collection(db, 'households', householdId, 'recipes'), recipeDoc);
      closeRecipeForm();
    } catch (error) {
      console.error('Error extracting recipe:', error);
      let message =
        error.message || 'Failed to extract recipe. Try again or paste the instructions manually.';
      if (error.code === 'functions/not-found') {
        message =
          'Recipe extractor is not deployed yet. Deploy the `extractRecipe` Cloud Function and try again.';
      }
      setRecipeExtractionError(message);
      setAllowManualRecipeEntry(true);
    } finally {
      setIsExtractingRecipe(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!recipeId) return;

    try {
      if (!householdId) {
        setRecipes((prev) => prev.filter((recipe) => recipe.id !== recipeId));
        return;
      }
      await deleteDoc(doc(db, 'households', householdId, 'recipes', recipeId));
    } catch (error) {
      console.error('Error deleting recipe:', error);
      Alert.alert('Error', 'Failed to delete recipe');
    }
  };

  const openRecipeSource = async (recipe) => {
    const url = recipe?.videoUrl || recipe?.sourceUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open the link right now.');
    }
  };

  const shareRecipe = async (recipe) => {
    const url = recipe?.videoUrl || recipe?.sourceUrl;
    if (!url) {
      Alert.alert('No link', 'This recipe does not have a link to share.');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Login required', 'You must be logged in to share recipes.');
        return;
      }

      // Get user's name from Firestore
      let userName = 'Someone';
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.name && userData.name !== 'Not set') {
            userName = userData.name;
          }
        }
      } catch (error) {
        console.error('Error fetching user name:', error);
      }

      const shareMessage = `Hey! ${userName} wants to share this recipe with you! Click the link below to view:\n${url}`;

      const result = await Share.share({
        message: shareMessage,
        title: 'Share Recipe',
      });

      if (result.action === Share.sharedAction) {
        // Recipe was shared successfully
      } else if (result.action === Share.dismissedAction) {
        // Share was dismissed
      }
    } catch (error) {
      console.error('Error sharing recipe:', error);
      Alert.alert('Error', 'Failed to share recipe');
    }
  };

  const handleAddRecipeIngredientsToGroceries = async (recipe) => {
    if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
      Alert.alert('No ingredients', 'This recipe does not have any ingredients to add.');
      return;
    }

    if (!householdId) {
      Alert.alert('Household required', 'Join or create a household to add items to groceries.');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Login required', 'You must be logged in to add groceries.');
      return;
    }

    const ingredientLines = recipe.ingredients
      .map((ingredient) => formatIngredientLine(ingredient).trim())
      .filter(Boolean);

    if (ingredientLines.length === 0) {
      Alert.alert('No ingredients', 'This recipe does not have any ingredients to add.');
      return;
    }

    const uniqueIngredientLines = [];
    const seenLines = new Set();
    ingredientLines.forEach((line) => {
      const key = line.toLowerCase();
      if (!seenLines.has(key)) {
        seenLines.add(key);
        uniqueIngredientLines.push(line);
      }
    });

    const existingGroceries = items.filter((item) => item.category === 'groceries');
    const existingTitles = new Set(
      existingGroceries
        .map((item) => (item.title || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const ingredientsToAdd = uniqueIngredientLines.filter(
      (line) => !existingTitles.has(line.toLowerCase())
    );

    if (ingredientsToAdd.length === 0) {
      Alert.alert('Already added', 'All of these ingredients are already in your grocery list.');
      return;
    }

    try {
      setIsAddingRecipeToGroceries(true);
      const baseOrder = existingGroceries.length;
      const now = new Date().toISOString();

      await Promise.all(
        ingredientsToAdd.map((line, index) =>
          addDoc(collection(db, 'households', householdId, 'items'), {
            title: line,
            category: 'groceries',
            notes: recipe.title ? `From recipe: ${recipe.title}` : '',
            completed: false,
            createdAt: now,
            createdBy: currentUser.uid,
            order: baseOrder + index,
          })
        )
      );

      Alert.alert(
        'Added to Groceries',
        `${ingredientsToAdd.length} ingredient${ingredientsToAdd.length === 1 ? '' : 's'} added to your grocery list.`
      );
    } catch (error) {
      console.error('Error adding recipe ingredients to groceries:', error);
      Alert.alert('Error', 'Could not add ingredients to your grocery list. Please try again.');
    } finally {
      setIsAddingRecipeToGroceries(false);
    }
  };

  const addRecipeManually = async () => {
    if (!householdId) {
      Alert.alert('Household required', 'Join or create a household before saving recipes.');
      return;
    }

    // When editing, use original title if form title is empty
    const title = manualRecipeTitle.trim() || (editingRecipeId && editingRecipeOriginal?.title) || '';
    const description = manualRecipeDescription.trim();
    const ingredientLines = manualRecipeIngredients
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const stepLines = manualRecipeSteps
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    // Only require title for new recipes
    if (!editingRecipeId && !title) {
      Alert.alert('Missing title', 'Please enter a recipe title.');
      return;
    }

    // Only require ingredients and steps for new recipes, not when editing
    if (!editingRecipeId && (ingredientLines.length === 0 || stepLines.length === 0)) {
      Alert.alert('Missing details', 'Add at least one ingredient and one step to save the recipe.');
      return;
    }

    const normalizedIngredients = normalizeIngredients(ingredientLines);
    const normalizedSteps = normalizeSteps(stepLines);
    const url = newRecipeUrl.trim();

    try {
      setIsExtractingRecipe(true);
      const now = new Date().toISOString();

      if (editingRecipeId) {
        const existing = editingRecipeOriginal || {};
        const updatePayload = {
          title,
          description,
          ingredients: ingredientLines.length > 0 ? normalizedIngredients : (existing.ingredients || []),
          steps: stepLines.length > 0 ? normalizedSteps : (existing.steps || []),
          tags: newRecipeTags,
          updatedAt: now,
        };

        if (url) {
          updatePayload.sourceUrl = url;
          updatePayload.videoUrl = url;
        }

        if (existing.sourceName) {
          updatePayload.sourceName = existing.sourceName;
        }
        if (existing.thumbnail) {
          updatePayload.thumbnail = existing.thumbnail;
        }
        if (typeof existing.favorited === 'boolean') {
          updatePayload.favorited = existing.favorited;
        }

        await updateDoc(
          doc(db, 'households', householdId, 'recipes', editingRecipeId),
          updatePayload
        );
      } else {
        const urlToSave = url || '';
        const recipeDoc = {
          title,
          description,
          sourceUrl: urlToSave,
          sourceName: '',
          thumbnail: '',
          videoUrl: urlToSave,
          ingredients: normalizedIngredients,
          steps: normalizedSteps,
          tags: newRecipeTags,
          createdAt: now,
          favorited: false,
        };

        await addDoc(collection(db, 'households', householdId, 'recipes'), recipeDoc);
      }

      closeRecipeForm();
    } catch (error) {
      console.error('Error saving recipe manually:', error);
      Alert.alert('Error', 'Could not save the recipe. Please try again.');
    } finally {
      setIsExtractingRecipe(false);
    }
  };

  const closeRecipeForm = () => {
    setShowRecipeForm(false);
    setRecipeExtractionError('');
    resetManualRecipeFields();
    setNewRecipeUrl('');
    setNewRecipeTags([]);
    setIsExtractingRecipe(false);
    setEditingRecipeId(null);
    setEditingRecipeOriginal(null);
  };

  const clearGroceriesList = async () => {
    if (isClearingGroceries) return;

    const groceries = items.filter((item) => item.category === 'groceries' && item.id);
    if (groceries.length === 0) {
      Alert.alert('Grocery list is empty', 'There are no grocery items to clear.');
      return;
    }

    if (!householdId) {
      Alert.alert('Household required', 'Join or create a household before clearing the grocery list.');
      return;
    }

    try {
      setIsClearingGroceries(true);
      const batch = writeBatch(db);
      groceries.forEach((item) => {
        const itemRef = doc(db, 'households', householdId, 'items', item.id);
        batch.delete(itemRef);
      });
      await batch.commit();
      Alert.alert('Grocery list cleared', `${groceries.length} item${groceries.length === 1 ? '' : 's'} removed.`);
    } catch (error) {
      console.error('Error clearing grocery list:', error);
      Alert.alert('Error', 'Could not clear the grocery list. Please try again.');
    } finally {
      setIsClearingGroceries(false);
    }
  };

  const handleClearGroceriesPress = () => {
    if (showGroceryQuickActions) {
      setShowGroceryQuickActions(false);
    }
    if (isClearingGroceries) return;

    const groceriesCount = items.filter((item) => item.category === 'groceries').length;

    if (groceriesCount === 0) {
      Alert.alert('Grocery list is empty', 'There are no grocery items to clear.');
      return;
    }

    Alert.alert(
      'Clear grocery list?',
      `This will remove all ${groceriesCount} item${groceriesCount === 1 ? '' : 's'} from the grocery list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearGroceriesList,
        },
      ]
    );
  };

  const formatIngredientLine = (ingredient) => {
    if (!ingredient) return '';
    if (typeof ingredient === 'string') return ingredient;
    const parts = [
      ingredient.quantity,
      ingredient.unit,
      ingredient.name,
    ].filter(Boolean);
    return parts.join(' ').trim();
  };

  const orderedTabs = tabOrder.filter((tabKey) => {
    switch (tabKey) {
      case 'today':
        return true;
      case 'all':
        return tabVisibility.all;
      case 'ideas':
        return tabVisibility.ideas;
      case 'food':
        return tabVisibility.food;
      case 'todo':
        return tabVisibility.todo;
      case 'groceries':
        return tabVisibility.groceries;
      case 'gifts':
        return tabVisibility.gifts;
      case 'calendar':
        return tabVisibility.calendar;
      default:
        return false;
    }
  });

  const renderTabButton = (tabKey) => {
    const isActive = activeTab === tabKey;
    const iconColor = isActive ? themeColors.accentPrimary : themeColors.textSecondary;
    const labelStyle = [dynamicStyles.bottomTabLabel, isActive && { color: themeColors.accentPrimary, fontWeight: '600' }];

    switch (tabKey) {
      case 'today':
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('today')}
          >
            <View style={styles.bottomTabIcon}>
              <Sun size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Today</Text>
          </TouchableOpacity>
        );
      case 'all':
        if (!tabVisibility.all) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('all')}
          >
            <View style={styles.bottomTabIcon}>
              <List size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>All</Text>
          </TouchableOpacity>
        );
      case 'ideas':
        if (!tabVisibility.ideas) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('ideas')}
          >
            <View style={styles.bottomTabIcon}>
              <Lightbulb size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Ideas</Text>
          </TouchableOpacity>
        );
      case 'food':
        if (!tabVisibility.food) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('food')}
          >
            <View style={styles.bottomTabIcon}>
              <Utensils size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Food</Text>
          </TouchableOpacity>
        );
      case 'todo':
        if (!tabVisibility.todo) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('todo')}
          >
            <View style={styles.bottomTabIcon}>
              <Check size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>To Do</Text>
          </TouchableOpacity>
        );
      case 'groceries':
        if (!tabVisibility.groceries) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('groceries')}
          >
            <View style={styles.bottomTabIcon}>
              <ShoppingCart size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Shop</Text>
          </TouchableOpacity>
        );
      case 'gifts':
        if (!tabVisibility.gifts) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('gifts')}
          >
            <View style={styles.bottomTabIcon}>
              <Gift size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Gifts</Text>
          </TouchableOpacity>
        );
      case 'calendar':
        if (!tabVisibility.calendar) return null;
        return (
          <TouchableOpacity
            key={tabKey}
            style={[styles.bottomTab, isActive && styles.bottomTabActive]}
            onPress={() => setActiveTab('calendar')}
          >
            <View style={styles.bottomTabIcon}>
              <Calendar size={20} color={iconColor} />
            </View>
            <Text style={labelStyle}>Cal</Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  const getCityStateFromAddress = (address) => {
    if (!address) return '';
    const parts = address.split(',').map(part => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const city = parts[parts.length - 3];
      const stateZip = parts[parts.length - 2];
      const state = stateZip.split(' ').filter(Boolean)[0] || stateZip;
      return `${city}, ${state}`;
    }
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    return address;
  };

  const renderContent = () => {
    // Ensure activeTab has a valid value - default to 'today' if not
    const validTabs = ['today', 'todo', 'calendar', 'groceries', 'ideas', 'gifts', 'food', 'all'];
    const currentTab = validTabs.includes(activeTab) ? activeTab : 'today';

    // Today Tab - First tab (also default fallback)
    if (currentTab === 'today') {
      const { activities, tasks } = getTodayItems();
      const todayDateStr = getTodayDateString();
      const showWeeklyForecast = tabSettings.today?.showWeeklyForecast;
      const weeklyForecastDays = weatherForecast?.daily ? weatherForecast.daily.slice(0, 7) : [];
      const formatForecastDay = (timestamp, index) => {
        const date = new Date(timestamp * 1000);
        if (index === 0) return 'Today';
        return date.toLocaleDateString(undefined, { weekday: 'short' });
      };
      
      return (
        <View style={dynamicStyles.container}>
          <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
            {/* Sub-header with Date and Greeting */}
            <View style={dynamicStyles.todaySubHeader}>
              <Text style={dynamicStyles.todayDate}>{getFormattedTodayDate()}</Text>
              <Text style={dynamicStyles.todayGreeting}>
                {getGreeting()}, <Text style={dynamicStyles.todayGreetingName}>{getUserFirstName()}</Text>
              </Text>
            </View>

            {/* Weather Card - Editorial Style */}
            <View style={dynamicStyles.weatherCard}>
              {weatherLoading && (
                <ActivityIndicator size="small" color={themeColors.accentPrimary} style={{ position: 'absolute', top: 16, right: 16 }} />
              )}
              {weatherData ? (
                <>
                  {/* Location */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                    <MapPin size={14} color={themeColors.accentPrimary} />
                    <Text style={dynamicStyles.weatherLocation}>{weatherData.name || 'Your Location'}</Text>
                  </View>

                  {/* Main Weather Row */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* Left - Temperature */}
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                        <Text style={dynamicStyles.weatherTemp}>{Math.round(weatherData.main.temp)}</Text>
                        <Text style={dynamicStyles.weatherTempUnit}>°F</Text>
                      </View>
                    </View>

                    {/* Right - Icon and Condition */}
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={dynamicStyles.weatherIconCircle}>
                        <Sun size={32} color={themeColors.accentPrimary} />
                      </View>
                      <Text style={dynamicStyles.weatherConditionItalic}>
                        {weatherData.weather[0]?.description ?
                          weatherData.weather[0].description.charAt(0).toUpperCase() + weatherData.weather[0].description.slice(1)
                          : 'Clear'}
                      </Text>
                      <Text style={dynamicStyles.weatherHighLow}>
                        High {Math.round(weatherData.main.temp_max)}° • Low {Math.round(weatherData.main.temp_min)}°
                      </Text>
                    </View>
                  </View>

                  {/* Weekly Forecast Toggle */}
                  <View style={dynamicStyles.weatherToggleRow}>
                    <Text style={dynamicStyles.weatherToggleLabel}>Show weekly forecast</Text>
                    <TouchableOpacity
                      style={[styles.weatherToggleSwitch, showWeeklyForecast && styles.weatherToggleSwitchActive]}
                      onPress={() => setTabSettings({
                        ...tabSettings,
                        today: { ...tabSettings.today, showWeeklyForecast: !showWeeklyForecast }
                      })}
                    >
                      <View style={[styles.weatherToggleKnob, showWeeklyForecast && styles.weatherToggleKnobActive]} />
                    </TouchableOpacity>
                  </View>

                  {/* Weekly Forecast (if enabled) */}
                  {showWeeklyForecast && weeklyForecastDays.length > 0 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ marginTop: 16 }}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {weeklyForecastDays.map((day, index) => (
                        <View key={day.dt || index} style={dynamicStyles.forecastDayCard}>
                          <Text style={dynamicStyles.forecastDayName}>{formatForecastDay(day.dt, index)}</Text>
                          <Sun size={24} color={themeColors.accentPrimary} style={{ marginVertical: 8 }} />
                          <Text style={dynamicStyles.forecastDayTemp}>{Math.round(day.temp?.max || 0)}°</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </>
              ) : !weatherLoading ? (
                <View style={dynamicStyles.todayWeatherEmpty}>
                  <Cloud size={32} color={themeColors.textMuted} />
                  <Text style={dynamicStyles.todayWeatherEmptyText}>Weather data unavailable</Text>
                  <Text style={dynamicStyles.todayWeatherEmptySubtext}>Check your API key configuration</Text>
                </View>
              ) : null}
            </View>

            {/* Today's Activities Section */}
            <View style={{ marginBottom: 28 }}>
              <View style={dynamicStyles.sectionHeader}>
                <Text style={dynamicStyles.sectionTitle}>Today's Schedule</Text>
                <Text style={dynamicStyles.sectionAction}>See All</Text>
              </View>
              {activities.length > 0 ? (
                activities.map((activity, idx) => {
                  // Determine dot color based on category or type
                  const dotColor = activity.isBirthday ? '#ec4899' :
                                   activity.isAppleCalendar ? '#3b82f6' :
                                   activity.isPersonal ? themeColors.accentPrimary : '#3b82f6';
                  return (
                    <TouchableOpacity
                      key={activity.id || idx}
                      onPress={() => {
                        if (!activity.isBirthday && !activity.isAppleCalendar) {
                          setSelectedActivity(activity);
                        }
                      }}
                      disabled={activity.isBirthday || activity.isAppleCalendar}
                    >
                      <View style={dynamicStyles.activityCard}>
                        <View style={dynamicStyles.activityTimeBadge}>
                          {activity.time && (
                            <>
                              <Text style={dynamicStyles.activityTime}>{formatTime(activity.time).split(' ')[0]}</Text>
                              <Text style={dynamicStyles.activityPeriod}>{formatTime(activity.time).split(' ')[1]}</Text>
                            </>
                          )}
                        </View>
                        <View style={dynamicStyles.activityDivider} />
                        <View style={dynamicStyles.activityInfo}>
                          <Text style={dynamicStyles.activityTitle}>{activity.title}</Text>
                          {activity.notes && !activity.isAppleCalendar && (
                            <Text style={dynamicStyles.activityLocation} numberOfLines={1}>{activity.notes}</Text>
                          )}
                        </View>
                        <View style={[dynamicStyles.activityDot, { backgroundColor: dotColor }]} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={dynamicStyles.todayEmptyState}>
                  <Text style={dynamicStyles.todayEmptyText}>No activities scheduled for today</Text>
                </View>
              )}
            </View>

            {/* Today's Tasks Section */}
            <View style={{ marginBottom: 28 }}>
              <View style={dynamicStyles.sectionHeader}>
                <Text style={dynamicStyles.sectionTitle}>Tasks Due Today</Text>
                <Text style={dynamicStyles.sectionAction}>See All</Text>
              </View>
              {tasks.length > 0 ? (
                tasks.map((task, idx) => {
                  const isPersonal = task.isPersonal;
                  const editType = isPersonal ? 'personalTask' : 'item';
                  return (
                    <TouchableOpacity
                      key={task.id}
                      onPress={() => openEditForm(task, editType)}
                    >
                      <View style={dynamicStyles.activityCard}>
                        <View style={dynamicStyles.activityTimeBadge}>
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleComplete(task.id, isPersonal ? 'personal' : 'items');
                            }}
                          >
                            <View style={[dynamicStyles.checkbox, task.completed && dynamicStyles.checkboxCompleted]}>
                              {task.completed && <Check size={16} color="#fff" />}
                            </View>
                          </TouchableOpacity>
                        </View>
                        <View style={dynamicStyles.activityDivider} />
                        <View style={dynamicStyles.activityInfo}>
                          <Text style={[dynamicStyles.activityTitle, task.completed && dynamicStyles.completedText]}>
                            {task.title}
                          </Text>
                          {task.priority && (
                            <Text style={dynamicStyles.activityLocation}>
                              Priority: {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={dynamicStyles.todayEmptyState}>
                  <Text style={dynamicStyles.todayEmptyText}>No tasks due today</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      );
    }

    if (currentTab === 'todo') {
      const { overdue, today, upcoming, current, allCurrent, noDate } = getFilteredTodoItems();

      const renderTaskCard = (task, isPersonal) => {
        const taskDateStr = task.dueDate || task.date;
        let dateDisplay = '';
        if (taskDateStr) {
          // Parse date string as local date to avoid timezone issues
          const parseLocal = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
          };
          const taskDate = parseLocal(taskDateStr);
          if (task.endDate) {
            // Multi-day event - show date range
            const endDate = parseLocal(task.endDate);
            dateDisplay = `${taskDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
          } else {
            dateDisplay = taskDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            if (task.time) {
              dateDisplay += ` at ${task.time}`;
            }
          }
        }

        const priorityStyle = task.priority === 'urgent' ? styles.priorityDotUrgent :
                             task.priority === 'high' ? styles.priorityDotHigh :
                             task.priority === 'low' ? styles.priorityDotLow :
                             styles.priorityDotMedium;

        const handleDeleteTask = () => {
          Alert.alert(
            'Delete Item',
            `Are you sure you want to delete "${task.title}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  const category = todoFilter === 'activities'
                    ? (isPersonal ? 'personalActivities' : 'activities')
                    : 'items';
                  deleteItem(task.id, category);
                },
              },
            ]
          );
        };

        const renderRightActions = (progress, dragX) => {
          const scale = dragX.interpolate({
            inputRange: [-100, 0],
            outputRange: [1, 0.5],
            extrapolate: 'clamp',
          });
          const opacity = dragX.interpolate({
            inputRange: [-100, -50, 0],
            outputRange: [1, 0.8, 0],
            extrapolate: 'clamp',
          });

          return (
            <TouchableOpacity
              onPress={handleDeleteTask}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  dynamicStyles.swipeDeleteAction,
                  { opacity, transform: [{ scale }] },
                ]}
              >
                <Trash2 size={22} color="#fff" />
              </Animated.View>
            </TouchableOpacity>
          );
        };

        return (
          <Swipeable
            key={task.id}
            renderRightActions={renderRightActions}
            rightThreshold={40}
            overshootRight={false}
            friction={2}
          >
            <TouchableOpacity
              onPress={() => {
                if (todoFilter === 'activities') {
                  // Show activity detail popup
                  setSelectedActivity(task);
                } else {
                  const editType = isPersonal ? 'personalTask' : 'item';
                  openEditForm(task, editType);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={dynamicStyles.taskCard}>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    const collection = todoFilter === 'activities'
                      ? 'activities'
                      : 'items';
                    toggleComplete(task.id, collection);
                  }}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <View style={[dynamicStyles.checkbox, { marginRight: 14 }, task.completed && dynamicStyles.checkboxCompleted]}>
                    {task.completed && <Check size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>

                <View style={dynamicStyles.taskInfo}>
                  <Text style={[dynamicStyles.taskTitle, task.completed && dynamicStyles.completedText]}>
                    {task.title}
                  </Text>
                  {dateDisplay && (
                    <Text style={dynamicStyles.taskMeta}>{dateDisplay}</Text>
                  )}
                </View>

                {!task.completed && todoFilter === 'tasks' && (
                  <View style={[styles.priorityDot, priorityStyle]} />
                )}
              </View>
            </TouchableOpacity>
          </Swipeable>
        );
      };

      const renderSection = (title, tasks, count) => {
        if (tasks.length === 0) return null;

        return (
          <>
            <View style={dynamicStyles.todoSectionHeader}>
              <Text style={dynamicStyles.todoSectionTitle}>
                {title} {count !== undefined && `(${count})`}
              </Text>
            </View>
            {tasks.map(task => renderTaskCard(task, task.isPersonal))}
          </>
        );
      };

      return (
        <View style={dynamicStyles.container}>
          <View style={dynamicStyles.todoSubHeader}>
            <Text style={dynamicStyles.todoMainTitle}>
              Your <Text style={dynamicStyles.todoMainTitleAccent}>To Do</Text>
            </Text>
          </View>

          <View style={dynamicStyles.todoToggleRow}>
            <View style={dynamicStyles.todoToggle}>
              <TouchableOpacity
                style={[dynamicStyles.todoToggleItem, todoFilter === 'tasks' && dynamicStyles.todoToggleItemActive]}
                onPress={() => setTodoFilter('tasks')}
              >
                <Text style={[dynamicStyles.todoToggleText, todoFilter === 'tasks' && dynamicStyles.todoToggleTextActive]}>
                  TASKS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.todoToggleItem, todoFilter === 'activities' && dynamicStyles.todoToggleItemActive]}
                onPress={() => setTodoFilter('activities')}
              >
                <Text style={[dynamicStyles.todoToggleText, todoFilter === 'activities' && dynamicStyles.todoToggleTextActive]}>
                  ACTIVITIES
                </Text>
              </TouchableOpacity>
            </View>
            {todoFilter === 'activities' && (
              <View style={dynamicStyles.mapToggleContainer}>
                <MapPin size={16} color={todoViewMode === 'map' ? themeColors.accentPrimary : themeColors.textMuted} />
                <Switch
                  value={todoViewMode === 'map'}
                  onValueChange={(value) => setTodoViewMode(value ? 'map' : 'list')}
                  trackColor={{ false: themeColors.border, true: theme === 'dark' ? 'rgba(245, 158, 11, 0.4)' : '#fcd9b8' }}
                  thumbColor={todoViewMode === 'map' ? themeColors.accentPrimary : themeColors.surface}
                  ios_backgroundColor={themeColors.border}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>
            )}
          </View>

          <View style={dynamicStyles.filterPills}>
            <TouchableOpacity
              style={[dynamicStyles.filterPill, todoTimeFilter === 'all' && dynamicStyles.filterPillActive]}
              onPress={() => setTodoTimeFilter('all')}
            >
              <Text style={[dynamicStyles.filterPillText, todoTimeFilter === 'all' && dynamicStyles.filterPillTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.filterPill, todoTimeFilter === 'today' && dynamicStyles.filterPillActive]}
              onPress={() => setTodoTimeFilter('today')}
            >
              <Text style={[dynamicStyles.filterPillText, todoTimeFilter === 'today' && dynamicStyles.filterPillTextActive]}>
                Today
              </Text>
            </TouchableOpacity>
            {todoFilter === 'activities' && (
              <TouchableOpacity
                style={[dynamicStyles.filterPill, todoTimeFilter === 'current' && dynamicStyles.filterPillActive]}
                onPress={() => setTodoTimeFilter('current')}
              >
                <Text style={[dynamicStyles.filterPillText, todoTimeFilter === 'current' && dynamicStyles.filterPillTextActive]}>
                  Current
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[dynamicStyles.filterPill, todoTimeFilter === 'upcoming' && dynamicStyles.filterPillActive]}
              onPress={() => setTodoTimeFilter('upcoming')}
            >
              <Text style={[dynamicStyles.filterPillText, todoTimeFilter === 'upcoming' && dynamicStyles.filterPillTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>
            {todoFilter === 'tasks' && (
              <TouchableOpacity
                style={[dynamicStyles.filterPill, todoTimeFilter === 'overdue' && dynamicStyles.filterPillActive]}
                onPress={() => setTodoTimeFilter('overdue')}
              >
                <Text style={[dynamicStyles.filterPillText, todoTimeFilter === 'overdue' && dynamicStyles.filterPillTextActive]}>
                  Overdue
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {todoFilter === 'activities' && todoViewMode === 'map' ? (
            (() => {
              const allActivities = [...activities, ...personalActivities.map(a => ({ ...a, isPersonal: true }))];
              const activitiesWithLocation = allActivities.filter(a => a.location && a.location.latitude && a.location.longitude);

              if (activitiesWithLocation.length === 0) {
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 }}>
                    <MapPin size={48} color="#9CA3AF" />
                    <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
                      No activities with locations
                    </Text>
                    <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
                      Add activities with addresses to see them on the map
                    </Text>
                  </View>
                );
              }

              const mapRadius = tabSettings.map?.radius || 15;
              const milesPerLatDegree = 69.0;
              const minDelta = (mapRadius * 2) / milesPerLatDegree;

              const latitudes = activitiesWithLocation.map(a => a.location.latitude);
              const longitudes = activitiesWithLocation.map(a => a.location.longitude);

              if (userLocation) {
                latitudes.push(userLocation.latitude);
                longitudes.push(userLocation.longitude);
              }

              const minLat = Math.min(...latitudes);
              const maxLat = Math.max(...latitudes);
              const minLon = Math.min(...longitudes);
              const maxLon = Math.max(...longitudes);

              const centerLat = (minLat + maxLat) / 2;
              const centerLon = (minLon + maxLon) / 2;
              const cosLat = Math.cos(centerLat * Math.PI / 180);
              const minLonDelta = (mapRadius * 2) / (milesPerLatDegree * Math.abs(cosLat));
              const latDelta = Math.max(minDelta, (maxLat - minLat) * 1.5);
              const lonDelta = Math.max(minLonDelta, (maxLon - minLon) * 1.5);

              return (
                <View style={styles.embeddedMapContainer}>
                  <MapView
                    style={styles.embeddedMap}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    initialRegion={{
                      latitude: centerLat,
                      longitude: centerLon,
                      latitudeDelta: latDelta,
                      longitudeDelta: lonDelta,
                    }}
                  >
                    {activitiesWithLocation.map(activity => (
                      <Marker
                        key={activity.id}
                        coordinate={{
                          latitude: activity.location.latitude,
                          longitude: activity.location.longitude,
                        }}
                        pinColor="#b45309"
                      >
                        <Callout onPress={() => handleMapPress({ nativeEvent: { coordinate: activity.location } }, activity)}>
                          <View style={styles.calloutContainer}>
                            <Text style={styles.calloutTitle}>{activity.title}</Text>
                            {activity.date && (
                              <Text style={styles.calloutText}>Date: {formatDate(activity.date)}</Text>
                            )}
                            {activity.time && (
                              <Text style={styles.calloutText}>Time: {formatTime(activity.time)}</Text>
                            )}
                            {activity.location?.address && (
                              <Text style={styles.calloutText}>{activity.location.address}</Text>
                            )}
                            <Text style={styles.calloutLink}>Tap to open in Maps</Text>
                          </View>
                        </Callout>
                      </Marker>
                    ))}
                  </MapView>
                </View>
              );
            })()
          ) : (
            <ScrollView style={dynamicStyles.content} showsVerticalScrollIndicator={false}>
              {todoTimeFilter === 'all' ? (
                todoFilter === 'activities' ? (
                  <>
                    {renderSection('Current', allCurrent, allCurrent.length)}
                    {renderSection('Upcoming', upcoming, upcoming.length)}
                    {renderSection('Overdue', overdue, overdue.length)}
                    {renderSection('No Date', noDate, noDate.length)}
                  </>
                ) : (
                  <>
                    {renderSection('Overdue', overdue, overdue.length)}
                    {renderSection('Today', today, today.length)}
                    {renderSection('Upcoming', upcoming, upcoming.length)}
                    {renderSection('No Due Date', noDate, noDate.length)}
                  </>
                )
              ) : todoTimeFilter === 'today' ? (
                renderSection('Today', today, today.length)
              ) : todoTimeFilter === 'current' ? (
                renderSection('Current', allCurrent, allCurrent.length)
              ) : todoTimeFilter === 'upcoming' ? (
                renderSection('Upcoming', upcoming, upcoming.length)
              ) : todoTimeFilter === 'overdue' ? (
                renderSection('Overdue', overdue, overdue.length)
              ) : null}

              {overdue.length === 0 && today.length === 0 && upcoming.length === 0 && allCurrent.length === 0 && noDate.length === 0 && (
                <View style={{ paddingHorizontal: 24, paddingVertical: 40, alignItems: 'center' }}>
                  <Square size={48} color="#9CA3AF" strokeWidth={1.5} />
                  <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 16, textAlign: 'center' }}>
                    No {todoFilter} to display
                  </Text>
                </View>
              )}

              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </View>
      );
    }
    if (currentTab === 'gifts') {
      // Avatar colors for people
      const avatarColors = ['#c084fc', '#4ade80', '#60a5fa', '#f97316', '#ec4899', '#facc15'];
      const getAvatarColor = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return avatarColors[Math.abs(hash) % avatarColors.length];
      };

      // Get upcoming events count
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcomingCount = allPeople.filter(p => {
        if (!p.birthday) return false;
        const [year, month, day] = p.birthday.split('-').map(Number);
        const bday = new Date(today.getFullYear(), month - 1, day);
        if (bday < today) bday.setFullYear(today.getFullYear() + 1);
        const diffDays = Math.ceil((bday - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }).length;

      const renderGiftItem = (gift) => (
        <TouchableOpacity
          key={gift.id}
          style={dynamicStyles.newGiftItem}
          onPress={() => openEditForm(gift, 'gift')}
        >
          <Gift size={16} color={themeColors.textMuted} />
          <Text style={dynamicStyles.newGiftItemText}>{gift.idea}</Text>
          {gift.budget && (
            <Text style={dynamicStyles.newGiftItemPrice}>${gift.budget}</Text>
          )}
        </TouchableOpacity>
      );

      const renderPersonCard = (person) => {
        const personGifts = giftIdeas.filter(g => g.person === person.name);
        const avatarColor = getAvatarColor(person.name);
        let dateDisplay = '';
        let occasion = person.occasion || 'Birthday';

        if (person.birthday) {
          const [year, month, day] = person.birthday.split('-').map(Number);
          const bday = new Date(today.getFullYear(), month - 1, day);
          dateDisplay = bday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        return (
          <TouchableOpacity
            key={person.name}
            style={dynamicStyles.newPersonCard}
            onPress={() => openPersonProfile(person)}
          >
            <View style={dynamicStyles.newPersonCardHeader}>
              <View style={[styles.newPersonAvatar, { backgroundColor: avatarColor }]}>
                <Text style={dynamicStyles.newPersonAvatarText}>{person.name[0]}</Text>
              </View>
              <View style={dynamicStyles.newPersonInfo}>
                <Text style={dynamicStyles.newPersonName}>{person.name}</Text>
                <Text style={dynamicStyles.newPersonOccasion}>{occasion}</Text>
              </View>
              {dateDisplay && (
                <View style={[styles.newPersonDateBadge, occasion === 'Birthday' ? styles.birthdayBadge : styles.christmasBadge]}>
                  <Text style={[styles.newPersonDateText, occasion === 'Birthday' ? styles.birthdayText : styles.christmasText]}>
                    {dateDisplay}
                  </Text>
                </View>
              )}
            </View>
            {personGifts.length > 0 && (
              <>
                <Text style={dynamicStyles.newGiftIdeasLabel}>GIFT IDEAS</Text>
                {personGifts.slice(0, 3).map(gift => renderGiftItem(gift))}
              </>
            )}
          </TouchableOpacity>
        );
      };

      // Render personal wishlist item
      const renderWishlistItem = (item) => (
        <Swipeable
          key={item.id}
          renderRightActions={() => (
            <View style={styles.swipeActionContainer}>
              <View style={styles.swipeDeleteButton}>
                <Trash2 size={24} color="#fff" />
                <Text style={styles.swipeDeleteText}>Delete</Text>
              </View>
            </View>
          )}
          onSwipeableRightOpen={() => {
            setPersonalWishlist(prev => prev.filter(i => i.id !== item.id));
          }}
          rightThreshold={80}
          overshootRight={false}
        >
          <TouchableOpacity
            onPress={() => openEditForm(item, 'wishlist')}
            activeOpacity={0.7}
          >
            <View style={[styles.wishlistItem, item.purchased && styles.wishlistItemPurchased]}>
              <TouchableOpacity onPress={(e) => {
                e.stopPropagation();
                setPersonalWishlist(prev => prev.map(i =>
                  i.id === item.id ? { ...i, purchased: !i.purchased } : i
                ));
              }}>
                <View style={[styles.groceryCheckbox, item.purchased && styles.groceryCheckboxChecked]}>
                  {item.purchased && <Check size={16} color="#fff" />}
                </View>
              </TouchableOpacity>
              <View style={styles.wishlistItemInfo}>
                <Text style={[styles.wishlistItemTitle, item.purchased && styles.completedText]}>
                  {item.title}
                </Text>
                {item.notes && (
                  <Text style={[styles.wishlistItemNotes, item.purchased && styles.completedText]} numberOfLines={1}>
                    {item.notes}
                  </Text>
                )}
              </View>
              {item.price && (
                <Text style={[styles.wishlistItemPrice, item.purchased && styles.completedText]}>
                  ${parseFloat(item.price).toFixed(2)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </Swipeable>
      );

      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={dynamicStyles.container}>
          {/* Subheader */}
          <View style={dynamicStyles.giftSubHeader}>
            <Text style={dynamicStyles.giftMainTitle}>
              Gift <Text style={dynamicStyles.giftMainTitleAccent}>Ideas</Text>
            </Text>
          </View>

          {/* Toggle Buttons */}
          <View style={dynamicStyles.giftFilterPills}>
            <TouchableOpacity
              style={[dynamicStyles.filterPill, giftViewMode === 'others' && dynamicStyles.filterPillActive]}
              onPress={() => setGiftViewMode('others')}
            >
              <Text style={[dynamicStyles.filterPillText, giftViewMode === 'others' && dynamicStyles.filterPillTextActive]}>Others</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[dynamicStyles.filterPill, giftViewMode === 'personal' && dynamicStyles.filterPillActive]}
              onPress={() => setGiftViewMode('personal')}
            >
              <Text style={[dynamicStyles.filterPillText, giftViewMode === 'personal' && dynamicStyles.filterPillTextActive]}>Personal</Text>
            </TouchableOpacity>
          </View>

          {giftViewMode === 'others' ? (
            /* Others - Gift ideas for other people */
            <ScrollView style={dynamicStyles.giftPeopleScroll} showsVerticalScrollIndicator={false}>
              {allPeople.map(person => renderPersonCard(person))}
              <View style={{ height: 100 }} />
            </ScrollView>
          ) : (
            /* Personal - User's own wishlist */
            <ScrollView style={dynamicStyles.giftPeopleScroll} showsVerticalScrollIndicator={false}>
              {personalWishlist.length === 0 ? (
                <View style={dynamicStyles.emptyState}>
                  <Gift size={48} color={themeColors.textMuted} />
                  <Text style={dynamicStyles.emptyStateText}>Your Wishlist</Text>
                  <Text style={dynamicStyles.emptyStateSubtext}>Add items you want for yourself</Text>
                </View>
              ) : (
                personalWishlist.map(item => renderWishlistItem(item))
              )}
              <View style={{ height: 100 }} />
            </ScrollView>
          )}
        </View>
        </GestureHandlerRootView>
      );
    }

    if (currentTab === 'calendar') {
      // Get all upcoming events sorted by date
      const getEventsForSelectedDate = () => {
        const allEvents = [...activities, ...personalActivities];
        const selectedDateStr = selectedDate.toISOString().split('T')[0];
        return allEvents
          .filter(event => {
            if (!event.date) return false;
            const eventDateStr = event.date.split('T')[0];
            return eventDateStr === selectedDateStr;
          })
          .sort((a, b) => {
            // Sort by time
            const timeA = a.time || '00:00';
            const timeB = b.time || '00:00';
            return timeA.localeCompare(timeB);
          });
      };

      const selectedDateEvents = getEventsForSelectedDate();

      // Get dates that have events for showing dots
      const getDatesWithEvents = () => {
        const allEvents = [...activities, ...personalActivities];
        const dateMap = {};
        allEvents.forEach(event => {
          if (event.date) {
            const dateStr = event.date.split('T')[0];
            if (!dateMap[dateStr]) dateMap[dateStr] = [];
            dateMap[dateStr].push(event);
          }
        });
        return dateMap;
      };

      const datesWithEvents = getDatesWithEvents();

      const handleEventPress = (event) => {
        if (!event || event.isBirthday || event.isAppleCalendar) return;
        setSelectedActivity(event);
      };

      // Calendar grid helpers
      const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      };

      const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
      };

      const renderCalendarGrid = () => {
        const daysInMonth = getDaysInMonth(selectedDate);
        const firstDay = getFirstDayOfMonth(selectedDate);
        const today = new Date();
        const isCurrentMonth = today.getMonth() === selectedDate.getMonth() && today.getFullYear() === selectedDate.getFullYear();
        const todayDate = today.getDate();

        // Previous month days
        const prevMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 0);
        const prevMonthDays = prevMonth.getDate();

        const days = [];
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        // Add day name headers
        const headerRow = (
          <View key="header" style={dynamicStyles.calGridRow}>
            {dayNames.map(day => (
              <View key={day} style={dynamicStyles.calGridCell}>
                <Text style={dynamicStyles.calGridDayName}>{day}</Text>
              </View>
            ))}
          </View>
        );
        days.push(headerRow);

        // Build calendar grid
        let dayCount = 1;
        let nextMonthDay = 1;
        for (let week = 0; week < 6; week++) {
          const weekDays = [];
          for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const cellIndex = week * 7 + dayOfWeek;
            let dayNumber = null;
            let isCurrentMonthDay = false;
            let dateStr = '';

            if (cellIndex < firstDay) {
              // Previous month
              dayNumber = prevMonthDays - firstDay + cellIndex + 1;
              const prevMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, dayNumber);
              dateStr = prevMonthDate.toISOString().split('T')[0];
            } else if (dayCount <= daysInMonth) {
              // Current month
              dayNumber = dayCount;
              isCurrentMonthDay = true;
              const currentDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNumber);
              dateStr = currentDate.toISOString().split('T')[0];
              dayCount++;
            } else {
              // Next month
              dayNumber = nextMonthDay;
              const nextMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, dayNumber);
              dateStr = nextMonthDate.toISOString().split('T')[0];
              nextMonthDay++;
            }

            const isToday = isCurrentMonthDay && isCurrentMonth && dayNumber === todayDate;
            const isSelected = isCurrentMonthDay && selectedDate.getDate() === dayNumber;
            const eventsOnDay = datesWithEvents[dateStr] || [];
            const hasEvents = eventsOnDay.length > 0;

            weekDays.push(
              <TouchableOpacity
                key={`${week}-${dayOfWeek}`}
                style={dynamicStyles.calGridCell}
                onPress={() => {
                  if (isCurrentMonthDay) {
                    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayNumber);
                    setSelectedDate(newDate);
                  }
                }}
              >
                <View style={[
                  dynamicStyles.calGridDayWrapper,
                  isToday && !isSelected && dynamicStyles.calGridDayTodayOutline,
                  isSelected && dynamicStyles.calGridDaySelected
                ]}>
                  <Text style={[
                    dynamicStyles.calGridDayNumber,
                    !isCurrentMonthDay && dynamicStyles.calGridDayNumberMuted,
                    (isToday && !isSelected) && dynamicStyles.calGridDayNumberToday,
                    isSelected && dynamicStyles.calGridDayNumberSelected
                  ]}>
                    {dayNumber}
                  </Text>
                </View>
                {hasEvents && (
                  <View style={dynamicStyles.calGridDotRow}>
                    {eventsOnDay.slice(0, 3).map((event, idx) => (
                      <View
                        key={idx}
                        style={[styles.calGridDot, { backgroundColor: getEventColor(event) }]}
                      />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          }
          days.push(
            <View key={`week-${week}`} style={dynamicStyles.calGridRow}>
              {weekDays}
            </View>
          );
          if (dayCount > daysInMonth && nextMonthDay > 1) break;
        }

        return days;
      };

      const renderEventCard = (event) => {
        const eventDate = new Date(event.date);
        const dayNum = eventDate.getDate();
        const monthShort = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
        const isAllDay = !event.time || parseTimeToMinutes(event.time) === null;
        const timeDisplay = isAllDay ? 'All Day' : formatTime(event.time);
        const locationDisplay = event.location?.address ? event.location.address.split(',')[0] : '';

        return (
          <TouchableOpacity
            key={event.id}
            style={dynamicStyles.calEventCard}
            onPress={() => handleEventPress(event)}
            disabled={event.isBirthday || event.isAppleCalendar}
          >
            <View style={dynamicStyles.calEventDateBox}>
              <Text style={dynamicStyles.calEventDateNum}>{dayNum}</Text>
              <Text style={dynamicStyles.calEventDateMonth}>{monthShort}</Text>
            </View>
            <View style={dynamicStyles.calEventInfo}>
              <Text style={dynamicStyles.calEventTitle}>{event.title}</Text>
              <Text style={dynamicStyles.calEventMeta}>
                {timeDisplay}{locationDisplay ? ` - ${locationDisplay}` : ''}
              </Text>
            </View>
            <View style={[styles.calEventDot, { backgroundColor: getEventColor(event) }]} />
          </TouchableOpacity>
        );
      };

      const monthLabel = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      return (
        <View style={dynamicStyles.container}>
          {/* Subheader */}
          <View style={dynamicStyles.calSubHeader}>
            <Text style={dynamicStyles.calMainTitle}>
              Your <Text style={dynamicStyles.calMainTitleAccent}>Calendar</Text>
            </Text>
          </View>

          {/* Month Navigation */}
          <View style={dynamicStyles.calMonthNav}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={dynamicStyles.calNavButton}>
              <ChevronLeft size={20} color={themeColors.text} />
            </TouchableOpacity>
            <Text style={dynamicStyles.calMonthLabel}>{monthLabel}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={dynamicStyles.calNavButton}>
              <ChevronRight size={20} color={themeColors.text} />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={dynamicStyles.calGridContainer}>
            {renderCalendarGrid()}
          </View>

          {/* Events for Selected Date */}
          <Text style={dynamicStyles.calUpcomingTitle}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          <ScrollView style={dynamicStyles.calEventsScroll} showsVerticalScrollIndicator={false}>
            {selectedDateEvents.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: themeColors.textMuted, fontSize: 14 }}>No events on this day</Text>
              </View>
            ) : (
              selectedDateEvents.map(event => renderEventCard(event))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </View>
      );
    }

    if (currentTab === 'food' && foodViewMode === 'recipes') {
      const recipeTags = ['All', 'Quick', 'Dinner', 'Dessert', 'Healthy', 'Breakfast', 'Lunch'];
      const recipeColors = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'];

      // Filter recipes by selected tag and search query
      let visibleRecipes = recipes;
      if (selectedCuisine && selectedCuisine !== 'All') {
        visibleRecipes = visibleRecipes.filter(recipe =>
          Array.isArray(recipe.tags) && recipe.tags.includes(selectedCuisine)
        );
      }
      if (foodSearchQuery.trim()) {
        const query = foodSearchQuery.toLowerCase();
        visibleRecipes = visibleRecipes.filter(recipe =>
          recipe.title?.toLowerCase().includes(query) ||
          recipe.description?.toLowerCase().includes(query)
        );
      }

      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={dynamicStyles.container}>
          {/* Subheader */}
          <View style={dynamicStyles.foodSubHeader}>
            <View style={dynamicStyles.foodToggle}>
              <TouchableOpacity onPress={() => setFoodViewMode('restaurants')}>
                <Text style={[dynamicStyles.foodToggleWord, { color: themeColors.textSecondary }]}>Restaurants</Text>
              </TouchableOpacity>
              <Text style={dynamicStyles.foodToggleSeparator}>•</Text>
              <TouchableOpacity onPress={() => setFoodViewMode('recipes')}>
                <Text style={dynamicStyles.foodToggleWord}>Recipes</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View style={dynamicStyles.foodSearchBar}>
            <Search size={18} color={themeColors.textMuted} />
            <TextInput
              style={dynamicStyles.foodSearchInput}
              placeholder="Search recipes..."
              placeholderTextColor={themeColors.textMuted}
              value={foodSearchQuery}
              onChangeText={setFoodSearchQuery}
            />
          </View>

          {/* Tag Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.categoryScroll} contentContainerStyle={{ paddingRight: 24, alignItems: 'center' }}>
            {recipeTags.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[dynamicStyles.filterPill, selectedCuisine === tag && dynamicStyles.filterPillActive]}
                onPress={() => setSelectedCuisine(tag)}
              >
                <Text style={[dynamicStyles.filterPillText, selectedCuisine === tag && dynamicStyles.filterPillTextActive]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Recipes List */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
            {isExtractingRecipe && (
              <View style={dynamicStyles.recipeLoadingBanner}>
                <ActivityIndicator color={themeColors.accentPrimary} />
                <Text style={dynamicStyles.recipeLoadingText}>Extracting recipe…</Text>
              </View>
            )}
            {visibleRecipes.length === 0 ? (
              <View style={[dynamicStyles.emptyState, { marginTop: 40 }]}>
                <BookOpen size={48} color={themeColors.textMuted} />
                <Text style={dynamicStyles.emptyStateText}>No recipes yet</Text>
                <Text style={dynamicStyles.emptyStateSubtext}>
                  Tap + to add your first recipe
                </Text>
              </View>
            ) : (
              visibleRecipes.map((recipe, index) => {
                const bgColor = recipeColors[index % recipeColors.length];

                const handleDeleteRecipe = () => {
                  Alert.alert(
                    'Delete Recipe',
                    `Are you sure you want to delete "${recipe.title}"?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => deleteRecipe(recipe.id),
                      },
                    ]
                  );
                };

                const renderRightActions = (progress, dragX) => {
                  const scale = dragX.interpolate({
                    inputRange: [-100, 0],
                    outputRange: [1, 0.5],
                    extrapolate: 'clamp',
                  });
                  const opacity = dragX.interpolate({
                    inputRange: [-100, -50, 0],
                    outputRange: [1, 0.8, 0],
                    extrapolate: 'clamp',
                  });

                  return (
                    <TouchableOpacity
                      onPress={handleDeleteRecipe}
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          dynamicStyles.swipeDeleteAction,
                          { opacity, transform: [{ scale }] },
                        ]}
                      >
                        <Trash2 size={22} color="#fff" />
                      </Animated.View>
                    </TouchableOpacity>
                  );
                };

                return (
                  <Swipeable
                    key={recipe.id}
                    renderRightActions={renderRightActions}
                    overshootRight={false}
                  >
                    <TouchableOpacity
                      style={dynamicStyles.newRecipeCard}
                      onPress={() => setSelectedRecipe(recipe)}
                      activeOpacity={0.8}
                    >
                      {/* Content */}
                      <View style={dynamicStyles.newRecipeCardContent}>
                        <Text style={dynamicStyles.newRecipeTitle}>{recipe.title}</Text>
                        {recipe.description && (
                          <Text style={dynamicStyles.newRecipeDescription} numberOfLines={2}>{recipe.description}</Text>
                        )}

                        {/* Meta Row */}
                        <View style={dynamicStyles.newRecipeMetaRow}>
                          <View style={dynamicStyles.newRecipeMeta}>
                            <Clock size={14} color={themeColors.textSecondary} />
                            <Text style={dynamicStyles.newRecipeMetaText}>{recipe.cookTime || '35 min'}</Text>
                          </View>
                          <View style={dynamicStyles.newRecipeMeta}>
                            <Users size={14} color={themeColors.textSecondary} />
                            <Text style={dynamicStyles.newRecipeMetaText}>{recipe.servings || '4'} servings</Text>
                          </View>
                          <View style={dynamicStyles.newRecipeMeta}>
                            <Star size={14} color={themeColors.textSecondary} />
                            <Text style={dynamicStyles.newRecipeMetaText}>{recipe.difficulty || 'Easy'}</Text>
                          </View>
                        </View>

                        {/* Tags Row */}
                        {Array.isArray(recipe.tags) && recipe.tags.length > 0 && (
                          <View style={dynamicStyles.recipeTagsRow}>
                            {recipe.tags.map(tag => (
                              <View key={tag} style={dynamicStyles.recipeTagChip}>
                                <Text style={dynamicStyles.recipeTagChipText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                );
              })
            )}
          </ScrollView>
        </View>
        </GestureHandlerRootView>
      );
    }

    if (currentTab === 'food' && foodViewMode === 'restaurants') {
      // Filter and sort restaurants
      let restaurants = getFilteredItems()
        .filter(item => item && item.category === 'restaurants')
        .sort((a, b) => {
          // First sort by favorited (favorited items first)
          if (a.favorited && !b.favorited) return -1;
          if (!a.favorited && b.favorited) return 1;
          // Then by order for items with the same favorited status
          return (a.order || 0) - (b.order || 0);
        });

      // Apply cuisine filter
      if (selectedCuisine !== 'All') {
        restaurants = restaurants.filter(item => item.cuisine === selectedCuisine);
      }

      // Apply search filter
      if (foodSearchQuery.trim()) {
        const query = foodSearchQuery.toLowerCase();
        restaurants = restaurants.filter(item =>
          item.title?.toLowerCase().includes(query) ||
          item.cuisine?.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query)
        );
      }

      const useBoxView = tabSettings.restaurants?.boxView === true;

      // Map view helpers (used when restaurantViewMode === 'map')
      const getMapData = () => {
        const mapRadius = tabSettings.map?.radius || 15;
        const restaurantsWithLocation = restaurants.filter(r => r.location && r.location.latitude && r.location.longitude);
        const hasUserLocation = userLocation && Number.isFinite(userLocation.latitude) && Number.isFinite(userLocation.longitude);

        // Show ALL restaurants (user can pan to see restaurants in other areas)
        let restaurantsInRange = restaurantsWithLocation;

        let centerLat = 0, centerLon = 0, latDelta = 0.2, lonDelta = 0.2;

        if (hasUserLocation) {
          centerLat = userLocation.latitude;
          centerLon = userLocation.longitude;
          const mileRadius = mapRadius;
          const milesPerLatDegree = 69.0;
          latDelta = (mileRadius * 2) / milesPerLatDegree;
          const cosLat = Math.cos(centerLat * Math.PI / 180);
          lonDelta = (mileRadius * 2) / (milesPerLatDegree * Math.abs(cosLat));
        } else if (restaurantsInRange.length > 0) {
          const latitudes = restaurantsInRange.map(r => r.location.latitude);
          const longitudes = restaurantsInRange.map(r => r.location.longitude);
          const minLat = Math.min(...latitudes);
          const maxLat = Math.max(...latitudes);
          const minLon = Math.min(...longitudes);
          const maxLon = Math.max(...longitudes);
          centerLat = (minLat + maxLat) / 2;
          centerLon = (minLon + maxLon) / 2;
          latDelta = Math.max(0.1, (maxLat - minLat) * 1.5);
          lonDelta = Math.max(0.1, (maxLon - minLon) * 1.5);
        }

        return { restaurantsInRange, hasUserLocation, centerLat, centerLon, latDelta, lonDelta };
      };
      const renderRestaurantListItem = ({ item, drag, isActive }) => {
        if (!item) return null;
      const renderRightActions = () => (
        <View style={styles.swipeActionContainer}>
          <View style={styles.swipeDeleteButton}>
            <Trash2 size={24} color="#fff" />
            <Text style={styles.swipeDeleteText}>Delete</Text>
          </View>
        </View>
      );

      const ListContent = (
                <TouchableOpacity
          onPress={() => {
            if (restaurantEditMode) {
              openEditForm(item, 'item');
            } else {
              fetchRestaurantDetails(item);
            }
          }}
                  onLongPress={drag}
                  disabled={isActive}
                  style={{ opacity: isActive ? 0.5 : 1 }}
                >
                  <View style={dynamicStyles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor('restaurants') }]}>
                        <Utensils size={14} color="#fff" />
                        <Text style={styles.categoryText}>restaurants</Text>
                      </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {item.visited && (
                  <View style={styles.visitedBadge}>
                    <Text style={styles.visitedBadgeText}>Visited</Text>
                  </View>
                )}
                {item.happyHour && (
                  <View style={styles.happyHourBadge}>
                    <Text style={styles.happyHourBadgeText}>Happy Hour</Text>
                  </View>
                )}
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}>
                  <Star 
                    size={18} 
                    color={item.favorited ? '#F59E0B' : '#9CA3AF'} 
                    fill={item.favorited ? '#F59E0B' : 'transparent'}
                  />
                </TouchableOpacity>
                      <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteItem(item.id); }}>
                        <Trash2 size={18} color="#EF4444" />
                      </TouchableOpacity>
              </View>
                    </View>
                    <View style={styles.itemContent}>
              <Text style={[dynamicStyles.itemTitle, item.visited && styles.visitedText]}>{item.title}</Text>
                    </View>
            {shouldShowLocationForItem(item) && (
                      <View style={styles.itemLocation}>
                        <MapPin size={14} color={themeColors.textSecondary} />
                <Text style={dynamicStyles.locationText}>{getCityStateFromAddress(item.location.address)}</Text>
                      </View>
                    )}
                    {item.cuisine && (
                      <Text style={dynamicStyles.itemDetail}>Cuisine: {item.cuisine}</Text>
                    )}
            {item.priceRange && shouldShowPriceForItem(item) && (
                      <Text style={dynamicStyles.itemDetail}>Price: {item.priceRange}</Text>
                    )}
                    {item.notes && (
                      <Text style={dynamicStyles.itemNotes}>{item.notes}</Text>
                    )}
                  </View>
                </TouchableOpacity>
      );

      return (
        <Swipeable
          key={item.id}
          renderRightActions={renderRightActions}
          onSwipeableRightOpen={() => deleteItem(item.id)}
          rightThreshold={80}
          overshootRight={false}
          enabled={!isActive}
        >
          {ListContent}
        </Swipeable>
      );
      };

      const renderRestaurantBoxItem = ({ item, drag, isActive }) => {
        if (!item) return null;
        const cityState = item.location ? getCityStateFromAddress(item.location.address) : null;
        return (
        <TouchableOpacity
          onPress={() => {
            if (restaurantEditMode) {
              openEditForm(item, 'item');
            } else {
              fetchRestaurantDetails(item);
            }
          }}
          onLongPress={drag}
          disabled={isActive}
          activeOpacity={0.9}
          style={[styles.restaurantBoxWrapper, isActive && { opacity: 0.5 }]}
        >
          <View style={[styles.restaurantBox, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.restaurantBoxName, { color: themeColors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.cuisine ? (
              <Text style={[styles.restaurantBoxDetail, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {item.cuisine}
              </Text>
            ) : null}
            {cityState ? (
              <Text style={[styles.restaurantBoxDetail, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {cityState}
              </Text>
            ) : null}
            {item.priceRange ? (
              <Text style={[styles.restaurantBoxPrice, { color: themeColors.text }]}>
                {item.priceRange}
              </Text>
            ) : null}
            <View style={styles.restaurantBoxFooter}>
              {item.visited && (
                <View style={styles.restaurantBoxVisitedBadge}>
                  <Text style={styles.restaurantBoxVisitedText}>Visited</Text>
                </View>
              )}
              {item.happyHour && (
                <View style={styles.restaurantBoxHappyHourBadge}>
                  <Text style={styles.restaurantBoxHappyHourText}>Happy Hour</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.restaurantBoxFavorite}
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(item.id);
                }}
              >
                <Star
                  size={18}
                  color={item.favorited ? '#F59E0B' : '#9CA3AF'}
                  fill={item.favorited ? '#F59E0B' : 'transparent'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      );
      };

      // Categories for filtering
      const categories = ['All', 'Italian', 'Japanese', 'Mexican', 'Cafe'];

      // Render restaurant card with new Editorial design
      const renderRestaurantCard = (item) => {
        const cityState = item.location ? getCityStateFromAddress(item.location.address) : null;
        const distance = item.location && userLocation ?
          getDistanceInMiles(userLocation.latitude, userLocation.longitude, item.location.latitude, item.location.longitude) : null;

        return (
          <TouchableOpacity
            key={item.id}
            style={dynamicStyles.restaurantCard}
            onPress={() => {
              if (restaurantEditMode) {
                openEditForm(item, 'item');
              } else {
                fetchRestaurantDetails(item);
              }
            }}
            activeOpacity={0.85}
          >
            <View style={dynamicStyles.restaurantInfo}>
              <Text style={dynamicStyles.restaurantName}>{item.title}</Text>
              <Text style={dynamicStyles.restaurantCuisine}>
                {item.cuisine || 'Restaurant'}{item.notes ? ' · ' + item.notes.substring(0, 40) + (item.notes.length > 40 ? '...' : '') : ''}
              </Text>
              <View style={dynamicStyles.restaurantRating}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Star size={14} color={theme === 'dark' ? '#374151' : '#e5e7eb'} fill={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                <Text style={dynamicStyles.restaurantRatingText}>4.0</Text>
              </View>
              <View style={dynamicStyles.restaurantDetails}>
                {distance && (
                  <View style={dynamicStyles.restaurantDetail}>
                    <MapPin size={12} color={themeColors.textSecondary} />
                    <Text style={dynamicStyles.restaurantDetailText}>{distance.toFixed(1)} mi</Text>
                  </View>
                )}
                {item.priceRange && (
                  <View style={dynamicStyles.restaurantDetail}>
                    <Text style={dynamicStyles.restaurantDetailText}>{item.priceRange}</Text>
                  </View>
                )}
                <View style={dynamicStyles.restaurantDetail}>
                  <Clock size={12} color={themeColors.textSecondary} />
                  <Text style={dynamicStyles.restaurantDetailText}>25 min</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      };

      // Restaurants list or box view with drag-and-drop
      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={dynamicStyles.container}>
          {/* Subheader */}
          <View style={dynamicStyles.foodSubHeader}>
            <View style={dynamicStyles.foodToggle}>
              <TouchableOpacity onPress={() => setFoodViewMode('restaurants')}>
                <Text style={dynamicStyles.foodToggleWord}>Restaurants</Text>
              </TouchableOpacity>
              <Text style={dynamicStyles.foodToggleSeparator}>•</Text>
              <TouchableOpacity onPress={() => setFoodViewMode('recipes')}>
                <Text style={[dynamicStyles.foodToggleWord, { color: themeColors.textSecondary }]}>Recipes</Text>
              </TouchableOpacity>
            </View>
            <View style={dynamicStyles.viewToggleIcons}>
              <TouchableOpacity
                style={[dynamicStyles.viewToggleIconBtn, restaurantViewMode === 'list' && dynamicStyles.viewToggleIconBtnActive]}
                onPress={() => setRestaurantViewMode('list')}
              >
                <Menu size={18} color={restaurantViewMode === 'list' ? '#fff' : themeColors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.viewToggleIconBtn, restaurantViewMode === 'map' && dynamicStyles.viewToggleIconBtnActive]}
                onPress={() => setRestaurantViewMode('map')}
              >
                <MapIcon size={18} color={restaurantViewMode === 'map' ? '#fff' : themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={dynamicStyles.foodSearchBar}>
            <Search size={18} color={themeColors.textMuted} />
            <TextInput style={dynamicStyles.foodSearchInput} placeholder="Search restaurants..." placeholderTextColor={themeColors.textMuted} value={foodSearchQuery} onChangeText={setFoodSearchQuery} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={dynamicStyles.categoryScroll} contentContainerStyle={{ paddingRight: 24, alignItems: 'center' }}>
            {categories.map(category => (
              <TouchableOpacity key={category} style={[dynamicStyles.filterPill, selectedCuisine === category && dynamicStyles.filterPillActive]} onPress={() => setSelectedCuisine(category)}>
                <Text style={[dynamicStyles.filterPillText, selectedCuisine === category && dynamicStyles.filterPillTextActive]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {restaurantViewMode === 'map' ? (
            (() => {
              const { restaurantsInRange, hasUserLocation, centerLat, centerLon, latDelta, lonDelta } = getMapData();
              if (restaurantsInRange.length === 0 && !hasUserLocation) {
                return (
                  <View style={[dynamicStyles.emptyState, { marginTop: 40 }]}>
                    <MapPin size={48} color={themeColors.textMuted} />
                    <Text style={{ fontSize: 16, color: themeColors.textSecondary, marginTop: 12 }}>No restaurants with locations</Text>
                  </View>
                );
              }
              return (
                <View style={styles.embeddedMapContainer}>
                  <MapView
                    style={styles.embeddedMap}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    initialRegion={{
                      latitude: centerLat,
                      longitude: centerLon,
                      latitudeDelta: latDelta,
                      longitudeDelta: lonDelta,
                    }}
                    loadingEnabled={true}
                  >
                    {restaurantsInRange.map(restaurant => (
                      <Marker
                        key={restaurant.id}
                        coordinate={{
                          latitude: restaurant.location.latitude,
                          longitude: restaurant.location.longitude,
                        }}
                        pinColor={restaurant.happyHour ? "#10B981" : "#EF4444"}
                        tracksViewChanges={false}
                      >
                        <Callout onPress={() => fetchRestaurantDetails(restaurant)}>
                          <View style={styles.calloutContainer}>
                            <Text style={styles.calloutTitle}>{restaurant.title}</Text>
                            {restaurant.happyHour && (
                              <Text style={styles.calloutText}>🍻 Happy Hour</Text>
                            )}
                            {restaurant.cuisine && (
                              <Text style={styles.calloutText}>{restaurant.cuisine}</Text>
                            )}
                            <Text style={styles.calloutLink}>Tap for details</Text>
                          </View>
                        </Callout>
                      </Marker>
                    ))}
                  </MapView>
                </View>
              );
            })()
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
              {restaurants.length === 0 ? (
                <View style={[styles.emptyState, { marginTop: 40 }]}>
                  <Utensils size={48} color="#9ca3af" />
                  <Text style={{ fontSize: 16, color: '#6b7280', marginTop: 12 }}>No restaurants found</Text>
                </View>
              ) : (
                restaurants.map(restaurant => renderRestaurantCard(restaurant))
              )}
            </ScrollView>
          )}
        </View>
        </GestureHandlerRootView>
      );
    }

    // Ideas tab with drag-and-drop; default category list
    const listItems = filteredItems.sort((a, b) => (a.order || 0) - (b.order || 0));
    const isIdeas = currentTab === 'ideas';
    if (isIdeas) {
      const completedIdeas = listItems.filter(item => item.completed);
      const activeIdeas = listItems.filter(item => !item.completed);
      const orderedIdeas = [...activeIdeas, ...completedIdeas];
      return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
            {orderedIdeas.length === 0 ? (
              <View style={[dynamicStyles.emptyState, { flex: 1, justifyContent: 'center' }]}>
                <List size={48} color={themeColors.textSecondary} />
                <Text style={dynamicStyles.emptyStateText}>No items yet</Text>
                <Text style={dynamicStyles.emptyStateSubtext}>Tap the + button to add your first item</Text>
              </View>
            ) : (
              <DraggableFlatList
                data={orderedIdeas}
                onDragEnd={({ data }) => handleReorderCategory('ideas', data)}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, drag, isActive }) => {
                  const handleDeleteIdea = () => {
                    Alert.alert(
                      'Delete Idea',
                      `Are you sure you want to delete "${item.title}"?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            deleteItem(item.id, item.isPersonal ? 'ideas' : 'ideas');
                          },
                        },
                      ]
                    );
                  };

                  const renderRightActions = (progress, dragX) => {
                    const scale = dragX.interpolate({
                      inputRange: [-100, 0],
                      outputRange: [1, 0.5],
                      extrapolate: 'clamp',
                    });
                    const opacity = dragX.interpolate({
                      inputRange: [-100, -50, 0],
                      outputRange: [1, 0.8, 0],
                      extrapolate: 'clamp',
                    });

                    return (
                      <TouchableOpacity
                        onPress={handleDeleteIdea}
                        activeOpacity={0.8}
                      >
                        <Animated.View
                          style={[
                            dynamicStyles.swipeDeleteAction,
                            { opacity, transform: [{ scale }] },
                          ]}
                        >
                          <Trash2 size={22} color="#fff" />
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  };

                  const IdeaContent = (
                  <TouchableOpacity
                    onPress={() => openEditForm(item, 'item')}
                    onLongPress={drag}
                    disabled={isActive}
                    style={{ opacity: isActive ? 0.5 : 1 }}
                  >
                    <View style={dynamicStyles.ideaCard}>
                      <View style={dynamicStyles.ideaCardHeader}>
                        <Text style={[dynamicStyles.ideaTitle, item.completed && dynamicStyles.completedText]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View style={dynamicStyles.ideaCategoryBadge}>
                          <Text style={dynamicStyles.ideaCategoryBadgeText}>
                            {item.isPersonal ? 'Personal' : 'Household'}
                          </Text>
                        </View>
                      </View>
                      {item.notes && (
                        <Text style={[dynamicStyles.ideaDescription, item.completed && dynamicStyles.completedText]}>
                          {item.notes}
                        </Text>
                      )}
                      {/* Display tags */}
                      {item.tagIds && item.tagIds.length > 0 && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {item.tagIds.map((tagId) => {
                            const tag = ideaTags.find(t => t.id === tagId);
                            if (!tag) return null;
                            return (
                              <View
                                key={tagId}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                  borderRadius: 12,
                                  backgroundColor: tag.color + '20',
                                }}
                              >
                                <View
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: tag.color,
                                    marginRight: 4,
                                  }}
                                />
                                <Text style={{ fontSize: 11, color: tag.color, fontWeight: '500' }}>
                                  {tag.name}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                      <View style={dynamicStyles.ideaCardFooter}>
                        <Text style={dynamicStyles.ideaCardDate}>
                          {item.createdAt ? 'Added ' + new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                        <View style={dynamicStyles.ideaCardActions}>
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleIdeaFavorite(item); }}>
                            <Star size={22} color={item.favorited ? themeColors.accentPrimary : themeColors.textMuted} fill={item.favorited ? themeColors.accentPrimary : 'none'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  );

                  return (
                    <Swipeable
                      key={item.id}
                      renderRightActions={renderRightActions}
                      rightThreshold={40}
                      overshootRight={false}
                      friction={2}
                      enabled={!isActive}
                    >
                      {IdeaContent}
                    </Swipeable>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 0 }}
              />
            )}
        </GestureHandlerRootView>
      );
    }

    // All items tab with collapsible categories
    if (currentTab === 'all') {
      // Group items by category, filtering out hidden tabs
      const groupedItems = {};
      filteredItems.forEach(item => {
        const category = item.category || 'other';
        // Skip if this category's tab is hidden
        if (category === 'ideas' && !tabVisibility.ideas) return;
        if (category === 'restaurants' && !tabVisibility.restaurants) return;
        if (category === 'todo' && !tabVisibility.todo) return;
        if (category === 'groceries' && !tabVisibility.groceries) return;
        
        if (!groupedItems[category]) {
          groupedItems[category] = [];
        }
        groupedItems[category].push(item);
      });
      
      // Also group activities separately (only if calendar/todo is visible)
      if (tabVisibility.todo || tabVisibility.calendar) {
        const filteredActivities = getFilteredActivities();
        if (filteredActivities.length > 0) {
          groupedItems['activities'] = filteredActivities;
        }
      }
      
      // Define category order and display names - filter out hidden categories
      const categoryOrder = ['ideas', 'restaurants', 'todo', 'activities', 'groceries'].filter(cat => {
        if (cat === 'ideas') return tabVisibility.ideas;
        if (cat === 'restaurants') return tabVisibility.restaurants;
        if (cat === 'todo') return tabVisibility.todo;
        if (cat === 'activities') return tabVisibility.todo || tabVisibility.calendar;
        if (cat === 'groceries') return tabVisibility.groceries;
        return true;
      });
      const categoryNames = {
        ideas: 'Ideas',
        restaurants: 'Restaurants',
        todo: 'Tasks',
        activities: 'Activities',
        groceries: 'Groceries',
      };
      
      const toggleCategory = (category) => {
        setExpandedCategories(prev => ({
          ...prev,
          [category]: !prev[category]
        }));
      };
      
      const renderItemCard = (item, isActivity = false) => (
        <TouchableOpacity key={item.id} onPress={() => isActivity ? setSelectedActivity(item) : openEditForm(item, 'item')}>
          <View style={dynamicStyles.itemCard}>
            {!isActivity && item.category === 'todo' && item.priority && (
              <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
            )}
            <View style={styles.itemHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(isActivity ? 'activities' : item.category) }]}>
                {isActivity ? <Calendar size={14} color="#fff" /> : getCategoryIcon(item.category)}
                <Text style={styles.categoryText}>{isActivity ? 'Activity' : item.category}</Text>
              </View>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteItem(item.id, isActivity ? 'activities' : 'items'); }}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <View style={styles.itemContent}>
              {isActivity ? (
                <>
                  <Text style={dynamicStyles.itemTitle}>{item.title}</Text>
                  <Text style={styles.activityDate}>{formatDate(item.date)} at {formatTime(item.time)}</Text>
                </>
              ) : (
                <View style={styles.itemTitleRow}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleComplete(item.id, 'items'); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <View style={[dynamicStyles.checkbox, item.completed && dynamicStyles.checkboxCompleted]}>
                      {item.completed && <Check size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                  <Text style={[dynamicStyles.itemTitle, item.completed && styles.completedText]}>
                    {item.title}
                  </Text>
                </View>
              )}
            </View>
            {shouldShowLocationForItem(item) && (
              <View style={styles.itemLocation}>
                <MapPin size={14} color={themeColors.textSecondary} />
                <Text style={dynamicStyles.locationText}>{item.location.address}</Text>
              </View>
            )}
            {item.cuisine && (
              <Text style={dynamicStyles.itemDetail}>Cuisine: {item.cuisine}</Text>
            )}
            {item.priceRange && shouldShowPriceForItem(item) && (
              <Text style={dynamicStyles.itemDetail}>Price: {item.priceRange}</Text>
            )}
            {item.notes && (
              <Text style={dynamicStyles.itemNotes}>{item.notes}</Text>
            )}
            {item.dueDate && (
              <Text style={styles.itemDueDate}>Due: {formatDate(item.dueDate)}</Text>
            )}
            {item.category === 'groceries' && shouldShowPriceForItem(item) && typeof item.price === 'number' && (
              <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            )}
          </View>
        </TouchableOpacity>
      );
      
      const allCategories = [...categoryOrder, ...Object.keys(groupedItems).filter(cat => !categoryOrder.includes(cat))];
      
      return (
        <View style={styles.container}>
          <ScrollView style={dynamicStyles.content}>
            {allCategories.map(category => {
              const items = groupedItems[category] || [];
              if (items.length === 0) return null;
              
              const isExpanded = expandedCategories[category] !== false;
              const categoryName = categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
              const isActivity = category === 'activities';
              
              return (
                <View key={category} style={styles.categorySection}>
                  <TouchableOpacity
                    style={dynamicStyles.categoryHeader}
                    onPress={() => toggleCategory(category)}
                  >
                    <View style={styles.categoryHeaderContent}>
                      <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(category) }]}>
                        {isActivity ? <Calendar size={16} color="#fff" /> : getCategoryIcon(category)}
                        <Text style={dynamicStyles.categoryHeaderText}>{categoryName}</Text>
                      </View>
                      <View style={styles.categoryHeaderRight}>
                        <Text style={dynamicStyles.categoryCount}>{items.length}</Text>
                        {isExpanded ? (
                          <ChevronUp size={20} color={themeColors.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={themeColors.textSecondary} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.categoryItems}>
                      {items.map(item => renderItemCard(item, isActivity))}
                    </View>
                  )}
                </View>
              );
            })}
            {Object.keys(groupedItems).length === 0 && (
              <View style={styles.emptyState}>
                <List size={48} color={themeColors.textSecondary} />
                <Text style={dynamicStyles.emptyStateText}>No items yet</Text>
                <Text style={dynamicStyles.emptyStateSubtext}>Tap the + button to add your first item</Text>
              </View>
            )}
          </ScrollView>
        </View>
      );
    }

    // Groceries tab with categories and quick-add
    if (currentTab === 'groceries') {
      const groceryItems = [...filteredItems].sort((a, b) => (a.order || 0) - (b.order || 0));

      // Group by subcategory
      const categorizedGroceries = {
        produce: [],
        dairy: [],
        meat: [],
        bakery: [],
        pantry: [],
        frozen: [],
        beverages: [],
        household: [],
        other: [],
      };

      groceryItems.forEach(item => {
        const subcat = getGrocerySubcategory(item);
        if (categorizedGroceries[subcat]) {
          categorizedGroceries[subcat].push(item);
        } else {
          categorizedGroceries.other.push(item);
        }
      });

      // Separate completed/active within each category
      Object.keys(categorizedGroceries).forEach(cat => {
        const active = categorizedGroceries[cat].filter(i => !i.completed);
        const completed = categorizedGroceries[cat].filter(i => i.completed);
        categorizedGroceries[cat] = [...active, ...completed];
      });

      const totalItems = groceryItems.length;
      const activeItems = groceryItems.filter(i => !i.completed).length;
      const totalPrice = groceryItems
        .filter(i => !i.completed && typeof i.price === 'number')
        .reduce((sum, i) => sum + i.price, 0);

      const categoryConfig = {
        produce: { label: 'Produce', emoji: '🥬' },
        dairy: { label: 'Dairy', emoji: '🥛' },
        meat: { label: 'Meat & Seafood', emoji: '🥩' },
        bakery: { label: 'Bakery', emoji: '🥖' },
        pantry: { label: 'Pantry', emoji: '🥫' },
        frozen: { label: 'Frozen', emoji: '🧊' },
        beverages: { label: 'Beverages', emoji: '🥤' },
        household: { label: 'Household', emoji: '🧹' },
        other: { label: 'Other', emoji: '📦' },
      };

      const categoryOrder = ['produce', 'dairy', 'meat', 'bakery', 'pantry', 'frozen', 'beverages', 'household', 'other'];

      return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: themeColors.background }}>
          <View style={dynamicStyles.container}>
            {/* Shop Mode Selector */}
            <View style={dynamicStyles.shopModeSelector}>
              <TouchableOpacity
                style={[dynamicStyles.shopModeButton, shopMode === 'grocery' && dynamicStyles.shopModeButtonActive]}
                onPress={() => setShopMode('grocery')}
              >
                <Text style={[dynamicStyles.shopModeButtonText, shopMode === 'grocery' && dynamicStyles.shopModeButtonTextActive]}>Grocery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.shopModeButton, shopMode === 'other' && dynamicStyles.shopModeButtonActive]}
                onPress={() => setShopMode('other')}
              >
                <Text style={[dynamicStyles.shopModeButtonText, shopMode === 'other' && dynamicStyles.shopModeButtonTextActive]}>Other</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.content} contentContainerStyle={{ paddingBottom: 120 }}>
              {shopMode === 'grocery' ? (
                <>
              {/* Empty State or Category Sections */}
              {totalItems === 0 ? (
                <View style={styles.emptyState}>
                  <ShoppingCart size={48} color={themeColors.textSecondary} />
                  <Text style={dynamicStyles.emptyStateText}>No items yet</Text>
                  <Text style={dynamicStyles.emptyStateSubtext}>Tap the + button to add your first item</Text>
                </View>
              ) : (
                categoryOrder.map(subcategory => {
                  const categoryItems = categorizedGroceries[subcategory];
                  if (categoryItems.length === 0) return null;

                  const isExpanded = expandedGroceryCategories[subcategory];
                  const config = categoryConfig[subcategory];
                  const completedCount = categoryItems.filter(i => i.completed).length;

                  return (
                    <View key={subcategory} style={dynamicStyles.groceryCategorySection}>
                      <TouchableOpacity
                        style={dynamicStyles.groceryCategoryHeader}
                        onPress={() =>
                          setExpandedGroceryCategories(prev => ({
                            ...prev,
                            [subcategory]: !prev[subcategory]
                          }))
                        }
                        activeOpacity={0.7}
                      >
                        <View style={dynamicStyles.groceryCategoryHeaderLeft}>
                          <Text style={dynamicStyles.groceryCategoryEmoji}>{config.emoji}</Text>
                          <Text style={dynamicStyles.groceryCategoryTitle}>
                            {config.label}
                          </Text>
                          <Text style={dynamicStyles.groceryCategoryCount}>
                            {categoryItems.length - completedCount}/{categoryItems.length}
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronUp size={20} color={themeColors.textSecondary} />
                        ) : (
                          <ChevronDown size={20} color={themeColors.textSecondary} />
                        )}
                      </TouchableOpacity>

                      {isExpanded && categoryItems.map((item) => {
                        const handleDeleteGrocery = () => {
                          Alert.alert(
                            'Delete Item',
                            `Are you sure you want to delete "${item.title}"?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => deleteItem(item.id),
                              },
                            ]
                          );
                        };

                        const renderRightActions = (progress, dragX) => {
                          const scale = dragX.interpolate({
                            inputRange: [-100, 0],
                            outputRange: [1, 0.5],
                            extrapolate: 'clamp',
                          });
                          const opacity = dragX.interpolate({
                            inputRange: [-100, -50, 0],
                            outputRange: [1, 0.8, 0],
                            extrapolate: 'clamp',
                          });

                          return (
                            <TouchableOpacity
                              onPress={handleDeleteGrocery}
                              activeOpacity={0.8}
                            >
                              <Animated.View
                                style={[
                                  dynamicStyles.swipeDeleteAction,
                                  { opacity, transform: [{ scale }] },
                                ]}
                              >
                                <Trash2 size={22} color="#fff" />
                              </Animated.View>
                            </TouchableOpacity>
                          );
                        };

                        return (
                          <Swipeable
                            key={item.id}
                            renderRightActions={renderRightActions}
                            rightThreshold={40}
                            overshootRight={false}
                            friction={2}
                          >
                            <TouchableOpacity
                              onPress={() => openEditForm(item, 'item')}
                              activeOpacity={0.7}
                            >
                              <View style={[dynamicStyles.groceryCard, item.completed && dynamicStyles.groceryCardCompleted]}>
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleComplete(item.id); }}>
                                  <View style={[dynamicStyles.groceryCheckbox, item.completed && dynamicStyles.groceryCheckboxChecked]}>
                                    {item.completed && <Check size={16} color="#fff" />}
                                  </View>
                                </TouchableOpacity>
                                <View style={dynamicStyles.groceryInfo}>
                                  <Text style={[dynamicStyles.groceryName, item.completed && dynamicStyles.groceryNameChecked]}>
                                    {item.title}
                                  </Text>
                                  {item.notes && (
                                    <Text style={[dynamicStyles.ideaDescription, item.completed && dynamicStyles.completedText]} numberOfLines={1}>
                                      {item.notes}
                                    </Text>
                                  )}
                                </View>
                                {shouldShowPriceForItem(item) && typeof item.price === 'number' && (
                                  <Text style={[dynamicStyles.groceryItemPrice, item.completed && dynamicStyles.completedText]}>
                                    ${item.price.toFixed(2)}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          </Swipeable>
                        );
                      })}
                    </View>
                  );
                })
              )}
                </>
              ) : (
                /* Other Shop Items Section */
                <>
                  {otherShopItems.length === 0 ? (
                    <View style={styles.emptyState}>
                      <ShoppingBag size={48} color={themeColors.textSecondary} />
                      <Text style={dynamicStyles.emptyStateText}>No items yet</Text>
                      <Text style={dynamicStyles.emptyStateSubtext}>Add items from other stores</Text>
                    </View>
                  ) : (
                    otherShopItems.map((item) => {
                      const handleDeleteOtherShop = () => {
                        Alert.alert(
                          'Delete Item',
                          `Are you sure you want to delete "${item.title}"?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                setOtherShopItems(prev => prev.filter(i => i.id !== item.id));
                              },
                            },
                          ]
                        );
                      };

                      const renderRightActions = (progress, dragX) => {
                        const scale = dragX.interpolate({
                          inputRange: [-100, 0],
                          outputRange: [1, 0.5],
                          extrapolate: 'clamp',
                        });
                        const opacity = dragX.interpolate({
                          inputRange: [-100, -50, 0],
                          outputRange: [1, 0.8, 0],
                          extrapolate: 'clamp',
                        });

                        return (
                          <TouchableOpacity
                            onPress={handleDeleteOtherShop}
                            activeOpacity={0.8}
                          >
                            <Animated.View
                              style={[
                                dynamicStyles.swipeDeleteAction,
                                { opacity, transform: [{ scale }] },
                              ]}
                            >
                              <Trash2 size={22} color="#fff" />
                            </Animated.View>
                          </TouchableOpacity>
                        );
                      };

                      return (
                        <Swipeable
                          key={item.id}
                          renderRightActions={renderRightActions}
                          rightThreshold={40}
                          overshootRight={false}
                          friction={2}
                        >
                          <TouchableOpacity
                            onPress={() => openEditForm(item, 'otherShop')}
                            activeOpacity={0.7}
                          >
                            <View style={[dynamicStyles.groceryCard, item.completed && dynamicStyles.groceryCardCompleted]}>
                              <TouchableOpacity onPress={(e) => {
                                e.stopPropagation();
                                setOtherShopItems(prev => prev.map(i =>
                                  i.id === item.id ? { ...i, completed: !i.completed } : i
                                ));
                              }}>
                                <View style={[dynamicStyles.groceryCheckbox, item.completed && dynamicStyles.groceryCheckboxChecked]}>
                                  {item.completed && <Check size={16} color="#fff" />}
                                </View>
                              </TouchableOpacity>
                              <View style={dynamicStyles.groceryInfo}>
                                <Text style={[dynamicStyles.groceryName, item.completed && dynamicStyles.groceryNameChecked]}>
                                  {item.title}
                                </Text>
                                {item.store && (
                                  <Text style={[dynamicStyles.ideaDescription, item.completed && dynamicStyles.completedText]} numberOfLines={1}>
                                    {item.store}
                                  </Text>
                                )}
                              </View>
                              {typeof item.price === 'number' && (
                                <Text style={[dynamicStyles.groceryItemPrice, item.completed && dynamicStyles.completedText]}>
                                  ${item.price.toFixed(2)}
                                </Text>
                              )}
                            </View>
                          </TouchableOpacity>
                        </Swipeable>
                      );
                    })
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </GestureHandlerRootView>
      );
    }

    // Fallback - should never reach here since currentTab is always valid
    // But if it does, return null to avoid showing incorrect content
    return null;
  };

  const getCategoryColor = (category) => {
    return getThemeCategoryColor(category, theme);
  };

  const getPriorityColor = (priority) => {
    return getThemePriorityColor(priority, theme);
  };

  // Get priority weight for sorting (higher number = higher priority)
  const getPriorityWeight = (priority) => {
    if (!priority) return 2; // Default to medium if no priority
    const normalizedPriority = priority.toLowerCase().trim();
    const weights = {
      urgent: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    return weights[normalizedPriority] || 2; // Default to medium if unknown
  };

  // Theme colors - using centralized theme system
  const colors = getThemeColors(theme);
  const themeColors = {
    background: colors.background,
    surface: colors.surface,
    surfaceSecondary: colors.surfaceElevated,
    text: colors.text,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    border: colors.border,
    borderWarm: colors.borderWarm,
    inputBg: colors.inputBg,
    inputBorder: colors.inputBorder,
    accentPrimary: colors.accent,
    accentSecondary: colors.success,
    shadowSoft: colors.shadow,
    shadowMedium: colors.shadowMedium,
  };

  const dynamicStyles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    searchInput: {
      flex: 1,
      color: themeColors.text,
      fontSize: 16,
    },
    tabs: {
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    content: {
      flex: 1,
      padding: 16,
      backgroundColor: themeColors.background,
    },
    emptyStateText: {
      color: themeColors.textSecondary,
      fontSize: 18,
      fontWeight: '600',
      marginTop: 16,
    },
    emptyStateSubtext: {
      color: themeColors.textSecondary,
      fontSize: 14,
      marginTop: 8,
    },
    itemCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    itemTitle: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    locationText: {
      color: themeColors.textSecondary,
      fontSize: 14,
    },
    itemDetail: {
      color: themeColors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
    itemNotes: {
      color: themeColors.textSecondary,
      fontSize: 14,
      marginTop: 8,
      fontStyle: 'italic',
    },
    categoryHeader: {
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    categoryHeaderText: {
      color: themeColors.text,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 6,
    },
    categoryCount: {
      color: themeColors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: themeColors.textSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabText: {
      color: themeColors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    activeTabText: {
      color: '#fff',
    },
    subTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: themeColors.surface,
    },
    subTabText: {
      color: themeColors.textSecondary,
      fontSize: 14,
    },
    activeSubTabText: {
      color: '#fff',
    },
    viewModeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: themeColors.surface,
    },
    viewModeText: {
      color: themeColors.textSecondary,
      fontSize: 14,
    },
    activeViewModeText: {
      color: '#fff',
    },
    // App Header
    appHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
      backgroundColor: themeColors.background,
    },
    logoContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    logoIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: themeColors.accentPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.text,
      letterSpacing: -0.5,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: themeColors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    avatarText: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
    },
    settingsButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Bottom Tab Bar
    bottomTabBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 85,
      backgroundColor: themeColors.surface,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingBottom: 20,
      paddingTop: 8,
    },
    bottomTabLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: themeColors.textSecondary,
    },
    // Page Headers
    pageMainTitle: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    // Section Headers
    sectionTitle: {
      fontFamily: 'PlayfairDisplay_400Regular_Italic',
      fontSize: 22,
      color: themeColors.text,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginTop: -8,
      marginBottom: 16,
    },
    // Cards
    card: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
      shadowColor: themeColors.shadowSoft,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    cardText: {
      fontSize: 14,
      color: themeColors.textSecondary,
      lineHeight: 20,
    },
    // Today Screen
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    todaySubHeader: {
      paddingHorizontal: 0,
      paddingTop: 8,
      paddingBottom: 20,
    },
    todayDate: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.accentPrimary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    todayGreeting: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    todayGreetingName: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      color: themeColors.accentPrimary,
    },
    greetingContainer: {
      backgroundColor: themeColors.surfaceSecondary,
      paddingHorizontal: 24,
      paddingVertical: 16,
      marginBottom: 16,
    },
    greetingDate: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.accentPrimary,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 4,
    },
    greetingText: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 26,
      color: themeColors.text,
    },
    greetingName: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      color: themeColors.accentPrimary,
    },
    weatherCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    weatherLocation: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    weatherTemp: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 56,
      fontWeight: '200',
      color: themeColors.text,
      lineHeight: 60,
    },
    weatherTempUnit: {
      fontSize: 24,
      fontWeight: '300',
      color: themeColors.textSecondary,
      marginTop: 4,
    },
    weatherIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(180, 83, 9, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    weatherConditionItalic: {
      fontFamily: 'PlayfairDisplay_400Regular_Italic',
      fontSize: 16,
      color: themeColors.text,
      marginBottom: 4,
    },
    weatherHighLow: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    weatherToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: themeColors.border,
    },
    weatherToggleLabel: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    forecastDayCard: {
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 12,
      minWidth: 80,
    },
    forecastDayName: {
      fontSize: 13,
      fontWeight: '500',
      color: themeColors.textSecondary,
    },
    forecastDayTemp: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
    },
    todayWeatherEmpty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
    todayWeatherEmptyText: {
      fontSize: 16,
      fontWeight: '500',
      color: themeColors.textSecondary,
      marginTop: 12,
    },
    todayWeatherEmptySubtext: {
      fontSize: 14,
      color: themeColors.textMuted,
      marginTop: 4,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionTitle: {
      fontFamily: 'PlayfairDisplay_400Regular_Italic',
      fontSize: 22,
      color: themeColors.text,
    },
    sectionAction: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.accentPrimary,
    },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 0,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    activityTimeBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 50,
    },
    activityTime: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
    },
    activityPeriod: {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.textMuted,
      textTransform: 'uppercase',
    },
    activityDivider: {
      width: 1,
      height: 36,
      backgroundColor: themeColors.border,
      marginHorizontal: 16,
    },
    activityInfo: {
      flex: 1,
    },
    activityTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: themeColors.text,
      marginBottom: 2,
    },
    activityLocation: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    activityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginLeft: 12,
    },
    todayEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 14,
    },
    todayEmptyText: {
      fontSize: 15,
      color: themeColors.textSecondary,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: themeColors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.surface,
    },
    checkboxCompleted: {
      backgroundColor: themeColors.accentPrimary,
      borderColor: themeColors.accentPrimary,
    },
    completedText: {
      textDecorationLine: 'line-through',
      color: themeColors.textMuted,
    },
    weatherDesc: {
      fontSize: 16,
      color: themeColors.text,
      fontStyle: 'italic',
    },
    // Filter Pills
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      marginRight: 8,
    },
    filterPillActive: {
      backgroundColor: themeColors.accentPrimary,
      borderColor: themeColors.accentPrimary,
    },
    filterPillText: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.text,
    },
    filterPillTextActive: {
      color: '#fff',
    },
    filterPills: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      paddingVertical: 12,
      flexWrap: 'wrap',
      gap: 8,
    },
    // To Do Screen
    todoSubHeader: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    todoMainTitle: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    todoMainTitleAccent: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      color: themeColors.accentPrimary,
    },
    todoToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      marginBottom: 8,
    },
    todoToggle: {
      flexDirection: 'row',
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 8,
      padding: 4,
    },
    todoToggleItem: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
    },
    todoToggleItemActive: {
      backgroundColor: themeColors.surface,
    },
    todoToggleText: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 1,
      color: themeColors.textMuted,
    },
    todoToggleTextActive: {
      color: themeColors.accentPrimary,
    },
    mapToggleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    todoSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    todoSectionTitle: {
      fontFamily: 'PlayfairDisplay_400Regular_Italic',
      fontSize: 18,
      color: themeColors.text,
    },
    taskCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 14,
      padding: 16,
      marginHorizontal: 0,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    swipeDeleteAction: {
      backgroundColor: '#ef4444',
      justifyContent: 'center',
      alignItems: 'center',
      width: 80,
      height: '100%',
      borderRadius: 14,
      marginBottom: 10,
      marginLeft: 8,
    },
    taskInfo: {
      flex: 1,
      marginLeft: 14,
    },
    taskMeta: {
      fontSize: 13,
      color: themeColors.textSecondary,
      marginTop: 4,
    },
    taskTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: themeColors.text,
    },
    // Ideas Screen
    ideasSubheader: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    ideasSubheaderTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    ideasSubheaderTitleRegular: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    ideasSubheaderTitleItalic: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      fontSize: 28,
      color: themeColors.accentPrimary,
    },
    ideaFilterScroll: {
      flexGrow: 0,
      flexShrink: 0,
      marginBottom: 16,
      maxHeight: 60,
    },
    ideaCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 18,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
      overflow: 'hidden',
    },
    ideaTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.text,
      flex: 1,
      flexShrink: 1,
      marginRight: 12,
    },
    ideaDescription: {
      fontSize: 14,
      color: themeColors.textSecondary,
      lineHeight: 20,
    },
    ideaCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      overflow: 'hidden',
    },
    ideaCategoryBadge: {
      backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(180, 83, 9, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      flexShrink: 0,
    },
    ideaCategoryBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.accentPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    ideaCardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    ideaCardDate: {
      fontSize: 12,
      color: themeColors.textMuted,
    },
    ideaCardActions: {
      flexDirection: 'row',
      gap: 8,
    },
    // Gifts Screen
    giftSubHeader: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    giftMainTitle: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    giftMainTitleAccent: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      color: themeColors.accentPrimary,
    },
    giftFilterPills: {
      flexDirection: 'row',
      paddingHorizontal: 24,
      marginBottom: 16,
      gap: 8,
    },
    giftPeopleScroll: {
      flex: 1,
      paddingHorizontal: 24,
    },
    newPersonCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    newPersonCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    newPersonAvatarText: {
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.text,
    },
    newPersonInfo: {
      flex: 1,
      marginLeft: 14,
    },
    newPersonName: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
    },
    newPersonOccasion: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    newGiftIdeasLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: themeColors.textMuted,
      letterSpacing: 1,
      marginBottom: 10,
    },
    newGiftItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    newGiftItemText: {
      fontSize: 15,
      color: themeColors.text,
      flex: 1,
    },
    newGiftItemPrice: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.accentPrimary,
    },
    wishlistItemInfo: {
      flex: 1,
    },
    // Calendar Screen
    calSubHeader: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    calMainTitle: {
      fontFamily: 'PlayfairDisplay_400Regular',
      fontSize: 28,
      color: themeColors.text,
    },
    calMainTitleAccent: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      color: themeColors.accentPrimary,
    },
    calMonthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    calNavButton: {
      padding: 8,
    },
    calMonthLabel: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 20,
      color: themeColors.text,
    },
    calGridContainer: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      marginHorizontal: 24,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    calGridRow: {
      flexDirection: 'row',
    },
    calGridCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
    },
    calGridDayName: {
      fontSize: 12,
      fontWeight: '600',
      color: themeColors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    calGridDotRow: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 4,
    },
    calGridDayWrapper: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calGridDayTodayOutline: {
      borderWidth: 2,
      borderColor: themeColors.accentPrimary,
    },
    calGridDaySelected: {
      backgroundColor: themeColors.accentPrimary,
    },
    calGridDayNumber: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.text,
    },
    calGridDayNumberMuted: {
      color: themeColors.textMuted,
    },
    calGridDayNumberToday: {
      color: themeColors.accentPrimary,
      fontWeight: '600',
    },
    calGridDayNumberSelected: {
      color: '#fff',
      fontWeight: '600',
    },
    calUpcomingTitle: {
      fontFamily: 'PlayfairDisplay_400Regular_Italic',
      fontSize: 20,
      color: themeColors.text,
      paddingHorizontal: 24,
      marginBottom: 16,
    },
    calEventsScroll: {
      paddingHorizontal: 24,
    },
    calEventCard: {
      flexDirection: 'row',
      backgroundColor: themeColors.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    calEventDateBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 16,
      borderRightWidth: 1,
      borderRightColor: themeColors.border,
      minWidth: 60,
    },
    calEventDateNum: {
      fontSize: 24,
      fontWeight: '600',
      color: themeColors.text,
    },
    calEventDateMonth: {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
    },
    calEventInfo: {
      flex: 1,
      paddingLeft: 16,
      justifyContent: 'center',
    },
    calEventTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 4,
    },
    calEventMeta: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    // Food Screen
    foodSubHeader: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    foodToggle: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewToggleIcons: {
      flexDirection: 'row',
      backgroundColor: themeColors.surface,
      borderRadius: 10,
      padding: 4,
      gap: 4,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    viewToggleIconBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    viewToggleIconBtnActive: {
      backgroundColor: themeColors.accentPrimary,
    },
    foodToggleWord: {
      fontFamily: 'PlayfairDisplay_500Medium_Italic',
      fontSize: 28,
      color: themeColors.accentPrimary,
    },
    foodToggleSeparator: {
      fontSize: 24,
      color: themeColors.textMuted,
      marginHorizontal: 12,
    },
    foodSearchBar: {
      flexGrow: 0,
      flexShrink: 0,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      paddingHorizontal: 14,
      marginHorizontal: 24,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    foodSearchInput: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 10,
      fontSize: 16,
      color: themeColors.text,
    },
    categoryScroll: {
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: 24,
      marginBottom: 16,
      maxHeight: 50,
    },
    newRecipeCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
      overflow: 'hidden',
    },
    newRecipeCardContent: {
      padding: 16,
    },
    newRecipeTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 6,
    },
    newRecipeDescription: {
      fontSize: 14,
      color: themeColors.textSecondary,
      lineHeight: 20,
      marginBottom: 12,
    },
    newRecipeMetaRow: {
      flexDirection: 'row',
      gap: 16,
    },
    newRecipeMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    newRecipeMetaText: {
      fontSize: 13,
      color: themeColors.textSecondary,
    },
    recipeTagsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 12,
    },
    recipeTagChip: {
      backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(180, 83, 9, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
    },
    recipeTagChipText: {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.accentPrimary,
    },
    recipeLoadingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.surfaceSecondary,
      paddingVertical: 12,
      marginHorizontal: 24,
      borderRadius: 12,
      marginBottom: 16,
      gap: 10,
    },
    recipeLoadingText: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    restaurantCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    restaurantInfo: {
      flex: 1,
    },
    restaurantName: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 4,
    },
    restaurantCuisine: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginBottom: 6,
    },
    restaurantRating: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: 6,
    },
    restaurantRatingText: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.text,
    },
    restaurantDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    restaurantDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    restaurantDetailText: {
      fontSize: 13,
      color: themeColors.textSecondary,
    },
    viewToggle: {
      flexDirection: 'row',
      flexGrow: 0,
      flexShrink: 0,
      paddingHorizontal: 24,
      gap: 8,
      marginBottom: 16,
    },
    // Groceries Screen
    groceriesPageHeader: {
      paddingHorizontal: 24,
      paddingTop: 8,
      paddingBottom: 16,
    },
    shopModeSelector: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      marginBottom: 8,
      gap: 12,
      backgroundColor: 'transparent',
    },
    shopModeButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    shopModeButtonActive: {
      backgroundColor: themeColors.accentPrimary,
      borderColor: themeColors.accentPrimary,
    },
    shopModeButtonText: {
      fontSize: 14,
      color: themeColors.text,
    },
    shopModeButtonTextActive: {
      color: '#ffffff',
    },
    frequentItemsContainer: {
      paddingHorizontal: 24,
      marginBottom: 20,
    },
    frequentItemsLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textMuted,
      marginBottom: 10,
      letterSpacing: 0.5,
    },
    frequentItemChip: {
      backgroundColor: themeColors.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    frequentItemChipText: {
      fontSize: 14,
      color: themeColors.text,
    },
    groceryCategorySection: {
      marginBottom: 16,
    },
    groceryCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: themeColors.surfaceSecondary,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginHorizontal: 0,
      borderRadius: 12,
      marginBottom: 8,
    },
    groceryCategoryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    groceryCategoryEmoji: {
      fontSize: 20,
    },
    groceryCategoryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
    },
    groceryCategoryCount: {
      fontSize: 14,
      color: themeColors.textSecondary,
      marginLeft: 6,
    },
    groceryInfo: {
      flex: 1,
      marginLeft: 12,
    },
    groceryCard: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 0,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme === 'dark' ? 0.15 : 0.06,
      shadowRadius: 12,
      elevation: 2,
    },
    groceryCardCompleted: {
      backgroundColor: theme === 'dark' ? themeColors.surfaceSecondary : '#f9fafb',
      opacity: 0.7,
    },
    groceryCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: themeColors.borderWarm,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 14,
    },
    groceryCheckboxChecked: {
      backgroundColor: '#10b981',
      borderColor: '#10b981',
    },
    groceryName: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 15,
      color: themeColors.text,
    },
    groceryNameChecked: {
      textDecorationLine: 'line-through',
      color: themeColors.textMuted,
    },
    groceryItemPrice: {
      fontFamily: 'SourceSans3_600SemiBold',
      fontSize: 14,
      color: theme === 'dark' ? '#fbbf24' : '#b45309',
      marginLeft: 'auto',
    },
    // Empty State
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 40,
    },
    emptyStateText: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.textSecondary,
      marginTop: 16,
      textAlign: 'center',
    },
    emptyStateSubtext: {
      fontSize: 14,
      color: themeColors.textMuted,
      marginTop: 8,
      textAlign: 'center',
    },
    // Category Headers (Groceries)
    categoryBox: {
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    // Calendar
    calendarContainer: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 24,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    calendarHeader: {
      color: themeColors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    calendarDayText: {
      color: themeColors.text,
      fontSize: 14,
    },
    calendarDayTextMuted: {
      color: themeColors.textMuted,
    },
    // Event Cards
    eventCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
    },
    eventTime: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    // Calendar Day Styles
    calendarDay: {
      width: '14.28%',
      minHeight: 90,
      borderWidth: 1,
      borderColor: themeColors.border,
      padding: 4,
    },
    calendarDayEmpty: {
      width: '14.28%',
      minHeight: 90,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    calendarMoreText: {
      color: themeColors.textMuted,
      fontSize: 8,
      marginTop: 2,
    },
    // Compact Calendar Day Styles
    calendarDayCompact: {
      width: '13.28%',
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      margin: '0.5%',
      paddingVertical: 4,
    },
    calendarDayCompactToday: {
      backgroundColor: themeColors.accentPrimary,
    },
    calendarDayCompactSelected: {
      backgroundColor: themeColors.surface,
      borderWidth: 2,
      borderColor: themeColors.accentPrimary,
    },
    calendarDayCompactEmpty: {
      width: '13.28%',
      minHeight: 44,
      margin: '0.5%',
    },
    calendarDayCompactText: {
      color: themeColors.text,
      fontSize: 14,
      fontWeight: '500',
    },
    calendarDayCompactTextToday: {
      color: '#fff',
      fontWeight: '600',
    },
    calendarDayCompactTextSelected: {
      color: themeColors.text,
      fontWeight: '600',
    },
    // Calendar Events Section
    calendarEventsSection: {
      flex: 1,
      backgroundColor: themeColors.surfaceSecondary,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 16,
    },
    dayDetailsContainer: {
      marginTop: 16,
      backgroundColor: themeColors.surface,
      borderRadius: 8,
      padding: 16,
      marginBottom: 20,
    },
    dayDetailsTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 18,
      color: themeColors.text,
    },
    // Task/Todo Items
    taskItem: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    taskText: {
      fontSize: 16,
      color: themeColors.text,
      flex: 1,
      marginLeft: 12,
    },
    taskTextCompleted: {
      textDecorationLine: 'line-through',
      color: themeColors.textMuted,
    },
    // Idea Cards
    ideaCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    ideaTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 4,
    },
    ideaDescription: {
      fontSize: 14,
      color: themeColors.textSecondary,
      lineHeight: 20,
    },
    ideaMeta: {
      fontSize: 12,
      color: themeColors.textMuted,
      marginTop: 8,
    },
    // Gift Person Cards
    personCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    personName: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.text,
    },
    personDetail: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    // Restaurant Cards
    restaurantCard: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    restaurantName: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.text,
    },
    restaurantCuisine: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
    restaurantMeta: {
      fontSize: 13,
      color: themeColors.textMuted,
    },
    // Grocery Items
    groceryItem: {
      backgroundColor: themeColors.surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    groceryText: {
      fontSize: 16,
      color: themeColors.text,
      flex: 1,
      marginLeft: 12,
    },
    // Modal/Form Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    modalContent: {
      backgroundColor: themeColors.surface,
      borderRadius: 16,
      padding: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.text,
      marginBottom: 16,
    },
    modalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalSubtitle: {
      color: themeColors.textSecondary,
      fontSize: 14,
      marginBottom: 16,
      fontWeight: '500',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    buttonCancel: {
      backgroundColor: themeColors.surfaceSecondary,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    buttonCancelText: {
      color: themeColors.text,
      fontWeight: '600',
      fontSize: 16,
    },
    buttonAdd: {
      backgroundColor: themeColors.accentPrimary,
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    errorText: {
      color: '#F87171',
      fontSize: 14,
      marginTop: 8,
    },
    recipeTagsLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
      marginBottom: 10,
      marginTop: 4,
    },
    recipeTagsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    recipeTagButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: themeColors.surfaceSecondary,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    recipeTagButtonActive: {
      backgroundColor: themeColors.accentPrimary,
      borderColor: themeColors.accentPrimary,
    },
    recipeTagButtonText: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.text,
    },
    recipeTagButtonTextActive: {
      color: '#fff',
    },
    manualSectionHeader: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      color: themeColors.text,
      fontSize: 16,
      marginTop: 24,
      marginBottom: 8,
    },
    manualFieldLabel: {
      color: themeColors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 6,
    },
    // Person Profile Modal Styles
    personProfileOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    personProfileBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    personProfileContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '85%',
      paddingHorizontal: 24,
      paddingTop: 24,
    },
    personProfileHeader: {
      alignItems: 'center',
      marginBottom: 24,
      position: 'relative',
    },
    personProfileCloseBtn: {
      position: 'absolute',
      right: 0,
      top: 0,
      padding: 4,
    },
    personProfileAvatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    personProfileAvatarText: {
      fontSize: 32,
      fontWeight: '600',
      color: '#ffffff',
    },
    personProfileName: {
      fontSize: 24,
      fontWeight: '600',
      color: themeColors.text,
      fontFamily: 'PlayfairDisplay_600SemiBold',
    },
    personProfileSection: {
      marginBottom: 24,
    },
    personProfileSectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    personProfileDatePicker: {
      backgroundColor: themeColors.inputBg,
      borderRadius: 12,
      padding: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    personProfileSizeRow: {
      flexDirection: 'row',
      gap: 12,
    },
    personProfileSizeItem: {
      flex: 1,
    },
    personProfileSizeLabel: {
      fontSize: 13,
      color: themeColors.textSecondary,
      marginBottom: 6,
    },
    personProfileSizeInput: {
      backgroundColor: themeColors.inputBg,
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      color: themeColors.text,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    personProfileGiftHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    personProfileGiftCount: {
      fontSize: 13,
      color: themeColors.textMuted,
    },
    personProfileEmptyText: {
      fontSize: 14,
      color: themeColors.textMuted,
      textAlign: 'center',
      paddingVertical: 20,
    },
    personProfileGiftItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
      gap: 12,
    },
    personProfileGiftInfo: {
      flex: 1,
    },
    personProfileGiftName: {
      fontSize: 15,
      fontWeight: '500',
      color: themeColors.text,
    },
    personProfileGiftNotes: {
      fontSize: 13,
      color: themeColors.textSecondary,
      marginTop: 2,
    },
    personProfileGiftPrice: {
      fontSize: 15,
      fontWeight: '600',
      color: '#10B981',
    },
    personProfileSaveBtn: {
      backgroundColor: themeColors.accentPrimary,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    personProfileSaveBtnText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    personProfileAddGiftBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fff7ed',
      borderRadius: 12,
      paddingVertical: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.3)' : '#fed7aa',
    },
    personProfileAddGiftText: {
      color: themeColors.accentPrimary,
      fontSize: 15,
      fontWeight: '500',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
      marginBottom: 8,
    },
    textInput: {
      backgroundColor: themeColors.inputBg,
      borderWidth: 1,
      borderColor: themeColors.inputBorder,
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: themeColors.text,
    },
    // Form Modal Styles
    formModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    formModalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    formModalContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      maxHeight: '90%',
      paddingBottom: 40,
    },
    formModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    formModalForm: {
      padding: 24,
    },
    formInput: {
      backgroundColor: themeColors.inputBg,
      borderWidth: 1,
      borderColor: themeColors.inputBorder,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: themeColors.text,
      marginBottom: 16,
    },
    formInputText: {
      color: themeColors.text,
      fontSize: 16,
    },
    formInputPlaceholder: {
      color: themeColors.textMuted,
      fontSize: 16,
    },
    formLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.textSecondary,
      marginBottom: 8,
      marginTop: 8,
    },
    formSuggestionsContainer: {
      backgroundColor: themeColors.surface,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 8,
      marginTop: -12,
      marginBottom: 16,
      maxHeight: 200,
    },
    formSuggestionItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    formSuggestionText: {
      color: themeColors.text,
      fontSize: 14,
    },
    formButton: {
      backgroundColor: themeColors.accentPrimary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    formButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    // Activity Detail Modal Styles
    activityDetailModal: {
      maxHeight: '85%',
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      marginHorizontal: 16,
      marginBottom: 20,
      overflow: 'hidden',
    },
    activityDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: 20,
      paddingBottom: 12,
    },
    activityDetailActionBtn: {
      padding: 8,
    },
    activityDetailActionSheet: {
      backgroundColor: theme === 'dark' ? '#374151' : '#1f2937',
      marginHorizontal: 20,
      marginBottom: 12,
      borderRadius: 12,
      overflow: 'hidden',
    },
    activityDetailActionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    activityDetailActionSheetText: {
      color: themeColors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    activityDetailContent: {
      paddingHorizontal: 20,
    },
    activityDetailTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: themeColors.text,
      marginBottom: 12,
    },
    activityDetailInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    activityDetailInfoText: {
      fontSize: 15,
      color: themeColors.textSecondary,
    },
    activityDetailNotes: {
      fontSize: 15,
      color: themeColors.textSecondary,
      lineHeight: 22,
      marginTop: 12,
    },
    activityDetailInfoCard: {
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      marginTop: 16,
    },
    activityDetailInfoLabel: {
      fontSize: 12,
      color: themeColors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    activityDetailInfoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.text,
    },
    activityDetailLocationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surfaceSecondary,
      borderRadius: 16,
      padding: 16,
      marginTop: 12,
      gap: 12,
    },
    activityDetailLocationLabel: {
      fontSize: 12,
      color: themeColors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    activityDetailLocationAddress: {
      fontSize: 15,
      color: themeColors.text,
      fontWeight: '500',
    },
    // Recipe Modal Styles
    recipeDetailModal: {
      maxHeight: '90%',
      marginHorizontal: 16,
      marginTop: 'auto',
      marginBottom: 16,
      backgroundColor: themeColors.surface,
      borderRadius: 24,
      padding: 24,
    },
    recipeDetailHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    recipeDetailTitle: {
      flex: 1,
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 22,
      color: themeColors.text,
      marginRight: 12,
    },
    recipeDetailHeaderActions: {
      flexDirection: 'row',
      gap: 8,
    },
    recipeDetailActionButton: {
      padding: 8,
    },
    recipeDetailActionSheet: {
      backgroundColor: theme === 'dark' ? '#374151' : '#1f2937',
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    },
    recipeDetailActionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 14,
    },
    recipeDetailActionSheetText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '500',
    },
    recipeDetailActionSheetItemSecondary: {
      justifyContent: 'center',
      borderTopWidth: 1,
      borderTopColor: theme === 'dark' ? '#4b5563' : '#374151',
    },
    recipeDetailActionSheetSecondaryText: {
      color: '#9ca3af',
      fontSize: 15,
    },
    recipeDescription: {
      color: themeColors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 12,
    },
    recipeSectionTitle: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      color: themeColors.text,
      fontSize: 16,
      marginTop: 12,
      marginBottom: 8,
    },
    recipeListText: {
      flex: 1,
      color: themeColors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    recipeEmptyText: {
      color: themeColors.textMuted,
      fontSize: 14,
    },
    recipeNotesText: {
      color: themeColors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    recipeSourceDetail: {
      fontSize: 12,
      color: themeColors.textMuted,
      marginBottom: 12,
    },
    // Restaurant Modal Styles
    restaurantModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    restaurantModalContent: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      height: '95%',
    },
    restaurantDetailsSection: {
      padding: 24,
    },
    restaurantDetailsLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    restaurantDetailsValue: {
      fontSize: 16,
      color: themeColors.text,
      lineHeight: 22,
    },
    restaurantInfoText: {
      fontSize: 14,
      color: themeColors.textSecondary,
    },
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={dynamicStyles.safeArea}>
      <StatusBar barStyle={theme === 'dark' ? "light-content" : "dark-content"} />
      <View style={dynamicStyles.appHeader}>
        <View style={dynamicStyles.logoContainer}>
          <View style={dynamicStyles.logoIcon}>
            <Home size={20} color="#fff" />
          </View>
          <Text style={dynamicStyles.logoText}>Life Organizer</Text>
        </View>
        <View style={dynamicStyles.headerRight}>
          <TouchableOpacity style={dynamicStyles.avatarButton} onPress={() => setShowProfile(true)}>
            <Text style={dynamicStyles.avatarText}>{currentUserName?.[0]?.toUpperCase() || 'A'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.settingsButton} onPress={() => setShowSettings(true)}>
            <Settings size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Old todo map/list views removed - new UI is in renderContent() */}

      {false && activeTab === 'todo' && todoViewMode === 'map' && (
        // Map view for tasks and activities
        (() => {
          const tasksWithLocation = filteredItems.filter(t => t.location && t.location.latitude && t.location.longitude);
          const activitiesWithLocation = getFilteredActivities().filter(a => a.location && a.location.latitude && a.location.longitude);
          const allItemsWithLocation = [...tasksWithLocation, ...activitiesWithLocation];
          
          if (allItemsWithLocation.length === 0 && !userLocation) {
            return (
              <View style={styles.emptyState}>
                <MapPin size={48} color={themeColors.textSecondary} />
                <Text style={dynamicStyles.emptyStateText}>No items with locations yet</Text>
                <Text style={dynamicStyles.emptyStateSubtext}>Add tasks or activities with addresses to see them on the map</Text>
              </View>
            );
          }
          
          let centerLat, centerLon, latDelta, lonDelta;
          
          if (allItemsWithLocation.length > 0) {
          const latitudes = allItemsWithLocation.map(i => i.location.latitude);
          const longitudes = allItemsWithLocation.map(i => i.location.longitude);
            
            // Include user location if available
            if (userLocation) {
              latitudes.push(userLocation.latitude);
              longitudes.push(userLocation.longitude);
            }
          
          const minLat = Math.min(...latitudes);
          const maxLat = Math.max(...latitudes);
          const minLon = Math.min(...longitudes);
          const maxLon = Math.max(...longitudes);
          
            centerLat = (minLat + maxLat) / 2;
            centerLon = (minLon + maxLon) / 2;
            latDelta = Math.max(0.01, (maxLat - minLat) * 1.5);
            lonDelta = Math.max(0.01, (maxLon - minLon) * 1.5);
          } else if (userLocation) {
            // If no items but user location available, center on user
            centerLat = userLocation.latitude;
            centerLon = userLocation.longitude;
            latDelta = 0.01;
            lonDelta = 0.01;
          }
          
          return (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                showsUserLocation={true}
                showsMyLocationButton={false}
                initialRegion={{
                  latitude: centerLat,
                  longitude: centerLon,
                  latitudeDelta: latDelta,
                  longitudeDelta: lonDelta,
                }}
                region={{
                  latitude: centerLat,
                  longitude: centerLon,
                  latitudeDelta: latDelta,
                  longitudeDelta: lonDelta,
                }}
              >
                {/* Tasks markers - Blue */}
                {tasksWithLocation.map(task => (
                  <Marker
                    key={task.id}
                    coordinate={{
                      latitude: task.location.latitude,
                      longitude: task.location.longitude,
                    }}
                    pinColor="#2563EB"
                  >
                    <Callout onPress={() => handleMapPress({ nativeEvent: { coordinate: task.location } }, task)}>
                      <View style={styles.calloutContainer}>
                        <Text style={styles.calloutTitle}>{task.title}</Text>
                        {task.dueDate && (
                          <Text style={styles.calloutText}>Due: {formatDate(task.dueDate)}</Text>
                        )}
                        {task.priority && (
                          <Text style={styles.calloutText}>Priority: {task.priority}</Text>
                        )}
                        {task.notes && (
                          <Text style={styles.calloutNotes}>{task.notes}</Text>
                        )}
                        <Text style={styles.calloutLink}>Tap to open in Maps</Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}
                
                {/* Activities markers - Purple */}
                {activitiesWithLocation.map(activity => (
                  <Marker
                    key={activity.id}
                    coordinate={{
                      latitude: activity.location.latitude,
                      longitude: activity.location.longitude,
                    }}
                    pinColor="#8B5CF6"
                  >
                    <Callout onPress={() => handleMapPress({ nativeEvent: { coordinate: activity.location } }, activity)}>
                      <View style={styles.calloutContainer}>
                        <Text style={styles.calloutTitle}>{activity.title}</Text>
                        {activity.date && (
                          <Text style={styles.calloutText}>Date: {formatDate(activity.date)}</Text>
                        )}
                        {activity.time && (
                          <Text style={styles.calloutText}>Time: {formatTime(activity.time)}</Text>
                        )}
                        {activity.notes && (
                          <Text style={styles.calloutNotes}>{activity.notes}</Text>
                        )}
                        <Text style={styles.calloutLink}>Tap to open in Maps</Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}
              </MapView>
            </View>
          );
        })()
      )}
      
      {false && activeTab === 'todo' && todoViewMode === 'list' && (
  <GestureHandlerRootView style={{ flex: 1 }}>
    {todoFilter === 'all' ? (
      // Filter: All - Scrollable list sorted by priority for tasks, date for activities
      <ScrollView style={dynamicStyles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {(() => {
          // Create combined array and sort
          const combined = [...filteredItems, ...getFilteredActivities()];
          const sorted = combined.sort((a, b) => {
            // Completed tasks/items go to bottom
            if (a.completed !== b.completed) {
              return a.completed ? 1 : -1;
            }
            // For tasks, sort by priority (urgent > high > medium > low)
            // Tasks have category 'todo' and no 'date' field
            const isTaskA = !a.date && a.category === 'todo';
            const isTaskB = !b.date && b.category === 'todo';
            if (isTaskA && isTaskB) {
              const priorityA = getPriorityWeight(a.priority);
              const priorityB = getPriorityWeight(b.priority);
              if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first (4 > 3 > 2 > 1)
              }
              // Same priority, sort by due date
              const dateA = a.dueDate || a.createdAt || new Date(0);
              const dateB = b.dueDate || b.createdAt || new Date(0);
            return new Date(dateA) - new Date(dateB);
            }
            // For non-tasks or mixed task/activity, sort by date
            const dateA = a.dueDate || a.date || a.createdAt || new Date(0);
            const dateB = b.dueDate || b.date || b.createdAt || new Date(0);
            return new Date(dateA) - new Date(dateB);
          });
          return sorted.map(item => {
            const isActivity = !!item.date; // Activities have 'date', tasks have 'dueDate'
            const isPersonal = item.isPersonal; // Check if item is personal
            // Determine edit type
            let editType = isActivity ? 'activity' : 'item';
            if (isPersonal && isActivity) {
              editType = 'personalActivity';
            } else if (isPersonal && !isActivity) {
              editType = 'personalTask';
            }
            
            const currentUser = auth.currentUser;
            const hasOwnership =
              permissionMode === 'collaborative' ||
              isAdmin ||
              item.isPersonal ||
              item.createdBy === currentUser?.uid ||
              !item.createdBy;
            const canSwipeDelete = !item.isAppleCalendar && !item.isBirthday && hasOwnership;
            const deleteCategory = isActivity ? 'activities' : 'items';
            
            const renderRightActions = () => {
              if (!canSwipeDelete) return null;
              
            return (
                <View style={styles.swipeActionContainer}>
                  <View style={styles.swipeDeleteButton}>
                    <Trash2 size={24} color="#fff" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                  </View>
                </View>
              );
            };
            
            const TaskComponent = (
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => {
                  // Check if user can edit
                  // In strict mode: only admin or creator can edit
                  // In collaborative mode: anyone can edit
                  const canEdit = permissionMode === 'collaborative' || isAdmin || item.createdBy === auth.currentUser?.uid || !item.createdBy;
                  if (canEdit) {
                    openEditForm(item, editType);
                  } else {
                    Alert.alert('Permission Denied', 'You can only edit items you created');
                  }
                }}
              >
                <View style={dynamicStyles.itemCard}>
                  {!isActivity && item.priority && (
                    <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
                  )}
                  <View style={styles.itemHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(isActivity ? item.category : 'todo') }]}>
                      {isActivity ? <Calendar size={14} color="#fff" /> : <Check size={14} color="#fff" />}
                      <Text style={styles.categoryText}>{isActivity ? 'Activity' : 'Task'}</Text>
                    </View>
                      {!isActivity && item.subtasks && item.subtasks.length > 0 && (
                        <>
                          <TouchableOpacity 
                            onPress={(e) => { 
                              e.stopPropagation(); 
                              setExpandedTasks(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                          >
                            {expandedTasks[item.id] ? (
                              <ChevronDown size={16} color="#9CA3AF" />
                            ) : (
                              <ChevronRight size={16} color="#9CA3AF" />
                            )}
                          </TouchableOpacity>
                          <CircularProgress percentage={getTaskProgress(item)} size={28} />
                        </>
                      )}
                    </View>
                    {/* In strict mode, only creator or admin can delete. In collaborative mode, anyone can delete */}
                    {(() => {
                      const currentUser = auth.currentUser;
                      const canDelete = permissionMode === 'collaborative' || currentUser && (isAdmin || item.createdBy === currentUser.uid);
                      return canDelete && !item.isAppleCalendar && !item.isBirthday ? (
                      <TouchableOpacity onPress={(e) => { 
                        e.stopPropagation(); 
                        deleteItem(item.id, isActivity ? 'activities' : 'items'); 
                      }}>
                        <Trash2 size={18} color="#EF4444" />
                      </TouchableOpacity>
                      ) : null;
                    })()}
                  </View>
                  <View style={styles.itemContent}>
                    {!isActivity && (
                      <View style={styles.itemTitleRow}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleComplete(item.id, 'items'); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <View style={[dynamicStyles.checkbox, item.completed && dynamicStyles.checkboxCompleted]}>
                            {item.completed && <Check size={16} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <Text style={[dynamicStyles.itemTitle, item.completed && styles.completedText]}>
                          {item.title}
                        </Text>
                      </View>
                    )}
                    {isActivity && (
                      <>
                        <Text style={dynamicStyles.itemTitle}>{item.title}</Text>
                        <Text style={styles.activityDate}>{formatDate(item.date)} at {formatTime(item.time)}</Text>
                      </>
                    )}
                  </View>
                  {/* Add Subtask Button (shown when no subtasks) */}
                  {!isActivity && (!item.subtasks || item.subtasks.length === 0) && (
                    <TouchableOpacity
                      style={styles.addSubtaskButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setExpandedTasks(prev => ({ ...prev, [item.id]: true }));
                        setEditingSubtask({ taskId: item.id, subtaskId: 'new' });
                        setNewSubtaskTitle('');
                      }}
                    >
                      <Plus size={16} color="#9CA3AF" />
                      <Text style={styles.addSubtaskText}>Add Subtask</Text>
                    </TouchableOpacity>
                  )}
                  {!isActivity && (!item.subtasks || item.subtasks.length === 0) && editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === 'new' && (
                    <View style={[styles.subtaskEditContainer, { marginLeft: 0, marginTop: 4 }]}>
                      <TextInput
                        style={styles.subtaskInput}
                        value={newSubtaskTitle}
                        onChangeText={setNewSubtaskTitle}
                        placeholder="Subtask title"
                        placeholderTextColor="#9CA3AF"
                        autoFocus
                        onSubmitEditing={() => {
                          if (newSubtaskTitle.trim()) {
                            addSubtask(item.id, newSubtaskTitle);
                            setEditingSubtask(null);
                          }
                        }}
                        onBlur={() => {
                          if (newSubtaskTitle.trim()) {
                            addSubtask(item.id, newSubtaskTitle);
                          }
                          setEditingSubtask(null);
                          setNewSubtaskTitle('');
                        }}
                      />
                      <TouchableOpacity
                        onPress={() => {
                          if (newSubtaskTitle.trim()) {
                            addSubtask(item.id, newSubtaskTitle);
                          }
                          setEditingSubtask(null);
                          setNewSubtaskTitle('');
                        }}
                      >
                        <Check size={18} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setEditingSubtask(null);
                          setNewSubtaskTitle('');
                        }}
                      >
                        <X size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {/* Subtasks Section */}
                  {!isActivity && item.subtasks && item.subtasks.length > 0 && expandedTasks[item.id] && (
                    <View style={styles.subtasksContainer}>
                      <DraggableFlatList
                        data={[...item.subtasks].sort((a, b) => (a.order || 0) - (b.order || 0))}
                        onDragEnd={({ data }) => reorderSubtasks(item.id, data)}
                        keyExtractor={(subtask) => subtask.id.toString()}
                        scrollEnabled={false}
                        renderItem={({ item: subtask, drag, isActive: isSubtaskActive }) => {
                          const renderSubtaskRightActions = () => {
                            return (
                              <View style={styles.swipeActionContainer}>
                                <View style={styles.swipeDeleteButton}>
                                  <Trash2 size={20} color="#fff" />
                                  <Text style={styles.swipeDeleteText}>Delete</Text>
                                </View>
                              </View>
                            );
                          };
                          
                          const isEditing = editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === subtask.id;
                          
                          return (
                            <Swipeable
                              renderRightActions={renderSubtaskRightActions}
                              onSwipeableRightOpen={() => {
                                deleteSubtask(item.id, subtask.id);
                              }}
                              rightThreshold={60}
                              overshootRight={false}
                              enabled={!isSubtaskActive}
                            >
                              <View style={styles.subtaskItem}>
                                <View style={styles.subtaskConnector} />
                                {isEditing ? (
                                  <View style={styles.subtaskEditContainer}>
                                    <TextInput
                                      style={styles.subtaskInput}
                                      value={newSubtaskTitle || subtask.title}
                                      onChangeText={setNewSubtaskTitle}
                                      placeholder="Subtask title"
                                      placeholderTextColor="#9CA3AF"
                                      autoFocus
                                      onSubmitEditing={() => {
                                        if (newSubtaskTitle.trim()) {
                                          updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                          setEditingSubtask(null);
                                          setNewSubtaskTitle('');
                                        }
                                      }}
                                      onBlur={() => {
                                        if (newSubtaskTitle.trim()) {
                                          updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                        }
                                        setEditingSubtask(null);
                                        setNewSubtaskTitle('');
                                      }}
                                    />
                                    <TouchableOpacity
                                      onPress={() => {
                                        if (newSubtaskTitle.trim()) {
                                          updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                        }
                                        setEditingSubtask(null);
                                        setNewSubtaskTitle('');
                                      }}
                                    >
                                      <Check size={18} color="#10B981" />
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <View style={styles.subtaskContent}>
                                    <TouchableOpacity 
                                      onPress={(e) => { 
                                        e.stopPropagation(); 
                                        toggleSubtaskComplete(item.id, subtask.id); 
                                      }}
                                    >
                                      <View style={[dynamicStyles.checkbox, styles.subtaskCheckbox]}>
                                        {subtask.completed && <Check size={14} color="#fff" />}
                                      </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.subtaskTitleContainer}
                                      onPress={(e) => {
                                        e.stopPropagation();
                                        setEditingSubtask({ taskId: item.id, subtaskId: subtask.id });
                                        setNewSubtaskTitle(subtask.title);
                                      }}
                                      onLongPress={drag}
                                      disabled={isSubtaskActive}
                                    >
                                      <Text style={[styles.subtaskTitle, subtask.completed && styles.completedText]}>
                                        {subtask.title}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              </View>
                            </Swipeable>
                          );
                        }}
                      />
                      {/* Add Subtask Button */}
                      <TouchableOpacity
                        style={styles.addSubtaskButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditingSubtask({ taskId: item.id, subtaskId: 'new' });
                          setNewSubtaskTitle('');
                        }}
                      >
                        <Plus size={16} color="#9CA3AF" />
                        <Text style={styles.addSubtaskText}>Add Subtask</Text>
                      </TouchableOpacity>
                      {editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === 'new' && (
                        <View style={styles.subtaskEditContainer}>
                          <TextInput
                            style={styles.subtaskInput}
                            value={newSubtaskTitle}
                            onChangeText={setNewSubtaskTitle}
                            placeholder="Subtask title"
                            placeholderTextColor="#9CA3AF"
                            autoFocus
                            onSubmitEditing={() => {
                              if (newSubtaskTitle.trim()) {
                                addSubtask(item.id, newSubtaskTitle);
                                setEditingSubtask(null);
                              }
                            }}
                            onBlur={() => {
                              if (newSubtaskTitle.trim()) {
                                addSubtask(item.id, newSubtaskTitle);
                              }
                              setEditingSubtask(null);
                              setNewSubtaskTitle('');
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              if (newSubtaskTitle.trim()) {
                                addSubtask(item.id, newSubtaskTitle);
                              }
                              setEditingSubtask(null);
                              setNewSubtaskTitle('');
                            }}
                          >
                            <Check size={18} color="#10B981" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingSubtask(null);
                              setNewSubtaskTitle('');
                            }}
                          >
                            <X size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                  {item.dueDate && (
                    <Text style={styles.itemDueDate}>Due: {formatDate(item.dueDate)}</Text>
                  )}
                  {shouldShowLocationForItem(item) && (
                    <View style={styles.itemLocation}>
                      <MapPin size={14} color={themeColors.textSecondary} />
                      <Text style={dynamicStyles.locationText}>{getCityStateFromAddress(item.location.address)}</Text>
                    </View>
                  )}
                  {item.notes && (
                    <Text style={dynamicStyles.itemNotes}>{item.notes}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
            
            if (canSwipeDelete) {
              return (
                <Swipeable
                  key={item.id}
                  renderRightActions={renderRightActions}
                  onSwipeableRightOpen={() => {
                    deleteItem(item.id, deleteCategory);
                  }}
                  rightThreshold={80}
                  overshootRight={false}
                  containerStyle={{ backgroundColor: 'transparent' }}
                >
                  {TaskComponent}
                </Swipeable>
              );
            }
            
            return <View key={item.id}>{TaskComponent}</View>;
          });
        })()}
        
        {filteredItems.length === 0 && getFilteredActivities().length === 0 && (
          <View style={styles.emptyState}>
            <Check size={48} color={themeColors.textSecondary} />
            <Text style={dynamicStyles.emptyStateText}>No items yet</Text>
            <Text style={dynamicStyles.emptyStateSubtext}>Add tasks or activities!</Text>
          </View>
        )}
      </ScrollView>
    ) : todoFilter === 'tasks' ? (
      // Filter: Tasks - Draggable list sorted by priority
      <View style={dynamicStyles.content}>
        <DraggableFlatList
          data={(() => {
            // Create a copy and sort by priority
            const sorted = [...filteredItems].sort((a, b) => {
            // Completed tasks go to bottom
            if (a.completed !== b.completed) {
              return a.completed ? 1 : -1;
            }
              // Sort by priority (urgent > high > medium > low)
              const priorityA = getPriorityWeight(a.priority);
              const priorityB = getPriorityWeight(b.priority);
              if (priorityA !== priorityB) {
                return priorityB - priorityA; // Higher priority first (4 > 3 > 2 > 1)
              }
              // If same priority, sort by due date or creation date
              const dateA = a.dueDate || a.createdAt || new Date(0);
              const dateB = b.dueDate || b.createdAt || new Date(0);
              return new Date(dateA) - new Date(dateB);
            });
            return sorted;
          })()}
          onDragEnd={({ data }) => handleReorderItems(data)}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, drag, isActive }) => {
            const isPersonal = item.isPersonal;
            const editType = isPersonal ? 'personalTask' : 'item';
            const currentUser = auth.currentUser;
            const canDelete = permissionMode === 'collaborative' || currentUser && (isAdmin || item.createdBy === currentUser.uid);
            
            const renderRightActions = () => {
              if (!canDelete) return null;
              
            return (
                <View style={styles.swipeActionContainer}>
                  <View style={styles.swipeDeleteButton}>
                    <Trash2 size={24} color="#fff" />
                    <Text style={styles.swipeDeleteText}>Delete</Text>
                  </View>
                </View>
              );
            };
            
            return (
            <Swipeable
              renderRightActions={renderRightActions}
              onSwipeableRightOpen={() => {
                if (canDelete) {
                  deleteItem(item.id, 'items');
                }
              }}
              rightThreshold={80}
              overshootRight={false}
              enabled={!isActive}
              containerStyle={{ backgroundColor: 'transparent' }}
            >
            <TouchableOpacity 
                activeOpacity={0.7}
              onPress={() => {
                // Check if user can edit
                // In strict mode: only admin or creator can edit
                // In collaborative mode: anyone can edit
                const canEdit = permissionMode === 'collaborative' || isAdmin || item.createdBy === auth.currentUser?.uid || !item.createdBy;
                if (canEdit) {
                  openEditForm(item, editType);
                } else {
                  Alert.alert('Permission Denied', 'You can only edit items you created');
                }
              }}
              onLongPress={isPersonal ? undefined : drag}
                disabled={isActive}
              style={{ opacity: isActive ? 0.5 : 1 }}
            >
              <View style={dynamicStyles.itemCard}>
                {item.priority && (
                  <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(item.priority) }]} />
                )}
                <View style={styles.itemHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor('todo') }]}>
                    <Check size={14} color="#fff" />
                    <Text style={styles.categoryText}>Task</Text>
                    </View>
                    {item.subtasks && item.subtasks.length > 0 && (
                      <>
                        <TouchableOpacity 
                          onPress={(e) => { 
                            e.stopPropagation(); 
                            setExpandedTasks(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                          }}
                        >
                          {expandedTasks[item.id] ? (
                            <ChevronDown size={16} color="#9CA3AF" />
                          ) : (
                            <ChevronRight size={16} color="#9CA3AF" />
                          )}
                        </TouchableOpacity>
                        <CircularProgress percentage={getTaskProgress(item)} size={28} />
                      </>
                    )}
                  </View>
                  {(() => {
                    const currentUser = auth.currentUser;
                    const canDelete = permissionMode === 'collaborative' || currentUser && (isAdmin || item.createdBy === currentUser.uid);
                    return canDelete ? (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteItem(item.id, 'items'); }}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                    ) : null;
                  })()}
                </View>
                <View style={styles.itemContent}>
                  <View style={styles.itemTitleRow}>
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleComplete(item.id, 'items'); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <View style={[dynamicStyles.checkbox, item.completed && dynamicStyles.checkboxCompleted]}>
                        {item.completed && <Check size={16} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    <Text style={[dynamicStyles.itemTitle, item.completed && styles.completedText]}>
                      {item.title}
                    </Text>
                  </View>
                </View>
                {/* Add Subtask Button (shown when no subtasks or when expanded) */}
                {(!item.subtasks || item.subtasks.length === 0) && (
                  <TouchableOpacity
                    style={styles.addSubtaskButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      setExpandedTasks(prev => ({ ...prev, [item.id]: true }));
                      setEditingSubtask({ taskId: item.id, subtaskId: 'new' });
                      setNewSubtaskTitle('');
                    }}
                  >
                    <Plus size={16} color={themeColors.textSecondary} />
                    <Text style={styles.addSubtaskText}>Add Subtask</Text>
                  </TouchableOpacity>
                )}
                {(!item.subtasks || item.subtasks.length === 0) && editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === 'new' && (
                  <View style={[styles.subtaskEditContainer, { marginLeft: 0, marginTop: 4 }]}>
                    <TextInput
                      style={styles.subtaskInput}
                      value={newSubtaskTitle}
                      onChangeText={setNewSubtaskTitle}
                      placeholder="Subtask title"
                      placeholderTextColor="#9CA3AF"
                      autoFocus
                      onSubmitEditing={() => {
                        if (newSubtaskTitle.trim()) {
                          addSubtask(item.id, newSubtaskTitle);
                          setEditingSubtask(null);
                        }
                      }}
                      onBlur={() => {
                        if (newSubtaskTitle.trim()) {
                          addSubtask(item.id, newSubtaskTitle);
                        }
                        setEditingSubtask(null);
                        setNewSubtaskTitle('');
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (newSubtaskTitle.trim()) {
                          addSubtask(item.id, newSubtaskTitle);
                        }
                        setEditingSubtask(null);
                        setNewSubtaskTitle('');
                      }}
                    >
                      <Check size={18} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingSubtask(null);
                        setNewSubtaskTitle('');
                      }}
                    >
                      <X size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
                {/* Subtasks Section */}
                {item.subtasks && item.subtasks.length > 0 && expandedTasks[item.id] && (
                  <View style={styles.subtasksContainer}>
                    <DraggableFlatList
                      data={[...item.subtasks].sort((a, b) => (a.order || 0) - (b.order || 0))}
                      onDragEnd={({ data }) => reorderSubtasks(item.id, data)}
                      keyExtractor={(subtask) => subtask.id.toString()}
                      scrollEnabled={false}
                      renderItem={({ item: subtask, drag, isActive: isSubtaskActive }) => {
                        const renderSubtaskRightActions = () => {
                          return (
                            <View style={styles.swipeActionContainer}>
                              <View style={styles.swipeDeleteButton}>
                                <Trash2 size={20} color="#fff" />
                                <Text style={styles.swipeDeleteText}>Delete</Text>
                              </View>
                            </View>
                          );
                        };
                        
                        const isEditing = editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === subtask.id;
                        
                        return (
                          <Swipeable
                            renderRightActions={renderSubtaskRightActions}
                            onSwipeableRightOpen={() => {
                              deleteSubtask(item.id, subtask.id);
                            }}
                            rightThreshold={60}
                            overshootRight={false}
                            enabled={!isSubtaskActive}
                          >
                            <View style={styles.subtaskItem}>
                              <View style={styles.subtaskConnector} />
                              {isEditing ? (
                                <View style={styles.subtaskEditContainer}>
                                  <TextInput
                                    style={styles.subtaskInput}
                                    value={newSubtaskTitle || subtask.title}
                                    onChangeText={setNewSubtaskTitle}
                                    placeholder="Subtask title"
                                    placeholderTextColor="#9CA3AF"
                                    autoFocus
                                    onSubmitEditing={() => {
                                      if (newSubtaskTitle.trim()) {
                                        updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                        setEditingSubtask(null);
                                        setNewSubtaskTitle('');
                                      }
                                    }}
                                    onBlur={() => {
                                      if (newSubtaskTitle.trim()) {
                                        updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                      }
                                      setEditingSubtask(null);
                                      setNewSubtaskTitle('');
                                    }}
                                  />
                                  <TouchableOpacity
                                    onPress={() => {
                                      if (newSubtaskTitle.trim()) {
                                        updateSubtask(item.id, subtask.id, { title: newSubtaskTitle.trim() });
                                      }
                                      setEditingSubtask(null);
                                      setNewSubtaskTitle('');
                                    }}
                                  >
                                    <Check size={18} color="#10B981" />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={styles.subtaskContent}>
                                  <TouchableOpacity 
                                    onPress={(e) => { 
                                      e.stopPropagation(); 
                                      toggleSubtaskComplete(item.id, subtask.id); 
                                    }}
                                  >
                                    <View style={[dynamicStyles.checkbox, styles.subtaskCheckbox]}>
                                      {subtask.completed && <Check size={14} color="#fff" />}
                                    </View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.subtaskTitleContainer}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      setEditingSubtask({ taskId: item.id, subtaskId: subtask.id });
                                      setNewSubtaskTitle(subtask.title);
                                    }}
                                    onLongPress={drag}
                                    disabled={isSubtaskActive}
                                  >
                                    <Text style={[styles.subtaskTitle, subtask.completed && styles.completedText]}>
                                      {subtask.title}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </Swipeable>
                        );
                      }}
                    />
                    {/* Add Subtask Button */}
                    <TouchableOpacity
                      style={styles.addSubtaskButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        setEditingSubtask({ taskId: item.id, subtaskId: 'new' });
                        setNewSubtaskTitle('');
                      }}
                    >
                      <Plus size={16} color="#9CA3AF" />
                      <Text style={styles.addSubtaskText}>Add Subtask</Text>
                    </TouchableOpacity>
                    {editingSubtask?.taskId === item.id && editingSubtask?.subtaskId === 'new' && (
                      <View style={styles.subtaskEditContainer}>
                        <TextInput
                          style={styles.subtaskInput}
                          value={newSubtaskTitle}
                          onChangeText={setNewSubtaskTitle}
                          placeholder="Subtask title"
                          placeholderTextColor="#9CA3AF"
                          autoFocus
                          onSubmitEditing={() => {
                            if (newSubtaskTitle.trim()) {
                              addSubtask(item.id, newSubtaskTitle);
                              setEditingSubtask(null);
                            }
                          }}
                          onBlur={() => {
                            if (newSubtaskTitle.trim()) {
                              addSubtask(item.id, newSubtaskTitle);
                            }
                            setEditingSubtask(null);
                            setNewSubtaskTitle('');
                          }}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (newSubtaskTitle.trim()) {
                              addSubtask(item.id, newSubtaskTitle);
                            }
                            setEditingSubtask(null);
                            setNewSubtaskTitle('');
                          }}
                        >
                          <Check size={18} color="#10B981" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setEditingSubtask(null);
                            setNewSubtaskTitle('');
                          }}
                        >
                          <X size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
                {item.dueDate && (
                  <Text style={styles.itemDueDate}>Due: {formatDate(item.dueDate)}</Text>
                )}
                {shouldShowLocationForItem(item) && (
                  <View style={styles.itemLocation}>
                    <MapPin size={14} color={themeColors.textSecondary} />
                    <Text style={dynamicStyles.locationText}>{item.location.address}</Text>
                  </View>
                )}
                {item.notes && (
                  <Text style={dynamicStyles.itemNotes}>{item.notes}</Text>
                )}
              </View>
            </TouchableOpacity>
            </Swipeable>
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
        
        {filteredItems.length === 0 && (
          <View style={styles.emptyState}>
            <Check size={48} color={themeColors.textSecondary} />
            <Text style={dynamicStyles.emptyStateText}>No tasks yet</Text>
            <Text style={dynamicStyles.emptyStateSubtext}>Add your first task!</Text>
          </View>
        )}
      </View>
    ) : (
      // Filter: Activities - Draggable list
      <View style={dynamicStyles.content}>
        <DraggableFlatList
          data={getFilteredActivities()}
          onDragEnd={({ data }) => handleReorderActivities(data)}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item, drag, isActive }) => {
            const isPersonal = item.isPersonal;
            const editType = isPersonal ? 'personalActivity' : 'activity';
            return (
            <TouchableOpacity
              onPress={() => {
                // Show activity detail popup
                setSelectedActivity(item);
              }}
              onLongPress={isPersonal ? undefined : drag}
              disabled={isActive || isPersonal}
              style={{ opacity: isActive ? 0.5 : 1 }}
            >
              <View style={dynamicStyles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
                    <Calendar size={14} color="#fff" />
                    <Text style={styles.categoryText}>Activity</Text>
                  </View>
                  {(() => {
                    const currentUser = auth.currentUser;
                    const canDelete = permissionMode === 'collaborative' || currentUser && (isAdmin || item.createdBy === currentUser.uid);
                    return canDelete ? (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteItem(item.id, 'activities'); }}>
                      <Trash2 size={18} color="#EF4444" />
                    </TouchableOpacity>
                    ) : null;
                  })()}
                </View>
                <View style={styles.itemContent}>
                  <Text style={dynamicStyles.itemTitle}>{item.title}</Text>
                  <Text style={styles.activityDate}>{formatDate(item.date)} at {formatTime(item.time)}</Text>
                </View>
                {shouldShowLocationForItem(item) && (
                  <View style={styles.itemLocation}>
                    <MapPin size={14} color={themeColors.textSecondary} />
                    <Text style={dynamicStyles.locationText}>{item.location.address}</Text>
                  </View>
                )}
                {item.notes && (
                  <Text style={dynamicStyles.itemNotes}>{item.notes}</Text>
                )}
              </View>
            </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
        
        {getFilteredActivities().length === 0 && (
          <View style={styles.emptyState}>
            <Calendar size={48} color={themeColors.textSecondary} />
            <Text style={dynamicStyles.emptyStateText}>No activities yet</Text>
            <Text style={dynamicStyles.emptyStateSubtext}>Add your first activity!</Text>
          </View>
        )}
      </View>
    )}
  </GestureHandlerRootView>
)}

{/* Old todo viewModeToggle removed - new UI handles this */}
{activeTab === 'groceries' && (
  <View style={dynamicStyles.groceriesPageHeader}>
    <View style={dynamicStyles.ideasSubheaderTitleRow}>
      <Text style={dynamicStyles.ideasSubheaderTitleRegular}>Your </Text>
      <Text style={dynamicStyles.ideasSubheaderTitleItalic}>Groceries</Text>
    </View>
  </View>
)}
{activeTab === 'ideas' && (
  <>
    <View style={dynamicStyles.ideasSubheader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <View style={dynamicStyles.ideasSubheaderTitleRow}>
          <Text style={dynamicStyles.ideasSubheaderTitleRegular}>Your </Text>
          <Text style={dynamicStyles.ideasSubheaderTitleItalic}>Ideas</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Sort dropdown */}
          <TouchableOpacity
            onPress={() => {
              const nextSort = ideaSortMode === 'recent' ? 'oldest' : ideaSortMode === 'oldest' ? 'grouped' : 'recent';
              setIdeaSortMode(nextSort);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 }}
          >
            <SlidersHorizontal size={16} color={themeColors.textSecondary} />
            <Text style={{ marginLeft: 4, fontSize: 12, color: themeColors.textSecondary }}>
              {ideaSortMode === 'recent' ? 'Recent' : ideaSortMode === 'oldest' ? 'Oldest' : 'Grouped'}
            </Text>
          </TouchableOpacity>
          {/* Tag Manager button */}
          <TouchableOpacity
            onPress={() => setShowTagManager(true)}
            style={{ padding: 8 }}
          >
            <Tag size={20} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
    {/* Scope filters */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={dynamicStyles.ideaFilterScroll}
      contentContainerStyle={styles.ideaFilterScrollContent}
    >
      <TouchableOpacity
        style={[dynamicStyles.filterPill, ideaFilter === 'all' && dynamicStyles.filterPillActive]}
        onPress={() => setIdeaFilter('all')}
        activeOpacity={0.7}
      >
        <Text style={[dynamicStyles.filterPillText, ideaFilter === 'all' && dynamicStyles.filterPillTextActive]}>
          All
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[dynamicStyles.filterPill, ideaFilter === 'personal' && dynamicStyles.filterPillActive]}
        onPress={() => setIdeaFilter('personal')}
        activeOpacity={0.7}
      >
        <Text style={[dynamicStyles.filterPillText, ideaFilter === 'personal' && dynamicStyles.filterPillTextActive]}>
          Personal
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[dynamicStyles.filterPill, ideaFilter === 'household' && dynamicStyles.filterPillActive]}
        onPress={() => setIdeaFilter('household')}
        activeOpacity={0.7}
      >
        <Text style={[dynamicStyles.filterPillText, ideaFilter === 'household' && dynamicStyles.filterPillTextActive]}>
          Household
        </Text>
      </TouchableOpacity>
    </ScrollView>
    {/* Tag filters */}
    {ideaTags.length > 0 && (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12, paddingHorizontal: 16 }}>
        {ideaTags.map((tag) => {
          const isSelected = selectedTagFilters.includes(tag.id);
          return (
            <TouchableOpacity
              key={tag.id}
              onPress={() => {
                if (isSelected) {
                  setSelectedTagFilters(selectedTagFilters.filter(id => id !== tag.id));
                } else {
                  setSelectedTagFilters([...selectedTagFilters, tag.id]);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: isSelected ? tag.color : 'transparent',
                borderWidth: 1,
                borderColor: isSelected ? tag.color : themeColors.border,
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: isSelected ? '#fff' : tag.color,
                  marginRight: 5,
                }}
              />
              <Text style={{ fontSize: 12, color: isSelected ? '#fff' : themeColors.textSecondary }}>
                {tag.name}
              </Text>
            </TouchableOpacity>
          );
        })}
        {selectedTagFilters.length > 0 && (
          <TouchableOpacity
            onPress={() => setSelectedTagFilters([])}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 12,
            }}
          >
            <Text style={{ fontSize: 12, color: themeColors.textMuted }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    )}
  </>
)}
      {renderContent()}

{(
        <>
          {showGroceryQuickActions && activeTab === 'groceries' && (
            <View style={styles.quickActionWrapper} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.quickActionBackdrop}
                activeOpacity={1}
                onPress={() => setShowGroceryQuickActions(false)}
              />
              <View style={styles.quickActionContainer}>
                <TouchableOpacity
                  style={[
                    styles.quickActionButton,
                    isClearingGroceries && styles.buttonDisabled,
                  ]}
                  onPress={handleClearGroceriesPress}
                  disabled={isClearingGroceries}
                  activeOpacity={0.9}
                >
                  {isClearingGroceries ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Trash2 size={16} color="#fff" />
                      <Text style={styles.quickActionButtonText}>Clear grocery list</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          <Pressable
            style={styles.fab}
            onPress={() => {
              if (!isVoiceRecording) {
                handleAddClick();
              }
            }}
            onLongPress={() => {
              if (activeTab === 'groceries') {
                setShowGroceryQuickActions((prev) => !prev);
              } else if (activeTab === 'ideas') {
                startVoiceRecording();
              }
            }}
            onPressOut={() => {
              if (isVoiceRecording) {
                stopVoiceRecording();
              }
            }}
            delayLongPress={300}
          >
            {isVoiceRecording ? (
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <Mic size={24} color="#fff" />
              </Animated.View>
            ) : (
              <Plus size={24} color="#fff" />
            )}
          </Pressable>
        </>
      )}

      <Modal
        visible={showAddForm}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={dynamicStyles.formModalOverlay}
        >
          <TouchableOpacity
            style={dynamicStyles.formModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowAddForm(false);
              // Clear address suggestions when closing form
              setShowAddressSuggestions(false);
              setAddressSuggestions([]);
            }}
          />
          <View style={dynamicStyles.formModalContent}>
            <View style={dynamicStyles.formModalHeader}>
              <Text style={dynamicStyles.modalTitle}>{isEditMode ? 'Edit' : 'Add'} {addItemType === 'activities' ? 'Activity' : addItemType === 'gifts' ? 'Gift Idea' : addItemType === 'wishlist' ? 'Wishlist Item' : addItemType === 'otherShop' ? 'Shopping Item' : 'Item'}</Text>
              <TouchableOpacity onPress={() => {
                setShowAddForm(false);
                setIsEditMode(false);
                setEditingItem(null);
                // Clear address suggestions when closing form
                setShowAddressSuggestions(false);
                setAddressSuggestions([]);
              }}>
                <X size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.formModalForm} keyboardShouldPersistTaps="handled">
              {addItemType === 'gifts' ? (
                <>
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Person's name"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.person}
                    onChangeText={(text) => setNewItem({...newItem, person: text})}
                  />
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Gift idea"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.title}
                    onChangeText={(text) => setNewItem({...newItem, title: text})}
                  />
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Price (optional)"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.budget}
                    onChangeText={(text) => setNewItem({...newItem, budget: text})}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Link (optional)"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.link}
                    onChangeText={(text) => setNewItem({...newItem, link: text})}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              ) : addItemType === 'activities' ? (
                <>
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Activity title"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.title}
                    onChangeText={(text) => setNewItem({...newItem, title: text})}
                  />

                  <TouchableOpacity
                    style={dynamicStyles.formInput}
                    onPress={() => openDatePicker('activityDate')}
                  >
                    <Text style={newItem.date ? dynamicStyles.formInputText : dynamicStyles.formInputPlaceholder}>
                      {newItem.date || 'Select date'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={dynamicStyles.formInput}
                    onPress={openTimePicker}
                  >
                    <Text style={newItem.time ? dynamicStyles.formInputText : dynamicStyles.formInputPlaceholder}>
                      {newItem.time ? formatTime(newItem.time) : 'Select time'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={dynamicStyles.formInput}
                    onPress={(e) => {
                      e.stopPropagation();
                      openReminderPicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={newItem.reminderTime ? dynamicStyles.formInputText : dynamicStyles.formInputPlaceholder}>
                      {newItem.reminderTime ? `Set Reminder: ${newItem.reminderTime}` : 'Set Reminder'}
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Category (work, social, exercise, etc.)"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.activityCategory}
                    onChangeText={(text) => setNewItem({...newItem, activityCategory: text})}
                  />

                  <View style={styles.inputWithClear}>
                    <TextInput
                      style={[dynamicStyles.formInput, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                      placeholder="Address (optional)"
                      placeholderTextColor={themeColors.textMuted}
                      autoCorrect={false}
                      autoCapitalize="none"
                      value={newItem.activityAddress}
                      onChangeText={(text) => {
                        setNewItem({...newItem, activityAddress: text});
                        searchAddress(text);
                      }}
                    />
                    {newItem.activityAddress && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setNewItem({...newItem, activityAddress: '', activityLatitude: null, activityLongitude: null})}
                      >
                        <X size={20} color={themeColors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <View style={dynamicStyles.formSuggestionsContainer}>
                      <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="always">
                        {addressSuggestions.map((suggestion, index) => (
                          <TouchableOpacity
                            key={index}
                            style={dynamicStyles.formSuggestionItem}
                            onPress={() => handleAddressSelect(suggestion, true)}
                          >
                            <MapPin size={16} color={themeColors.textMuted} />
                            <Text style={dynamicStyles.formSuggestionText}>{suggestion.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <LocationReminderToggle
                    enabled={newItem.locationReminder}
                    onToggle={(value) => setNewItem({...newItem, locationReminder: value})}
                    hasLocation={!!(newItem.activityLatitude && newItem.activityLongitude)}
                    theme={theme}
                  />
                </>
              ) : (
                <>
                {addItemType === 'ideas' && (
                  <>
                    <View style={dynamicStyles.shopModeSelector}>
                      <TouchableOpacity
                        style={[dynamicStyles.shopModeButton, ideaScope === 'personal' && dynamicStyles.shopModeButtonActive]}
                        onPress={() => setIdeaScope('personal')}
                      >
                        <Text style={[dynamicStyles.shopModeButtonText, ideaScope === 'personal' && dynamicStyles.shopModeButtonTextActive]}>Personal</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[dynamicStyles.shopModeButton, ideaScope === 'household' && dynamicStyles.shopModeButtonActive]}
                        onPress={() => setIdeaScope('household')}
                      >
                        <Text style={[dynamicStyles.shopModeButtonText, ideaScope === 'household' && dynamicStyles.shopModeButtonTextActive]}>Household</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Tag picker for ideas */}
                    <View style={{ marginBottom: 16 }}>
                      {ideaTags.length === 0 ? (
                        <TouchableOpacity
                          onPress={() => {
                            setShowTagManager(true);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: themeColors.border,
                            borderStyle: 'dashed',
                          }}
                        >
                          <Tag size={16} color={themeColors.textSecondary} />
                          <Text style={{ fontSize: 14, color: themeColors.textSecondary, marginLeft: 8 }}>
                            + Add tags to organize ideas
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {ideaTags.map((tag) => {
                            const isSelected = newItem.tagIds?.includes(tag.id);
                            return (
                              <TouchableOpacity
                                key={tag.id}
                                onPress={() => {
                                  const currentTags = newItem.tagIds || [];
                                  if (isSelected) {
                                    setNewItem({ ...newItem, tagIds: currentTags.filter(id => id !== tag.id) });
                                  } else {
                                    setNewItem({ ...newItem, tagIds: [...currentTags, tag.id] });
                                  }
                                }}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  borderRadius: 16,
                                  backgroundColor: isSelected ? tag.color : themeColors.cardBackground,
                                  borderWidth: 1,
                                  borderColor: isSelected ? tag.color : themeColors.border,
                                }}
                              >
                                <View
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: isSelected ? '#fff' : tag.color,
                                    marginRight: 6,
                                  }}
                                />
                                <Text style={{ fontSize: 13, color: isSelected ? '#fff' : themeColors.text }}>
                                  {tag.name}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            onPress={() => {
                              setShowTagManager(true);
                            }}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: 16,
                              borderWidth: 1,
                              borderColor: themeColors.border,
                              borderStyle: 'dashed',
                            }}
                          >
                            <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>+ Add</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </>
                )}
                <TextInput
                  style={dynamicStyles.formInput}
                  placeholder={addItemType === 'restaurants' ? "Restaurant name" : "Item title"}
                  placeholderTextColor={themeColors.textMuted}
                  value={newItem.title}
                  onChangeText={(text) => setNewItem({...newItem, title: text})}
                />

                </>
              )}
{addItemType === 'todo' && (
  <>
    <View style={dynamicStyles.shopModeSelector}>
      <TouchableOpacity
        style={[dynamicStyles.shopModeButton, todoItemType === 'task' && dynamicStyles.shopModeButtonActive]}
        onPress={() => setTodoItemType('task')}
      >
        <Text style={[dynamicStyles.shopModeButtonText, todoItemType === 'task' && dynamicStyles.shopModeButtonTextActive]}>
          Task
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[dynamicStyles.shopModeButton, todoItemType === 'activity' && dynamicStyles.shopModeButtonActive]}
        onPress={() => setTodoItemType('activity')}
      >
        <Text style={[dynamicStyles.shopModeButtonText, todoItemType === 'activity' && dynamicStyles.shopModeButtonTextActive]}>
          Activity
        </Text>
      </TouchableOpacity>
    </View>
    <View style={dynamicStyles.shopModeSelector}>
      <TouchableOpacity
        style={[dynamicStyles.shopModeButton, (todoItemType === 'task' ? taskScope : activityScope) === 'personal' && dynamicStyles.shopModeButtonActive]}
        onPress={() => {
          if (todoItemType === 'task') {
            setTaskScope('personal');
          } else {
            setActivityScope('personal');
          }
        }}
      >
        <Text style={[dynamicStyles.shopModeButtonText, (todoItemType === 'task' ? taskScope : activityScope) === 'personal' && dynamicStyles.shopModeButtonTextActive]}>
          Personal
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[dynamicStyles.shopModeButton, (todoItemType === 'task' ? taskScope : activityScope) === 'household' && dynamicStyles.shopModeButtonActive]}
        onPress={() => {
          if (todoItemType === 'task') {
            setTaskScope('household');
          } else {
            setActivityScope('household');
          }
        }}
      >
        <Text style={[dynamicStyles.shopModeButtonText, (todoItemType === 'task' ? taskScope : activityScope) === 'household' && dynamicStyles.shopModeButtonTextActive]}>
          Household
        </Text>
      </TouchableOpacity>
    </View>
  </>
)}
{addItemType === 'groceries' && tabSettings.groceries?.showPrices !== false && (
  <TextInput
    style={dynamicStyles.formInput}
    placeholder="Price (optional)"
    placeholderTextColor={themeColors.textMuted}
    value={newItem.price}
    onChangeText={(text) => setNewItem({...newItem, price: text})}
    keyboardType="decimal-pad"
  />
)}

{addItemType === 'wishlist' && (
  <>
    <TextInput
      style={dynamicStyles.formInput}
      placeholder="Price (optional)"
      placeholderTextColor={themeColors.textMuted}
      value={newItem.price}
      onChangeText={(text) => setNewItem({...newItem, price: text})}
      keyboardType="decimal-pad"
    />
    <TextInput
      style={dynamicStyles.formInput}
      placeholder="Link (optional)"
      placeholderTextColor={themeColors.textMuted}
      value={newItem.link}
      onChangeText={(text) => setNewItem({...newItem, link: text})}
      autoCapitalize="none"
      keyboardType="url"
    />
  </>
)}

{addItemType === 'otherShop' && (
  <>
    <TextInput
      style={dynamicStyles.formInput}
      placeholder="Store name (optional)"
      placeholderTextColor={themeColors.textMuted}
      value={newItem.notes}
      onChangeText={(text) => setNewItem({...newItem, notes: text})}
    />
    <TextInput
      style={dynamicStyles.formInput}
      placeholder="Price (optional)"
      placeholderTextColor={themeColors.textMuted}
      value={newItem.price}
      onChangeText={(text) => setNewItem({...newItem, price: text})}
      keyboardType="decimal-pad"
    />
  </>
)}

              {addItemType === 'restaurants' && (
                <>
                  <View style={styles.inputWithClear}>
                    <TextInput
                      style={[dynamicStyles.formInput, { flex: 1, marginBottom: 0, marginRight: 8 }]}
                      placeholder="Address"
                      placeholderTextColor={themeColors.textMuted}
                      autoCorrect={false}
                      autoCapitalize="none"
                      value={newItem.address}
                      onChangeText={(text) => {
                        setNewItem({...newItem, address: text});
                        searchAddress(text);
                      }}
                    />
                    {newItem.address && (
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => setNewItem({...newItem, address: '', latitude: null, longitude: null})}
                      >
                        <X size={20} color={themeColors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <View style={dynamicStyles.formSuggestionsContainer}>
                      <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="always">
                        {addressSuggestions.map((suggestion, index) => (
                          <TouchableOpacity
                            key={index}
                            style={dynamicStyles.formSuggestionItem}
                            onPress={() => handleAddressSelect(suggestion, false)}
                          >
                            <MapPin size={16} color={themeColors.textMuted} />
                            <Text style={dynamicStyles.formSuggestionText}>{suggestion.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Cuisine type"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.cuisine}
                    onChangeText={(text) => setNewItem({...newItem, cuisine: text})}
                  />
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Price range ($, $$, $$$, $$$$)"
                    placeholderTextColor={themeColors.textMuted}
                    value={newItem.priceRange}
                    onChangeText={(text) => setNewItem({...newItem, priceRange: text})}
                  />

                  <LocationReminderToggle
                    enabled={newItem.locationReminder}
                    onToggle={(value) => setNewItem({...newItem, locationReminder: value})}
                    hasLocation={!!(newItem.latitude && newItem.longitude)}
                    theme={theme}
                  />
                </>
              )}

{addItemType === 'todo' && todoItemType === 'task' && (
  <>
    <TouchableOpacity
      style={dynamicStyles.formInput}
      onPress={() => openDatePicker('dueDate')}
    >
      <Text style={newItem.dueDate ? dynamicStyles.formInputText : dynamicStyles.formInputPlaceholder}>
        {newItem.dueDate ? `Due: ${formatDate(newItem.dueDate)}` : 'Set due date (optional)'}
      </Text>
    </TouchableOpacity>

    <Text style={dynamicStyles.formLabel}>Priority</Text>
    <View style={styles.priorityButtons}>
      {['low', 'medium', 'high', 'urgent'].map((priority) => (
        <TouchableOpacity
          key={priority}
          style={[
            styles.priorityButton,
            { backgroundColor: getPriorityColor(priority) },
            newItem.priority === priority && styles.priorityButtonActive
          ]}
          onPress={() => setNewItem({...newItem, priority})}
          activeOpacity={0.8}
        >
          <Text style={styles.priorityButtonText}>
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>

    {/* ADD THIS - Address for tasks */}
    <View style={styles.inputWithClear}>
      <TextInput
        style={[dynamicStyles.formInput, { flex: 1, marginBottom: 0, marginRight: 8 }]}
        placeholder="Address (optional)"
        placeholderTextColor={themeColors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        value={newItem.activityAddress}
        onChangeText={(text) => {
          setNewItem({...newItem, activityAddress: text});
          searchAddress(text);
        }}
      />
      {newItem.activityAddress && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setNewItem({...newItem, activityAddress: '', activityLatitude: null, activityLongitude: null})}
        >
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>

    {showAddressSuggestions && addressSuggestions.length > 0 && (
      <View style={styles.suggestionsContainer}>
        <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="always">
          {addressSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleAddressSelect(suggestion, true)}
            >
              <MapPin size={16} color="#9CA3AF" />
              <Text style={styles.suggestionText}>{suggestion.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}

    <LocationReminderToggle
      enabled={newItem.locationReminder}
      onToggle={(value) => setNewItem({...newItem, locationReminder: value})}
      hasLocation={!!(newItem.activityLatitude && newItem.activityLongitude)}
      theme={theme}
    />
  </>
)}
{addItemType === 'todo' && todoItemType === 'activity' && (
  <>
    <TouchableOpacity
      style={styles.input}
      onPress={() => openDatePicker('activityDate')}
    >
      <Text style={newItem.date ? styles.inputText : styles.inputPlaceholder}>
        {newItem.date ? formatDate(newItem.date) : 'Start date *'}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.input}
      onPress={() => openDatePicker('activityEndDate')}
    >
      <Text style={newItem.endDate ? styles.inputText : styles.inputPlaceholder}>
        {newItem.endDate ? formatDate(newItem.endDate) : 'End date (optional)'}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.input}
      onPress={openTimePicker}
    >
      <Text style={newItem.time ? styles.inputText : styles.inputPlaceholder}>
        {newItem.time ? formatTime(newItem.time) : 'Select time (optional)'}
      </Text>
    </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.input}
                    onPress={(e) => {
                      e.stopPropagation();
                      openReminderPicker();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={newItem.reminderTime ? styles.inputText : styles.inputPlaceholder}>
                      {newItem.reminderTime ? `Set Reminder: ${newItem.reminderTime}` : 'Set Reminder'}
      </Text>
    </TouchableOpacity>

    <View style={styles.inputWithClear}>
      <TextInput
        style={[styles.input, styles.inputWithButton]}
        placeholder="Address *"
        placeholderTextColor="#9CA3AF"
        autoCorrect={false}
        autoCapitalize="none"
        value={newItem.activityAddress}
        onChangeText={(text) => {
          setNewItem({...newItem, activityAddress: text});
          searchAddress(text);
        }}
      />
      {newItem.activityAddress && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => setNewItem({...newItem, activityAddress: '', activityLatitude: null, activityLongitude: null})}
        >
          <X size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>

    {showAddressSuggestions && addressSuggestions.length > 0 && (
      <View style={styles.suggestionsContainer}>
        <ScrollView style={styles.suggestionsList} keyboardShouldPersistTaps="always">
          {addressSuggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => handleAddressSelect(suggestion, true)}
            >
              <MapPin size={16} color="#9CA3AF" />
              <Text style={styles.suggestionText}>{suggestion.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}

    <LocationReminderToggle
      enabled={newItem.locationReminder}
      onToggle={(value) => setNewItem({...newItem, locationReminder: value})}
      hasLocation={!!(newItem.activityLatitude && newItem.activityLongitude)}
      theme={theme}
    />
  </>
)}
              {addItemType === 'personal' && (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Price (optional)"
                    placeholderTextColor="#9CA3AF"
                    value={newItem.budget}
                    onChangeText={(text) => setNewItem({...newItem, budget: text})}
                    keyboardType="decimal-pad"
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Link (optional)"
                    placeholderTextColor="#9CA3AF"
                    value={newItem.link}
                    onChangeText={(text) => setNewItem({...newItem, link: text})}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </>
              )}

              <TextInput
                style={[dynamicStyles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Notes (optional)"
                placeholderTextColor={themeColors.textMuted}
                value={newItem.notes}
                onChangeText={(text) => setNewItem({...newItem, notes: text})}
                multiline
              />

              <View style={dynamicStyles.modalButtons}>
                <TouchableOpacity
                  style={[dynamicStyles.button, dynamicStyles.buttonCancel]}
                  onPress={() => {
                    setShowAddForm(false);
                    setIsEditMode(false);
                    setEditingItem(null);
                    // Clear address suggestions when closing form
                    setShowAddressSuggestions(false);
                    setAddressSuggestions([]);
                  }}
                >
                  <Text style={dynamicStyles.buttonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    dynamicStyles.button,
                    dynamicStyles.buttonAdd,
                    !isEditMode && isSubmitting && dynamicStyles.buttonDisabled,
                  ]}
                  onPress={isEditMode ? saveEditedItem : addItem}
                  disabled={!isEditMode && isSubmitting}
                >
                  <Text style={dynamicStyles.buttonText}>{isEditMode ? 'Save' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
          {showDatePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => {
                // Use local date to avoid timezone issues
                const year = tempDate.getFullYear();
                const month = String(tempDate.getMonth() + 1).padStart(2, '0');
                const day = String(tempDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                if (dateFieldType === 'dueDate') {
                  setNewItem({...newItem, dueDate: dateStr});
                } else if (dateFieldType === 'activityDate') {
                  setNewItem({...newItem, date: dateStr});
                } else if (dateFieldType === 'activityEndDate') {
                  setNewItem({...newItem, endDate: dateStr});
                }
                setShowDatePicker(false);
              }}>
                <Text style={styles.pickerDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
              textColor="#1f2933"
              themeVariant="light"
            />
          </View>
        </View>
      )}

      {/* Time Picker Overlay - INSIDE the add form modal */}
      {showTimePicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => {
                const hours = tempDate.getHours().toString().padStart(2, '0');
                const minutes = tempDate.getMinutes().toString().padStart(2, '0');
                setNewItem({...newItem, time: `${hours}:${minutes}`});
                setShowTimePicker(false);
              }}>
                <Text style={styles.pickerDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              textColor="#1f2933"
              themeVariant="light"
            />
          </View>
        </View>
      )}

      {/* Reminder Picker Overlay - INSIDE the add form modal */}
      {showReminderPicker && (
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => {
                setShowReminderPicker(false);
              }}>
                <Text style={styles.pickerDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={newItem.reminderTime || '1 hour before'}
              onValueChange={(itemValue) => {
                setNewItem({...newItem, reminderTime: itemValue});
              }}
              style={styles.picker}
              itemStyle={styles.pickerItem}
            >
              <Picker.Item label="15 min before" value="15 min before" />
              <Picker.Item label="1 hour before" value="1 hour before" />
              <Picker.Item label="1 day before" value="1 day before" />
              <Picker.Item label="3 days before" value="3 days before" />
              <Picker.Item label="1 week before" value="1 week before" />
            </Picker>
          </View>
        </View>
      )}
      
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showRecipeForm}
        transparent
        animationType="slide"
        onRequestClose={closeRecipeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.select({ ios: 0, android: 0 })}
          style={dynamicStyles.formModalOverlay}
        >
          <TouchableOpacity
            style={dynamicStyles.formModalBackdrop}
            activeOpacity={1}
            onPress={closeRecipeForm}
          />
          <View style={dynamicStyles.formModalContent}>
            <ScrollView
              contentContainerStyle={{
                paddingBottom: allowManualRecipeEntry ? 32 : 32,
              }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={dynamicStyles.formModalHeader}>
                <Text style={dynamicStyles.modalTitle}>{editingRecipeId ? 'Edit Recipe' : 'Add Recipe'}</Text>
                <TouchableOpacity onPress={closeRecipeForm}>
                  <X size={24} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={dynamicStyles.formModalForm}>
              <Text style={dynamicStyles.modalSubtitle}>
                Paste a TikTok or Instagram link and we&apos;ll pull the ingredients and steps for you.
              </Text>
              <TextInput
                style={dynamicStyles.formInput}
                placeholder="Video link"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
                value={newRecipeUrl}
                onFocus={async () => {
                  // Auto-paste from clipboard if field is empty
                  if (!newRecipeUrl.trim()) {
                    // Add a small delay to allow permission dialog to complete if needed
                    await new Promise(resolve => setTimeout(resolve, 200));
                    try {
                      const clipboardText = await Clipboard.getStringAsync();
                      if (clipboardText && clipboardText.trim()) {
                        const trimmedText = clipboardText.trim();
                        // Check if it looks like a URL (Instagram, TikTok, or any http/https link)
                        // More lenient pattern - just check if it contains common URL indicators
                        const hasUrl = trimmedText.includes('http://') || 
                                      trimmedText.includes('https://') ||
                                      trimmedText.includes('instagram.com') || 
                                      trimmedText.includes('tiktok.com') ||
                                      trimmedText.includes('www.') ||
                                      /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedText);
                        
                        if (hasUrl) {
                          setRecipeExtractionError('');
                          if (allowManualRecipeEntry) {
                            resetManualRecipeFields();
                          }
                          setNewRecipeUrl(trimmedText);
                        }
                      }
                    } catch (error) {
                      // Silently fail if clipboard access fails
                      console.error('Error reading clipboard:', error);
                    }
                  }
                }}
                onChangeText={(text) => {
                  setRecipeExtractionError('');
                  if (allowManualRecipeEntry) {
                    resetManualRecipeFields();
                  }
                  setNewRecipeUrl(text);
                }}
              />
              {/* Category Tags */}
              <Text style={dynamicStyles.recipeTagsLabel}>Tags (optional)</Text>
              <View style={dynamicStyles.recipeTagsContainer}>
                {['Quick', 'Dinner', 'Dessert', 'Healthy', 'Breakfast', 'Lunch'].map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      dynamicStyles.recipeTagButton,
                      newRecipeTags.includes(tag) && dynamicStyles.recipeTagButtonActive
                    ]}
                    onPress={() => {
                      if (newRecipeTags.includes(tag)) {
                        setNewRecipeTags(newRecipeTags.filter(t => t !== tag));
                      } else {
                        setNewRecipeTags([...newRecipeTags, tag]);
                      }
                    }}
                  >
                    <Text style={[
                      dynamicStyles.recipeTagButtonText,
                      newRecipeTags.includes(tag) && dynamicStyles.recipeTagButtonTextActive
                    ]}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {recipeExtractionError ? (
                <Text style={dynamicStyles.errorText}>{recipeExtractionError}</Text>
              ) : null}
              <View style={dynamicStyles.modalButtons}>
                <TouchableOpacity
                  style={[dynamicStyles.button, dynamicStyles.buttonCancel]}
                  onPress={closeRecipeForm}
                >
                  <Text style={dynamicStyles.buttonCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    dynamicStyles.button,
                    dynamicStyles.buttonAdd,
                    (isExtractingRecipe ||
                      (editingRecipeId
                        ? !recipeHasChanges
                        : (allowManualRecipeEntry
                          ? !manualRecipeReady
                          : !newRecipeUrl.trim()))) && dynamicStyles.buttonDisabled,
                  ]}
                  disabled={
                    isExtractingRecipe ||
                    (editingRecipeId
                      ? !recipeHasChanges
                      : (allowManualRecipeEntry ? !manualRecipeReady : !newRecipeUrl.trim()))
                  }
                  onPress={allowManualRecipeEntry ? addRecipeManually : addRecipeFromUrl}
                >
                  {isExtractingRecipe ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={dynamicStyles.buttonText}>
                      {editingRecipeId ? 'Save Recipe' : (allowManualRecipeEntry ? 'Add Recipe' : 'Fetch Recipe')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
              {allowManualRecipeEntry && (
                <>
                  <Text style={dynamicStyles.manualSectionHeader}>
                    Add recipe manually
                  </Text>
                  <Text style={dynamicStyles.manualFieldLabel}>Caption from link</Text>
                  <TextInput
                    style={[dynamicStyles.formInput, { minHeight: 100, textAlignVertical: 'top' }]}
                    placeholder="Caption will appear here if automatic extraction fails"
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={manualRecipeRawCaption}
                    onChangeText={setManualRecipeRawCaption}
                  />
                  <TextInput
                    style={dynamicStyles.formInput}
                    placeholder="Recipe title"
                    placeholderTextColor={themeColors.textMuted}
                    value={manualRecipeTitle}
                    onChangeText={setManualRecipeTitle}
                  />
                  <TextInput
                    style={[dynamicStyles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
                    placeholder="Description (optional)"
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    value={manualRecipeDescription}
                    onChangeText={setManualRecipeDescription}
                  />
                  <Text style={dynamicStyles.manualFieldLabel}>Ingredients (one per line)</Text>
                  <TextInput
                    style={[dynamicStyles.formInput, { minHeight: 100, textAlignVertical: 'top' }]}
                    placeholder="e.g. 1 tbsp chili oil"
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={manualRecipeIngredients}
                    onChangeText={setManualRecipeIngredients}
                  />
                  <Text style={dynamicStyles.manualFieldLabel}>Steps (one per line)</Text>
                  <TextInput
                    style={[dynamicStyles.formInput, { minHeight: 100, textAlignVertical: 'top' }]}
                    placeholder="e.g. Whisk eggs in a small bowl"
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    textAlignVertical="top"
                    value={manualRecipeSteps}
                    onChangeText={setManualRecipeSteps}
                  />
                </>
              )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={!!selectedRecipe}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowRecipeActions(false);
          setSelectedRecipe(null);
        }}
      >
        <View style={dynamicStyles.modalOverlay}>
          <TouchableOpacity
            style={dynamicStyles.modalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowRecipeActions(false);
              setSelectedRecipe(null);
            }}
          />
          <View style={dynamicStyles.recipeDetailModal}>
            {selectedRecipe && (
              <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
                <View style={dynamicStyles.recipeDetailHeader}>
                  <Text style={dynamicStyles.recipeDetailTitle}>
                    {(selectedRecipe.title || '').trim() || 'Recipe'}
                  </Text>
                  <View style={dynamicStyles.recipeDetailHeaderActions}>
                    <TouchableOpacity
                      onPress={() => setShowRecipeActions((prev) => !prev)}
                      style={dynamicStyles.recipeDetailActionButton}
                    >
                      <MoreVertical size={20} color={themeColors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setShowRecipeActions(false);
                          setSelectedRecipe(null);
                      }}
                      style={dynamicStyles.recipeDetailActionButton}
                    >
                      <X size={24} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
                {showRecipeActions && (
                  <View style={dynamicStyles.recipeDetailActionSheet}>
                    <TouchableOpacity
                      style={dynamicStyles.recipeDetailActionSheetItem}
                      onPress={() => {
                        setShowRecipeActions(false);
                        if (selectedRecipe) {
                          setEditingRecipeId(selectedRecipe.id || null);
                          setEditingRecipeOriginal(selectedRecipe);
                          setRecipeExtractionError('');
                          const ingredientList = Array.isArray(selectedRecipe.ingredients)
                            ? selectedRecipe.ingredients.map((ingredient) =>
                                typeof ingredient === 'string'
                                  ? ingredient
                                  : formatIngredientLine(ingredient)
                              )
                            : [];
                          const stepList = Array.isArray(selectedRecipe.steps)
                            ? selectedRecipe.steps.map((step) =>
                                typeof step === 'string' ? step : String(step)
                              )
                            : [];
                          setManualRecipeTitle(selectedRecipe.title || '');
                          setManualRecipeDescription(selectedRecipe.description || '');
                          setManualRecipeIngredients(ingredientList.join('\n'));
                          setManualRecipeSteps(stepList.join('\n'));
                          setManualRecipeRawCaption('');
                          setAllowManualRecipeEntry(true);
                          setNewRecipeUrl(selectedRecipe.sourceUrl || selectedRecipe.videoUrl || '');
                          setNewRecipeTags(Array.isArray(selectedRecipe.tags) ? selectedRecipe.tags : []);
                          setSelectedRecipe(null);
                          setShowRecipeForm(true);
                        }
                      }}
                    >
                      <Pencil size={18} color="#fff" />
                      <Text style={dynamicStyles.recipeDetailActionSheetText}>Edit Recipe</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={dynamicStyles.recipeDetailActionSheetItem}
                      onPress={() => {
                        setShowRecipeActions(false);
                        if (selectedRecipe) {
                          shareRecipe(selectedRecipe);
                        }
                      }}
                    >
                      <Share2 size={18} color="#fff" />
                      <Text style={dynamicStyles.recipeDetailActionSheetText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dynamicStyles.recipeDetailActionSheetItem, dynamicStyles.recipeDetailActionSheetItemSecondary]}
                      onPress={() => setShowRecipeActions(false)}
                    >
                      <Text style={dynamicStyles.recipeDetailActionSheetSecondaryText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {selectedRecipe.thumbnail ? (
                  <Image source={{ uri: selectedRecipe.thumbnail }} style={styles.recipeDetailImage} />
                ) : null}
                {selectedRecipe.sourceName ? (
                  <Text style={dynamicStyles.recipeSourceDetail}>Source: {selectedRecipe.sourceName}</Text>
                ) : null}
                {(hasSelectedRecipeVideo || hasSelectedRecipeIngredients) && (
                  <View style={styles.recipeActionButtonRow}>
                    {hasSelectedRecipeVideo && (
                      <TouchableOpacity
                        style={styles.recipePrimaryButton}
                        onPress={() => openRecipeSource(selectedRecipe)}
                        activeOpacity={0.85}
                      >
                        <ExternalLink size={18} color="#fff" />
                        <Text style={styles.recipePrimaryButtonText}>Open Video</Text>
                      </TouchableOpacity>
                    )}
                    {hasSelectedRecipeIngredients && (
                      <TouchableOpacity
                        style={[
                          styles.recipeSecondaryButton,
                          (isAddingRecipeToGroceries || !hasSelectedRecipeIngredients) && styles.buttonDisabled,
                        ]}
                        disabled={isAddingRecipeToGroceries || !hasSelectedRecipeIngredients}
                        onPress={() => handleAddRecipeIngredientsToGroceries(selectedRecipe)}
                        activeOpacity={0.85}
                      >
                        {isAddingRecipeToGroceries ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <>
                            <ShoppingCart size={18} color="#fff" />
                            <Text style={styles.recipeSecondaryButtonText}>Add to Groceries</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {selectedRecipe.description ? (
                  <Text style={dynamicStyles.recipeDescription}>{selectedRecipe.description}</Text>
                ) : null}
                <Text style={dynamicStyles.recipeSectionTitle}>Ingredients</Text>
                {Array.isArray(selectedRecipe.ingredients) && selectedRecipe.ingredients.length > 0 ? (
                  <View style={styles.recipeList}>
                    {selectedRecipe.ingredients.map((ingredient, index) => (
                      <View key={`ingredient-${index}`} style={styles.recipeListItem}>
                        <View style={styles.recipeBullet} />
                        <Text style={dynamicStyles.recipeListText}>{formatIngredientLine(ingredient)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={dynamicStyles.recipeEmptyText}>No ingredients found.</Text>
                )}
                <Text style={dynamicStyles.recipeSectionTitle}>Steps</Text>
                {Array.isArray(selectedRecipe.steps) && selectedRecipe.steps.length > 0 ? (
                  <View style={styles.recipeList}>
                    {selectedRecipe.steps.map((step, index) => (
                      <View key={`step-${index}`} style={styles.recipeListItemNumbered}>
                        <Text style={styles.recipeStepNumber}>{index + 1}</Text>
                        <Text style={dynamicStyles.recipeListText}>{typeof step === 'string' ? step : String(step)}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={dynamicStyles.recipeEmptyText}>No steps found.</Text>
                )}
                {selectedRecipe.notes ? (
                  <>
                    <Text style={dynamicStyles.recipeSectionTitle}>Notes</Text>
                    <Text style={dynamicStyles.recipeNotesText}>{selectedRecipe.notes}</Text>
                  </>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Activity Detail Modal */}
      <Modal
        visible={!!selectedActivity}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowActivityActions(false);
          setSelectedActivity(null);
        }}
      >
        <View style={dynamicStyles.modalOverlay}>
          <TouchableOpacity
            style={dynamicStyles.formModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowActivityActions(false);
              setSelectedActivity(null);
            }}
          />
          <View style={dynamicStyles.activityDetailModal}>
            {selectedActivity && (
              <View style={{ flex: 1 }}>
                {/* Decorative Header Accent */}
                <View style={[styles.activityDetailAccent, { backgroundColor: themeColors.accentPrimary }]} />

                {/* Header */}
                <View style={dynamicStyles.activityDetailHeader}>
                  <View style={styles.activityDetailHeaderLeft}>
                    <View style={[
                      styles.activityDetailIcon,
                      { backgroundColor: selectedActivity.isPersonal ? (theme === 'dark' ? 'rgba(254, 243, 199, 0.2)' : '#fef3c7') : (theme === 'dark' ? 'rgba(219, 234, 254, 0.2)' : '#dbeafe') }
                    ]}>
                      <Calendar size={24} color={selectedActivity.isPersonal ? '#fbbf24' : '#60a5fa'} />
                    </View>
                  </View>
                  <View style={styles.activityDetailHeaderActions}>
                    <TouchableOpacity
                      onPress={() => setShowActivityActions(prev => !prev)}
                      style={dynamicStyles.activityDetailActionBtn}
                    >
                      <MoreVertical size={20} color={themeColors.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setShowActivityActions(false);
                        setSelectedActivity(null);
                      }}
                      style={dynamicStyles.activityDetailActionBtn}
                    >
                      <X size={22} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Action Sheet */}
                {showActivityActions && (
                  <View style={dynamicStyles.activityDetailActionSheet}>
                    <TouchableOpacity
                      style={dynamicStyles.activityDetailActionSheetItem}
                      onPress={() => {
                        setShowActivityActions(false);
                        const activity = selectedActivity;
                        setSelectedActivity(null);
                        openEditForm(activity, activity.isPersonal ? 'personalActivity' : 'activity');
                      }}
                    >
                      <Pencil size={18} color="#fff" />
                      <Text style={[dynamicStyles.activityDetailActionSheetText, { color: '#fff' }]}>Edit Activity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={dynamicStyles.activityDetailActionSheetItem}
                      onPress={() => {
                        setShowActivityActions(false);
                        if (selectedActivity?.location?.address) {
                          const address = encodeURIComponent(selectedActivity.location.address);
                          Linking.openURL(`maps://?address=${address}`);
                        }
                      }}
                    >
                      <MapPin size={18} color="#fff" />
                      <Text style={[dynamicStyles.activityDetailActionSheetText, { color: '#fff' }]}>Open in Maps</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dynamicStyles.activityDetailActionSheetItem, { borderTopWidth: 1, borderTopColor: theme === 'dark' ? '#4b5563' : '#374151' }]}
                      onPress={() => {
                        setShowActivityActions(false);
                        Alert.alert(
                          'Delete Activity',
                          'Are you sure you want to delete this activity?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                deleteItem(selectedActivity.id, selectedActivity.isPersonal ? 'personalActivities' : 'activities');
                                setSelectedActivity(null);
                              }
                            }
                          ]
                        );
                      }}
                    >
                      <Trash2 size={18} color="#ef4444" />
                      <Text style={[dynamicStyles.activityDetailActionSheetText, { color: '#ef4444' }]}>Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[dynamicStyles.activityDetailActionSheetItem, { justifyContent: 'center', borderTopWidth: 1, borderTopColor: theme === 'dark' ? '#4b5563' : '#374151' }]}
                      onPress={() => setShowActivityActions(false)}
                    >
                      <Text style={{ color: '#9ca3af', fontSize: 15 }}>Close</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Content */}
                <ScrollView
                  style={dynamicStyles.activityDetailContent}
                  contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Title */}
                  <Text style={dynamicStyles.activityDetailTitle}>{selectedActivity.title}</Text>

                  {/* Category Badge */}
                  <View style={styles.activityDetailBadgeRow}>
                    <View style={[
                      styles.activityDetailBadge,
                      { backgroundColor: selectedActivity.isPersonal ? '#fef3c7' : '#dbeafe' }
                    ]}>
                      <Text style={[
                        styles.activityDetailBadgeText,
                        { color: selectedActivity.isPersonal ? '#b45309' : '#2563eb' }
                      ]}>
                        {selectedActivity.isPersonal ? 'Personal' : 'Household'}
                      </Text>
                    </View>
                    {selectedActivity.activityCategory && (
                      <View style={[styles.activityDetailBadge, { backgroundColor: '#f3e8ff' }]}>
                        <Text style={[styles.activityDetailBadgeText, { color: '#7c3aed' }]}>
                          {selectedActivity.activityCategory}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Date & Time Card */}
                  <View style={dynamicStyles.activityDetailInfoCard}>
                    <View style={styles.activityDetailInfoRow}>
                      <View style={styles.activityDetailInfoIcon}>
                        <Calendar size={20} color={themeColors.accentPrimary} />
                      </View>
                      <View style={styles.activityDetailInfoContent}>
                        <Text style={dynamicStyles.activityDetailInfoLabel}>{selectedActivity.endDate ? 'Dates' : 'Date'}</Text>
                        <Text style={dynamicStyles.activityDetailInfoValue}>
                          {selectedActivity.date ? (
                            (() => {
                              // Parse dates as local to avoid timezone issues
                              const parseLocal = (str) => {
                                const [y, m, d] = str.split('-').map(Number);
                                return new Date(y, m - 1, d);
                              };
                              const startDate = parseLocal(selectedActivity.date);
                              if (selectedActivity.endDate) {
                                const endDate = parseLocal(selectedActivity.endDate);
                                return `${startDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })} - ${endDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}`;
                              } else {
                                return startDate.toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                              }
                            })()
                          ) : 'No date set'}
                        </Text>
                      </View>
                    </View>

                    {selectedActivity.time && (
                      <View style={styles.activityDetailInfoRow}>
                        <View style={styles.activityDetailInfoIcon}>
                          <Clock size={20} color={themeColors.accentPrimary} />
                        </View>
                        <View style={styles.activityDetailInfoContent}>
                          <Text style={dynamicStyles.activityDetailInfoLabel}>Time</Text>
                          <Text style={dynamicStyles.activityDetailInfoValue}>
                            {formatTime(selectedActivity.time)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Location Card */}
                  {selectedActivity.location?.address && (
                    <TouchableOpacity
                      style={dynamicStyles.activityDetailLocationCard}
                      onPress={() => {
                        const address = encodeURIComponent(selectedActivity.location.address);
                        Linking.openURL(`maps://?address=${address}`);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.activityDetailLocationIcon, { backgroundColor: themeColors.accentPrimary }]}>
                        <MapPin size={22} color="#fff" />
                      </View>
                      <View style={styles.activityDetailLocationContent}>
                        <Text style={dynamicStyles.activityDetailLocationLabel}>Location</Text>
                        <Text style={dynamicStyles.activityDetailLocationAddress} numberOfLines={2}>
                          {selectedActivity.location.address}
                        </Text>
                      </View>
                      <ExternalLink size={18} color="#9ca3af" />
                    </TouchableOpacity>
                  )}

                  {/* Notes */}
                  {selectedActivity.notes && (
                    <View style={styles.activityDetailNotesCard}>
                      <Text style={styles.activityDetailNotesLabel}>Notes</Text>
                      <Text style={styles.activityDetailNotesText}>{selectedActivity.notes}</Text>
                    </View>
                  )}
                </ScrollView>

                {/* Footer Actions */}
                <View style={styles.activityDetailFooter}>
                  <TouchableOpacity
                    style={styles.activityDetailEditButton}
                    onPress={() => {
                      const activity = selectedActivity;
                      setSelectedActivity(null);
                      openEditForm(activity, activity.isPersonal ? 'personalActivity' : 'activity');
                    }}
                    activeOpacity={0.85}
                  >
                    <Pencil size={18} color="#fff" />
                    <Text style={styles.activityDetailEditButtonText}>Edit Activity</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showTimePicker} transparent={false} presentationStyle="overFullScreen" animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.pickerModalOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            onPress={() => setShowTimePicker(false)}
          />
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerHeader}>
              <TouchableOpacity onPress={() => {
                const hours = tempDate.getHours().toString().padStart(2, '0');
                const minutes = tempDate.getMinutes().toString().padStart(2, '0');
                setNewItem({...newItem, time: `${hours}:${minutes}`});
                setShowTimePicker(false);
              }}>
                <Text style={styles.pickerDoneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="spinner"
              onChange={handleTimeChange}
              textColor="#1f2933"
              themeVariant="light"
            />
          </View>
        </View>
      </Modal>

      {/* Birthday Picker Modal */}
      <Modal visible={showBirthdayPicker} transparent={true} animationType="slide" onRequestClose={() => setShowBirthdayPicker(false)}>
        <View style={styles.birthdayPickerModalOverlay}>
          <TouchableOpacity
            style={styles.birthdayPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowBirthdayPicker(false)}
          />
          <View style={styles.birthdayPickerModalContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>
                {editingPerson ? `Set Birthday for ${editingPerson.name}` : 'Set Birthday'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity onPress={() => {
                  setShowBirthdayPicker(false);
                  setEditingPerson(null);
                }}>
                  <Text style={styles.pickerCancelButton}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveBirthday}>
                  <Text style={styles.pickerDoneButton}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
            <DateTimePicker
              value={birthdayDate}
              mode="date"
              display="spinner"
              onChange={(event, selectedDate) => {
                if (selectedDate) {
                  setBirthdayDate(selectedDate);
                }
              }}
              textColor="#1f2933"
              themeVariant="light"
            />
          </View>
        </View>
      </Modal>

      {/* Person Profile Modal */}
      <Modal
        visible={showPersonProfile}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPersonProfile(false)}
      >
        <View style={dynamicStyles.personProfileOverlay}>
          <TouchableOpacity
            style={dynamicStyles.personProfileBackdrop}
            activeOpacity={1}
            onPress={() => setShowPersonProfile(false)}
          />
          <View style={dynamicStyles.personProfileContent}>
            {profilePerson && (() => {
              const personGifts = giftIdeas.filter(g => g.person === profilePerson.name);
              const avatarColors = ['#c084fc', '#4ade80', '#60a5fa', '#f97316', '#ec4899', '#facc15'];
              const getAvatarColor = (name) => {
                let hash = 0;
                for (let i = 0; i < name.length; i++) {
                  hash = name.charCodeAt(i) + ((hash << 5) - hash);
                }
                return avatarColors[Math.abs(hash) % avatarColors.length];
              };
              const avatarColor = getAvatarColor(profilePerson.name);

              return (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Header */}
                  <View style={dynamicStyles.personProfileHeader}>
                    <View style={[dynamicStyles.personProfileAvatar, { backgroundColor: avatarColor }]}>
                      <Text style={dynamicStyles.personProfileAvatarText}>{profilePerson.name[0]}</Text>
                    </View>
                    <Text style={dynamicStyles.personProfileName}>{profilePerson.name}</Text>
                    <TouchableOpacity
                      style={dynamicStyles.personProfileCloseBtn}
                      onPress={() => setShowPersonProfile(false)}
                    >
                      <X size={24} color={themeColors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Birthday Section */}
                  <View style={dynamicStyles.personProfileSection}>
                    <Text style={dynamicStyles.personProfileSectionTitle}>Birthday</Text>
                    <View style={dynamicStyles.personProfileDatePicker}>
                      <DateTimePicker
                        value={birthdayDate}
                        mode="date"
                        display="compact"
                        onChange={(event, selectedDate) => {
                          if (selectedDate) {
                            setBirthdayDate(selectedDate);
                          }
                        }}
                        style={{ flex: 1 }}
                        accentColor={themeColors.accentPrimary}
                        themeVariant={theme}
                      />
                    </View>
                  </View>

                  {/* Sizes Section */}
                  <View style={dynamicStyles.personProfileSection}>
                    <Text style={dynamicStyles.personProfileSectionTitle}>Sizes</Text>
                    <View style={dynamicStyles.personProfileSizeRow}>
                      <View style={dynamicStyles.personProfileSizeItem}>
                        <Text style={dynamicStyles.personProfileSizeLabel}>Clothing</Text>
                        <TextInput
                          style={dynamicStyles.personProfileSizeInput}
                          placeholder="S, M, L, XL..."
                          placeholderTextColor={themeColors.textMuted}
                          value={personClothingSize}
                          onChangeText={setPersonClothingSize}
                        />
                      </View>
                      <View style={dynamicStyles.personProfileSizeItem}>
                        <Text style={dynamicStyles.personProfileSizeLabel}>Shoe</Text>
                        <TextInput
                          style={dynamicStyles.personProfileSizeInput}
                          placeholder="8, 9, 10..."
                          placeholderTextColor={themeColors.textMuted}
                          value={personShoeSize}
                          onChangeText={setPersonShoeSize}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Gift Ideas Section */}
                  <View style={dynamicStyles.personProfileSection}>
                    <View style={dynamicStyles.personProfileGiftHeader}>
                      <Text style={dynamicStyles.personProfileSectionTitle}>Gift Ideas</Text>
                      <Text style={dynamicStyles.personProfileGiftCount}>{personGifts.length} ideas</Text>
                    </View>
                    {personGifts.length === 0 ? (
                      <Text style={dynamicStyles.personProfileEmptyText}>No gift ideas yet</Text>
                    ) : (
                      personGifts.map(gift => (
                        <TouchableOpacity
                          key={gift.id}
                          style={dynamicStyles.personProfileGiftItem}
                          onPress={() => {
                            setShowPersonProfile(false);
                            openEditForm(gift, 'gift');
                          }}
                        >
                          <Gift size={18} color={themeColors.accentPrimary} />
                          <View style={dynamicStyles.personProfileGiftInfo}>
                            <Text style={dynamicStyles.personProfileGiftName}>{gift.idea}</Text>
                            {gift.notes && (
                              <Text style={dynamicStyles.personProfileGiftNotes} numberOfLines={1}>{gift.notes}</Text>
                            )}
                          </View>
                          {gift.budget && (
                            <Text style={dynamicStyles.personProfileGiftPrice}>${gift.budget}</Text>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </View>

                  {/* Save Button */}
                  <TouchableOpacity
                    style={dynamicStyles.personProfileSaveBtn}
                    onPress={savePersonProfile}
                  >
                    <Text style={dynamicStyles.personProfileSaveBtnText}>Save Profile</Text>
                  </TouchableOpacity>

                  {/* Add Gift Button */}
                  <TouchableOpacity
                    style={dynamicStyles.personProfileAddGiftBtn}
                    onPress={() => {
                      setShowPersonProfile(false);
                      setSelectedPerson(profilePerson.name);
                      setNewItem({
                        title: '',
                        notes: '',
                        address: '',
                        cuisine: '',
                        priceRange: '',
                        dueDate: '',
                        date: '',
                        time: '',
                        activityCategory: '',
                        person: profilePerson.name,
                        occasion: '',
                        budget: '',
                        link: '',
                        activityAddress: '',
                        priority: 'medium',
                        price: '',
                        reminderTime: '1 hour before',
                      });
                      setIsEditMode(false);
                      setEditingItem(null);
                      setAddItemType('gifts');
                      setShowAddForm(true);
                    }}
                  >
                    <Plus size={18} color={themeColors.accentPrimary} />
                    <Text style={dynamicStyles.personProfileAddGiftText}>Add Gift Idea</Text>
                  </TouchableOpacity>

                  <View style={{ height: 40 }} />
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfile(false)}
      >
        <ProfileScreen 
          onClose={() => setShowProfile(false)}
          householdId={householdId}
          onLeaveHousehold={async () => {
            try {
              const currentUser = auth.currentUser;
              if (currentUser) {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                  householdId: null,
                });
              }
              setHouseholdId(null);
              setItems([]);
              setActivities([]);
              setSkippedHousehold(true);
              setShowProfile(false);
            } catch (error) {
              console.error('Error leaving household:', error);
              Alert.alert('Error', 'Failed to leave household');
            }
          }}
          onJoinCreate={() => {
            setShowProfile(false);
            setShowHouseholdSetup(true);
          }}
          onOpenSettings={() => {
            setShowProfile(false);
            setShowSettings(true);
          }}
          theme={theme}
        />
      </Modal>

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <SettingsScreen 
          onClose={() => setShowSettings(false)}
          theme={theme}
          onThemeChange={(newTheme) => {
            setTheme(newTheme);
          }}
          onTabVisibilityChange={(newVisibility) => {
            setTabVisibility(newVisibility);
            // If current tab is hidden, switch to 'all'
            const currentTabKey = activeTab === 'todo' ? 'todo' : activeTab === 'calendar' ? 'calendar' : activeTab;
            if (!newVisibility[currentTabKey]) {
              setActiveTab(newVisibility.all ? 'all' : 'today');
            }
          }}
          isAdmin={isAdmin}
          householdId={householdId}
          permissionMode={permissionMode}
          onPermissionModeChange={async (newMode) => {
            const currentUser = auth.currentUser;
            if (!householdId || !isAdmin || !currentUser) return;
            try {
              await updateDoc(doc(db, 'households', householdId), {
                permissionMode: newMode,
              });
              setPermissionMode(newMode);
            } catch (error) {
              console.error('Error updating permission mode:', error);
              Alert.alert('Error', 'Failed to update permission mode');
            }
          }}
          faceIdEnabled={isFaceIdEnabled}
          onFaceIdToggle={async (enabled) => {
            setIsFaceIdEnabled(enabled);
            await AsyncStorage.setItem('faceIdEnabled', enabled ? 'true' : 'false');
            // If disabling Face ID, reset authentication state
            if (!enabled) {
              setIsFaceIdAuthenticated(true);
            } else {
              // If enabling Face ID, reset authentication state to trigger prompt
              setIsFaceIdAuthenticated(false);
            }
          }}
          showAppleCalendar={showAppleCalendar}
          onAppleCalendarToggle={async (enabled) => {
            setShowAppleCalendar(enabled);
            await AsyncStorage.setItem('showAppleCalendar', JSON.stringify(enabled));
          }}
          tabSettings={tabSettings}
          onUpdateTabSettings={updateTabSettings}
          tabOrder={tabOrder}
          onTabOrderChange={handleTabOrderChange}
        />
      </Modal>

      {/* Tag Manager Modal */}
      <Modal
        visible={showTagManager}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowTagManager(false);
          setEditingTag(null);
          setNewTagName('');
          setNewTagColor('#6366f1');
        }}
      >
        <View style={dynamicStyles.formModalOverlay}>
          <TouchableOpacity
            style={dynamicStyles.formModalBackdrop}
            activeOpacity={1}
            onPress={() => {
              setShowTagManager(false);
              setEditingTag(null);
              setNewTagName('');
              setNewTagColor('#6366f1');
            }}
          />
          <View style={[dynamicStyles.formModalContent, { height: 500 }]}>
            <View style={dynamicStyles.formModalHeader}>
              <Text style={dynamicStyles.modalTitle}>Manage Tags</Text>
              <TouchableOpacity onPress={() => {
                setShowTagManager(false);
                setEditingTag(null);
                setNewTagName('');
                setNewTagColor('#6366f1');
              }}>
                <X size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Add new tag section */}
              <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: themeColors.border }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text, marginBottom: 12 }}>
                  Create New Tag
                </Text>
                <TextInput
                  style={dynamicStyles.formInput}
                  placeholder="Tag name"
                  placeholderTextColor={themeColors.textMuted}
                  value={newTagName}
                  onChangeText={setNewTagName}
                />
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 8, marginTop: 8 }}>
                  Select Color
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {TAG_COLORS.map((color) => (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewTagColor(color)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: color,
                        borderWidth: newTagColor === color ? 3 : 0,
                        borderColor: themeColors.text,
                      }}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: newTagName.trim() ? themeColors.primary : themeColors.border,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    marginTop: 16,
                    alignItems: 'center',
                  }}
                  onPress={addIdeaTag}
                  disabled={!newTagName.trim()}
                >
                  <Text style={{ color: newTagName.trim() ? '#fff' : themeColors.textMuted, fontWeight: '600' }}>
                    Add Tag
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Existing tags list */}
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: themeColors.text, marginBottom: 12 }}>
                  Your Tags ({ideaTags.length})
                </Text>
                {ideaTags.length === 0 ? (
                  <Text style={{ color: themeColors.textMuted, textAlign: 'center', paddingVertical: 20 }}>
                    No tags yet. Create your first tag above!
                  </Text>
                ) : (
                  ideaTags.map((tag) => (
                    <View
                      key={tag.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: themeColors.border,
                      }}
                    >
                      {editingTag?.id === tag.id ? (
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={[dynamicStyles.formInput, { marginBottom: 8 }]}
                            value={editingTag.name}
                            onChangeText={(text) => setEditingTag({ ...editingTag, name: text })}
                            autoFocus
                          />
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {TAG_COLORS.map((color) => (
                              <TouchableOpacity
                                key={color}
                                onPress={() => setEditingTag({ ...editingTag, color })}
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  backgroundColor: color,
                                  borderWidth: editingTag.color === color ? 2 : 0,
                                  borderColor: themeColors.text,
                                }}
                              />
                            ))}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: themeColors.primary,
                                paddingVertical: 8,
                                borderRadius: 6,
                                alignItems: 'center',
                              }}
                              onPress={() => updateIdeaTag(tag.id, { name: editingTag.name, color: editingTag.color })}
                            >
                              <Text style={{ color: '#fff', fontWeight: '500' }}>Save</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                backgroundColor: themeColors.cardBackground,
                                paddingVertical: 8,
                                borderRadius: 6,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: themeColors.border,
                              }}
                              onPress={() => setEditingTag(null)}
                            >
                              <Text style={{ color: themeColors.text, fontWeight: '500' }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <>
                          <View
                            style={{
                              width: 12,
                              height: 12,
                              borderRadius: 6,
                              backgroundColor: tag.color,
                              marginRight: 12,
                            }}
                          />
                          <Text style={{ flex: 1, color: themeColors.text, fontSize: 16 }}>{tag.name}</Text>
                          <TouchableOpacity
                            onPress={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}
                            style={{ padding: 8 }}
                          >
                            <Pencil size={18} color={themeColors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => deleteIdeaTag(tag.id)}
                            style={{ padding: 8 }}
                          >
                            <Trash2 size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRestaurantDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRestaurantDetails(false)}
      >
        <View style={dynamicStyles.restaurantModalOverlay}>
          <TouchableOpacity
            style={[styles.modalBackdrop, { zIndex: 1 }]}
            activeOpacity={1}
            onPress={() => setShowRestaurantDetails(false)}
          />
          <View style={[dynamicStyles.restaurantModalContent, { zIndex: 2 }]}>
            <View style={[styles.modalHeader, { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }]}>
              <Text style={dynamicStyles.modalTitle}>Restaurant Details</Text>
              <TouchableOpacity onPress={() => setShowRestaurantDetails(false)}>
                <X size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingRestaurantDetails ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading details...</Text>
              </View>
            ) : restaurantDetails ? (
              <ScrollView
                style={styles.restaurantDetailsContent}
                contentContainerStyle={styles.restaurantDetailsScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
              >
                {restaurantDetails.photoUrl && (
                  <Image
                    source={{ uri: restaurantDetails.photoUrl }}
                    style={styles.restaurantPhoto}
                    resizeMode="cover"
                  />
                )}

                <View style={dynamicStyles.restaurantDetailsSection}>
                  <View style={styles.restaurantNameRow}>
                    <Text style={[styles.restaurantName, { color: themeColors.text }]}>{restaurantDetails.name}</Text>
                    {restaurantDetails.restaurantId && (
                      <View style={styles.restaurantActionButtons}>
                        <TouchableOpacity 
                          onPress={() => {
                            if (restaurantDetails.restaurantId) {
                              toggleFavorite(restaurantDetails.restaurantId);
                              setRestaurantDetails({
                                ...restaurantDetails,
                                favorited: !restaurantDetails.favorited
                              });
                            }
                          }}
                          style={styles.restaurantActionButton}
                        >
                          <View style={styles.starButtonContainer}>
                            <Star 
                              size={34} 
                              color={restaurantDetails.favorited ? '#F59E0B' : '#9CA3AF'} 
                              fill={restaurantDetails.favorited ? '#F59E0B' : 'transparent'}
                            />
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            if (restaurantDetails.restaurantId) {
                              toggleVisited(restaurantDetails.restaurantId);
                              setRestaurantDetails({
                                ...restaurantDetails,
                                visited: !restaurantDetails.visited
                              });
                            }
                          }}
                          style={styles.restaurantActionButton}
                        >
                          <View style={[styles.visitedCheckboxLarge, restaurantDetails.visited && styles.visitedCheckboxLargeActive]}>
                            {restaurantDetails.visited && <Check size={20} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          onPress={() => {
                            if (restaurantDetails.restaurantId) {
                              toggleHappyHour(restaurantDetails.restaurantId);
                              setRestaurantDetails({
                                ...restaurantDetails,
                                happyHour: !restaurantDetails.happyHour
                              });
                            }
                          }}
                          style={styles.restaurantActionButton}
                        >
                          <View style={[styles.happyHourButton, restaurantDetails.happyHour && styles.happyHourButtonActive]}>
                            <Text style={[styles.happyHourButtonText, restaurantDetails.happyHour && styles.happyHourButtonTextActive]}>
                              HH
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {(restaurantDetails.visited || restaurantDetails.favorited || restaurantDetails.happyHour) && (
                    <View style={styles.restaurantBadgesRow}>
                      {restaurantDetails.favorited && (
                        <View style={styles.favoriteBadgeLarge}>
                          <Star size={14} color="#F59E0B" fill="#F59E0B" />
                          <Text style={styles.favoriteBadgeLargeText}>Favorite</Text>
                        </View>
                      )}
                      {restaurantDetails.visited && (
                        <View style={styles.visitedBadgeLarge}>
                          <Text style={styles.visitedBadgeLargeText}>✓ Visited</Text>
                        </View>
                      )}
                      {restaurantDetails.happyHour && (
                        <View style={styles.happyHourBadgeLarge}>
                          <Text style={styles.happyHourBadgeLargeText}>Happy Hour</Text>
                        </View>
                      )}
                    </View>
                  )}
                  
                  {(restaurantDetails.rating || restaurantDetails.reviewCount) && (
                    <View style={styles.ratingContainer}>
                      {restaurantDetails.rating && (
                        <View style={styles.ratingRow}>
                          <Text style={[styles.ratingText, { color: themeColors.text }]}>
                            ⭐ {restaurantDetails.rating.toFixed(1)}
                          </Text>
                          {restaurantDetails.reviewCount > 0 && (
                            <Text style={[styles.reviewCountText, { color: themeColors.textSecondary }]}>
                              ({restaurantDetails.reviewCount.toLocaleString()} reviews)
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                  
                  {(restaurantDetails.priceRange || restaurantDetails.cuisine) && (
                    <View style={styles.infoRow}>
                      {restaurantDetails.priceRange && (
                        <Text style={[styles.infoTag, { color: themeColors.text, backgroundColor: themeColors.card }]}>
                          {restaurantDetails.priceRange}
                        </Text>
                      )}
                      {restaurantDetails.cuisine && (
                        <Text style={[styles.infoTag, { color: themeColors.text, backgroundColor: themeColors.card }]}>
                          {restaurantDetails.cuisine}
                        </Text>
                      )}
                    </View>
                  )}
                  
                  {restaurantDetails.summary && (
                    <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>
                      {restaurantDetails.summary}
                    </Text>
                  )}
                </View>

                {restaurantDetails.address && (
                  <View style={styles.restaurantDetailsSection}>
                    <View style={styles.sectionHeader}>
                      <MapPin size={18} color={themeColors.textSecondary} />
                      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Address</Text>
                    </View>
                    <Text style={[styles.sectionContent, { color: themeColors.textSecondary }]}>
                      {restaurantDetails.address}
                    </Text>
                    {restaurantDetails.latitude && restaurantDetails.longitude && (
                      <TouchableOpacity
                        style={styles.mapButton}
                        onPress={() => {
                          const query = encodeURIComponent(restaurantDetails.address);
                          const url = Platform.select({
                            ios: `maps://?q=${query}`,
                            android: `geo:0,0?q=${query}`
                          });
                          Linking.openURL(url);
                        }}
                      >
                        <Text style={styles.mapButtonText}>Open in Maps</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {restaurantDetails.phone && (
                  <View style={styles.restaurantDetailsSection}>
                    <View style={styles.sectionHeader}>
                      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Phone</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(`tel:${restaurantDetails.phone.replace(/[^0-9+]/g, '')}`)}
                    >
                      <Text style={[styles.sectionContent, { color: '#3B82F6' }]}>
                        {restaurantDetails.phone}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {restaurantDetails.hours && restaurantDetails.hours.length > 0 && (
                  <View style={styles.restaurantDetailsSection}>
                    <View style={styles.sectionHeader}>
                      <Clock size={18} color={themeColors.textSecondary} />
                      <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Hours</Text>
                    </View>
                    {restaurantDetails.hours.map((hour, index) => (
                      <Text key={index} style={[styles.hourText, { color: themeColors.textSecondary }]}>
                        {hour}
                      </Text>
                    ))}
                  </View>
                )}

                {restaurantDetails.website && (
                  <View style={styles.restaurantDetailsSection}>
                    <TouchableOpacity
                      onPress={() => Linking.openURL(restaurantDetails.website)}
                      style={styles.websiteButton}
                    >
                      <Text style={styles.websiteButtonText}>Visit Website</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <FireworkEffect
        active={showFirework}
        onComplete={() => setShowFirework(false)}
      />

      <View style={dynamicStyles.bottomTabBar}>
        {orderedTabs.map((tab) => renderTabButton(tab))}
      </View>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fdfaf5',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  searchInput: {
    flex: 1,
    color: '#1f2933',
    fontSize: 16,
  },
  tabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 88,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#d4c5b0',
    paddingTop: 10,
    paddingBottom: 0,
  },
  tabsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
  },
  tab: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 50,
  },
  activeTab: {
    backgroundColor: 'rgba(180, 83, 9, 0.1)',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  subTabs: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  activeSubTab: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  subTabText: {
    color: '#6b7280',
    fontSize: 14,
  },
  activeSubTabText: {
    color: '#fff',
  },
  viewModeToggle: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  activeViewModeButton: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  viewModeText: {
    color: '#6b7280',
    fontSize: 14,
  },
  activeViewModeText: {
    color: '#fff',
  },
  container: {
    flex: 1,
  },
  fullScreenContent: {
    flex: 1,
    padding: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#6b7280',
    fontSize: 18,
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  deleteButton: {
    padding: 4,
  },
  itemContent: {
    marginBottom: 8,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#d4c5b0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    color: '#1f2933',
    fontSize: 16,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  locationText: {
    color: '#6b7280',
    fontSize: 14,
  },
  itemDetail: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  itemNotes: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  itemDueDate: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  activityCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityTime: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  activityTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 16,
    marginBottom: 4,
  },
  activityDate: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  activityNotes: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  peopleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  personCard: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  personName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 18,
    marginTop: 8,
  },
  birthdayBadge: {
    color: '#EC4899',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  giftCount: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
  },
  giftPersonHeader: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '500',
  },
  giftPersonTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: '#1f2933',
  },
  giftsList: {
    flex: 1,
  },
  giftItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  giftItemHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  giftItemContent: {
    flex: 1,
  },
  giftIdea: {
    fontFamily: 'PlayfairDisplay_500Medium',
    color: '#1f2933',
    fontSize: 16,
    marginBottom: 4,
  },
  giftOccasion: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 2,
  },
  giftBudget: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 2,
  },
  giftPrice: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  giftLink: {
    color: '#60A5FA',
    fontSize: 14,
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  giftNotes: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    color: '#1f2933',
  },
  calendarHeaderSecondary: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  calendarViewToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  calendarToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  calendarToggleButtonActive: {
    backgroundColor: '#2563EB',
  },
  calendarToggleButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarToggleButtonTextActive: {
    color: '#fff',
  },
  calendarWeekDays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekDay: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  calendarWeekDayText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  calendarDay: {
    width: '14.28%',
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 4,
  },
  calendarDayToday: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
  },
  calendarDayEmpty: {
    width: '14.28%',
    minHeight: 90,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  calendarDayText: {
    color: '#1f2933',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  calendarDayTextToday: {
    color: '#60A5FA',
  },
  calendarActivity: {
    backgroundColor: '#2563EB',
    borderRadius: 2,
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: 2,
  },
  calendarActivityText: {
    color: '#fff',
    fontSize: 8,
  },
  calendarMoreText: {
    color: '#6b7280',
    fontSize: 8,
    marginTop: 2,
  },
  dayDetailsContainer: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  dayDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayDetailsTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: '#1f2933',
  },
  dayDetailsContent: {
    gap: 8,
  },
  // Compact calendar styles
  calendarNavButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarTodayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffffff',
  },
  calendarTodayText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
  // New calendar UI styles
  calSubHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  calSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
    letterSpacing: 1,
    marginBottom: 4,
  },
  calMainTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 28,
    color: '#1f2933',
  },
  calMainTitleAccent: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
  },
  calMonthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  calNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  calMonthLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: '#1f2933',
  },
  calGridContainer: {
    backgroundColor: '#ffffff',
    marginHorizontal: 24,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  calGridRow: {
    flexDirection: 'row',
  },
  calGridCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 48,
  },
  calGridDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  calGridDayWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calGridDayToday: {
    backgroundColor: '#b45309',
  },
  calGridDayTodayOutline: {
    borderWidth: 2,
    borderColor: '#b45309',
    backgroundColor: 'transparent',
  },
  calGridDaySelected: {
    backgroundColor: '#b45309',
  },
  calGridDayNumber: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2933',
  },
  calGridDayNumberMuted: {
    color: '#d1d5db',
  },
  calGridDayNumberToday: {
    color: '#b45309',
    fontWeight: '700',
  },
  calGridDayNumberSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  calGridDotRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
  },
  calGridDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  calUpcomingTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: '#1f2933',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 12,
  },
  calEventsScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  calEventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  calEventDateBox: {
    width: 48,
    alignItems: 'center',
    marginRight: 16,
  },
  calEventDateNum: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: '#b45309',
  },
  calEventDateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  calEventInfo: {
    flex: 1,
  },
  calEventTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#1f2933',
    marginBottom: 4,
  },
  calEventMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  calEventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 12,
  },
  calendarGridCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  calendarDailyContainer: {
    flex: 1,
    backgroundColor: '#fdfaf5',
    borderRadius: 16,
    padding: 16,
  },
  calendarAllDaySection: {
    marginBottom: 16,
    gap: 8,
  },
  calendarAllDayTitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarAllDayChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  calendarAllDayChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  calendarAllDayChipText: {
    color: '#1f2933',
    fontSize: 13,
    fontWeight: '500',
  },
  calendarTimeline: {
    flexDirection: 'row',
  },
  calendarTimelineHours: {
    width: 64,
    paddingRight: 8,
  },
  calendarTimelineHourRow: {
    height: CALENDAR_HOUR_HEIGHT,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  calendarTimelineHourLabel: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarTimelineHourDivider: {
    height: 1,
    backgroundColor: '#ffffff',
    marginTop: 6,
    width: '100%',
  },
  calendarTimelineScroll: {
    flex: 1,
  },
  calendarTimelineScrollContent: {
    flexDirection: 'row',
  },
  calendarTimelineEvents: {
    position: 'relative',
    flex: 1,
  },
  calendarTimelineEventBlock: {
    position: 'absolute',
    right: 12,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  calendarTimelineEventTime: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarTimelineEventTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 15,
  },
  calendarTimelineEventNotes: {
    color: '#6b7280',
    fontSize: 12,
  },
  calendarWeekScroll: {
    marginTop: 8,
  },
  calendarWeekContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
    gap: 12,
  },
  calendarWeekColumn: {
    width: CALENDAR_WEEK_COLUMN_WIDTH,
    backgroundColor: '#fdfaf5',
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  calendarWeekColumnSelected: {
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  calendarWeekColumnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarWeekDayName: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  calendarWeekDayNameSelected: {
    color: '#1f2933',
  },
  calendarWeekDayNumberWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  calendarWeekDayNumberToday: {
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  calendarWeekDayNumberSelectedWrapper: {
    backgroundColor: '#2563EB',
  },
  calendarWeekDayNumber: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  calendarWeekDayNumberSelectedText: {
    color: '#FFFFFF',
  },
  calendarWeekAllDaySection: {
    gap: 8,
  },
  calendarWeekAllDayChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  calendarWeekAllDayChipText: {
    color: '#1f2933',
    fontSize: 12,
    fontWeight: '500',
  },
  calendarWeekEventList: {
    gap: 8,
  },
  calendarWeekEventCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  calendarWeekEventTime: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarWeekEventTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 14,
  },
  calendarWeekEmptyText: {
    color: '#6B7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  calendarDayCompact: {
    width: '13.28%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    margin: '0.5%',
    paddingVertical: 4,
  },
  calendarDayCompactToday: {
    backgroundColor: '#2563EB',
  },
  calendarDayCompactSelected: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  calendarDayCompactEmpty: {
    width: '13.28%',
    minHeight: 44,
    margin: '0.5%',
  },
  calendarDayCompactText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayCompactTextToday: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarDayCompactTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarDayDots: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 2,
  },
  calendarDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calendarEventsSection: {
    flex: 1,
    backgroundColor: '#fdfaf5',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
  },
  calendarEventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  calendarEventsTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    color: '#1f2933',
  },
  calendarEventsList: {
    paddingHorizontal: 16,
  },
  calendarEventCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  calendarEventCardFirst: {
    borderWidth: 1,
    borderColor: '#60A5FA',
  },
  calendarEventBar: {
    width: 4,
  },
  calendarEventContent: {
    flex: 1,
    padding: 12,
  },
  calendarEventTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#60A5FA',
    marginBottom: 4,
  },
  calendarEventTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#1f2933',
    marginBottom: 4,
  },
  calendarEventNotes: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  calendarEmptyDay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  calendarEmptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  embeddedMapContainer: {
    flex: 1,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  embeddedMap: {
    width: '100%',
    height: '100%',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#b45309',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(31, 41, 51, 0.6)',
  },
  modalContent: {
    backgroundColor: '#fdfaf5',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: SCREEN_HEIGHT * 0.8,
    borderWidth: 1,
    borderColor: '#d4c5b0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 22,
    color: '#1f2933',
  },
  modalForm: {
    gap: 12,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    color: '#1f2933',
    fontSize: 16,
    borderWidth: 1.5,
    borderColor: '#d4c5b0',
    marginBottom: 12,
  },
  inputWithClear: {
    position: 'relative',
    marginBottom: 12,
  },
  inputWithButton: {
    marginBottom: 0,
    paddingRight: 40,
  },
  clearButton: {
    position: 'absolute',
    right: 10,
    top: 12,
    padding: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonCancel: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#d4c5b0',
  },
  buttonCancelText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#78716c',
    fontSize: 16,
  },
  buttonAdd: {
    backgroundColor: '#b45309',
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalSubtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    marginTop: 8,
  },
  recipeLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  recipeLoadingText: {
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '500',
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  recipeThumbnail: {
    width: 110,
    height: 110,
  },
  recipeThumbnailPlaceholder: {
    width: 110,
    height: 110,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeCardContent: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  recipeTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 16,
  },
  recipeSource: {
    color: '#6b7280',
    fontSize: 13,
  },
  recipeMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  recipeActionRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  recipeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recipeActionText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '600',
  },
  recipeDetailModal: {
    maxHeight: SCREEN_HEIGHT * 0.85,
  },
  recipeDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  recipeDetailTitle: {
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
    marginRight: 16,
  },
  recipeDetailImage: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginBottom: 16,
  },
  recipeSourceDetail: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 12,
  },
  recipeActionButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  recipePrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
  },
  recipePrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  manualSectionHeader: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  manualFieldLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 6,
  },
  recipeSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f8f5f0',
    paddingVertical: 12,
    borderRadius: 10,
  },
  recipeSecondaryButtonText: {
    color: '#1f2933',
    fontSize: 15,
    fontWeight: '600',
  },
  quickActionWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 24,
  },
  quickActionBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  quickActionContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 72,
    minWidth: 180,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#B91C1C',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  textAreaLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  recipeDetailHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipeDetailActionButton: {
    padding: 4,
  },
  recipeDetailActionSheet: {
    backgroundColor: '#fdfaf5',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  recipeDetailActionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  recipeDetailActionSheetItemSecondary: {
    justifyContent: 'center',
  },
  recipeDetailActionSheetText: {
    color: '#1f2933',
    fontWeight: '600',
    fontSize: 15,
  },
  recipeDetailActionSheetSecondaryText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },

  // Activity Detail Modal Styles
  activityDetailModal: {
    minHeight: 580,
    maxHeight: '85%',
    padding: 0,
    overflow: 'hidden',
  },
  activityDetailAccent: {
    height: 4,
    backgroundColor: '#b45309',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  activityDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  activityDetailHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityDetailIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetailHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityDetailActionBtn: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: '#f8f5f0',
  },
  activityDetailActionSheet: {
    marginHorizontal: 24,
    backgroundColor: '#f8f5f0',
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  activityDetailActionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  activityDetailActionSheetItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#e7e0d8',
  },
  activityDetailActionSheetItemClose: {
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e7e0d8',
  },
  activityDetailActionSheetText: {
    color: '#1f2933',
    fontWeight: '600',
    fontSize: 15,
  },
  activityDetailActionSheetCloseText: {
    color: '#78716c',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  activityDetailContent: {
    flex: 1,
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  activityDetailTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 26,
    color: '#1f2933',
    marginBottom: 12,
    lineHeight: 32,
  },
  activityDetailBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  activityDetailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activityDetailBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityDetailInfoCard: {
    backgroundColor: '#fefdfb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0ebe4',
  },
  activityDetailInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  activityDetailInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  activityDetailInfoContent: {
    flex: 1,
  },
  activityDetailInfoLabel: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activityDetailInfoValue: {
    fontSize: 16,
    color: '#1f2933',
    fontWeight: '600',
  },
  activityDetailLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f5f0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  activityDetailLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#b45309',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetailLocationContent: {
    flex: 1,
  },
  activityDetailLocationLabel: {
    fontSize: 11,
    color: '#78716c',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  activityDetailLocationValue: {
    fontSize: 15,
    color: '#1f2933',
    fontWeight: '500',
    lineHeight: 20,
  },
  activityDetailNotesCard: {
    backgroundColor: '#f8f5f0',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  activityDetailNotesLabel: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 14,
    color: '#78716c',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityDetailNotesText: {
    fontSize: 15,
    color: '#1f2933',
    lineHeight: 22,
  },
  activityDetailFooter: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0ebe4',
    backgroundColor: '#fff',
  },
  activityDetailEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b45309',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  activityDetailEditButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  recipeDescription: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  recipeSectionTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 8,
  },
  recipeList: {
    gap: 10,
  },
  recipeListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recipeBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#60A5FA',
    marginTop: 9,
  },
  recipeListText: {
    flex: 1,
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  recipeListItemNumbered: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  recipeStepNumber: {
    color: '#60A5FA',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
  recipeEmptyText: {
    color: '#6B7280',
    fontSize: 14,
  },
  recipeNotesText: {
    color: '#6b7280',
    fontSize: 14,
    lineHeight: 20,
  },
  buttonText: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#ffffff',
    fontSize: 16,
  },
  calloutContainer: {
    padding: 10,
    minWidth: 200,
  },
  calloutTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  calloutNotes: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  calloutLink: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '500',
    marginTop: 4,
  },
  inputText: {
    color: '#1f2933',
    fontSize: 16,
  },
  inputPlaceholder: {
    color: '#9ca3af',
    fontSize: 16,
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pickerModalContent: {
    position: 'absolute', // ADD - force positioning
    bottom: 0, // ADD - stick to bottom
    left: 0, // ADD - full width
    right: 0, // ADD - full width
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
    minHeight: 300,
    padding: 16,
    zIndex: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    color: '#1f2933',
    fontSize: 18,
    flex: 1,
  },
  pickerCancelButton: {
    color: '#6b7280',
    fontSize: 18,
    fontWeight: '600',
  },
  pickerDoneButton: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '600',
  },
  reminderWheelContainer: {
    height: 200,
    overflow: 'hidden',
    marginVertical: 20,
    position: 'relative',
  },
  reminderWheelSelectionOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 60,
    pointerEvents: 'none',
    zIndex: 1,
    justifyContent: 'center',
  },
  reminderWheelSelectionLine: {
    height: 1,
    backgroundColor: '#f8f5f0',
    marginHorizontal: 20,
  },
  reminderWheel: {
    flex: 1,
    zIndex: 0,
  },
  reminderWheelContent: {
    paddingVertical: 70,
  },
  reminderWheelItem: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reminderWheelText: {
    color: '#6b7280',
    fontSize: 18,
    textAlign: 'center',
  },
  reminderWheelTextSelected: {
    color: '#1f2933',
    fontSize: 20,
    fontWeight: '600',
  },
  suggestionsContainer: {
    backgroundColor: '#f8f5f0',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 12,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: '#d4c5b0',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4c5b0',
    gap: 10,
  },
  suggestionText: {
    flex: 1,
    color: '#1f2933',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdfaf5',
  },
  loadingText: {
    color: '#1f2933',
    fontSize: 18,
  },
  profileButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  priorityLabel: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  priorityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  priorityButton: {
    minWidth: '22%',
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  priorityButtonActive: {
    borderColor: '#1f2933',
  },
  priorityButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  itemPrice: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  groceryTotal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingRight: 90,
    borderTopWidth: 2,
    borderTopColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'flex-start', // CHANGE from 'space-between' to 'flex-start'
    alignItems: 'center',
    gap: 8, // ADD THIS - small space between "Total:" and the amount
  },
  groceryTotalLabel: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#1f2933',
  },
  groceryTotalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2933',
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 16,
  },
  filterButton: {
    backgroundColor: '#f8f5f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  filterButtonText: {
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '600',
  },
  mapLegend: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    color: '#1f2933',
    fontSize: 12,
  },
  todoTypeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  todoTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#f8f5f0',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  todoTypeButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#60A5FA',
  },
  todoTypeButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  todoTypeButtonTextActive: {
    color: '#fff',
  },
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  pickerContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  picker: {
    height: 200,
    backgroundColor: '#ffffff',
  },
  pickerItem: {
    color: '#1f2933',
    fontSize: 20,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  categoryHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryHeaderText: {
    color: '#1f2933',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  categoryCount: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryItems: {
    paddingLeft: 8,
  },
  loadingContainer: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  restaurantModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
    paddingTop: '15%',
  },
  restaurantModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '90%',
    height: '90%',
    overflow: 'hidden',
    zIndex: 10,
    flexDirection: 'column',
  },
  restaurantDetailsContent: {
    flex: 1,
    width: '100%',
  },
  restaurantDetailsScrollContent: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 24,
  },
  restaurantPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 20,
  },
  restaurantDetailsSection: {
    marginBottom: 24,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  ratingContainer: {
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  reviewCountText: {
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  infoTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 22,
    marginLeft: 26,
  },
  hourText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 26,
    marginBottom: 4,
  },
  mapButton: {
    marginTop: 12,
    marginLeft: 26,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  websiteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#2563EB',
    borderRadius: 8,
    alignItems: 'center',
  },
  websiteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  visitedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  visitedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  happyHourBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  happyHourBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  visitedCheckbox: {
    backgroundColor: '#10B981',
  },
  visitedText: {
    opacity: 0.7,
  },
  restaurantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 32,
  },
  restaurantActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  restaurantActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  starButtonContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  favoriteBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  favoriteBadgeLargeText: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
  },
  visitedCheckboxLarge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitedCheckboxLargeActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  visitedButtonLargeActive: {
    backgroundColor: '#10B981',
  },
  visitedButtonTextActive: {
    color: '#fff',
  },
  visitedBadgeLarge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  visitedBadgeLargeHidden: {
    opacity: 0,
    backgroundColor: 'transparent',
  },
  visitedBadgeLargeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  happyHourButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  happyHourButtonActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  happyHourButtonText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '700',
  },
  happyHourButtonTextActive: {
    color: '#fff',
  },
  happyHourBadgeLarge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  happyHourBadgeLargeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeActionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
    marginVertical: 8,
  },
  swipeDeleteButton: {
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
    flex: 1,
    maxHeight: '90%',
    borderRadius: 8,
    gap: 4,
  },
  swipeDeleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressCircleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  progressCircleFill: {
    position: 'absolute',
    top: 3,
    left: 3,
  },
  progressCircleText: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  progressCircleTextValue: {
    fontSize: 9,
    fontWeight: '600',
  },
  subtasksContainer: {
    marginTop: 8,
    marginLeft: 16,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#e5e7eb',
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 8,
  },
  subtaskConnector: {
    width: 12,
    height: 2,
    backgroundColor: '#f8f5f0',
    marginRight: 8,
  },
  subtaskContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  subtaskCheckbox: {
    width: 18,
    height: 18,
  },
  subtaskTitleContainer: {
    flex: 1,
  },
  subtaskTitle: {
    fontSize: 14,
    color: '#1f2933',
  },
  subtaskEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    backgroundColor: '#f8f5f0',
    borderRadius: 6,
    padding: 8,
  },
  subtaskInput: {
    flex: 1,
    color: '#1f2933',
    fontSize: 14,
  },
  addSubtaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    marginLeft: 8,
  },
  addSubtaskText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  birthdayPickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  birthdayPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  birthdayPickerModalContent: {
    backgroundColor: '#1f2933',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  birthdayPickerWheelContainer: {
    flexDirection: 'row',
    height: 200,
    overflow: 'hidden',
    marginVertical: 20,
    position: 'relative',
  },
  birthdayPickerWheel: {
    flex: 1,
    position: 'relative',
  },
  birthdayPickerSelectionOverlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 60,
    pointerEvents: 'none',
    zIndex: 1,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
  },
  birthdayPickerWheelContent: {
    paddingVertical: 70,
  },
  birthdayPickerWheelItem: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  birthdayPickerWheelText: {
    color: '#6b7280',
    fontSize: 18,
    textAlign: 'center',
  },
  birthdayPickerWheelTextSelected: {
    color: '#1f2933',
    fontSize: 20,
    fontWeight: '600',
  },
  todayWeatherCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    margin: 16,
    marginBottom: 12,
  },
  todayWeatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  todayWeatherContent: {
    gap: 16,
  },
  todayWeeklyContainer: {
    gap: 16,
  },
  todayWeeklyCurrent: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16,
  },
  todayWeeklyCarousel: {
    gap: 8,
    paddingVertical: 4,
  },
  todayWeeklyCard: {
    width: 110,
    backgroundColor: '#fdfaf5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    gap: 10,
  },
  todayWeeklyDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  todayWeeklyIconRow: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayWeeklyDescription: {
    fontSize: 12,
    color: '#6b7280',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  todayWeeklyTemps: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2933',
  },
  todayWeatherMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  todayWeatherTemp: {
    flex: 1,
  },
  todayWeatherTempValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1f2933',
  },
  todayWeatherDescription: {
    fontSize: 16,
    color: '#6b7280',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  todayWeatherDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  todayWeatherDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayWeatherDetailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  todayWeatherEmpty: {
    alignItems: 'center',
    padding: 20,
  },
  todayWeatherEmptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  todayWeatherEmptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  todaySection: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  todaySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todaySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2933',
  },
  todayItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  todayItemCardFirst: {
    marginTop: 0,
  },
  todayItemBar: {
    width: 4,
  },
  todayItemContent: {
    flex: 1,
    padding: 16,
  },
  todayItemTime: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  todayItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2933',
    marginBottom: 4,
  },
  todayItemNotes: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  todayTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayTaskCheckbox: {
    marginRight: 0,
  },
  todayTaskPriority: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  todayEmptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  todayEmptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  // New Editorial Design Styles
  todaySubHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: '#fdfaf5',
  },
  todayDate: {
    fontSize: 13,
    fontWeight: '500',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  todayGreeting: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 28,
    color: '#1f2933',
    letterSpacing: -0.5,
  },
  todayGreetingName: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
  },
  weatherCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weatherLocation: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 13,
    color: '#6b7280',
  },
  weatherTemp: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 60,
    color: '#1f2933',
    letterSpacing: -2,
    lineHeight: 60,
  },
  weatherTempUnit: {
    fontSize: 32,
    color: '#6b7280',
  },
  weatherCondition: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 16,
    color: '#1f2933',
    textTransform: 'capitalize',
  },
  weatherIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  weatherConditionItalic: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
    fontSize: 16,
    color: '#1f2933',
    textAlign: 'right',
  },
  weatherHighLow: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  weatherToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  weatherToggleLabel: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 13,
    color: '#6b7280',
  },
  weatherToggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e5e7eb',
    padding: 3,
    justifyContent: 'center',
  },
  weatherToggleSwitchActive: {
    backgroundColor: '#10b981',
  },
  weatherToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  weatherToggleKnobActive: {
    alignSelf: 'flex-end',
  },
  forecastDayCard: {
    backgroundColor: '#f8f5f0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: 70,
  },
  forecastDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forecastDayTemp: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 18,
    color: '#1f2933',
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 22,
    color: '#1f2933',
    letterSpacing: -0.3,
  },
  sectionAction: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 13,
    color: '#b45309',
  },
  activityCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  activityTimeBadge: {
    minWidth: 56,
    alignItems: 'center',
  },
  activityTime: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: '#1f2933',
  },
  activityPeriod: {
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2933',
    marginBottom: 3,
  },
  activityLocation: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#6b7280',
  },
  restaurantBoxGrid: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  restaurantBoxRow: {
    justifyContent: 'space-between',
  },
  restaurantBoxWrapper: {
    flex: 1,
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  restaurantBox: {
    borderRadius: 12,
    padding: 16,
    paddingBottom: 36,
    height: 140,
    justifyContent: 'space-between',
    position: 'relative',
  },
  restaurantBoxName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  restaurantBoxDetail: {
    fontSize: 14,
    marginBottom: 6,
  },
  restaurantBoxPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  restaurantBoxFooter: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restaurantBoxVisitedBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  restaurantBoxVisitedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  restaurantBoxHappyHourBadge: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  restaurantBoxHappyHourText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  restaurantBoxFavorite: {
    padding: 4,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#fdfaf5',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#b45309',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2933',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#b45309',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 20,
    paddingTop: 8,
  },
  bottomTab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bottomTabActive: {
    backgroundColor: 'rgba(180, 83, 9, 0.1)',
    borderRadius: 12,
  },
  bottomTabIcon: {
    marginBottom: 4,
  },
  bottomTabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
  },
  bottomTabLabelActive: {
    color: '#b45309',
    fontWeight: '600',
  },

  // Generic page styles
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pageIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#b45309',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    color: '#1f2933',
    marginLeft: 10,
  },
  pageSubHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  pageSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  pageMainTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 28,
    color: '#1f2933',
  },
  pageMainTitleAccent: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
  },

  // Ideas screen
  ideasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#fdfaf5',
  },
  ideasHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ideasIconCircle: {
    width: 38,
    height: 38,
    backgroundColor: '#b45309',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideasHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2933',
    letterSpacing: -0.5,
  },
  ideasSubheader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: '#fdfaf5',
  },
  ideasSubheaderLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  ideasSubheaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ideasSubheaderTitleRegular: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 24,
    color: '#1f2933',
  },
  ideasSubheaderTitleItalic: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    fontSize: 24,
    color: '#b45309',
  },
  ideaFilterScroll: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: '#fdfaf5',
    paddingBottom: 16,
    maxHeight: 60,
  },
  ideaFilterScrollContent: {
    paddingHorizontal: 24,
    gap: 8,
    alignItems: 'center',
  },
  ideaFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    height: 36,
    justifyContent: 'center',
  },
  ideaFilterChipActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  ideaFilterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  ideaFilterChipTextActive: {
    color: '#ffffff',
  },
  ideaCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 24,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  ideaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ideaTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 16,
    color: '#1f2933',
    flex: 1,
    marginRight: 12,
  },
  ideaCategoryBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ideaCategoryBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  ideaDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  ideaCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ideaCardDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ideaCardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  ideaCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // Gifts screen
  giftPersonCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  giftPersonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f8f5f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  giftPersonName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#1f2933',
    marginBottom: 4,
  },
  giftPersonDate: {
    fontSize: 13,
    color: '#b45309',
    marginBottom: 4,
  },
  giftPersonCount: {
    fontSize: 13,
    color: '#6b7280',
  },

  // New Gifts UI styles
  giftSubHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  giftSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#b45309',
    letterSpacing: 1,
    marginBottom: 4,
  },
  giftMainTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 28,
    color: '#1f2933',
  },
  giftMainTitleAccent: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
  },
  giftFilterPills: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 20,
  },
  giftFilterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  giftFilterPillText: {
    fontSize: 14,
    color: '#1f2933',
  },
  giftToggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  giftToggleButtonActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  giftToggleButtonText: {
    fontSize: 14,
    color: '#1f2933',
  },
  giftToggleButtonTextActive: {
    color: '#ffffff',
  },
  wishlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  wishlistItemPurchased: {
    opacity: 0.6,
  },
  wishlistItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  wishlistItemTitle: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 16,
    color: '#1f2933',
  },
  wishlistItemNotes: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  wishlistItemPrice: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 15,
    color: '#b45309',
    marginLeft: 12,
  },
  giftPeopleScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  newPersonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  newPersonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newPersonAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  newPersonAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  newPersonInfo: {
    flex: 1,
  },
  newPersonName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 18,
    color: '#1f2933',
  },
  newPersonOccasion: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  newPersonDateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  birthdayBadge: {
    backgroundColor: '#fed7aa',
  },
  christmasBadge: {
    backgroundColor: '#e5e7eb',
  },
  newPersonDateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  birthdayText: {
    color: '#c2410c',
  },
  christmasText: {
    color: '#6b7280',
  },
  newGiftIdeasLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9ca3af',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
  },
  newGiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  newGiftItemText: {
    flex: 1,
    fontSize: 15,
    color: '#1f2933',
    marginLeft: 12,
  },
  newGiftItemPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#22c55e',
  },

  // Groceries screen
  groceryCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  groceryCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d4c5b0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  groceryCheckboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  groceryInfo: {
    flex: 1,
  },
  groceryName: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: '#1f2933',
  },
  groceryNameChecked: {
    textDecorationLine: 'line-through',
    color: '#9ca3af',
  },
  groceryCardCompleted: {
    backgroundColor: '#f9fafb',
    opacity: 0.7,
  },
  groceryItemPrice: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 14,
    color: '#b45309',
    marginLeft: 'auto',
  },
  groceryStatsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 8,
  },
  groceryStatsText: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
  },
  groceryStatsPrice: {
    fontFamily: 'SourceSans3_600SemiBold',
    color: '#b45309',
  },
  shopModeSelector: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: '#fdfaf5',
  },
  shopModeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  shopModeButtonActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  shopModeButtonText: {
    fontSize: 14,
    color: '#1f2933',
  },
  shopModeButtonTextActive: {
    color: '#ffffff',
  },
  frequentItemsContainer: {
    marginBottom: 16,
    paddingHorizontal: 24,
  },
  frequentItemsLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 11,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  frequentItemsScroll: {
    paddingRight: 24,
    gap: 8,
  },
  frequentItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  frequentItemChipText: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 14,
    color: '#1f2933',
    maxWidth: 100,
  },
  groceryCategorySection: {
    marginBottom: 8,
  },
  groceryCategoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#f8f5f0',
  },
  groceryCategoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groceryCategoryEmoji: {
    fontSize: 18,
  },
  groceryCategoryTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 16,
    color: '#1f2933',
  },
  groceryCategoryCount: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 4,
  },
  groceriesPageHeader: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  foodPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  foodPageIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#b45309',
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodPageTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 24,
    color: '#1f2933',
  },
  foodSubHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  foodSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  foodToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  foodToggleWord: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 28,
    color: '#1f2933',
  },
  foodToggleWordActive: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
    textDecorationLine: 'underline',
  },
  foodToggleSeparator: {
    fontSize: 24,
    color: '#9ca3af',
  },
  foodSearchBar: {
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  foodSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1f2933',
  },
  categoryScroll: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: 24,
    marginBottom: 16,
    maxHeight: 50,
  },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    marginRight: 8,
    alignSelf: 'center',
    height: 40,
    justifyContent: 'center',
  },
  categoryPillActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: '#f8f5f0',
    borderRadius: 12,
    padding: 4,
    alignSelf: 'flex-start',
  },
  viewToggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewToggleButtonActive: {
    backgroundColor: '#b45309',
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  viewToggleTextActive: {
    color: '#ffffff',
  },
  restaurantCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  restaurantIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantInfo: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 17,
    color: '#1f2933',
    marginBottom: 4,
  },
  restaurantCuisine: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
  restaurantRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  restaurantRatingText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  restaurantDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restaurantDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantDetailText: {
    fontSize: 13,
    color: '#6b7280',
  },

  // To Do Page Styles
  todoPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  todoPageIcon: {
    width: 38,
    height: 38,
    backgroundColor: '#b45309',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoPageTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2933',
    marginLeft: 10,
  },
  todoSubHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  todoSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  todoMainTitle: {
    fontFamily: 'PlayfairDisplay_400Regular',
    fontSize: 28,
    color: '#1f2933',
  },
  todoMainTitleAccent: {
    fontFamily: 'PlayfairDisplay_500Medium_Italic',
    color: '#b45309',
  },
  todoToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 12,
  },
  todoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todoToggleItem: {
    paddingBottom: 8,
    marginRight: 24,
  },
  todoToggleItemActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#b45309',
  },
  todoToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  todoToggleTextActive: {
    color: '#b45309',
  },
  filterPills: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  todoSectionHeader: {
    paddingHorizontal: 24,
    marginBottom: 12,
    marginTop: 8,
  },
  todoSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2933',
  },
  taskCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  taskCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d4c5b0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  taskCheckboxChecked: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 15,
    color: '#1f2933',
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityDotUrgent: {
    backgroundColor: '#4a0000',
  },
  priorityDotHigh: {
    backgroundColor: '#ef4444',
  },
  priorityDotMedium: {
    backgroundColor: '#f59e0b',
  },
  priorityDotLow: {
    backgroundColor: '#10b981',
  },
  // New Recipe Card Styles
  newRecipeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  newRecipeCardHeader: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  recipeSourceBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recipeSourceBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2933',
  },
  recipeEmoji: {
    fontSize: 64,
  },
  newRecipeCardContent: {
    padding: 20,
  },
  newRecipeTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: 20,
    color: '#1f2933',
    marginBottom: 8,
  },
  newRecipeDescription: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 12,
  },
  newRecipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  newRecipeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newRecipeMetaText: {
    fontSize: 13,
    color: '#6b7280',
  },
  recipeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  recipeTagChip: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recipeTagChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#b45309',
  },
  newRecipeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addToGroceriesBtn: {
    flex: 1,
    backgroundColor: '#b45309',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addToGroceriesBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  viewRecipeBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  viewRecipeBtnText: {
    color: '#1f2933',
    fontSize: 14,
    fontWeight: '500',
  },
  // Person Profile Modal Styles
  personProfileOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  personProfileBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  personProfileContent: {
    backgroundColor: '#fdfaf5',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  personProfileHeader: {
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  personProfileCloseBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    padding: 4,
  },
  personProfileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  personProfileAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#ffffff',
  },
  personProfileName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2933',
    fontFamily: 'PlayfairDisplay_600SemiBold',
  },
  personProfileSection: {
    marginBottom: 24,
  },
  personProfileSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  personProfileDatePicker: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personProfileSizeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  personProfileSizeItem: {
    flex: 1,
  },
  personProfileSizeLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
  },
  personProfileSizeInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#1f2933',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  personProfileGiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  personProfileGiftCount: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  personProfileEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  personProfileGiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  personProfileGiftInfo: {
    flex: 1,
  },
  personProfileGiftName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2933',
  },
  personProfileGiftNotes: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  personProfileGiftPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  personProfileSaveBtn: {
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  personProfileSaveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  personProfileAddGiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  personProfileAddGiftText: {
    color: '#b45309',
    fontSize: 15,
    fontWeight: '500',
  },
  // Recipe Tags Styles
  recipeTagsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 10,
    marginTop: 4,
  },
  recipeTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  recipeTagButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  recipeTagButtonActive: {
    backgroundColor: '#b45309',
    borderColor: '#b45309',
  },
  recipeTagButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  recipeTagButtonTextActive: {
    color: '#ffffff',
  },
});
