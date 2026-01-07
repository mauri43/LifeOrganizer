import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  StatusBar,
} from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User, AtSign, ArrowRight } from 'lucide-react-native';
import { getThemeColors } from './theme';

export default function UserProfileSetup({ onComplete, theme = 'light' }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Get theme colors
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate progress based on form completion
  useEffect(() => {
    const progress = (name.trim() ? 0.5 : 0) + (username.trim() ? 0.5 : 0);
    Animated.spring(progressAnim, {
      toValue: progress,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [name, username]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please tell us your name.');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Username Required', 'Please choose a username.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Session Expired', 'Please sign in again.');
        setLoading(false);
        return;
      }

      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        username: username.trim(),
        email: user.email,
        createdAt: new Date().toISOString(),
      }, { merge: true });

      onComplete();
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = name.trim() && username.trim();

  // Dynamic styles based on theme
  const dynamicStyles = useMemo(() => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    decorativeCircle: {
      position: 'absolute',
      top: -80,
      left: -60,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: colors.decorativeCircle1,
      opacity: isDark ? 0.3 : 0.5,
    },
    decorativeCircle2: {
      position: 'absolute',
      bottom: 100,
      right: -100,
      width: 220,
      height: 220,
      borderRadius: 110,
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
    saveButton: {
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
    saveButtonDisabled: {
      backgroundColor: colors.textMuted,
      shadowOpacity: 0.05,
    },
    saveButtonText: {
      fontFamily: 'SourceSans3_600SemiBold',
      color: colors.logoText,
      fontSize: 17,
      letterSpacing: 0.3,
    },
  }), [colors, isDark])

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Animated.View
          style={[
            styles.content,
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
              <Animated.View
                style={[
                  dynamicStyles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  }
                ]}
              />
            </View>
            <Text style={dynamicStyles.progressText}>Step 1 of 2</Text>
          </View>

          {/* Header */}
          <View style={styles.headerSection}>
            <View style={dynamicStyles.iconContainer}>
              <User size={32} color={colors.accent} strokeWidth={1.5} />
            </View>
            <Text style={dynamicStyles.title}>Complete Your{'\n'}Profile</Text>
            <Text style={dynamicStyles.subtitle}>Tell us a bit about yourself</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <Text style={dynamicStyles.inputLabel}>Full Name</Text>
              <View style={[
                dynamicStyles.inputContainer,
                focusedField === 'name' && dynamicStyles.inputContainerFocused,
              ]}>
                <User size={20} color={focusedField === 'name' ? colors.accent : colors.textMuted} strokeWidth={1.5} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="How should we call you?"
                  placeholderTextColor={colors.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            <View style={styles.inputWrapper}>
              <Text style={dynamicStyles.inputLabel}>Username</Text>
              <View style={[
                dynamicStyles.inputContainer,
                focusedField === 'username' && dynamicStyles.inputContainerFocused,
              ]}>
                <AtSign size={20} color={focusedField === 'username' ? colors.accent : colors.textMuted} strokeWidth={1.5} />
                <TextInput
                  style={dynamicStyles.input}
                  placeholder="Choose a unique username"
                  placeholderTextColor={colors.placeholder}
                  value={username}
                  onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={dynamicStyles.inputHint}>Others can find you with this</Text>
            </View>

            <TouchableOpacity
              style={[
                dynamicStyles.saveButton,
                !isFormValid && dynamicStyles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={loading || !isFormValid}
              activeOpacity={0.8}
            >
              <Text style={dynamicStyles.saveButtonText}>
                {loading ? 'Saving...' : 'Continue'}
              </Text>
              {!loading && <ArrowRight size={20} color={colors.logoText} strokeWidth={2} />}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  progressContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
  },
});
