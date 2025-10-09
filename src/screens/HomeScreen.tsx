import React, { useEffect, useState, useRef } from "react";
import { View, Alert, Dimensions, StyleSheet } from "react-native";
import { Button, Card, Text, TouchableRipple, IconButton, Appbar } from "react-native-paper";
import { SwipeListView } from 'react-native-swipe-list-view';
import { getTasks, completeTask, deleteTask, insertTask, revertTaskCompletion } from "../services/SQLiteService";
import { Task } from "../types/Task";
import { calculatePriority } from "../utils/priority";

export default function HomeScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [swipeProgress, setSwipeProgress] = useState<Map<string, number>>(new Map());
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<string | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<{type: 'complete' | 'delete', task: Task, previousState?: { lastCompleted?: Date, streak: number, nextDue: Date }} | null>(null);
  const listRef = useRef<any>(null);
  const actionInProgress = useRef(false);
  const handledKeys = useRef<Set<string>>(new Set());
  const swipeStates = useRef<Map<string, { isAtThreshold: boolean, direction: 'left' | 'right' | null }>>(new Map());
  
  const screenWidth = Dimensions.get('window').width;
  const showTaskDetails = (task: Task) => {
    Alert.alert(
      task.title,
      `Importance: ${task.importance}\nUrgency: ${task.urgency}\nDifficulty: ${task.difficulty}\nStreak: ${task.streak}\nNext Due: ${task.nextDue.toDateString()}\nPriority Score: ${calculatePriority(task)}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Edit', onPress: () => navigation.navigate('Newtask', { task }) }
      ]
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTasks();
    });
    // Initial load
    loadTasks();
    return unsubscribe;
  }, [navigation]);

  const loadTasks = async () => {
    const dbTasks = await getTasks();
    const sorted = dbTasks.sort((a, b) => {
      const scoreA = calculatePriority(a);
      const scoreB = calculatePriority(b);
      return scoreB - scoreA; // high priority first
    });
    setTasks(sorted);
  };

  const undoLastAction = async () => {
    if (!lastAction) return;

    try {
      if (lastAction.type === 'delete') {
        // Restore deleted task
        await insertTask({
          title: lastAction.task.title,
          description: lastAction.task.description,
          importance: lastAction.task.importance,
          urgency: lastAction.task.urgency,
          difficulty: lastAction.task.difficulty,
        }, () => {});
      } else if (lastAction.type === 'complete' && lastAction.previousState) {
        // Revert completed task - restore previous state
        await revertTaskCompletion(lastAction.task, lastAction.previousState);
      }
      
      await loadTasks();
      setShowUndo(false);
      setLastAction(null);
    } catch (error) {
      console.error('Error undoing action:', error);
    }
  };

  const hideUndo = () => {
    setShowUndo(false);
    setLastAction(null);
  };
  const confirmDelete = async (task: Task, rowKey: string) => {
    return new Promise((resolve) => {
      Alert.alert(
        'Delete Task',
        `Do you want to delete "${task.title}"?`,
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => {
              // Close the row
              const rowMap = listRef.current?.rowMap;
              if (rowMap && rowMap[rowKey] && rowMap[rowKey].closeRow) {
                rowMap[rowKey].closeRow();
              } else {
                listRef.current?.closeAllOpenRows?.();
              }
              resolve(false);
            }
          },
          {
            text: 'Yes',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTask(task);
                // Track delete action for undo
                setLastAction({ type: 'delete', task });
                setShowUndo(true);
                // Auto-hide undo after 5 seconds
                setTimeout(() => {
                  setShowUndo(false);
                  setLastAction(null);
                }, 5000);
                
                await loadTasks();
                // Close the row after successful deletion
                const rowMap = listRef.current?.rowMap;
                if (rowMap && rowMap[rowKey] && rowMap[rowKey].closeRow) {
                  rowMap[rowKey].closeRow();
                } else {
                  listRef.current?.closeAllOpenRows?.();
                }
                resolve(true);
              } catch (error) {
                console.error('Error deleting task:', error);
                // Close the row even if deletion failed
                const rowMap = listRef.current?.rowMap;
                if (rowMap && rowMap[rowKey] && rowMap[rowKey].closeRow) {
                  rowMap[rowKey].closeRow();
                } else {
                  listRef.current?.closeAllOpenRows?.();
                }
                resolve(false);
              }
            }
          }
        ],
        { cancelable: false }
      );
    });
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Header with Undo button */}
      {showUndo && (
        <Appbar.Header style={styles.undoHeader}>
          <Appbar.Content title={`${lastAction?.type === 'complete' ? 'Task completed' : 'Task deleted'}`} />
          <Appbar.Action 
            icon="undo" 
            onPress={undoLastAction}
            iconColor="white"
          />
          <Appbar.Action 
            icon="close" 
            onPress={hideUndo}
            iconColor="white"
          />
        </Appbar.Header>
      )}
      
      <View style={{ flex: 1, padding: 16 }}>
        <SwipeListView
        ref={listRef}
        data={tasks.filter(task => task.id !== completingTaskId)}
        keyExtractor={(item: Task) => item.id?.toString() ?? ""}
        useNativeDriver={true}
        closeOnRowPress={true}
        useAnimatedList={true}
        leftOpenValue={200}
        rightOpenValue={-200}
        disableLeftSwipe={false}
        disableRightSwipe={false}
        stopLeftSwipe={250}
        stopRightSwipe={-250}
        renderItem={({ item }) => {
          const k = String(item.id);
          const progress = swipeProgress.get(k) || 0;
          const isDeleteMode = showDeleteConfirmation === k;
          const swipeDirection = progress > 0 ? 'left' : 'right';
          const isLeftSwipe = swipeDirection === 'left';
          const isRightSwipe = swipeDirection === 'right';
          
          return (
            <View style={{ 
              position: 'relative', 
              overflow: 'hidden', 
              height: 68, 
              marginVertical: 4,
              backgroundColor: 'white',
              borderRadius: 4,
              elevation: 4,
            }}>
              {/* Action Buttons - Fixed Background (like iPhone Messages) */}
              <View style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                flexDirection: 'row',
                zIndex: 1,
              }}>
                {/* Complete Button (Right side) */}
                <View style={{
                  flex: 1,
                  backgroundColor: '#34C759',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderTopLeftRadius: 4,
                  borderBottomLeftRadius: 4,
                }}>
                  <IconButton
                    icon="check"
                    iconColor="white"
                    size={20}
                  />
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
                    Complete
                  </Text>
                </View>
                
                {/* Delete Button (Left side) */}
                <View style={{
                  flex: 1,
                  backgroundColor: '#FF3B30',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderTopRightRadius: 4,
                  borderBottomRightRadius: 4,
                }}>
                  <IconButton
                    icon="delete"
                    iconColor="white"
                    size={20}
                  />
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 12 }}>
                    Delete
                  </Text>
                </View>
              </View>
              
              {/* Task Card - Slides over the buttons (like iPhone Messages) */}
              <View style={{ 
                backgroundColor: 'white',
                borderRadius: 4,
                transform: [{ translateX: progress }],
                zIndex: 2,
                height: '100%',
                elevation: 4,
              }}>
                <TouchableRipple onPress={() => showTaskDetails(item)}>
                  <Card.Title 
                    title={item.title}
                    subtitle={`${item.lastCompleted ? new Date(item.lastCompleted).toLocaleDateString() : 'Never'}`}
                  />
                </TouchableRipple>
              </View>
              
              {/* Confirmation Dialog */}
              {isDeleteMode && (
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  padding: 16,
                  zIndex: 3,
                }}>
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center', marginBottom: 16 }}>
                    Delete "{item.title}"?
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    <Button 
                      mode="outlined" 
                      textColor="white" 
                      onPress={() => setShowDeleteConfirmation(null)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      mode="contained" 
                      buttonColor="#FF3B30"
                      onPress={async () => {
                        try {
                          await deleteTask(item);
                          // Track delete action for undo
                          setLastAction({ type: 'delete', task: item });
                          setShowUndo(true);
                          // Auto-hide undo after 5 seconds
                          setTimeout(() => {
                            setShowUndo(false);
                            setLastAction(null);
                          }, 5000);
                          
                          await loadTasks();
                          setShowDeleteConfirmation(null);
                        } catch (error) {
                          console.error('Error deleting task:', error);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </View>
                </View>
              )}
            </View>
          );
        }}
        renderHiddenItem={({ item }) => (
          <View style={{
            marginVertical: 4,
            height: 68,
            backgroundColor: 'transparent', // Make it invisible
          }} />
        )}
        onSwipeValueChange={({ key, value }) => {
          const k = String(key);
          
          // Only prevent processing if an action is currently in progress for this specific row
          if (actionInProgress.current) return;

          // Track swipe progress for visual feedback (use raw value for iPhone Messages style)
          setSwipeProgress(prev => new Map(prev.set(k, value)));

          // Track swipe state for hold-swipe-release behavior
          const currentState = swipeStates.current.get(k) || { isAtThreshold: false, direction: null };
          
          // Check if we've reached the threshold for complete action (right swipe)
          if (value >= 100) {
            swipeStates.current.set(k, { isAtThreshold: true, direction: 'right' });
          }
          // Check if we've reached the threshold for delete action (left swipe)
          else if (value <= -100) {
            swipeStates.current.set(k, { isAtThreshold: true, direction: 'left' });
          }
          // Reset state if we're not at threshold
          else {
            swipeStates.current.set(k, { isAtThreshold: false, direction: null });
          }
        }}
        onRowDidOpen={(rowKey, rowMap) => {
          // iPhone Messages style snap behavior: auto-close partially opened rows
          const row = rowMap[rowKey];
          if (row) {
            // Use a small delay to allow the swipe animation to settle
            setTimeout(() => {
              // Check if the row is still open and close it if it's not fully swiped
              if (row && row.closeRow) {
                row.closeRow();
              }
            }, 150);
          }
        }}
        onRowDidClose={(rowKey) => {
          // Trigger action on release if we were at threshold
          const k = String(rowKey);
          const swipeState = swipeStates.current.get(k);
          const progress = swipeProgress.get(k) || 0;
          
          // Clear the handled key immediately to allow future swipes
          handledKeys.current.delete(k);
          
          // Check if we should show delete confirmation (swiped far enough to the left)
          if (swipeState?.direction === 'left' && Math.abs(progress) > 150) {
            setShowDeleteConfirmation(k);
            // Reset swipe progress
            setSwipeProgress(prev => {
              const newMap = new Map(prev);
              newMap.delete(k);
              return newMap;
            });
            return;
          }
          
          if (swipeState?.isAtThreshold && !actionInProgress.current) {
            const task = tasks.find(t => t.id?.toString() === k);
            if (!task) return;

            actionInProgress.current = true;
            const rowMap = listRef.current?.rowMap || {};

            if (swipeState.direction === 'right') {
              // Complete task (right swipe) - mark as handled to prevent retrigger
              handledKeys.current.add(k);
              
              // Store previous state for undo
              const previousState = {
                lastCompleted: task.lastCompleted,
                streak: task.streak,
                nextDue: task.nextDue
              };
              
              // Track complete action for undo
              setLastAction({ type: 'complete', task, previousState });
              setShowUndo(true);
              // Auto-hide undo after 5 seconds
              setTimeout(() => {
                setShowUndo(false);
                setLastAction(null);
              }, 5000);
              
              // Step 1: Complete the task in the background first
              completeTask(task)
                .then(async () => {
                  // Step 2: Add delay before removing task to allow swipe animation to complete
                  setTimeout(() => {
                    // Step 3: Remove task from list to create disappear effect with slower slide-up
                    setCompletingTaskId(task.id);
                    
                    // Step 4: After slide-up animation, reload tasks to re-insert the completed task
                    setTimeout(async () => {
                      await loadTasks();
                      setCompletingTaskId(null);
                      // Close the row after re-insertion
                      if (rowMap[k]?.closeRow) rowMap[k].closeRow();
                      else listRef.current?.closeAllOpenRows?.();
                    }, 800); // Delay for slide-up animation
                  }, 400); // Delay before removing task to allow swipe to complete
                })
                .catch(error => {
                  console.error('Error completing task:', error);
                  setCompletingTaskId(null);
                })
                .finally(() => { 
                  actionInProgress.current = false;
                  // Clear handled key after animation completes
                  setTimeout(() => { handledKeys.current.delete(k); }, 2000);
                });
            }
          }
          
          // Clear the swipe state and progress when row closes
          swipeStates.current.delete(k);
          setSwipeProgress(prev => {
            const newMap = new Map(prev);
            newMap.delete(k);
            return newMap;
          });
        }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  undoHeader: {
    backgroundColor: '#FF6B35', // Orange color for undo actions
  },
});
