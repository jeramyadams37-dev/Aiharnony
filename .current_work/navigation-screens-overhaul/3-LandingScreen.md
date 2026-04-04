# Phase 3: Landing Screen

## Objective
Implement the `LandingScreen` as the app root hub. It presents three large action cards (AI Chat, Characters, Settings), a connection status badge in the header, and a settings icon button. This is the first screen users see on app launch.

## Files to Create
- `src/screens/LandingScreen.tsx`
- `src/components/landing/LandingCard.tsx`
- `src/components/settings/ConnectionStatusBadge.tsx`

## Files to Reference (for theming patterns)
- `src/components/themed/ThemedView.tsx`
- `src/components/themed/ThemedText.tsx`
- `src/components/themed/ThemedCard.tsx`
- `src/components/themed/ThemedGradient.tsx`
- `src/contexts/SyncConnectionContext.tsx`
- `src/contexts/ThemeContext.tsx`

---

## Visual Design

```
┌─────────────────────────────────────────────────────┐
│  Harmony AI                              [⚙]  [●]   │  ← header bar
│  ─────────────────────────────────────────────────  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  [💬 icon]                                    │  │
│  │  AI Chat                                      │  │
│  │  Continue your conversations with AI          │  │
│  │  partners                                     │  │  ← large card, primary gradient
│  │                                    [  →  ]    │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌─────────────────────┐  ┌────────────────────┐    │
│  │  [👤 icon]          │  │  [⚙ icon]          │    │
│  │  Characters         │  │  Settings           │    │  ← two smaller side-by-side cards
│  │  Manage AI char-    │  │  Connection, sync   │    │
│  │  acter profiles     │  │  & account          │    │
│  │             [→]     │  │              [→]    │    │
│  └─────────────────────┘  └────────────────────┘    │
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Version x.x.x                                       │  ← footer
└─────────────────────────────────────────────────────┘
```

**Layout rationale:**
- AI Chat is the most-used feature → gets a full-width hero card with prominent gradient
- Characters and Settings are equally secondary → two equal half-width cards
- Version in footer (subtle muted text)
- Connection status badge (●) in the top-right header — green=connected, amber=reconnecting/paired-not-connected, red=disconnected/unpaired

---

## Component: `ConnectionStatusBadge`

**File:** `src/components/settings/ConnectionStatusBadge.tsx`

```typescript
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSyncConnection } from '../../contexts/SyncConnectionContext';
import { useAppTheme } from '../../contexts/ThemeContext';

/**
 * Small colored dot indicating current connection state.
 * Green = connected, Amber = reconnecting or paired-not-connected, Red = not paired.
 */
export const ConnectionStatusBadge: React.FC = () => {
  const { isConnected, isPaired, isReconnecting } = useSyncConnection();
  const { theme } = useAppTheme();

  const color = isConnected
    ? theme.colors.status?.success ?? '#4caf50'
    : isReconnecting || isPaired
    ? theme.colors.status?.warning ?? '#ff9800'
    : theme.colors.status?.error ?? '#f44336';

  return (
    <View style={[styles.badge, { backgroundColor: color }]} />
  );
};

const styles = StyleSheet.create({
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 8,
  },
});
```

> **Note:** If `theme.colors.status` is not yet defined in the theme schema, use hardcoded fallback colors as shown above. Add `status.success/warning/error` to the theme system as a follow-up.

---

## Component: `LandingCard`

**File:** `src/components/landing/LandingCard.tsx`

```typescript
import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedText } from '../themed/ThemedText';

interface LandingCardProps {
  icon: string;          // MaterialCommunityIcons name
  title: string;
  description: string;
  onPress: () => void;
  variant?: 'hero' | 'secondary';  // hero = full-width prominent, secondary = half-width
  style?: ViewStyle;
}

export const LandingCard: React.FC<LandingCardProps> = ({
  icon, title, description, onPress, variant = 'secondary', style,
}) => {
  const { theme } = useAppTheme();

  const isHero = variant === 'hero';

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isHero ? styles.heroCard : styles.secondaryCard,
        {
          backgroundColor: theme.colors.background.elevated,
          borderColor: theme.colors.border.default,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent.primary + '22' }]}>
        <Icon name={icon} size={isHero ? 36 : 28} color={theme.colors.accent.primary} />
      </View>

      {/* Text */}
      <View style={styles.textContainer}>
        <ThemedText weight="bold" size={isHero ? 20 : 16} style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText variant="secondary" size={isHero ? 14 : 12} style={styles.description}>
          {description}
        </ThemedText>
      </View>

      {/* Arrow */}
      <View style={styles.arrowContainer}>
        <Icon name="chevron-right" size={20} color={theme.colors.text.muted} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  heroCard: {
    width: '100%',
    minHeight: 100,
  },
  secondaryCard: {
    flex: 1,
    minHeight: 120,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 4,
  },
  description: {
    lineHeight: 18,
  },
  arrowContainer: {
    alignSelf: 'flex-end',
  },
});
```

---

## Screen: `LandingScreen`

**File:** `src/screens/LandingScreen.tsx`

```typescript
import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppTheme } from '../contexts/ThemeContext';
import { ThemedView } from '../components/themed/ThemedView';
import { ThemedText } from '../components/themed/ThemedText';
import { LandingCard } from '../components/landing/LandingCard';
import { ConnectionStatusBadge } from '../components/settings/ConnectionStatusBadge';
import { ThemedGradient } from '../components/themed/ThemedGradient';
import { getAppVersion } from '../utils/version'; // see note below

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const LandingScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { theme } = useAppTheme();

  if (!theme) return null;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <Appbar.Header style={[styles.header, { backgroundColor: theme.colors.background.surface }]}>
        <Appbar.Content
          title="Harmony AI"
          titleStyle={{ color: theme.colors.text.primary, fontWeight: 'bold', fontSize: 20 }}
        />
        {/* Connection status dot */}
        <ConnectionStatusBadge />
        {/* Settings shortcut */}
        <Appbar.Action
          icon="cog"
          color={theme.colors.text.primary}
          onPress={() => navigation.navigate('Settings')}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Optional branded gradient stripe at the top */}
        <ThemedGradient style={styles.gradientAccent} />

        {/* Hero: AI Chat card */}
        <LandingCard
          icon="chat-processing"
          title="AI Chat"
          description="Continue your conversations with AI partners"
          variant="hero"
          onPress={() => navigation.navigate('ChatList')}
          style={styles.heroCard}
        />

        {/* Secondary row: Characters + Settings */}
        <View style={styles.secondaryRow}>
          <LandingCard
            icon="account-group"
            title="Characters"
            description="Manage AI character profiles"
            variant="secondary"
            onPress={() => navigation.navigate('Characters')}
          />
          <LandingCard
            icon="tune"
            title="Settings"
            description="Connection, sync & account"
            variant="secondary"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText variant="muted" size={11}>
            Harmony AI · v{getAppVersion()}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    elevation: 0,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
  },
  gradientAccent: {
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  heroCard: {
    marginBottom: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
});
```

> **Note on `getAppVersion()`:** Create `src/utils/version.ts` as a simple helper:
> ```typescript
> import { version } from '../../package.json';
> export const getAppVersion = () => version;
> ```

---

## Progress Checklist

- [ ] Create `src/components/settings/ConnectionStatusBadge.tsx`
- [ ] Create `src/components/landing/LandingCard.tsx`
- [ ] Create `src/screens/LandingScreen.tsx`
- [ ] Create `src/utils/version.ts`
- [ ] Verify `ThemedGradient` usage is consistent with existing pattern in `src/components/themed/ThemedGradient.tsx`
- [ ] Test: LandingScreen renders correctly with all 3 cards
- [ ] Test: Connection badge shows correct color per connection state
- [ ] Test: Each card navigates to the correct screen
- [ ] Test: Settings icon in header navigates to SettingsScreen
