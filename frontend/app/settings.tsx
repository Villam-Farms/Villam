// app/settings.tsx
import { StyleSheet, TouchableOpacity, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import React from 'react';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/auth-context';
import { useMyProfile } from '@/hooks/useMyProfile';
import { getProfileDisplay } from '@/lib/profile-display';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { signOut, session } = useAuth();
  const { data: profile } = useMyProfile();
  const metadata = session?.user?.user_metadata as
    | { name?: string; full_name?: string; username?: string }
    | undefined;
  const { avatarUrl, fullName, username, displayName, initials } = getProfileDisplay(
    profile,
    metadata,
    session?.user?.email
  );

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/profile');
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            console.log('Delete account');
            // Add your delete account logic here
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ThemedView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color={colors.text.primary} />
          </TouchableOpacity>

          {/* Title - centered */}
          <ThemedText type="title" style={[styles.title, { color: colors.text.primary }]}>
            Settings
          </ThemedText>
        </View>

        {/* Profile Section */}
        <TouchableOpacity 
          style={styles.profileSection}
          onPress={handleEditProfile}
        >
          <View style={[styles.profileImage, { backgroundColor: theme.neutral[400] }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.profileImageAsset} contentFit="cover" />
            ) : (
              <ThemedText style={styles.profileInitials}>{initials}</ThemedText>
            )}
          </View>
          <ThemedText type="subtitle" style={[styles.profileName, { color: colors.text.primary }]}>
            {fullName ?? displayName}
          </ThemedText>
          {!!username && (
            <ThemedText style={[styles.profileUsername, { color: colors.text.secondary }]}>
              @{username}
            </ThemedText>
          )}
          <ThemedText style={{ paddingTop: 7, color: '#0088FF'}}>
            Open profile
          </ThemedText>
        </TouchableOpacity>

        {/* Settings Options */}
        <View style={[styles.optionsContainer, { 
          backgroundColor: colors.card,
          borderColor: colors.border.default,
        }]}>
          {/* Delete Account */}
          <TouchableOpacity 
            style={[styles.option, { borderBottomColor: colors.border.default }]}
            onPress={handleDeleteAccount}
          >
            <ThemedText style={[styles.optionText, { color: '#EF4444' }]}>
              Delete Account
            </ThemedText>
            <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>

          {/* Log Out */}
          <TouchableOpacity 
            style={[styles.option, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
          >
            <ThemedText style={[styles.optionText, { color: '#EF4444' }]}>
              Log out
            </ThemedText>
            <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  title: {
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
  },
  profileSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: theme.spacing.md,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImageAsset: {
    width: '100%',
    height: '100%',
  },
  profileInitials: {
    color: theme.neutral.white,
    fontSize: theme.typography.fontSizes.h2,
    fontWeight: theme.typography.fontWeights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  profileName: {
    marginTop: theme.spacing.md,
    fontWeight: theme.typography.fontWeights.bold,
  },
  profileUsername: {
    marginTop: theme.spacing.xs,
  },
  optionsContainer: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: theme.typography.fontSizes.h4,
    fontWeight: theme.typography.fontWeights.medium,
    fontFamily: theme.typography.fontFamily,
  },
});
