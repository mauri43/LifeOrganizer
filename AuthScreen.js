import React, { useState } from 'react';
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
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

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
    Alert.alert('Error', 'Please fill in all fields');
    return;
  }

  setLoading(true);
  try {
    let loginEmail = email.trim();

    // If not signing up and input doesn't contain @, treat as username
    if (!isLogin && !email.includes('@')) {
      const fetchedEmail = await getEmailFromUsername(email.trim());
      if (!fetchedEmail) {
        Alert.alert('Error', 'Username not found');
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
    let errorMessage = 'Authentication failed';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'This email is already in use';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address';
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      errorMessage = 'Invalid credentials';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password should be at least 6 characters';
    }
    Alert.alert('Error', errorMessage);
  } finally {
    setLoading(false);
  }
};
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }
  
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        'Success', 
        'Password reset email sent! Check your inbox.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Life Organizer</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </Text>

          <View style={styles.form}>
          <TextInput
              style={styles.input}
              placeholder={isSignUp ? "Email" : "Email or Username"}
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType={isSignUp ? "email-address" : "default"}
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Login'}
              </Text>
            </TouchableOpacity>
            {!isSignUp && (
  <TouchableOpacity
    style={styles.forgotPasswordButton}
    onPress={handleForgotPassword}
  >
    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
  </TouchableOpacity>
)}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111827',
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 48,
  },
  form: {
    gap: 16,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#1E40AF',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchText: {
    color: '#60A5FA',
    fontSize: 16,
  },
  forgotPasswordButton: {
  marginTop: 12,
  alignItems: 'center',
},
forgotPasswordText: {
  color: '#60A5FA',
  fontSize: 14,
},
});