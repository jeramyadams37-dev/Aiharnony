# Phase 2: Navigation Restructure

## Objective
Replace the `BottomNavigator` with a flat stack-based hub-and-spoke navigation. `LandingScreen` becomes the initial route. All existing and new screens are registered in `AppNavigator`. `BottomNavigator.tsx` is deleted.

## Files to Modify
- `src/navigation/AppNavigator.tsx` — major rewrite

## Files to Delete
- `src/navigation/BottomNavigator.tsx`

---

## Current Navigation Structure

```
AppNavigator (NativeStackNavigator)
  └── "Main"  →  BottomNavigator (BottomTabNavigator)
        ├── "ChatList"       → ChatListScreen
        ├── "Characters"     → CharactersScreen (stub)
        └── "AIConfig"       → AIConfigScreen (stub)
  └── "ChatDetail"           → ChatDetailScreen
  └── "ConnectionSetup"      → ConnectionSetupScreen
  └── "SyncSettings"         → SyncSettingsScreen
  └── "ThemeSettings"        → ThemeSettingsScreen
  └── "ThemeEditor"          → ThemeEditorScreen
  └── "ProfileSettings"      → ProfileSettingsScreen
  └── "DatabaseTests"        → DatabaseTestScreen (DEV)
  └── "DatabaseTableViewer"  → DatabaseTableViewerScreen (DEV)
```

## Target Navigation Structure

```
AppNavigator (NativeStackNavigator)
  └── "Landing"              → LandingScreen          [NEW - initial route]
  └── "ChatList"             → ChatListScreen          [moved from bottom tabs]
  └── "ChatDetail"           → ChatDetailScreen        [existing]
  └── "Characters"           → CharactersScreen        [moved from bottom tabs]
  └── "CharacterProfileEdit" → CharacterProfileEditScreen  [NEW]
  └── "CreateAI"             → CreateAIScreen          [NEW]
  └── "EntityConfig"         → EntityConfigScreen      [NEW - replaces AIConfig]
  └── "EntityConfigEdit"     → EntityConfigEditScreen  [NEW]
  └── "Settings"             → SettingsScreen          [NEW]
  └── "ConnectionSetup"      → ConnectionSetupScreen   [existing]
  └── "SyncSettings"         → SyncSettingsScreen      [existing]
  └── "ThemeSettings"        → ThemeSettingsScreen     [existing]
  └── "ThemeEditor"          → ThemeEditorScreen       [existing]
  └── "ProfileSettings"      → ProfileSettingsScreen   [existing]
  └── "DatabaseTests"        → DatabaseTestScreen      [existing, DEV]
  └── "DatabaseTableViewer"  → DatabaseTableViewerScreen [existing, DEV]
```

---

## Implementation Steps

### Step 1: Update `RootStackParamList` type

**File:** `src/navigation/AppNavigator.tsx`

Replace the existing `RootStackParamList` with:

```typescript
export type RootStackParamList = {
  // Hub
  Landing: undefined;

  // Chat section
  ChatList: undefined;
  ChatDetail: { entityId: string };

  // Characters section
  Characters: undefined;
  CharacterProfileEdit: { profileId?: string }; // undefined = create new

  // Entity / AI Config section (not on Landing, accessed contextually)
  CreateAI: { prefillProfileId?: string };       // optional: pre-fill with a character profile
  EntityConfig: undefined;
  EntityConfigEdit: { entityId?: string };       // undefined = create new

  // Settings section
  Settings: undefined;
  ConnectionSetup: undefined;
  SyncSettings: undefined;
  ThemeSettings: undefined;
  ThemeEditor: { themeId: string };
  ProfileSettings: undefined;

  // Development (DEV only)
  DatabaseTests: undefined;
  DatabaseTableViewer: undefined;
};
```

### Step 2: Update imports

Add imports for all new screens (stubs can be created temporarily):

```typescript
import { LandingScreen } from '../screens/LandingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CreateAIScreen } from '../screens/CreateAIScreen';
import { EntityConfigScreen } from '../screens/EntityConfigScreen';
import { EntityConfigEditScreen } from '../screens/EntityConfigEditScreen';
import { CharacterProfileEditScreen } from '../screens/CharacterProfileEditScreen';
```

Remove:
```typescript
// Remove:
import { BottomNavigator } from './BottomNavigator';
```

### Step 3: Register all screens in the navigator

```typescript
const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Landing"
      screenOptions={{ headerShown: false }}
    >
      {/* Hub */}
      <Stack.Screen name="Landing" component={LandingScreen} />

      {/* Chat */}
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="ChatDetail" component={ChatDetailScreen} />

      {/* Characters */}
      <Stack.Screen name="Characters" component={CharactersScreen} />
      <Stack.Screen name="CharacterProfileEdit" component={CharacterProfileEditScreen} />

      {/* Entity / AI Config */}
      <Stack.Screen name="CreateAI" component={CreateAIScreen} />
      <Stack.Screen name="EntityConfig" component={EntityConfigScreen} />
      <Stack.Screen name="EntityConfigEdit" component={EntityConfigEditScreen} />

      {/* Settings */}
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="ConnectionSetup" component={ConnectionSetupScreen} />
      <Stack.Screen name="SyncSettings" component={SyncSettingsScreen} />
      <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} />
      <Stack.Screen name="ThemeEditor" component={ThemeEditorScreen} />
      <Stack.Screen name="ProfileSettings" component={ProfileSettingsScreen} />

      {/* Development */}
      {__DEV__ && (
        <>
          <Stack.Screen name="DatabaseTests" component={DatabaseTestScreen} />
          <Stack.Screen name="DatabaseTableViewer" component={DatabaseTableViewerScreen} />
        </>
      )}
    </Stack.Navigator>
  );
};
```

### Step 4: Stub new screens temporarily

Before implementing each screen's full UI, create minimal stubs so the app compiles immediately after Phase 2:

**`src/screens/LandingScreen.tsx`** (stub):
```typescript
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const LandingScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Landing (stub)</Text>
      <TouchableOpacity onPress={() => navigation.navigate('ChatList')}>
        <Text>AI Chat</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Characters')}>
        <Text>Characters</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
        <Text>Settings</Text>
      </TouchableOpacity>
    </View>
  );
};
```

Similarly create stubs for `SettingsScreen`, `CreateAIScreen`, `EntityConfigScreen`, `EntityConfigEditScreen`, `CharacterProfileEditScreen`.

### Step 5: Update `ChatListScreen` navigation calls

`ChatListScreen` currently uses `navigation.navigate('Main')` patterns inherited from the BottomNavigator. Update any such references to use the new flat route names. Search for:
- `navigate('Main')` → replace with `navigate('Landing')`
- `navigate('AIConfig')` → replace with `navigate('EntityConfig')`
- Any tab-specific navigation calls

### Step 6: Update `SettingsMenu` navigation targets

The `SettingsMenu` component uses string screen names for navigation. Update the `menuSections` config:
- `'PrivacySettings'` → remove (not yet implemented, keep as-is or remove item)
- `'NotificationSettings'` → remove (not yet implemented)
- `'About'` → remove (not yet implemented)
- `'Help'` → remove (not yet implemented)
- **Add** navigation items (see Phase 4 for full details)

### Step 7: Delete BottomNavigator

Delete `src/navigation/BottomNavigator.tsx`. Remove the `@react-navigation/bottom-tabs` imports from AppNavigator (if it was there).

> **Note:** Check `package.json` if `@react-navigation/bottom-tabs` is a dependency. If the app no longer uses it after this change, it can be removed, but this is optional and can be deferred.

---

## Progress Checklist

- [ ] Update `RootStackParamList` type in `src/navigation/AppNavigator.tsx`
- [ ] Update imports (add new screens, remove BottomNavigator)
- [ ] Rewrite `Stack.Navigator` to register all screens with `Landing` as `initialRouteName`
- [ ] Create minimal stubs for: `LandingScreen`, `SettingsScreen`, `CreateAIScreen`, `EntityConfigScreen`, `EntityConfigEditScreen`, `CharacterProfileEditScreen`
- [ ] Update `ChatListScreen` to remove BottomNavigator-specific navigation calls
- [ ] Verify app compiles and `LandingScreen` stub renders as root
- [ ] Delete `src/navigation/BottomNavigator.tsx`
