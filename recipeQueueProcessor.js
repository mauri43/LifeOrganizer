import { Platform, NativeModules } from 'react-native';
import * as Notifications from 'expo-notifications';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc } from 'firebase/firestore';

const { RecipeQueueManager } = NativeModules;

/**
 * Normalize ingredients array to consistent format
 */
const normalizeIngredients = (ingredients) => {
  if (!ingredients) return [];
  if (typeof ingredients === 'string') {
    return ingredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name, quantity: '', unit: '' }));
  }
  if (Array.isArray(ingredients)) {
    return ingredients.map((item) => {
      if (typeof item === 'string') {
        return { name: item.trim(), quantity: '', unit: '' };
      }
      return {
        name: item.name || item.ingredient || '',
        quantity: item.quantity || item.amount || '',
        unit: item.unit || '',
      };
    });
  }
  return [];
};

/**
 * Normalize steps array to consistent format
 */
const normalizeSteps = (steps) => {
  if (!steps) return [];
  if (typeof steps === 'string') {
    return steps
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (Array.isArray(steps)) {
    return steps
      .map((step) => {
        if (typeof step === 'string') return step.trim();
        if (typeof step === 'object') return step.step || step.instruction || step.text || '';
        return '';
      })
      .filter(Boolean);
  }
  return [];
};

/**
 * Send a local notification
 */
const sendNotification = async (title, body) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
};

/**
 * Process a single URL from the queue
 */
const processQueueItem = async (url, functions, db, householdId) => {
  try {
    // Call Firebase function to extract recipe
    const callable = httpsCallable(functions, 'extractRecipe');
    const response = await callable({ url });
    const data = response?.data || {};
    const recipePayload = data.recipe || (!data.manualEntryRequired ? data : null);

    // Check if extraction was successful
    if (data.manualEntryRequired || !recipePayload || Object.keys(recipePayload).length === 0) {
      await sendNotification(
        'Failed to fetch recipe',
        'Could not extract recipe from this link. Try adding it manually.'
      );
      return false;
    }

    // Normalize the recipe data
    const ingredients = normalizeIngredients(recipePayload.ingredients);
    const steps = normalizeSteps(recipePayload.steps || recipePayload.instructions);

    // Build recipe document
    const recipeDoc = {
      title: recipePayload.title || '',
      sourceUrl: recipePayload.sourceUrl || url,
      sourceName: recipePayload.sourceName || recipePayload.author || '',
      thumbnail: recipePayload.thumbnail || recipePayload.image || '',
      videoUrl: recipePayload.videoUrl || recipePayload.sourceUrl || url,
      description: recipePayload.description || '',
      ingredients,
      steps,
      tags: Array.isArray(recipePayload.tags) ? recipePayload.tags : [],
      createdAt: new Date().toISOString(),
      favorited: false,
      source: 'share-extension',
    };

    // Save to Firestore
    await addDoc(collection(db, 'households', householdId, 'recipes'), recipeDoc);

    // Send success notification
    const recipeTitle = recipeDoc.title || 'Recipe';
    await sendNotification(
      'Recipe saved!',
      `${recipeTitle} was added to your recipes`
    );

    return true;
  } catch (error) {
    console.error('Error processing recipe URL:', error);

    let message = 'Failed to extract recipe. Try adding it manually.';
    if (error.code === 'functions/deadline-exceeded') {
      message = 'Request timed out. Please try again.';
    } else if (error.code === 'functions/not-found') {
      message = 'Recipe extractor not available.';
    }

    await sendNotification('Failed to fetch recipe', message);
    return false;
  }
};

/**
 * Process all queued recipe URLs
 * Call this when the app opens and user is authenticated
 */
export const processRecipeQueue = async (functions, db, householdId) => {
  // Only run on iOS
  if (Platform.OS !== 'ios') {
    return;
  }

  // Check if native module is available
  if (!RecipeQueueManager) {
    console.log('RecipeQueueManager native module not available');
    return;
  }

  // Check if householdId is available
  if (!householdId) {
    console.log('No householdId available, skipping queue processing');
    return;
  }

  try {
    // Get queued URLs
    const urls = await RecipeQueueManager.getQueuedUrls();

    if (!urls || urls.length === 0) {
      return;
    }

    console.log(`Processing ${urls.length} queued recipe(s)...`);

    // Process each URL
    for (const url of urls) {
      await processQueueItem(url, functions, db, householdId);

      // Remove from queue after processing (success or failure)
      try {
        await RecipeQueueManager.removeUrl(url);
      } catch (removeError) {
        console.error('Failed to remove URL from queue:', removeError);
      }

      // Small delay between processing to avoid rate limits
      if (urls.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log('Recipe queue processing complete');
  } catch (error) {
    console.error('Error processing recipe queue:', error);
  }
};

/**
 * Get the current queue count (for badge display)
 */
export const getQueueCount = async () => {
  if (Platform.OS !== 'ios' || !RecipeQueueManager) {
    return 0;
  }

  try {
    const urls = await RecipeQueueManager.getQueuedUrls();
    return urls?.length || 0;
  } catch (error) {
    console.error('Error getting queue count:', error);
    return 0;
  }
};

/**
 * Clear the entire queue
 */
export const clearRecipeQueue = async () => {
  if (Platform.OS !== 'ios' || !RecipeQueueManager) {
    return;
  }

  try {
    await RecipeQueueManager.clearQueue();
  } catch (error) {
    console.error('Error clearing queue:', error);
  }
};
