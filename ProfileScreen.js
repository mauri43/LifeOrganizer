import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { User, Copy, LogOut, Settings, Shield, Users, Trash2, Crown } from 'lucide-react-native';
import { getDoc, doc, updateDoc, arrayRemove, arrayUnion, onSnapshot, collection, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { getThemeColors } from './theme';

export default function ProfileScreen({ onClose, householdId, onLeaveHousehold, onJoinCreate, onOpenSettings, theme = 'light' }) {
  const colors = getThemeColors(theme);
  const isDark = theme === 'dark';
    const [householdName, setHouseholdName] = useState('');
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');
    const [username, setUsername] = useState('');
    const [editingName, setEditingName] = useState(false);
    const [editingHousehold, setEditingHousehold] = useState(false);
    const [tempName, setTempName] = useState('');
    const [tempHouseholdName, setTempHouseholdName] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [householdMembers, setHouseholdMembers] = useState([]);

    const fetchUserProfile = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return;
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.name || 'Not set');
          setUsername(userData.username || 'Not set');
        } else {
          setUserName('Not set');
          setUsername('Not set');
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setUserName('Error loading');
        setUsername('Error loading');
      }
    };

    // Fetch household data and check admin status
useEffect(() => {
  if (householdId) {
    const fetchHouseholdData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (!currentUser) return; // Don't fetch if user is logged out
        
        const householdDoc = await getDoc(doc(db, 'households', householdId));
        if (householdDoc.exists()) {
          const householdData = householdDoc.data();
          setHouseholdName(householdData.name || 'Unknown');
          const admins = householdData.admins || [];
          setIsAdmin(admins.includes(currentUser.uid));
        }
      } catch (error) {
        console.error('Error fetching household:', error);
      }
    };

    fetchHouseholdData();

    // Listen to household members
    const unsubscribe = onSnapshot(doc(db, 'households', householdId), async (householdSnapshot) => {
      const currentUser = auth.currentUser;
      if (!currentUser) return; // Don't process if user is logged out
      
      // Capture uid early to avoid race conditions
      const userId = currentUser.uid;
      if (!userId) return; // Double check
      
      if (householdSnapshot.exists()) {
        const householdData = householdSnapshot.data();
        const memberIds = householdData.members || [];
        const admins = householdData.admins || [];
        
        // Re-check currentUser before setting state
        if (!auth.currentUser) return;
        setIsAdmin(admins.includes(userId));

        // Fetch member details
        const memberDetails = await Promise.all(
          memberIds.map(async (memberId) => {
            try {
              // Check again before async operations
              if (!auth.currentUser) return null;
              const userDoc = await getDoc(doc(db, 'users', memberId));
              if (userDoc.exists()) {
                return {
                  id: memberId,
                  name: userDoc.data().name || 'Unknown',
                  email: userDoc.data().email || '',
                  isAdmin: admins.includes(memberId),
                };
              }
              return { id: memberId, name: 'Unknown', email: '', isAdmin: admins.includes(memberId) };
            } catch (error) {
              return { id: memberId, name: 'Unknown', email: '', isAdmin: admins.includes(memberId) };
            }
          })
        );
        
        // Final check before setting state
        if (!auth.currentUser) return;
        // Filter out any null values from cancelled operations
        const validMemberDetails = memberDetails.filter(m => m !== null);
        setHouseholdMembers(validMemberDetails);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }
}, [householdId]);

useEffect(() => {
  fetchUserProfile();
}, []); // Fetch on mount

    useEffect(() => {
      fetchUserProfile();
    }, []); // Fetch on mount
    

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }
  
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to update your name');
        return;
      }
      
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: tempName.trim()
      });
      setUserName(tempName.trim());
      setEditingName(false);
      Alert.alert('Success', 'Name updated!');
    } catch (error) {
      console.error('Error updating name:', error);
      Alert.alert('Error', 'Failed to update name');
    }
  };
  
  const handleSaveHouseholdName = async () => {
    if (!tempHouseholdName.trim()) {
      Alert.alert('Error', 'Household name cannot be empty');
      return;
    }
  
    // Check if user is admin
    if (!isAdmin) {
      Alert.alert('Error', 'Only admins can change the household name');
      return;
    }

    try {
      await updateDoc(doc(db, 'households', householdId), {
        name: tempHouseholdName.trim()
      });
      setHouseholdName(tempHouseholdName.trim());
      setEditingHousehold(false);
      Alert.alert('Success', 'Household name updated!');
    } catch (error) {
      console.error('Error updating household name:', error);
      Alert.alert('Error', 'Failed to update household name');
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only admins can remove members');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to remove members');
      return;
    }

    // Check if trying to remove self
    if (memberId === currentUser.uid) {
      // Check if they are the last admin
      const admins = householdMembers.filter(m => m.isAdmin).map(m => m.id);
      if (admins.length === 1 && admins[0] === currentUser.uid) {
        Alert.alert('Error', 'You cannot remove yourself if you are the last admin');
        return;
      }
    }

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove this member from the household?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'households', householdId), {
                members: arrayRemove(memberId),
                admins: arrayRemove(memberId),
              });
              await updateDoc(doc(db, 'users', memberId), {
                householdId: null,
              });
              Alert.alert('Success', 'Member removed from household');
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const handleToggleAdmin = async (memberId, makeAdmin) => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only admins can promote/demote other admins');
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to change admin status');
      return;
    }

    if (memberId === currentUser.uid) {
      // Check if trying to demote self
      const admins = householdMembers.filter(m => m.isAdmin).map(m => m.id);
      if (!makeAdmin && admins.length === 1 && admins[0] === currentUser.uid) {
        Alert.alert('Error', 'You cannot demote yourself if you are the last admin');
        return;
      }
    }

    try {
      if (makeAdmin) {
        await updateDoc(doc(db, 'households', householdId), {
          admins: arrayUnion(memberId),
        });
        Alert.alert('Success', 'Member promoted to admin');
      } else {
        await updateDoc(doc(db, 'households', householdId), {
          admins: arrayRemove(memberId),
        });
        Alert.alert('Success', 'Member demoted from admin');
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      Alert.alert('Error', 'Failed to update admin status');
    }
  };
  const loadHouseholdData = async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    try {
      const householdDoc = await getDoc(doc(db, 'households', householdId));
      if (householdDoc.exists()) {
        setHouseholdName(householdDoc.data().name);
      }
    } catch (error) {
      console.error('Error loading household:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${label} copied to clipboard`);
  };

  const handleInviteOthers = async () => {
    if (!isAdmin) {
      Alert.alert('Error', 'Only admins can invite members');
      return;
    }

    try {
      const displayName = userName && userName !== 'Not set' ? userName : 'Someone';
      const inviteMessage = `Hey, ${displayName} is inviting you to their Household! Click the link to join: ${householdId}`;
      
      const result = await Share.share({
        message: inviteMessage,
        title: 'Join My Household',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
        } else {
          // Shared
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share invitation');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            auth.signOut();
            onClose();
          },
        },
      ]
    );
  };

  // Dynamic styles based on theme
  const dynamicStyles = {
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      paddingTop: 52,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '500',
      color: colors.text,
      letterSpacing: -0.5,
    },
    closeButton: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
    settingsButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      flex: 1,
      padding: 24,
      backgroundColor: colors.background,
    },
    profileInfo: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    profileLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      fontWeight: '500',
      letterSpacing: 1.2,
    },
    profileValue: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '400',
    },
    editButton: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: '600',
    },
    editInput: {
      backgroundColor: isDark ? colors.inputBg : '#fdfaf5',
      borderRadius: 12,
      padding: 14,
      color: colors.text,
      fontSize: 16,
      marginTop: 4,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    codeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 18,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.accent,
    },
    codeText: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
      letterSpacing: 1.5,
    },
    memberItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    memberEmail: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    memberActionButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: isDark ? colors.surfaceElevated : '#f8f5f0',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    memberActionText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
    },
    hint: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 8,
      fontStyle: 'italic',
    },
    cancelButton: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    saveButton: {
      color: colors.success,
      fontSize: 14,
      fontWeight: '600',
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.safeArea}>
      <View style={styles.container}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Profile</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={onOpenSettings} style={dynamicStyles.settingsButton}>
              <Settings size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={dynamicStyles.closeButton}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={dynamicStyles.content}>
        {/* Admin Banner */}
        {isAdmin && (
          <View style={styles.adminBanner}>
            <Shield size={20} color="#ffffff" />
            <Text style={styles.adminBannerText}>You are an Admin</Text>
          </View>
        )}

        {/* Name */}
        <View style={dynamicStyles.profileInfo}>
          <View style={styles.editableHeader}>
            <Text style={dynamicStyles.profileLabel}>Name</Text>
            {!editingName ? (
              <TouchableOpacity
                onPress={() => {
                  setTempName(userName);
                  setEditingName(true);
                }}
              >
                <Text style={dynamicStyles.editButton}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity onPress={() => setEditingName(false)}>
                  <Text style={dynamicStyles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveName}>
                  <Text style={dynamicStyles.saveButton}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {editingName ? (
            <TextInput
              style={dynamicStyles.editInput}
              value={tempName}
              onChangeText={setTempName}
              autoFocus
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={dynamicStyles.profileValue}>{userName || 'Loading...'}</Text>
          )}
        </View>

        {/* Username */}
        <View style={dynamicStyles.profileInfo}>
          <Text style={dynamicStyles.profileLabel}>Username</Text>
          <Text style={dynamicStyles.profileValue}>{username || 'Loading......'}</Text>
        </View>

        {/* Email */}
        <View style={dynamicStyles.profileInfo}>
          <Text style={dynamicStyles.profileLabel}>Email</Text>
          <Text style={dynamicStyles.profileValue}>{auth.currentUser?.email}</Text>
        </View>

        {/* Household Name or Join/Create */}
        {householdId ? (
          <View style={dynamicStyles.profileInfo}>
            <View style={styles.editableHeader}>
              <Text style={dynamicStyles.profileLabel}>Household Name</Text>
              {!editingHousehold && isAdmin && (
                <TouchableOpacity
                  onPress={() => {
                    setTempHouseholdName(householdName);
                    setEditingHousehold(true);
                  }}
                >
                  <Text style={dynamicStyles.editButton}>Edit</Text>
                </TouchableOpacity>
              )}
              {editingHousehold && (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => setEditingHousehold(false)}>
                    <Text style={dynamicStyles.cancelButton}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveHouseholdName}>
                    <Text style={dynamicStyles.saveButton}>Save</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {editingHousehold ? (
              <TextInput
                style={dynamicStyles.editInput}
                value={tempHouseholdName}
                onChangeText={setTempHouseholdName}
                autoFocus
                placeholderTextColor={colors.textMuted}
              />
            ) : (
              <Text style={dynamicStyles.profileValue}>{householdName || 'Loading...'}</Text>
            )}
          </View>
        ) : (
          <View style={dynamicStyles.profileInfo}>
            <Text style={dynamicStyles.profileLabel}>Household</Text>
            <Text style={dynamicStyles.profileValue}>No household joined</Text>
            {onJoinCreate && (
              <TouchableOpacity
                style={styles.joinCreateButton}
                onPress={onJoinCreate}
              >
                <Text style={styles.joinCreateButtonText}>Join or Create Household</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

          {/* Household Code Section - Admin Only */}
          {householdId && isAdmin && (
            <View style={styles.section}>
              <Text style={dynamicStyles.profileLabel}>Household Invite Code</Text>
              <TouchableOpacity
                style={dynamicStyles.codeContainer}
                onPress={() => copyToClipboard(householdId, 'Invite code')}
              >
                <Text style={dynamicStyles.codeText}>{householdId}</Text>
                <Copy size={20} color={colors.accent} />
              </TouchableOpacity>
              <Text style={dynamicStyles.hint}>Tap to copy and share with others</Text>
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={handleInviteOthers}
              >
                <Text style={styles.inviteButtonText}>Invite Others</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Member Management - Admin Only */}
          {householdId && isAdmin && (
            <View style={styles.section}>
              <Text style={dynamicStyles.profileLabel}>Household Members</Text>
              {householdMembers.map((member) => (
                <View key={member.id} style={dynamicStyles.memberItem}>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberHeader}>
                      <Text style={dynamicStyles.memberName}>{member.name}</Text>
                      {member.isAdmin && (
                        <View style={styles.adminBadge}>
                          <Crown size={14} color={colors.accent} />
                          <Text style={styles.adminBadgeText}>Admin</Text>
                        </View>
                      )}
                    </View>
                    <Text style={dynamicStyles.memberEmail}>{member.email}</Text>
                  </View>
                  <View style={styles.memberActions}>
                    {(() => {
                      const currentUser = auth.currentUser;
                      return currentUser && member.id !== currentUser.uid;
                    })() && (
                      <>
                        <TouchableOpacity
                          style={styles.memberActionButton}
                          onPress={() => handleToggleAdmin(member.id, !member.isAdmin)}
                        >
                          <Text style={styles.memberActionText}>
                            {member.isAdmin ? 'Demote' : 'Promote'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.memberActionButton, styles.removeButton]}
                          onPress={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Leave Household Button */}
          {householdId && onLeaveHousehold && (
            <TouchableOpacity 
              style={styles.leaveHouseholdButton} 
              onPress={() => {
                Alert.alert(
                  'Leave Household',
                  'Are you sure you want to leave this household?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Leave',
                      style: 'destructive',
                      onPress: onLeaveHousehold,
                    },
                  ]
                );
              }}
            >
              <Text style={styles.leaveHouseholdButtonText}>Leave Household</Text>
            </TouchableOpacity>
          )}

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={20} color="#dc2626" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fdfaf5',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#e7e5e4',
    backgroundColor: '#fdfaf5',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '500',
    color: '#292524',
    letterSpacing: -0.5,
  },
  closeButton: {
    color: '#b45309',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fdfaf5',
  },
  section: {
    marginBottom: 28,
  },
  label: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  valueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  value: {
    color: '#292524',
    fontSize: 16,
    flex: 1,
    fontWeight: '400',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#b45309',
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  codeText: {
    color: '#292524',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  hint: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 8,
    fontStyle: 'italic',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginTop: 32,
    borderWidth: 2,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  profileInfo: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  profileLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    fontWeight: '500',
    letterSpacing: 1.2,
  },
  profileValue: {
    fontSize: 16,
    color: '#292524',
    fontWeight: '400',
  },
  editableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editButton: {
    color: '#b45309',
    fontSize: 14,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
  },
  editInput: {
    backgroundColor: '#fdfaf5',
    borderRadius: 12,
    padding: 14,
    color: '#292524',
    fontSize: 16,
    marginTop: 4,
    borderWidth: 2,
    borderColor: '#b45309',
  },
  joinCreateButton: {
    marginTop: 12,
    backgroundColor: '#b45309',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  joinCreateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveHouseholdButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  leaveHouseholdButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  inviteButton: {
    marginTop: 12,
    backgroundColor: '#b45309',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#b45309',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  adminBannerText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  memberName: {
    color: '#292524',
    fontSize: 16,
    fontWeight: '500',
  },
  memberEmail: {
    color: '#9ca3af',
    fontSize: 14,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  adminBadgeText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  memberActionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8f5f0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
  memberActionText: {
    color: '#b45309',
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
});