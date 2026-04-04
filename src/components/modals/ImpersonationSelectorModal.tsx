import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Modal, Portal, Avatar, List, Button, Divider, ActivityIndicator } from 'react-native-paper';
import { useAppTheme } from '../../contexts/ThemeContext';
import { ThemedView } from '../themed/ThemedView';
import { ThemedText } from '../themed/ThemedText';
import { getAllEntities } from '../../database/repositories/entities';
import { getCharacterProfile, getPrimaryImage, imageToDataURL } from '../../database/repositories/characters';
import { Entity } from '../../database/models';
import { createLogger } from '../../utils/logger';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const log = createLogger('[ImpersonationSelectorModal]');

interface ImpersonationSelectorModalProps {
  visible: boolean;
  onSelect: (entityId: string) => void;
  onCancel: () => void;
  preSelectedEntityId?: string;
}

interface EntityDisplayItem {
  entityId: string;
  characterName: string;
  avatarUri: string | null;
}

const determineDefaultEntity = (
  entities: Entity[],
  preSelectedEntityId?: string
): string | null => {
  if (entities.length === 0) return null;

  if (preSelectedEntityId) {
    const isValid = entities.some(e => e.id === preSelectedEntityId);
    if (isValid) return preSelectedEntityId;
  }

  const userEntity = entities.find(e => e.id === 'user');
  if (userEntity) return userEntity.id;

  return entities[0].id;
};

export const ImpersonationSelectorModal: React.FC<ImpersonationSelectorModalProps> = ({
  visible,
  onSelect,
  onCancel,
  preSelectedEntityId,
}) => {
  const theme = useAppTheme();
  const [entities, setEntities] = useState<EntityDisplayItem[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadEntities();
    }
  }, [visible]);

  const loadEntities = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const allEntities = await getAllEntities();
      // No filter — show all entities
      
      if (allEntities.length === 0) {
        setError('No entities available. Please create a user entity first.');
        setLoading(false);
        return;
      }
      
      // Load display information for each entity
      const displayItems: EntityDisplayItem[] = [];
      for (const entity of allEntities) {
        let characterName = entity.id;
        let avatarUri: string | null = null;
        
        if (entity.character_profile_id) {
          const profile = await getCharacterProfile(entity.character_profile_id);
          if (profile) {
            characterName = profile.name;
          }
          const image = await getPrimaryImage(entity.character_profile_id);
          if (image) {
            avatarUri = imageToDataURL(image);
          }
        }
        
        displayItems.push({
          entityId: entity.id,
          characterName,
          avatarUri,
        });
      }
      
      setEntities(displayItems);
      
      // Determine default selection
      const defaultId = determineDefaultEntity(allEntities, preSelectedEntityId);
      setSelectedEntityId(defaultId);
    } catch (err) {
      log.error('Failed to load entities:', err);
      setError('Failed to load entities. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderEntityItem = ({ item }: { item: EntityDisplayItem }) => (
    <TouchableOpacity onPress={() => setSelectedEntityId(item.entityId)}>
      <List.Item
        title={item.characterName}
        description={`Entity ID: ${item.entityId}`}
        left={() => (
          item.avatarUri ? (
            <Avatar.Image size={40} source={{ uri: item.avatarUri }} />
          ) : (
            <Avatar.Text 
              size={40} 
              label={item.characterName.substring(0, 2).toUpperCase()} 
            />
          )
        )}
        right={() => (
          selectedEntityId === item.entityId && (
            <Icon name="check-circle" size={24} color={theme?.theme?.colors.accent.primary} />
          )
        )}
        style={[
          styles.listItem,
          selectedEntityId === item.entityId && {
            backgroundColor: theme?.theme?.colors.background.elevated,
          },
        ]}
      />
      <Divider />
    </TouchableOpacity>
  );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme?.theme?.colors.background.surface },
        ]}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText variant="primary" style={styles.title}>
              Chatting As
            </ThemedText>
            <ThemedText variant="secondary" size={14}>
              Select the persona you want to use across all chats
            </ThemedText>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Icon name="alert-circle" size={48} color={theme?.theme?.colors.status.error} />
              <ThemedText variant="secondary" style={styles.errorText}>
                {error}
              </ThemedText>
              <Button mode="contained" onPress={onCancel}>
                Close
              </Button>
            </View>
          ) : (
            <>
              <FlatList
                data={entities}
                renderItem={renderEntityItem}
                keyExtractor={item => item.entityId}
                style={styles.list}
                ItemSeparatorComponent={null}
              />
              
              {/* Actions */}
              <View style={styles.actions}>
                <Button 
                  mode="outlined" 
                  onPress={onCancel}
                  style={styles.button}
                >
                  Cancel
                </Button>
                <Button 
                  mode="contained" 
                  onPress={() => {
                    if (selectedEntityId) {
                      onSelect(selectedEntityId);
                    }
                  }}
                  disabled={!selectedEntityId}
                  style={styles.button}
                >
                  Confirm
                </Button>
              </View>
            </>
          )}
        </ThemedView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '80%',
  },
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    marginVertical: 16,
    textAlign: 'center',
  },
  list: {
    maxHeight: 300,
  },
  listItem: {
    paddingVertical: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    gap: 12,
  },
  button: {
    minWidth: 100,
  },
});