# Phase 5: Settings Screen

## Objective
Implement `SettingsScreen` as a dedicated, scrollable settings hub — replacing the current pattern of settings being only reachable through the `SettingsMenu` modal. It surfaces connection status, sync status, and account links in clearly labeled cards.

## Files to Create
- `src/screens/SettingsScreen.tsx`

## Files to Reference
- `src/services/ConnectionStateManager.ts` — connection type detection
- `src/contexts/SyncConnectionContext.tsx` — `isConnected`, `isPaired`, `isReconnecting`
- `src/screens/settings/SyncSettingsScreen.tsx` — pattern reference for sync status display
- `src/components/settings/ConnectionStatusBadge.tsx` (from Phase 3)
- `src/components/themed/ThemedCard.tsx`, `ThemedText.tsx`, `ThemedButton.tsx`

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  ←  Settings                                    [≡] │  ← header (back arrow, hamburger)
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌─ Connection ──────────────────────────────────┐  │
│  │  Type:    Harmony Link                        │  │
│  │  Status:  ● Connected                         │  │
│  │                                               │  │
│  │  [⚡ Configure Connection]                    │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Sync ────────────────────────────────────────┐  │
│  │  Last Sync:  Apr 4, 2026 at 20:14             │  │
│  │  Status:     ✓ Up to date                     │  │
│  │                                               │  │
│  │  [↻ Sync Settings →]                          │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Account ─────────────────────────────────────┐  │
│  │  [👤]  User Profile                    →      │  │
│  │  [🎨]  Appearance & Theme              →      │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─ Development ─────────────────────────────────┐  │  ← __DEV__ only
│  │  [🧪]  Database Tests                  →      │  │
│  │  [👁]  Database Table Viewer           →      │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Connection type detection helper

In `SettingsScreen.tsx`, add a local function to determine the connection type label from stored credentials. `ConnectionStateManager` stores `harmony_ws_url` / `harmony_wss_url` for Harmony Link connections. Cloud connections will be a future backend type.

```typescript
type ConnectionType = 'Harmony Link' | 'Cloud' | 'Not configured';

const getConnectionType = async (): Promise<ConnectionType> => {
  const wsUrl = await AsyncStorage.getItem('harmony_ws_url');
  const wssUrl = await AsyncStorage.getItem('harmony_wss_url');
  if (wsUrl || wssUrl) return 'Harmony Link';
  // Future: check for cloud token → return 'Cloud'
  return 'Not configured';
};
```

### Step 2: Screen implementation

**File:** `src/screens/SettingsScreen.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Appbar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useSyncConnection } from '../../contexts/SyncConnectionContext';
import { ThemedView } from '../../components/themed/ThemedView';
import { ThemedText } from '../../components/themed/ThemedText';
import { ThemedButton } from '../../components/themed/ThemedButton';
import { SettingsMenu } from '../../components/navigation/SettingsMenu';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ConnectionType = 'Harmony Link' | 'Cloud' | 'Not configured';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();
  const { isConnected, isPaired, isReconnecting } = useSyncConnection();

  const [menuVisible, setMenuVisible] = useState(false);
  const [connectionType, setConnectionType] = useState<ConnectionType>('Not configured');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Never');

  useEffect(() => {
    const loadData = async () => {
      // Connection type
      const wsUrl = await AsyncStorage.getItem('harmony_ws_url');
      const wssUrl = await AsyncStorage.getItem('harmony_wss_url');
      if (wsUrl || wssUrl) {
        setConnectionType('Harmony Link');
      } else {
        setConnectionType('Not configured');
      }

      // Last sync time
      const ts = await AsyncStorage.getItem('last_sync_timestamp');
      if (ts) {
        const date = new Date(parseInt(ts) * 1000);
        setLastSyncTime(date.toLocaleString());
      }
    };
    loadData();
  }, []);

  const connectionStatusText = isConnected
    ? 'Connected'
    : isReconnecting
    ? 'Reconnecting…'
    : isPaired
    ? 'Disconnected'
    : 'Not paired';

  const connectionStatusColor = isConnected
    ? theme.colors.status?.success ?? '#4caf50'
    : isReconnecting || isPaired
    ? theme.colors.status?.warning ?? '#ff9800'
    : theme.colors.status?.error ?? '#f44336';

  const syncStatusText = isConnected ? '✓ Up to date' : '⚠ Offline';

  if (!theme) return null;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.background.surface }]}>
        <Appbar.BackAction color={theme.colors.text.primary} onPress={() => navigation.goBack()} />
        <Appbar.Content
          title="Settings"
          titleStyle={{ color: theme.colors.text.primary, fontWeight: 'bold' }}
        />
        <Appbar.Action
          icon="menu"
          color={theme.colors.text.primary}
          onPress={() => setMenuVisible(true)}
        />
      </Appbar.Header>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Connection Card ── */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.elevated, borderColor: theme.colors.border.default }]}>
          <ThemedText weight="bold" size={14} variant="muted" style={styles.cardTitle}>
            CONNECTION
          </ThemedText>

          <View style={styles.row}>
            <ThemedText variant="secondary">Type</ThemedText>
            <ThemedText weight="semibold">{connectionType}</ThemedText>
          </View>

          <View style={styles.row}>
            <ThemedText variant="secondary">Status</ThemedText>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: connectionStatusColor }]} />
              <ThemedText weight="semibold">{connectionStatusText}</ThemedText>
            </View>
          </View>

          <ThemedButton
            mode="outlined"
            onPress={() => navigation.navigate('ConnectionSetup')}
            style={styles.cardButton}
            icon="connection"
          >
            Configure Connection
          </ThemedButton>
        </View>

        {/* ── Sync Card ── */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.elevated, borderColor: theme.colors.border.default }]}>
          <ThemedText weight="bold" size={14} variant="muted" style={styles.cardTitle}>
            SYNC
          </ThemedText>

          <View style={styles.row}>
            <ThemedText variant="secondary">Last Sync</ThemedText>
            <ThemedText weight="semibold">{lastSyncTime}</ThemedText>
          </View>

          <View style={styles.row}>
            <ThemedText variant="secondary">Status</ThemedText>
            <ThemedText weight="semibold">{syncStatusText}</ThemedText>
          </View>

          <ThemedButton
            mode="outlined"
            onPress={() => navigation.navigate('SyncSettings')}
            style={styles.cardButton}
            icon="sync"
          >
            Sync Settings
          </ThemedButton>
        </View>

        {/* ── Account Card ── */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.elevated, borderColor: theme.colors.border.default }]}>
          <ThemedText weight="bold" size={14} variant="muted" style={styles.cardTitle}>
            ACCOUNT
          </ThemedText>

          <SettingsLinkRow
            icon="account-circle"
            label="User Profile"
            onPress={() => navigation.navigate('ProfileSettings')}
            theme={theme}
          />
          <SettingsLinkRow
            icon="palette"
            label="Appearance & Theme"
            onPress={() => navigation.navigate('ThemeSettings')}
            theme={theme}
            badge="⭐"
          />
        </View>

        {/* ── Development Card (DEV only) ── */}
        {__DEV__ && (
          <View style={[styles.card, { backgroundColor: theme.colors.background.elevated, borderColor: theme.colors.border.default }]}>
            <ThemedText weight="bold" size={14} variant="muted" style={styles.cardTitle}>
              DEVELOPMENT
            </ThemedText>
            <SettingsLinkRow
              icon="test-tube"
              label="Database Tests"
              badge="DEV"
              onPress={() => navigation.navigate('DatabaseTests')}
              theme={theme}
            />
            <SettingsLinkRow
              icon="database-eye"
              label="Database Table Viewer"
              badge="DEV"
              onPress={() => navigation.navigate('DatabaseTableViewer')}
              theme={theme}
            />
          </View>
        )}
      </ScrollView>

      <SettingsMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onNavigate={(screen) => navigation.navigate(screen as any)}
      />
    </ThemedView>
  );
};

// ─── Local helper component ──────────────────────────────────────────────────

interface SettingsLinkRowProps {
  icon: string;
  label: string;
  onPress: () => void;
  theme: any;
  badge?: string;
}

const SettingsLinkRow: React.FC<SettingsLinkRowProps> = ({ icon, label, onPress, theme, badge }) => (
  <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.7}>
    <Icon name={icon} size={22} color={theme.colors.accent.primary} style={styles.linkIcon} />
    <ThemedText style={styles.linkLabel}>{label}</ThemedText>
    {badge && <ThemedText variant="muted" size={12} style={styles.badge}>{badge}</ThemedText>}
    <Icon name="chevron-right" size={20} color={theme.colors.text.muted} />
  </TouchableOpacity>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { elevation: 4 },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardButton: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkIcon: {
    marginRight: 14,
  },
  linkLabel: {
    flex: 1,
    fontSize: 15,
  },
  badge: {
    marginRight: 8,
  },
});
```

---

## Progress Checklist

- [ ] Create `src/screens/SettingsScreen.tsx`
- [ ] Verify `AsyncStorage` key `'last_sync_timestamp'` matches what `SyncService` writes (check `SyncSettingsScreen.tsx` for reference)
- [ ] Verify `AsyncStorage` keys `'harmony_ws_url'` / `'harmony_wss_url'` match `ConnectionStateManager.STORAGE_KEYS`
- [ ] Test: Connection card shows correct type (`Harmony Link` vs `Not configured`)
- [ ] Test: Connection status dot updates correctly when connection state changes
- [ ] Test: Last sync time displays correctly
- [ ] Test: All navigation links work (ConnectionSetup, SyncSettings, ProfileSettings, ThemeSettings)
- [ ] Test: DEV card only visible in `__DEV__` mode
- [ ] Test: SettingsMenu works from SettingsScreen
