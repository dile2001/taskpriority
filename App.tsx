

import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider as PaperProvider } from "react-native-paper";
import { TouchableOpacity, Text } from "react-native";

import HomeScreen from "./src/screens/HomeScreen";
import AddTaskScreen from "./src/screens/AddTaskScreen";
import { initDB } from "./src/services/SQLiteService";

const Stack = createNativeStackNavigator();

// Header button component that can access navigation
const AddTaskHeaderButton = ({ navigation }: any) => (
  <TouchableOpacity 
    onPress={() => navigation.navigate("Newtask")}
    style={{ marginRight: 16 }}
  >
    <Text style={{ color: '#007AFF', fontSize: 16 }}>Add Task</Text>
  </TouchableOpacity>
);

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="Taskpriority" 
            options={({ navigation }) => ({ 
              title: 'Task priority',
              headerTitleAlign: 'left',
              headerRight: () => <AddTaskHeaderButton navigation={navigation} />
            })} 
            component={HomeScreen} 
          />
          <Stack.Screen name="Newtask" options={{ title: 'New task' }} component={AddTaskScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
