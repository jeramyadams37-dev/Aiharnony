import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ToastAndroid,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  Modal,
  View,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Appbar, Avatar } from 'react-native-paper';
import { ThemedAppbar } from '../components/themed/ThemedAppbar';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppTheme } from '../contexts/ThemeContext';
import { ThemedView } from '../components/themed/ThemedView';
import { ThemedText } from '../components/themed/ThemedText';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatInput, ChatInputRef } from '../components/chat/ChatInput';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { NewMessagesDivider } from '../components/chat/NewMessagesDivider';
import { EmojiPickerInline } from '../components/emoji/EmojiPickerInline';
import EntityEmojiActionService from '../services/EntityEmojiActionService';
import { EmojiEntry } from '../types/emoji';
import { useEntitySession } from '../contexts/EntitySessionContext';
import EntitySessionService from '../services/EntitySessionService'; // Still needed for event listeners
import {
  getConversationMessagesByParticipantKey,
  getRecentConversationMessages,
  updateConversationMessage,
  getConversationMessage,
  deleteConversationMessage,
} from '../database/repositories/conversation_messages';
import {
  getPrimaryImage,
  getCharacterProfile,
  imageToDataURL,
} from '../database/repositories/characters';
import { getAllEntities } from '../database/repositories/entities';
import { deleteEntity } from '../database/repositories/entities';
import { useSyncConnection } from '../contexts/SyncConnectionContext';
import ChatPreferencesService from '../services/ChatPreferencesService';
import { createLogger } from '../utils/logger';
import { ConversationMessage } from '../database/models';
import { getInteractionById } from '../database/repositories/interactions';

const log = createLogger('[ChatDetailScreen]');

type Props = NativeStackScreenProps<RootStackParamList, 'ChatDetail'>;

export const ChatDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    interactionId: routeInteractionId,
    participantKey: routeParticipantKey,
    participantIds: routeParticipantIds,
    entityId: ownEntityId,
    entityName: routeEntityName,
  } = route.params;
  const { theme } = useAppTheme();
  const { isConnected } = useSyncConnection();
  const { isSessionActive, startInteractionSession, stopInteractionSession } =
    useEntitySession();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [partnerName, setPartnerName] = useState<string>('Chat');
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number>(0);
  const [failedTranscriptions, setFailedTranscriptions] = useState<Set<string>>(
    new Set(),
  );

  // Resolve participant info for header
  const [participantIds, setParticipantIds] = useState<string[]>(
    routeParticipantIds || [ownEntityId]
  );
  const [participantKey, setParticipantKey] = useState<string>(
    routeParticipantKey || ''
  );

  const chatInputRef = useRef<ChatInputRef>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const flatListRef = useRef<FlatList<any>>(null);
  const sessionDividerTimestamp = useRef<number>(0);
  const isInitialScrollDone = useRef(false);
  const isNearBottom = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isReadyToShow, setIsReadyToShow] = useState(false);
  const isReadyToShowRef = useRef(false);
  const messagesCountAtReveal = useRef(0);
  const pendingOwnMessageScroll = useRef(false);
  const loadedMessagesRef = useRef<ConversationMessage[]>([]);
  const lastReadTimestampRef = useRef<number>(0);
  const [showDivider, setShowDivider] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [replyMode, setReplyMode] = useState<string>('realistic');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [headerName, setHeaderName] = useState<string>('Chat');

  // Derive participantKey if not provided (for group chats or new)
  useEffect(() => {
    if (!participantKey && participantIds.length > 0) {
      // Derive from participantIds and ownEntityId
      const scope = participantIds.length <= 2 ? 'private' : 'group';
      const otherIds = participantIds.filter(id => id !== ownEntityId);
      if (scope === 'private' && otherIds.length > 0) {
        const partnerId = otherIds[0];
        const key = ownEntityId < partnerId
          ? `${ownEntityId}+${partnerId}`
          : `${partnerId}+${ownEntityId}`;
        setParticipantKey(key);
      } else if (scope === 'group') {
        const key = [...participantIds].sort().join('+');
        setParticipantKey(key);
      }
    }
  }, [participantKey, participantIds, ownEntityId]);

  // Derive isGroupChat from participantIds
  useEffect(() => {
    if (participantIds.length > 2) {
      setIsGroupChat(true);
    }
  }, [participantIds]);

  // Resolve header display name per D-11
  useEffect(() => {
    const resolveHeaderName = async () => {
      if (routeEntityName) {
        setHeaderName(routeEntityName);
        setPartnerName(routeEntityName);
        return;
      }

      if (isGroupChat) {
        // Group chat: show participant names inline per D-11
        const otherIds = participantIds.filter(id => id !== ownEntityId);
        const allEntities = await getAllEntities();
        const entityMap = new Map(allEntities.map(e => [e.id, e]));
        const names: string[] = [];

        for (const pid of otherIds) {
          const entity = entityMap.get(pid);
          if (entity?.character_profile_id) {
            const profile = await getCharacterProfile(entity.character_profile_id);
            if (profile) {
              names.push(profile.name);
              continue;
            }
          }
          names.push(pid);
        }

        const displayName = names.join(', ');
        setHeaderName(displayName);
        setPartnerName(displayName);

        // Set avatar from first participant
        if (otherIds.length > 0) {
          const firstEntity = entityMap.get(otherIds[0]);
          if (firstEntity?.character_profile_id) {
            const image = await getPrimaryImage(firstEntity.character_profile_id);
            if (image) {
              setPartnerAvatar(imageToDataURL(image));
            }
          }
        }
      } else {
        // Private chat: load partner info
        const otherIds = participantIds.filter(id => id !== ownEntityId);
        const partnerEntityId = otherIds[0] || '';
        setPartnerName(partnerEntityId);

        const allEntities = await getAllEntities();
        const entity = allEntities.find(e => e.id === partnerEntityId);
        if (entity?.character_profile_id) {
          const profile = await getCharacterProfile(entity.character_profile_id);
          if (profile) {
            setPartnerName(profile.name);
            setHeaderName(profile.name);
          }
          const image = await getPrimaryImage(entity.character_profile_id);
          if (image) {
            setPartnerAvatar(imageToDataURL(image));
          }
        }
      }
    };

    resolveHeaderName();
  }, [ownEntityId, participantIds, isGroupChat, routeEntityName]);

  // Load reply mode preference
  useEffect(() => {
    const loadReplyMode = async () => {
      const savedMode = await ChatPreferencesService.getReplyMode(routeInteractionId);
      if (savedMode) {
        setReplyMode(savedMode);
      }
    };
    loadReplyMode();
  }, [routeInteractionId]);

  // Load messages and last-read timestamp
  useEffect(() => {
    const loadMessagesAndTimestamp = async () => {
      try {
        setLoading(true);

        if (!participantKey) {
          setLoading(false);
          return;
        }

        const existingMessages = await getRecentConversationMessages(
          ownEntityId,
          participantKey,
          50,
        );
        setMessages(existingMessages);
        loadedMessagesRef.current = existingMessages;

        // Detect stuck transcriptions (messages with audio but no text that aren't actively transcribing)
        const stuckTranscriptions = existingMessages
          .filter(
            msg =>
              msg.audio_data &&
              msg.audio_data.length > 0 &&
              (!msg.content || msg.content.trim().length === 0) &&
              msg.sender_entity_id === ownEntityId,
          )
          .map(msg => msg.id);

        if (stuckTranscriptions.length > 0) {
          log.info(
            `Found ${stuckTranscriptions.length} stuck transcriptions on load`,
          );
          setFailedTranscriptions(new Set(stuckTranscriptions));
        }

        const timestamp =
          await ChatPreferencesService.getLastReadTimestamp(routeInteractionId);
        setLastReadTimestamp(timestamp);
        lastReadTimestampRef.current = timestamp;
        sessionDividerTimestamp.current = timestamp;
      } catch (error) {
        log.error('Failed to load messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessagesAndTimestamp();
  }, [routeInteractionId, participantKey, ownEntityId]);

  // Keep stable refs in sync with state
  useEffect(() => {
    loadedMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    lastReadTimestampRef.current = lastReadTimestamp;
  }, [lastReadTimestamp]);

  // Session lifecycle – stop session only when the screen unmounts
  useEffect(() => {
    return () => {
      log.info(`Screen unmounting – stopping session for ${routeInteractionId}`);
      stopInteractionSession(routeInteractionId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeInteractionId]);

  // Session initialization – (re)start the session when sync connection becomes available
  useEffect(() => {
    let mounted = true;

    if (!isConnected) {
      return;
    }

    const initializeSession = async () => {
      try {
        log.info(`Initializing interaction session for ${routeInteractionId}...`);
        // Load reply mode right before starting session
        const savedMode = await ChatPreferencesService.getReplyMode(routeInteractionId);
        setReplyMode(savedMode || 'realistic');
        await startInteractionSession(ownEntityId, participantIds, savedMode || 'realistic');
      } catch (error: any) {
        if (!mounted) return;

        log.error('Failed to initialize entity session:', error);

        const errorMessage = error?.message || 'Unknown error';
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            `Failed to start chat session: ${errorMessage}`,
            ToastAndroid.LONG,
          );
        } else {
          Alert.alert(
            'Connection Error',
            `Could not establish chat session: ${errorMessage}`,
            [{ text: 'OK' }],
          );
        }
      }
    };

    initializeSession();

    return () => {
      mounted = false;
    };
  }, [routeInteractionId, ownEntityId, participantIds, isConnected]);

  // Listen for new messages and typing indicator
  useEffect(() => {
    const handleNewMessage = (receivedInteractionId: string) => {
      if (receivedInteractionId === routeInteractionId) {
        // Reload messages from database
        if (participantKey) {
          getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          ).then(setMessages);
        }
      }
    };

    const handleTyping = (
      receivedInteractionId: string,
      senderId: string,
      isTypingActive: boolean,
    ) => {
      if (
        receivedInteractionId === routeInteractionId &&
        (senderId !== ownEntityId || senderId === '')
      ) {
        setIsTyping(isTypingActive);
        if (isTypingActive) setIsRecording(false);
      }
    };

    const handleRecording = (
      receivedInteractionId: string,
      senderId: string,
      isRecordingActive: boolean,
    ) => {
      if (
        receivedInteractionId === routeInteractionId &&
        (senderId !== ownEntityId || senderId === '')
      ) {
        setIsRecording(isRecordingActive);
        if (isRecordingActive) setIsTyping(false);
      }
    };

    // Cleanup indicators when session becomes inactive
    if (!isSessionActive(routeInteractionId)) {
      setIsTyping(false);
      setIsRecording(false);
    }

    const handleTranscriptionCompleted = (
      receivedInteractionId: string,
      messageId: string,
      text: string,
    ) => {
      if (receivedInteractionId === routeInteractionId) {
        log.info(`Transcription completed for message ${messageId}: "${text}"`);
        setFailedTranscriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });
        if (participantKey) {
          getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          ).then(updatedMessages => {
            pendingOwnMessageScroll.current = true;
            setMessages(updatedMessages);
          });
        }
      }
    };

    const handleTranscriptionFailed = (
      receivedInteractionId: string,
      messageId: string,
    ) => {
      if (receivedInteractionId === routeInteractionId) {
        log.warn(`Transcription failed for message ${messageId}`);
        setFailedTranscriptions(prev => new Set(prev).add(messageId));
        if (participantKey) {
          getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          ).then(setMessages);
        }
      }
    };

    const handleIncomingMessageEdit = (receivedInteractionId: string) => {
      if (receivedInteractionId === routeInteractionId) {
        if (participantKey) {
          getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          ).then(setMessages);
        }
      }
    };

    EntitySessionService.on('message:received', handleNewMessage);
    EntitySessionService.on('message:edited', handleIncomingMessageEdit);
    EntitySessionService.on('typing:indicator', handleTyping);
    EntitySessionService.on('recording:indicator', handleRecording);
    EntitySessionService.on(
      'transcription:completed',
      handleTranscriptionCompleted,
    );
    EntitySessionService.on('transcription:failed', handleTranscriptionFailed);

    return () => {
      EntitySessionService.off('message:received', handleNewMessage);
      EntitySessionService.off('message:edited', handleIncomingMessageEdit);
      EntitySessionService.off('typing:indicator', handleTyping);
      EntitySessionService.off('recording:indicator', handleRecording);
      EntitySessionService.off(
        'transcription:completed',
        handleTranscriptionCompleted,
      );
      EntitySessionService.off(
        'transcription:failed',
        handleTranscriptionFailed,
      );
    };
  }, [routeInteractionId, ownEntityId, participantKey]);

  // Listen for session errors
  useEffect(() => {
    const handleSessionError = (errorInteractionId: string, error: string) => {
      if (errorInteractionId === routeInteractionId) {
        log.error(`Session error for ${routeInteractionId}:`, error);

        if (Platform.OS === 'android') {
          ToastAndroid.show(`Chat session error: ${error}`, ToastAndroid.LONG);
        } else {
          Alert.alert('Session Error', error, [{ text: 'OK' }]);
        }
      }
    };

    EntitySessionService.on('session:error', handleSessionError);

    return () => {
      EntitySessionService.off('session:error', handleSessionError);
    };
  }, [routeInteractionId]);

  // Seed emoji action defaults when session becomes active
  useEffect(() => {
    if (routeInteractionId && isSessionActive(routeInteractionId)) {
      // Use interactionId as the key for emoji defaults
      EntityEmojiActionService.seedDefaults(routeInteractionId).catch(err => {
        log.warn('Failed to seed emoji action defaults:', err);
      });
    }
  }, [routeInteractionId, isSessionActive]);

  const handleSendText = useCallback(
    async (text: string) => {
      if (!text.trim() || !isSessionActive(routeInteractionId)) {
        log.warn('Cannot send message: session not active');
        return;
      }

      try {
        // Resolve emoji actions
        let sendText = text.trim();
        let additionalEffects = null;

        const resolved = await EntityEmojiActionService.resolveMessageActions(
          routeInteractionId,
          sendText,
        );

        if (resolved.hasActions) {
          sendText = resolved.substitutedText;
          additionalEffects = resolved.effects;
          log.info(`Resolved emoji actions: ${resolved.effects.emotionEffects.length} effects`);
        }

        await EntitySessionService.sendTextMessage(
          routeInteractionId,
          sendText,
          additionalEffects,
        );

        // Optimistically reload from database
        if (participantKey) {
          const updatedMessages = await getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          );
          pendingOwnMessageScroll.current = true;
          setMessages(updatedMessages);
        }
      } catch (error) {
        log.error('Failed to send message:', error);
      }
    },
    [routeInteractionId, ownEntityId, participantKey, isSessionActive],
  );

  const handleEmojiSelected = useCallback((emoji: EmojiEntry) => {
    chatInputRef.current?.insertEmoji(emoji.native);
  }, []);

  const handleSendAudio = useCallback(
    async (audioData: string, duration: number) => {
      if (!isSessionActive(routeInteractionId)) return;

      try {
        await EntitySessionService.newAudioMessage(
          routeInteractionId,
          audioData,
          'audio/wav',
          duration,
        );

        log.info('Audio message saved, awaiting transcription...');

        if (participantKey) {
          const updatedMessages = await getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          );
          pendingOwnMessageScroll.current = true;
          setMessages(updatedMessages);
        }
      } catch (error) {
        log.error('Failed to save audio message:', error);
      }
    },
    [routeInteractionId, ownEntityId, participantKey, isSessionActive],
  );

  const handleConfirmAndSendMessage = useCallback(
    async (messageId: string, finalText: string) => {
      if (!isSessionActive(routeInteractionId)) {
        log.warn('Cannot send message: session not active');
        return;
      }

      try {
        const message = await getConversationMessage(messageId);
        if (!message || !message.audio_data) {
          throw new Error('Message not found or has no audio');
        }

        const base64Audio = message.audio_data;

        // Resolve emoji actions in the text
        let sendText = finalText;
        let additionalEffects = null;

        const resolved = await EntityEmojiActionService.resolveMessageActions(
          routeInteractionId,
          sendText,
        );

        if (resolved.hasActions) {
          sendText = resolved.substitutedText;
          additionalEffects = resolved.effects;
        }

        // Update message with final text and change type to 'combined'
        const updates: any = { message_type: 'combined' };
        if (sendText !== message.content) {
          updates.content = sendText;
        }
        await updateConversationMessage(messageId, updates);

        // Use InteractionSession to send to ALL partner connections
        const session = EntitySessionService.getInteractionSession(routeInteractionId);
        if (session) {
          const utterance: any = {
            entity_id: session.ownEntityId,
            content: sendText,
            type: 'UTTERANCE_COMBINED',
            audio: base64Audio,
            audio_type: message.audio_mime_type || 'audio/wav',
            audio_duration: message.audio_duration || 0,
            message_id: messageId,
          };

          if (additionalEffects) {
            utterance.additional_effects = additionalEffects;
          }

          await EntitySessionService.sendUtterance(
            session.connections.get(session.ownEntityId)!.connectionId,
            utterance,
          );

          log.info(`Message ${messageId} sent for interaction ${routeInteractionId}`);

          if (participantKey) {
            const updatedMessages = await getRecentConversationMessages(
              ownEntityId,
              participantKey,
              50,
            );
            pendingOwnMessageScroll.current = true;
            setMessages(updatedMessages);
          }
        }
      } catch (error: any) {
        log.error('Failed to send message:', error);
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            `Failed to send: ${error.message}`,
            ToastAndroid.LONG,
          );
        } else {
          Alert.alert('Error', `Failed to send message: ${error.message}`);
        }
      }
    },
    [routeInteractionId, ownEntityId, participantKey, isSessionActive],
  );

  const handleSendImage = useCallback(
    async (imageBase64: string, mimeType: string, caption?: string) => {
      if (!isSessionActive(routeInteractionId)) return;

      try {
        await EntitySessionService.sendImageMessage(
          routeInteractionId,
          imageBase64,
          mimeType,
          caption,
        );
        if (participantKey) {
          const updatedMessages = await getRecentConversationMessages(
            ownEntityId,
            participantKey,
            50,
          );
          pendingOwnMessageScroll.current = true;
          setMessages(updatedMessages);
        }
      } catch (error) {
        log.error('Failed to send image:', error);
      }
    },
    [routeInteractionId, isSessionActive, ownEntityId, participantKey],
  );

  const handleTypingStart = useCallback(() => {
    // Send typing indicator if session active
  }, [routeInteractionId, isSessionActive]);

  // Delete message handler
  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteConversationMessage(messageId);
                if (participantKey) {
                  const updatedMessages = await getRecentConversationMessages(
                    ownEntityId,
                    participantKey,
                    50,
                  );
                  setMessages(updatedMessages);
                }

                if (Platform.OS === 'android') {
                  ToastAndroid.show('Message deleted', ToastAndroid.SHORT);
                }
              } catch (error) {
                log.error('Failed to delete message:', error);
              }
            },
          },
        ],
      );
    },
    [ownEntityId, participantKey],
  );

  // Regenerate message handler
  const handleRegenerateMessage = useCallback(
    async (messageId: string) => {
      Alert.alert(
        'Regenerate Response',
        'Delete this response and regenerate a new one?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Regenerate',
            onPress: async () => {
              try {
                await deleteConversationMessage(messageId);

                const userMessages = messages.filter(
                  m => m.sender_entity_id === ownEntityId,
                );
                if (userMessages.length === 0) {
                  throw new Error('No previous message to regenerate from');
                }

                const lastUserMessage = userMessages[userMessages.length - 1];

                await deleteConversationMessage(lastUserMessage.id);

                await EntitySessionService.sendTextMessage(
                  routeInteractionId,
                  lastUserMessage.content,
                );

                if (participantKey) {
                  const updatedMessages = await getRecentConversationMessages(
                    ownEntityId,
                    participantKey,
                    50,
                  );
                  pendingOwnMessageScroll.current = true;
                  setMessages(updatedMessages);
                }

                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    'Regenerating response...',
                    ToastAndroid.SHORT,
                  );
                }
              } catch (error: any) {
                log.error('Failed to regenerate:', error);
                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    `Failed: ${error.message}`,
                    ToastAndroid.LONG,
                  );
                } else {
                  Alert.alert('Error', error.message);
                }
              }
            },
          },
        ],
      );
    },
    [messages, ownEntityId, routeInteractionId, participantKey],
  );

  // Edit message handler
  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      Alert.alert(
        'Edit and Resend',
        'Edit and resend this message? This will trigger a new AI response.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Edit & Resend',
            onPress: async () => {
              try {
                await updateConversationMessage(messageId, {
                  content: newText,
                });

                const message = await getConversationMessage(messageId);
                if (!message) {
                  throw new Error('Message not found');
                }

                await EntitySessionService.sendTextMessage(
                  routeInteractionId,
                  newText,
                );

                if (participantKey) {
                  const updatedMessages = await getRecentConversationMessages(
                    ownEntityId,
                    participantKey,
                    50,
                  );
                  setMessages(updatedMessages);
                }

                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    'Message updated and sent',
                    ToastAndroid.SHORT,
                  );
                }
              } catch (error: any) {
                log.error('Failed to edit message:', error);
                if (Platform.OS === 'android') {
                  ToastAndroid.show(
                    `Failed: ${error.message}`,
                    ToastAndroid.LONG,
                  );
                } else {
                  Alert.alert('Error', error.message);
                }
              }
            },
          },
        ],
      );
    },
    [ownEntityId, routeInteractionId, participantKey],
  );

  const handleRetryTranscription = useCallback(
    async (messageId: string) => {
      try {
        setFailedTranscriptions(prev => {
          const newSet = new Set(prev);
          newSet.delete(messageId);
          return newSet;
        });

        await EntitySessionService.retryTranscription(
          messageId,
          routeInteractionId,
        );

        if (Platform.OS === 'android') {
          ToastAndroid.show('Retrying transcription...', ToastAndroid.SHORT);
        }
      } catch (error: any) {
        log.error('Failed to retry transcription:', error);
        setFailedTranscriptions(prev => new Set(prev).add(messageId));

        if (Platform.OS === 'android') {
          ToastAndroid.show(
            `Retry failed: ${error.message}`,
            ToastAndroid.LONG,
          );
        } else {
          Alert.alert('Retry Failed', error.message);
        }
      }
    },
    [routeInteractionId],
  );

  // Entity context menu
  const handleEntityContextMenu = useCallback(() => {
    setMenuVisible(true);
  }, []);

  const handleDeleteEntity = useCallback(() => {
    setMenuVisible(false);
    // For the delete entity flow, we need the partner entity ID from participantIds
    const otherIds = participantIds.filter(id => id !== ownEntityId);
    const partnerEntityId = otherIds[0] || '';
    Alert.alert(
      'Delete Entity',
      `Delete "${headerName}"? Chat history will be preserved but this entity will no longer be accessible.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntity(partnerEntityId);
              navigation.navigate('ChatList');
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.message ?? 'Failed to delete entity.',
              );
            }
          },
        },
      ],
    );
  }, [ownEntityId, participantIds, headerName, navigation]);

  const handleEntitySettings = useCallback(() => {
    setMenuVisible(false);
    // For entity settings, we need the partner entity ID
    const otherIds = participantIds.filter(id => id !== ownEntityId);
    const partnerEntityId = otherIds[0] || '';
    navigation.navigate('EntityConfigEdit', { entityId: partnerEntityId });
  }, [ownEntityId, participantIds, navigation]);

  const handleToggleReplyMode = useCallback(async () => {
    const newMode = replyMode === 'realistic' ? 'instant' : 'realistic';
    setReplyMode(newMode);

    // Persist locally
    await ChatPreferencesService.setReplyMode(routeInteractionId, newMode);

    // Send to Harmony Link if session is active
    if (isSessionActive(routeInteractionId)) {
      try {
        await EntitySessionService.setReplyMode(routeInteractionId, newMode);
      } catch (error) {
        log.error('Failed to send reply mode update:', error);
      }
    }
  }, [replyMode, routeInteractionId, isSessionActive]);

  // Calculate messages with divider AND compute the initial scroll target
  const { messagesWithDivider, initialScrollTarget } = useMemo(() => {
    if (messages.length === 0) {
      return { messagesWithDivider: messages, initialScrollTarget: 'bottom' as const };
    }

    let withDivider: any[] = messages;

    if (sessionDividerTimestamp.current !== 0 && showDivider) {
      const firstNewPartnerIndex = messages.findIndex(
        m =>
          m.created_at.getTime() > sessionDividerTimestamp.current &&
          m.sender_entity_id !== ownEntityId,
      );

      if (firstNewPartnerIndex > 0) {
        const newMessageCount = messages.length - firstNewPartnerIndex;
        const result: any[] = [...messages];
        result.splice(firstNewPartnerIndex, 0, {
          id: 'new-messages-divider',
          type: 'divider',
          count: newMessageCount,
        });
        withDivider = result;
      }
    }

    const dividerIndex = withDivider.findIndex((m: any) => m.type === 'divider');
    let target: 'bottom' | number = 'bottom';
    if (dividerIndex !== -1) {
      const messagesAfterDivider = withDivider.length - dividerIndex - 1;
      if (messagesAfterDivider >= 3) {
        target = dividerIndex;
      }
    }

    return { messagesWithDivider: withDivider, initialScrollTarget: target };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, showDivider, ownEntityId]);

  useEffect(() => {
    if (!isInitialScrollDone.current) {
      isNearBottom.current = initialScrollTarget === 'bottom';
    }
  }, [initialScrollTarget]);

  const persistMarkAsRead = useCallback(() => {
    const msgs = loadedMessagesRef.current;
    if (msgs.length === 0) return;
    const latestTimestamp = msgs[msgs.length - 1]?.created_at.getTime() || 0;
    if (latestTimestamp > lastReadTimestampRef.current) {
      lastReadTimestampRef.current = latestTimestamp;
      setLastReadTimestamp(latestTimestamp);
      ChatPreferencesService.setLastReadTimestamp(routeInteractionId, latestTimestamp);
    }
    if (isReadyToShowRef.current) {
      setShowDivider(false);
    }
  }, [routeInteractionId]);

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);

      isNearBottom.current = distanceFromBottom < 150;
      setShowScrollToBottom(!isNearBottom.current);

      if (isNearBottom.current) {
        persistMarkAsRead();
      }
    },
    [persistMarkAsRead],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceFromBottom =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);

      isNearBottom.current = distanceFromBottom < 150;
      setShowScrollToBottom(!isNearBottom.current);

      if (isNearBottom.current) {
        persistMarkAsRead();
      }
    },
    [persistMarkAsRead],
  );

  const renderMessage = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === 'divider') {
        return <NewMessagesDivider count={item.count} theme={theme!} />;
      }

      const isOwn = item.sender_entity_id === ownEntityId;
      const isLastMessage =
        messages.length > 0 && item.id === messages[messages.length - 1].id;
      const isTranscriptionFailed = failedTranscriptions.has(item.id);

      return (
        <ChatBubble
          message={item}
          isOwn={isOwn}
          isLastMessage={isLastMessage}
          isTranscriptionFailed={isTranscriptionFailed}
          partnerAvatar={!isOwn ? partnerAvatar : null}
          partnerName={partnerName}
          onImagePress={() => {}}
          onSendMessage={handleConfirmAndSendMessage}
          onDelete={handleDeleteMessage}
          onRegenerate={handleRegenerateMessage}
          onEdit={handleEditMessage}
          onRetryTranscription={handleRetryTranscription}
          theme={theme!}
        />
      );
    },
    [
      messages,
      partnerAvatar,
      theme,
      ownEntityId,
      failedTranscriptions,
      handleConfirmAndSendMessage,
      handleDeleteMessage,
      handleRegenerateMessage,
      handleEditMessage,
      handleRetryTranscription,
    ],
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme?.colors.accent.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {!isReadyToShow && (
        <ThemedView style={[styles.loadingOverlay, styles.centered]} pointerEvents="none">
          <ActivityIndicator size="large" color={theme?.colors.accent.primary} />
        </ThemedView>
      )}
      <ThemedAppbar>
        <Appbar.BackAction
          onPress={() => navigation.goBack()}
          color={theme?.colors.text.primary}
        />
        {partnerAvatar ? (
          <Avatar.Image
            size={36}
            source={{ uri: partnerAvatar }}
            style={styles.headerAvatar}
          />
        ) : (
          <Avatar.Text
            size={36}
            label={headerName.substring(0, 2).toUpperCase()}
            style={styles.headerAvatar}
          />
        )}
        <Appbar.Content
          title={headerName}
          titleStyle={{ color: theme?.colors.text.primary }}
        />
        {isConnected ? (
          isSessionActive(routeInteractionId) ? (
            <ThemedText
              variant="success"
              size={12}
              style={styles.statusIndicator}
            >
              Connected
            </ThemedText>
          ) : (
            <ThemedText
              variant="muted"
              size={12}
              style={styles.statusIndicator}
            >
              Connecting...
            </ThemedText>
          )
        ) : (
          <ThemedText variant="muted" size={12} style={styles.statusIndicator}>
            Offline
          </ThemedText>
        )}
        {/* Reply mode toggle */}
        <TouchableOpacity
          onPress={handleToggleReplyMode}
          style={styles.replyModeButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={!isSessionActive(routeInteractionId)}
        >
          <ThemedText
            size={11}
            weight="medium"
            style={[
              styles.replyModeText,
              { color: replyMode === 'instant'
                ? theme?.colors.accent.primary
                : theme?.colors.text.muted },
            ]}
          >
            {replyMode === 'instant' ? '⚡ Instant' : '💬 Realistic'}
          </ThemedText>
        </TouchableOpacity>
        {/* Entity context menu */}
        <TouchableOpacity
          onPress={handleEntityContextMenu}
          style={styles.headerMenuButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon
            name="dots-vertical"
            size={24}
            color={theme?.colors.text.primary}
          />
        </TouchableOpacity>
      </ThemedAppbar>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuShell}>
                <LinearGradient
                  colors={[
                    theme!.colors.background.elevated,
                    theme!.colors.background.surface,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[StyleSheet.absoluteFillObject, styles.menuGradientRadius]}
                />
                <LinearGradient
                  colors={[theme!.colors.accent.primary + '12', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0.6 }}
                  style={[StyleSheet.absoluteFillObject, styles.menuGradientRadius]}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[
                    theme!.colors.accent.primary + 'CC',
                    (theme!.colors.accent.secondary ?? theme!.colors.accent.primaryHover) + '66',
                    'transparent',
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.menuTopStripe}
                />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleEntitySettings}
                  activeOpacity={0.65}
                >
                  <View
                    style={[
                      styles.menuIconBadge,
                      { backgroundColor: theme!.colors.accent.primary + '1A' },
                    ]}
                  >
                    <Icon name="cog" size={18} color={theme!.colors.accent.primary} />
                  </View>
                  <ThemedText size={15} weight="medium" style={{ flex: 1 }}>
                    Entity Settings
                  </ThemedText>
                  <Icon name="chevron-right" size={18} color={theme!.colors.text.muted} />
                </TouchableOpacity>
                <View
                  style={[
                    styles.menuItemSeparator,
                    { backgroundColor: theme!.colors.border.default + '44' },
                  ]}
                />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDeleteEntity}
                  activeOpacity={0.65}
                >
                  <View
                    style={[
                      styles.menuIconBadge,
                      { backgroundColor: theme!.colors.status.error + '1A' },
                    ]}
                  >
                    <Icon name="delete-outline" size={18} color={theme!.colors.status.error} />
                  </View>
                  <ThemedText size={15} weight="medium" style={{ flex: 1, color: theme!.colors.status.error }}>
                    Delete Entity
                  </ThemedText>
                  <Icon name="chevron-right" size={18} color={theme!.colors.text.muted} />
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <KeyboardAvoidingView
        style={[styles.content, !isReadyToShow && styles.hidden]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messagesWithDivider}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
          initialNumToRender={50}
          maxToRenderPerBatch={50}
          windowSize={21}
          onScrollToIndexFailed={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          onContentSizeChange={() => {
            if (!isReadyToShowRef.current) {
              if (initialScrollTarget === 'bottom') {
                flatListRef.current?.scrollToEnd({ animated: false });
              } else if (typeof initialScrollTarget === 'number') {
                try {
                  flatListRef.current?.scrollToIndex({
                    index: initialScrollTarget,
                    animated: false,
                    viewPosition: 0,
                  });
                } catch {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }

              if (!isInitialScrollDone.current) {
                isInitialScrollDone.current = true;
                const revealTarget = initialScrollTarget;
                setTimeout(() => {
                  if (revealTarget === 'bottom') {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  } else if (typeof revealTarget === 'number') {
                    try {
                      flatListRef.current?.scrollToIndex({
                        index: revealTarget,
                        animated: false,
                        viewPosition: 0,
                      });
                    } catch {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    }
                  }
                  messagesCountAtReveal.current = messagesWithDivider.length;
                  isReadyToShowRef.current = true;
                  setIsReadyToShow(true);
                }, 200);
              }
            } else {
              if (messagesWithDivider.length > messagesCountAtReveal.current) {
                messagesCountAtReveal.current = messagesWithDivider.length;
                if (pendingOwnMessageScroll.current || isNearBottom.current) {
                  pendingOwnMessageScroll.current = false;
                  isNearBottom.current = true;
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }
            }
          }}
        />

        {isTyping && <TypingIndicator theme={theme} mode="text" />}
        {isRecording && <TypingIndicator theme={theme} mode="audio" />}

        {showScrollToBottom && (
          <TouchableOpacity
            style={[
              styles.scrollToBottomButton,
              { backgroundColor: theme?.colors.accent.primary },
            ]}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.8}
          >
            <Icon
              name="chevron-down"
              size={24}
              color={theme?.colors.background.base}
            />
          </TouchableOpacity>
        )}

        <ChatInput
          ref={chatInputRef}
          onSendText={handleSendText}
          onSendAudio={handleSendAudio}
          onSendImage={handleSendImage}
          onTypingStart={handleTypingStart}
          onEmojiToggle={() => {
            if (!showEmojiPicker) Keyboard.dismiss();
            setShowEmojiPicker(prev => !prev);
          }}
          showEmojiButton={true}
          disabled={!isSessionActive(routeInteractionId)}
          entityId={routeInteractionId}
          theme={theme!}
        />
        {showEmojiPicker && (
          <EmojiPickerInline
            onEmojiSelected={handleEmojiSelected}
            entityId={routeInteractionId}
            onOpenActionEditor={() => {
              setShowEmojiPicker(false);
              navigation.navigate('EmojiActionEditor', {
                entityId: routeInteractionId,
                entityName: headerName,
              });
            }}
          />
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  messageList: {
    paddingVertical: 8,
  },
  headerAvatar: {
    marginRight: 8,
  },
  statusIndicator: {
    marginRight: 8,
  },
  headerMenuButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  replyModeButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  replyModeText: {
    fontSize: 11,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  menuShell: {
    width: 260,
    marginTop: 56,
    marginRight: 8,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  menuGradientRadius: {
    borderRadius: 14,
  },
  menuTopStripe: {
    height: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  menuItemSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
});
