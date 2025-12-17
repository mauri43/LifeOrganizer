import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from './firebase';

export default function HouseholdSetup({ onHouseholdSet, allowSkip = false }) {
  const [mode, setMode] = useState('choose'); // 'choose', 'create', 'join'
  const [householdName, setHouseholdName] = useState('');
  const [householdCode, setHouseholdCode] = useState('');
  const [loading, setLoading] = useState(false);

  const generateHouseholdCode = () => {
    // Generate random 6-character code
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createHousehold = async () => {
    if (!householdName.trim()) {
      Alert.alert('Error', 'Please enter a household name');
      return;
    }

    setLoading(true);
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a household');
      setLoading(false);
      return;
    }
    
    try {
      const code = generateHouseholdCode();
      const userId = user.uid;
      
      // Create household document with creator as admin
      await setDoc(doc(db, 'households', code), {
        name: householdName,
        code: code,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        members: [userId],
        admins: [userId], // Creator is automatically admin
      });

      // Update user document with household ID
// Add user to household
await setDoc(doc(db, 'users', user.uid), {
  householdId: householdCode,
  email: user.email,
  joinedAt: new Date().toISOString(),
}, { merge: true });

      Alert.alert(
        'Household Created!',
        `Your household code is: ${code}\n\nShare this code with others so they can join your household.`,
        [
          {
            text: 'OK',
            onPress: () => onHouseholdSet(code),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating household:', error);
      Alert.alert('Error', 'Failed to create household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinHousehold = async () => {
    if (!householdCode.trim()) {
      Alert.alert('Error', 'Please enter a household code');
      return;
    }

    const code = householdCode.toUpperCase().trim();
    setLoading(true);
    const user = auth.currentUser;
    
    if (!user) {
      Alert.alert('Error', 'You must be logged in to join a household');
      setLoading(false);
      return;
    }

    try {
      const userId = user.uid;
      
      // Check if household exists
      const householdDoc = await getDoc(doc(db, 'households', code));
      
      if (!householdDoc.exists()) {
        Alert.alert('Error', 'Household not found. Please check the code and try again.');
        setLoading(false);
        return;
      }

      // Add user to household members
      await updateDoc(doc(db, 'households', code), {
        members: arrayUnion(userId),
      });

      // Update user document with household ID
// Add user to household
await setDoc(doc(db, 'users', user.uid), {
  householdId: householdCode,
  email: user.email,
  joinedAt: new Date().toISOString(),
}, { merge: true });

      const householdData = householdDoc.data();
      Alert.alert(
        'Success!',
        `You've joined "${householdData.name}"!`,
        [
          {
            text: 'OK',
            onPress: () => onHouseholdSet(code),
          },
        ]
      );
    } catch (error) {
      console.error('Error joining household:', error);
      Alert.alert('Error', 'Failed to join household. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Text style={styles.title}>Set Up Your Household</Text>
          <Text style={styles.subtitle}>
            Create a household or join an existing one to start organizing together
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => setMode('create')}
          >
            <Text style={styles.buttonText}>Create New Household</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => setMode('join')}
          >
            <Text style={styles.buttonTextSecondary}>Join Existing Household</Text>
          </TouchableOpacity>

          {allowSkip && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={() => onHouseholdSet(null)}
            >
              <Text style={styles.skipButtonText}>Skip this step</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'create') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('choose')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Create Household</Text>
          <Text style={styles.subtitle}>
            Give your household a name. You'll get a code to share with others.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Household name (e.g., The Smiths)"
            placeholderTextColor="#9CA3AF"
            value={householdName}
            onChangeText={setHouseholdName}
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={createHousehold}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create Household</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'join') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('choose')}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Join Household</Text>
          <Text style={styles.subtitle}>
            Enter the household code shared with you
          </Text>

          <TextInput
            style={[styles.input, styles.codeInput]}
            placeholder="Enter code (e.g., ABC123)"
            placeholderTextColor="#9CA3AF"
            value={householdCode}
            onChangeText={setHouseholdCode}
            autoCapitalize="characters"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={joinHousehold}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Join Household</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#111827',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#374151',
    borderRadius: 8,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
    marginBottom: 16,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563EB',
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
  buttonTextSecondary: {
    color: '#2563EB',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#374151',
  },
  dividerText: {
    color: '#9CA3AF',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  skipButton: {
    marginTop: 24,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});