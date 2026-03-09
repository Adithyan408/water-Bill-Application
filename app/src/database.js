import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WEB_DB_KEY = '@waterbill_web_db';

// Open database connection (Native only)
let db;
export const getDB = async () => {
    if (Platform.OS === 'web') return null;
    if (!db) {
        const SQLite = require('expo-sqlite');
        db = await SQLite.openDatabaseAsync('waterbill.db');
    }
    return db;
};

// Initialize tables
export const createTables = async () => {
    if (Platform.OS === 'web') {
        const existing = await AsyncStorage.getItem(WEB_DB_KEY);
        if (!existing) {
            await AsyncStorage.setItem(WEB_DB_KEY, JSON.stringify([]));
        }
        return;
    }

    const database = await getDB();

    // Create Bills table
    await database.execAsync(`
    CREATE TABLE IF NOT EXISTS Bills (
      offlineId TEXT PRIMARY KEY NOT NULL,
      consumerId TEXT NOT NULL,
      previousReading REAL NOT NULL,
      currentReading REAL NOT NULL,
      consumption REAL NOT NULL,
      amount REAL NOT NULL,
      billingDate TEXT,
      dueDate TEXT,
      status TEXT,
      isSynced INTEGER DEFAULT 0
    );
  `);
};

// Insert a bill (typically by Meter Reader, initially unsynced)
export const insertBillLocally = async (billData) => {
    const offlineId = Date.now().toString() + Math.random().toString(36).substring(7);

    const newBill = {
        offlineId,
        consumerId: billData.consumerId,
        previousReading: billData.previousReading,
        currentReading: billData.currentReading,
        consumption: billData.consumption,
        amount: billData.amount,
        billingDate: billData.billingDate || new Date().toISOString(),
        dueDate: billData.dueDate,
        status: billData.status || 'Unpaid',
        isSynced: 0
    };

    if (Platform.OS === 'web') {
        console.log(`[DB] Saving bill to web storage:`, newBill.offlineId);
        const bills = JSON.parse(await AsyncStorage.getItem(WEB_DB_KEY) || '[]');
        bills.push(newBill);
        await AsyncStorage.setItem(WEB_DB_KEY, JSON.stringify(bills));
        console.log(`[DB] Web storage updated. Total local bills: ${bills.length}`);
        return offlineId;
    }

    const database = await getDB();
    await database.runAsync(
        `INSERT INTO Bills (offlineId, consumerId, previousReading, currentReading, consumption, amount, billingDate, dueDate, status, isSynced) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
            newBill.offlineId,
            newBill.consumerId,
            newBill.previousReading,
            newBill.currentReading,
            newBill.consumption,
            newBill.amount,
            newBill.billingDate,
            newBill.dueDate,
            newBill.status
        ]
    );

    return offlineId;
};

// Insert or replace bill from server (when Consumer pulls history)
export const upsertServerBill = async (bill) => {
    const offlineId = bill.offlineId || bill._id;

    const serverBill = {
        offlineId,
        consumerId: bill.consumerId,
        previousReading: bill.previousReading,
        currentReading: bill.currentReading,
        consumption: bill.consumption,
        amount: bill.amount,
        billingDate: bill.billingDate,
        dueDate: bill.dueDate,
        status: bill.status,
        isSynced: 1
    };

    if (Platform.OS === 'web') {
        let bills = JSON.parse(await AsyncStorage.getItem(WEB_DB_KEY) || '[]');
        const index = bills.findIndex(b => b.offlineId === offlineId);
        if (index >= 0) {
            bills[index] = serverBill;
        } else {
            bills.push(serverBill);
        }
        await AsyncStorage.setItem(WEB_DB_KEY, JSON.stringify(bills));
        return;
    }

    const database = await getDB();
    await database.runAsync(
        `INSERT OR REPLACE INTO Bills (offlineId, consumerId, previousReading, currentReading, consumption, amount, billingDate, dueDate, status, isSynced) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
            serverBill.offlineId,
            serverBill.consumerId,
            serverBill.previousReading,
            serverBill.currentReading,
            serverBill.consumption,
            serverBill.amount,
            serverBill.billingDate,
            serverBill.dueDate,
            serverBill.status
        ]
    );
};

// Get all unsynced bills for pushing to server
export const getUnsyncedBills = async () => {
    if (Platform.OS === 'web') {
        const bills = JSON.parse(await AsyncStorage.getItem(WEB_DB_KEY) || '[]');
        return bills.filter(b => b.isSynced === 0);
    }

    const database = await getDB();
    const allRows = await database.getAllAsync('SELECT * FROM Bills WHERE isSynced = 0');
    return allRows;
};

// Mark bills as synced after successful push
export const markBillsAsSynced = async (offlineIds) => {
    if (!offlineIds || offlineIds.length === 0) return;

    if (Platform.OS === 'web') {
        let bills = JSON.parse(await AsyncStorage.getItem(WEB_DB_KEY) || '[]');
        bills = bills.map(b => {
            if (offlineIds.includes(b.offlineId)) {
                return { ...b, isSynced: 1 };
            }
            return b;
        });
        await AsyncStorage.setItem(WEB_DB_KEY, JSON.stringify(bills));
        return;
    }

    const database = await getDB();
    const placeholders = offlineIds.map(() => '?').join(',');

    await database.runAsync(
        `UPDATE Bills SET isSynced = 1 WHERE offlineId IN (${placeholders})`,
        offlineIds
    );
};

// Get bills for a specific consumer (History)
export const getConsumerBills = async (consumerId) => {
    if (Platform.OS === 'web') {
        const bills = JSON.parse(await AsyncStorage.getItem(WEB_DB_KEY) || '[]');
        return bills.filter(b => b.consumerId === consumerId).sort((a, b) => new Date(b.billingDate) - new Date(a.billingDate));
    }

    const database = await getDB();
    return await database.getAllAsync(
        'SELECT * FROM Bills WHERE consumerId = ? ORDER BY billingDate DESC',
        [consumerId]
    );
};

// Clear database (e.g., on logout)
export const clearDatabase = async () => {
    if (Platform.OS === 'web') {
        await AsyncStorage.removeItem(WEB_DB_KEY);
        return;
    }

    const database = await getDB();
    await database.execAsync('DELETE FROM Bills');
};
