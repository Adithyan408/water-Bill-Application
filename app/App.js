import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { createTables } from './src/database';
import { AppSyncEngine } from './src/services/SyncEngine';

export default function App() {
    useEffect(() => {
        const initApp = async () => {
            try {
                // Initialize local SQLite database tables
                await createTables();
                console.log('Local SQLite DB Initialized');

                // Initialize NetInfo Sync Engine
                AppSyncEngine.init();
                console.log('Background Sync Engine Initialized');

            } catch (error) {
                console.error('Error during app initialization:', error);
            }
        };

        initApp();
    }, []);

    return (
        <SafeAreaProvider>
            <AuthProvider>
                <AppNavigator />
            </AuthProvider>
        </SafeAreaProvider>
    );
}
