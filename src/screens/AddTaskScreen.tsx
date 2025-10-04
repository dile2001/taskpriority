import React, { useState } from "react";
import { CommonActions } from '@react-navigation/native';
import { View, Text } from "react-native";
import { Button, TextInput, Snackbar } from "react-native-paper";
import Slider from "@react-native-community/slider";
import { insertTask } from "../services/SQLiteService";

export default function AddTaskScreen({ route, navigation }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [importance, setImportance] = useState(3);
  const [urgency, setUrgency] = useState(3);

  const [difficulty, setDifficulty] = useState(3);
  const [visible, setVisible] = useState(false);

  const saveTask = async () => {
    try {
      await insertTask(
        {
          title,
          importance,
          urgency,
          difficulty,
          description,
        },
        () => {}
      );

      // Show snackbar
      setVisible(true);

      // Wait a moment before updating the list and navigating back
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (route.params?.reload) {
        await route.params.reload();
      }

      // Navigate back without animation
      navigation.dispatch(
        CommonActions.goBack()
      );
    } catch (error) {
      console.error('Error saving task:', error);
      setVisible(false);
    }
  };


  return (
    <View style={{ flex: 1, padding: 16 }}>
      <TextInput label="Task Title" value={title} onChangeText={setTitle} style={{ marginBottom: 16 }} />
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 4 }}>Description</Text>
      <TextInput 
        value={description} 
        onChangeText={setDescription} 
        style={{ marginBottom: 16 }} 
        multiline 
        numberOfLines={4} 
      />
  <Text style={{ fontSize: 16, fontWeight: "500", marginTop: 12 }}>Importance</Text>
  <Slider minimumValue={1} maximumValue={5} step={1} value={importance} onValueChange={setImportance} />
  <Text style={{ fontSize: 16, fontWeight: "500", marginTop: 12 }}>Urgency</Text>
  <Slider minimumValue={1} maximumValue={5} step={1} value={urgency} onValueChange={setUrgency} />
  <Text style={{ fontSize: 16, fontWeight: "500", marginTop: 12 }}>Difficulty</Text>
  <Slider minimumValue={1} maximumValue={5} step={1} value={difficulty} onValueChange={setDifficulty} />
      <Button mode="contained" onPress={saveTask}>
        Save
      </Button>
      <Snackbar
        visible={visible}
        onDismiss={() => setVisible(false)}
        duration={1500}
      >
        {`${title} added successfully`}
      </Snackbar>
    </View>
  );
}
