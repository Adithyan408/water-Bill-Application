import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

import LoginScreen from '../screens/Auth/LoginScreen';
import ConsumerDashboard from '../screens/Consumer/ConsumerDashboard';
import MeterReaderForm from '../screens/MeterReader/MeterReaderForm';
import AdminDashboard from '../screens/Admin/AdminDashboard';
import ConsumerListScreen from '../screens/Admin/ConsumerListScreen';

const Stack = createNativeStackNavigator();

const linking = {
    config: {
        screens: {
            Login: 'login',
            'Consumer Home': 'consumer/:username',
            'Meter Reader Home': 'reader/:username',
            'Admin Home': 'admin',
            ConsumerList: 'admin/consumers',
        },
    },
};

const AppNavigator = () => {
    const { isLoading, userToken, userInfo } = useContext(AuthContext);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3182ce" />
            </View>
        );
    }

    return (
        <NavigationContainer linking={linking}>
            <Stack.Navigator screenOptions={{ headerShown: true }}>
                {userToken == null ? (
                    // No token found, user isn't signed in
                    <Stack.Screen
                        name="Login"
                        component={LoginScreen}
                        options={{ headerShown: false }}
                    />
                ) : (
                    // User is signed in, check role
                    <>
                        {userInfo?.role === 'Consumer' && (
                            <Stack.Screen name="Consumer Home" component={ConsumerDashboard} />
                        )}

                        {userInfo?.role === 'MeterReader' && (
                            <Stack.Screen name="Meter Reader Home" component={MeterReaderForm} />
                        )}

                        {userInfo?.role === 'Admin' && (
                            <>
                                <Stack.Screen name="Admin Home" component={AdminDashboard} />
                                <Stack.Screen name="ConsumerList" component={ConsumerListScreen} options={{ title: 'Consumers' }} />
                            </>
                        )}
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
