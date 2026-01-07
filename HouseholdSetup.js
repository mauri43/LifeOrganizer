import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './firebase';
import { Home, Users, Plus, ArrowRight, ChevronLeft, Hash } from 'lucide-react-native';
import { getThemeColors } from './theme';

export default function HouseholdSetup({ onHouseholdSet, allowSkip = false, theme = 'light' }) {
  const [mode, setMode] = useState('choose'); // 'choose', 'create', 'join'
  const [householdName, setHouseholdName] = useState('');
  const [householdCode, setHouseholdCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Get theme colors
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [mode]);

  const generateHouseholdCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Name Required', 'Please give your household a name.');
      return;
    }

    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Session Expired', 'Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const code = generateHouseholdCode();
      const userId = user.uid;

      await setDoc(doc(db, 'households', code), {
        name: householdName,
        code: code,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        members: [userId],
        admins: [userId],
      });

      await setDoc(doc(db, 'users', user.uid), {
        householdId: code,
        email: user.email,
        joinedAt: new Date().toISOString(),
      }, { merge: true });

      Alert.alert(
        'Welcome Home!',
        `Your household code is:\n\n${code}\n\nShare this code with family members so they can join.`,
        [
          {
            text: 'Got it',
            onPress: () => onHouseholdSet(code),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinHousehold = async () => {
    if (!householdCode.trim()) {
      Alert.alert('Code Required', 'Please enter the household code.');
      return;
    }

    const code = householdCode.toUpperCase().trim();
    setLoading(true);
    const user = auth.currentUser;

    if (!user) {
      Alert.alert('Session Expired', 'Please sign in again.');
      setLoading(false);
      return;
    }

    try {
      const userId = user.uid;
      const householdDoc = await getDoc(doc(db, 'households', code));

      if (!householdDoc.exists()) {
        Alert.alert('Not Found', 'We couldn\'t find that household. Please check the code.');
        setLoading(false);
        return;
      }

      await updateDoc(doc(db, 'households', code), {
        members: arrayUnion(userId),
      });

      await setDoc(doc(db, 'users', user.uid), {
        householdId: code,
        email: user.email,
        joinedAt: new Date().toISOString(),
      }, { merge: true });

      const householdData = householdDoc.data();
      Alert.alert(
        'Welcome!',
        `You've joined "${householdData.name}"`,
        [
          {
            text: 'Let\'s go',
            onPress: () => onHouseholdSet(code),
          },
        ]
      );
    } catch (error) {
      console.error('Error joining household:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => ({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    decorativeCircle: {
      position: 'absolute',
      top: -100,
      right: -80,
      width: 250,
      height: 250,
      borderRadius: 125,
      backgroundColor: colors.decorativeCircle1,
      opacity: isDark ? 0.3 : 0.5,
    },
    decorativeCircle2: {
      position: 'absolute',
      bottom: -50,
      left: -100,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.decorativeCircle2,
      opacity: isDark ? 0.2 : 0.3,
    },
    progressTrack: {
      width: '60%',
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginBottom: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accent,
      borderRadius: 2,
    },
    progressText: {
      fontFamily: 'SourceSans3_500Medium',
      fontSize: 13,
      color: colors.textMuted,
    },
    backButtonText: {
      fontFamily: 'SourceSans3_500Medium',
      color: colors.textSecondary,
      fontSize: 16,
      marginLeft: 4,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 32,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 17,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.1 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accentLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    optionTitle: {
      fontFamily: 'SourceSans3_600SemiBold',
      fontSize: 17,
      color: colors.text,
      marginBottom: 4,
    },
    optionDescription: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 14,
      color: colors.textSecondary,
    },
    skipButtonText: {
      fontFamily: 'SourceSans3_500Medium',
      fontSize: 16,
      color: colors.textMuted,
    },
    inputLabel: {
      fontFamily: 'SourceSans3_500Medium',
      fontSize: 14,
      color: isDark ? colors.textSecondary : '#4b5563',
      marginBottom: 10,
      marginLeft: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 4,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.1 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    inputContainerFocused: {
      borderColor: colors.inputFocus,
      shadowColor: colors.inputFocus,
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 12,
      fontFamily: 'SourceSans3_400Regular',
      color: colors.text,
      fontSize: 16,
    },
    inputHint: {
      fontFamily: 'SourceSans3_400Regular',
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 8,
      marginLeft: 4,
    },
    primaryButton: {
      flexDirection: 'row',
      backgroundColor: colors.logoBg,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 16,
      shadowColor: colors.logoBg,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonDisabled: {
      backgroundColor: colors.textMuted,
      shadowOpacity: 0.05,
    },
    primaryButtonText: {
      fontFamily: 'SourceSans3_600SemiBold',
      color: colors.logoText,
      fontSize: 17,
      letterSpacing: 0.3,
    },
  }), [colors, isDark])

  // Choose Mode Screen
  if (mode === 'choose') {
    return (
      <SafeAreaView style={dynamicStyles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Decorative Elements */}
          <View style={dynamicStyles.decorativeCircle} />
          <View style={dynamicStyles.decorativeCircle2} />

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={dynamicStyles.progressTrack}>
              <View style={[dynamicStyles.progressFill, { width: '100%' }]} />
            </View>
            <Text style={dynamicStyles.progressText}>Step 2 of 2</Text>
          </View>

          {/* Header */}
          <View style={styles.headerSection}>
            <View style={dynamicStyles.iconContainer}>
              <Home size={32} color={colors.accent} strokeWidth={1.5} />
            </View>
            <Text style={dynamicStyles.title}>Set Up Your{'\n'}Household</Text>
            <Text style={dynamicStyles.subtitle}>
              Organize together with family or roommates
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={dynamicStyles.optionCard}
              onPress={() => setMode('create')}
              activeOpacity={0.7}
            >
              <View style={dynamicStyles.optionIconContainer}>
                <Plus size={24} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={styles.optionContent}>
                <Text style={dynamicStyles.optionTitle}>Create New</Text>
                <Text style={dynamicStyles.optionDescription}>
                  Start a household and invite others
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.optionCard}
              onPress={() => setMode('join')}
              activeOpacity={0.7}
            >
              <View style={dynamicStyles.optionIconContainer}>
                <Users size={24} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={styles.optionContent}>
                <Text style={dynamicStyles.optionTitle}>Join Existing</Text>
                <Text style={dynamicStyles.optionDescription}>
                  Enter a code to join a household
                </Text>
              </View>
              <ArrowRight size={20} color={colors.textMuted} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {allowSkip && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => onHouseholdSet(null)}
              activeOpacity={0.7}
            >
              <Text style={dynamicStyles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Create Household Screen
  if (mode === 'create') {
    return (
      <SafeAreaView style={dynamicStyles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Decorative Elements */}
            <View style={dynamicStyles.decorativeCircle} />
            <View style={dynamicStyles.decorativeCircle2} />

            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('choose')}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={dynamicStyles.backButtonText}>Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.headerSection}>
              <View style={dynamicStyles.iconContainer}>
                <Plus size={32} color={colors.accent} strokeWidth={1.5} />
              </View>
              <Text style={dynamicStyles.title}>Create Your{'\n'}Household</Text>
              <Text style={dynamicStyles.subtitle}>
                You'll get a code to share with others
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <Text style={dynamicStyles.inputLabel}>Household Name</Text>
                <View style={[
                  dynamicStyles.inputContainer,
                  focusedField === 'name' && dynamicStyles.inputContainerFocused,
                ]}>
                  <Home size={20} color={focusedField === 'name' ? colors.accent : colors.textMuted} strokeWidth={1.5} />
                  <TextInput
                    style={dynamicStyles.input}
                    placeholder="e.g., The Smiths"
                    placeholderTextColor={colors.placeholder}
                    value={householdName}
                    onChangeText={setHouseholdName}
                    autoFocus
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  dynamicStyles.primaryButton,
                  (!householdName.trim() || loading) && dynamicStyles.primaryButtonDisabled,
                ]}
                onPress={createHousehold}
                disabled={loading || !householdName.trim()}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.logoText} />
                ) : (
                  <>
                    <Text style={dynamicStyles.primaryButtonText}>Create Household</Text>
                    <ArrowRight size={20} color={colors.logoText} strokeWidth={2} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Join Household Screen
  if (mode === 'join') {
    return (
      <SafeAreaView style={dynamicStyles.safeArea}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            {/* Decorative Elements */}
            <View style={dynamicStyles.decorativeCircle} />
            <View style={dynamicStyles.decorativeCircle2} />

            {/* Back Button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setMode('choose')}
              activeOpacity={0.7}
            >
              <ChevronLeft size={24} color={colors.textSecondary} strokeWidth={1.5} />
              <Text style={dynamicStyles.backButtonText}>Back</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.headerSection}>
              <View style={dynamicStyles.iconContainer}>
                <Users size={32} color={colors.accent} strokeWidth={1.5} />
              </View>
              <Text style={dynamicStyles.title}>Join a{'\n'}Household</Text>
              <Text style={dynamicStyles.subtitle}>
                Enter the code shared with you
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
              <View style={styles.inputWrapper}>
                <Text style={dynamicStyles.inputLabel}>Household Code</Text>
                <View style={[
                  dynamicStyles.inputContainer,
                  styles.codeInputContainer,
                  focusedField === 'code' && dynamicStyles.inputContainerFocused,
                ]}>
                  <Hash size={20} color={focusedField === 'code' ? colors.accent : colors.textMuted} strokeWidth={1.5} />
                  <TextInput
                    style={[dynamicStyles.input, styles.codeInput]}
                    placeholder="ABC123"
                    placeholderTextColor={colors.placeholder}
                    value={householdCode}
                    onChangeText={setHouseholdCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    autoFocus
                    onFocus={() => setFocusedField('code')}
                    onBlur={() => setFocusedField(null)}
                  />
                </View>
                <Text style={dynamicStyles.inputHint}>
                  The code is 6 characters, like ABC123
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  dynamicStyles.primaryButton,
                  (!householdCode.trim() || loading) && dynamicStyles.primaryButtonDisabled,
                ]}
                onPress={joinHousehold}
                disabled={loading || !householdCode.trim()}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={colors.logoText} />
                ) : (
                  <>
                    <Text style={dynamicStyles.primaryButtonText}>Join Household</Text>
                    <ArrowRight size={20} color={colors.logoText} strokeWidth={2} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#faf9f6',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  decorativeCircle: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#fef3c7',
    opacity: 0.5,
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -50,
    left: -100,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fed7aa',
    opacity: 0.3,
  },
  progressContainer: {
    position: 'absolute',
    top: 60,
    left: 28,
    right: 28,
    alignItems: 'center',
  },
  progressTrack: {
    width: '60%',
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#b45309',
    borderRadius: 2,
  },
  progressText: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 13,
    color: '#9ca3af',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    zIndex: 10,
  },
  backButtonText: {
    fontFamily: 'SourceSans3_500Medium',
    color: '#6b7280',
    fontSize: 16,
    marginLeft: 4,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 32,
    color: '#1f2933',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 17,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  optionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 17,
    color: '#1f2933',
    marginBottom: 4,
  },
  optionDescription: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 14,
    color: '#6b7280',
  },
  skipButton: {
    marginTop: 8,
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontFamily: 'SourceSans3_500Medium',
    color: '#9ca3af',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'SourceSans3_500Medium',
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 10,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  codeInputContainer: {
    justifyContent: 'center',
  },
  inputContainerFocused: {
    borderColor: '#b45309',
    shadowColor: '#b45309',
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontFamily: 'SourceSans3_400Regular',
    color: '#1f2933',
    fontSize: 16,
  },
  codeInput: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  inputHint: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    marginLeft: 4,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#1f2933',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: '#1f2933',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0.05,
  },
  primaryButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    color: '#fff',
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
