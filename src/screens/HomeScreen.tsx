import React, { useEffect, useState, useRef } from "react";
import { View, Alert } from "react-native";
import { Button, Card, Text, TouchableRipple } from "react-native-paper";
import { SwipeListView } from 'react-native-swipe-list-view';
import { getTasks, completeTask, deleteTask } from "../services/SQLiteService";
import { Task } from "../types/Task";
import { calculatePriority } from "../utils/priority";

export default function HomeScreen({ navigation }: any) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const listRef = useRef<any>(null);
  const actionInProgress = useRef(false);
  const handledKeys = useRef<Set<string>>(new Set());
  const showTaskDetails = (task: Task) => {
    Alert.alert(
      task.title,
      `Importance: ${task.importance}\nUrgency: ${task.urgency}\nDifficulty: ${task.difficulty}\nStreak: ${task.streak}\nNext Due: ${task.nextDue.toDateString()}\nPriority Score: ${calculatePriority(task)}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Edit', onPress: () => navigation.navigate('AddTask', { task }) }
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
    <View style={{ flex: 1, padding: 16 }}>
      <Button mode="contained" onPress={() => navigation.navigate("AddTask", { reload: loadTasks })}>
        Add Task
      </Button>
      <SwipeListView
        ref={listRef}
        data={tasks.filter(task => task.id !== completingTaskId)}
        keyExtractor={(item: Task) => item.id?.toString() ?? ""}
        useNativeDriver={true}
        closeOnRowPress={true}
        useAnimatedList={true}
        leftOpenValue={75}
        rightOpenValue={-75}
        disableLeftSwipe={false}
        disableRightSwipe={false}
        stopLeftSwipe={100}
        stopRightSwipe={-100}
        renderItem={({ item }) => (
          <View style={{ 
            backgroundColor: 'white',
            marginVertical: 4,
            elevation: 4,
            borderRadius: 4,
          }}>
            <TouchableRipple onPress={() => showTaskDetails(item)}>
              <Card.Title 
                title={item.title}
                subtitle={`${item.lastCompleted ? new Date(item.lastCompleted).toLocaleDateString() : 'Never'}`}
              />
            </TouchableRipple>
          </View>
        )}
        renderHiddenItem={({ item }) => (
          <View style={{
            marginVertical: 4,
            height: 68,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            margin: 0.5
          }}>
            <View style={{
              marginVertical: 4,
              backgroundColor: '#44b544',
              width: 75,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: 'white' }}>Complete</Text>
            </View>
            <View style={{
              backgroundColor: '#ff4444',
              width: 75,
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: 'white' }}>Delete</Text>
            </View>
          </View>
        )}
        onSwipeValueChange={({ key, value }) => {
          const threshold = 75;
          const k = String(key);
          
          // ignore keys recently handled (prevents immediate retrigger when row slides back)
          if (handledKeys.current.has(k)) return;
          if (actionInProgress.current) return;

          // Only trigger action when swiping reaches threshold, not when sliding back
          if (Math.abs(value) >= threshold) {
            const task = tasks.find(t => t.id?.toString() === k);
            if (!task) return;

            actionInProgress.current = true;
            const rowMap = listRef.current?.rowMap || {};

            if (value > 0) {
              // Complete task (left swipe) - mark as handled to prevent retrigger
              handledKeys.current.add(k);
              
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
            } else {
              // Delete task (right swipe) - mark as handled immediately to prevent retrigger
              handledKeys.current.add(k);
              confirmDelete(task, k).finally(() => {
                actionInProgress.current = false;
                // Clear handled key after a delay to allow for proper cleanup
                setTimeout(() => { handledKeys.current.delete(k); }, 1000);
              });
            }
          }
        }}
      />
    </View>
  );
}
