import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  StatusBar,
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getThemeColors } from './theme';

const { width } = Dimensions.get('window');

export default function AuthScreen({ onAuthSuccess, theme = 'light' }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // Get theme colors
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getEmailFromUsername = async (username) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data().email;
      }
      return null;
    } catch (error) {
      console.error('Error fetching email from username:', error);
      return null;
    }
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields to continue.');
      return;
    }

    setLoading(true);
    try {
      let loginEmail = email.trim();

      if (isLogin && !email.includes('@')) {
        const fetchedEmail = await getEmailFromUsername(email.trim());
        if (!fetchedEmail) {
          Alert.alert('Not Found', 'We couldn\'t find that username.');
          setLoading(false);
          return;
        }
        loginEmail = fetchedEmail;
      }

      if (!isLogin) {
        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
        onAuthSuccess();
      } else {
        await signInWithEmailAndPassword(auth, loginEmail, password);
        onAuthSuccess();
      }
    } catch (error) {
      console.error('Auth error:', error);
      let errorMessage = 'Something went wrong. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      }
      Alert.alert('Oops', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Check Your Inbox',
        'We\'ve sent you a password reset link.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', error.message);
    }
  };

  // Dynamic styles based on theme
  const dynamicStyles = {
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
    logoContainer: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: colors.logoBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: colors.logoBg,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 8,
    },
    logoIcon: {
      fontFamily: 'PlayfairDisplay_600SemiBold',
      fontSize: 36,
      color: colors.logoText,
    },
    title: {
      fontFamily: 'PlayfairDisplay_500Medium',
      fontSize: 32,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
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
      marginBottom: 8,
      marginLeft: 4,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 16,
      fontFamily: 'SourceSans3_400Regular',
      color: colors.text,
      fontSize: 16,
      borderWidth: 1.5,
      borderColor: colors.inputBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.1 : 0.03,
      shadowRadius: 4,
      elevation: 1,
    },
    inputFocused: {
      borderColor: colors.inputFocus,
      shadowColor: colors.inputFocus,
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    button: {
      backgroundColor: colors.logoBg,
      borderRadius: 14,
      paddingVertical: 18,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: colors.logoBg,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    buttonDisabled: {
      backgroundColor: colors.textMuted,
      shadowOpacity: 0.1,
    },
    buttonText: {
      fontFamily: 'SourceSans3_600SemiBold',
      color: colors.logoText,
      fontSize: 17,
      letterSpacing: 0.3,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.divider,
    },
    dividerText: {
      fontFamily: 'SourceSans3_400Regular',
      color: colors.textMuted,
      paddingHorizontal: 16,
      fontSize: 14,
    },
    switchText: {
      fontFamily: 'SourceSans3_400Regular',
      color: colors.textSecondary,
      fontSize: 15,
    },
    switchTextAccent: {
      fontFamily: 'SourceSans3_600SemiBold',
      color: colors.accent,
    },
    forgotPasswordText: {
      fontFamily: 'SourceSans3_400Regular',
      color: colors.textMuted,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.safeArea}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
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

          {/* Logo/Brand Section */}
          <Animated.View style={[styles.brandSection, { transform: [{ scale: logoScale }] }]}>
            <View style={dynamicStyles.logoContainer}>
              <Text style={dynamicStyles.logoIcon}>L</Text>
            </View>
            <Text style={dynamicStyles.title}>Life Organizer</Text>
            <Text style={dynamicStyles.subtitle}>
              {isLogin ? 'Welcome back' : 'Begin your journey'}
            </Text>
          </Animated.View>

          {/* Form Section */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={dynamicStyles.inputLabel}>
                {!isLogin ? 'Email' : 'Email or Username'}
              </Text>
              <TextInput
                style={[
                  dynamicStyles.input,
                  focusedField === 'email' && dynamicStyles.inputFocused,
                ]}
                placeholder={!isLogin ? 'your@email.com' : 'Enter email or username'}
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType={!isLogin ? 'email-address' : 'default'}
                autoCapitalize="none"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={dynamicStyles.inputLabel}>Password</Text>
              <TextInput
                style={[
                  dynamicStyles.input,
                  focusedField === 'password' && dynamicStyles.inputFocused,
                ]}
                placeholder="Enter your password"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={true}
                autoCapitalize="none"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={[dynamicStyles.button, loading && dynamicStyles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={dynamicStyles.buttonText}>
                {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={dynamicStyles.dividerLine} />
              <Text style={dynamicStyles.dividerText}>or</Text>
              <View style={dynamicStyles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
              activeOpacity={0.7}
            >
              <Text style={dynamicStyles.switchText}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={dynamicStyles.switchTextAccent}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={dynamicStyles.forgotPasswordText}>Forgot your password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  form: {
    gap: 0,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  forgotPasswordButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 4,
  },
});
