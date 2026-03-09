import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import api from '../api';
import { getUnsyncedBills, markBillsAsSynced, upsertServerBill } from '../database';
import AsyncStorage from '@react-native-async-storage/async-storage';

let isSyncing = false;

export const AppSyncEngine = {

    init: () => {
        // Listen for network state changes
        NetInfo.addEventListener(state => {
            const isOnline = Platform.OS === 'web' ? state.isConnected : (state.isConnected && state.isInternetReachable);
            if (isOnline) {
                console.log('[SYNC] Connection detected, triggering sync...');
                AppSyncEngine.syncData();
            }
        });
    },

    syncData: async () => {
        if (isSyncing) return;
        isSyncing = true;

        try {
            // 1. Check if user is logged in and get their role
            const userStr = await AsyncStorage.getItem('userInfo');
            if (!userStr) {
                isSyncing = false;
                return; // Not logged in
            }

            const user = JSON.parse(userStr);

            // 2. Push local bills to server (Meter Readers & Admins)
            if (user.role === 'MeterReader' || user.role === 'Admin') {
                const unsyncedBills = await getUnsyncedBills();

                if (unsyncedBills.length > 0) {
                    console.log(`[SYNC_ENGINE] Found ${unsyncedBills.length} unsynced bills. Pushing to server...`);

                    const response = await api.post('/sync/push', { bills: unsyncedBills });
                    console.log(`[SYNC_ENGINE] Server response:`, response.data);

                    if (response.data && response.data.syncedCount > 0) {
                        // Find which offlineIds successfully synced. For simplicity, assume all if no errors.
                        // Ideally backend would return array of successfully synced offlineIds
                        const idsToUpdate = unsyncedBills.map(b => b.offlineId);
                        await markBillsAsSynced(idsToUpdate);
                        console.log('Successfully pushed local bills to server.');
                    }
                }
            }

            // 3. Pull latest history from server (Consumers)
            if (user.role === 'Consumer') {
                console.log('Pulling latest 12-month history for Consumer...');
                const response = await api.get('/sync/pull');

                if (response.data && response.data.bills) {
                    const serverBills = response.data.bills;

                    for (const sBill of serverBills) {
                        await upsertServerBill(sBill);
                    }
                    console.log(`Successfully pulled and saved ${serverBills.length} bills.`);
                }
            }

        } catch (error) {
            console.error('Error during synchronization:', error);
        } finally {
            isSyncing = false;
        }
    }
};
