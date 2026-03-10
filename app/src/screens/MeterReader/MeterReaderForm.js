import React, { useContext, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import { insertBillLocally } from '../../database';
import { AppSyncEngine } from '../../services/SyncEngine';
import api from '../../api/index';

/**
 * METER READER FORM
 * Billing Logic Fixed:
 * 1. Consumption (Litres) = (Current Reading - Previous Reading)
 *    (Meter reads directly in Litres)
 * 2. Base Amount = ₹110 (Covers up to 15,000 Litres)
 * 3. Extra Usage Litres = (Consumption - 15,000 Litres)
 * 4. Extra Charge = (Extra Usage Litres * ₹20) / 1,000
 * 5. Monthly Bill = Base Amount + Extra Charge
 */

const MeterReaderForm = () => {
    const { logout, userInfo } = useContext(AuthContext);

    // --- State Management ---
    const [searchQuery, setSearchQuery] = useState('');
    const [allConsumers, setAllConsumers] = useState([]);
    const [filteredConsumers, setFilteredConsumers] = useState([]);
    const [consumerData, setConsumerData] = useState(null); // The selected consumer detail
    const [currentReading, setCurrentReading] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const [isPreview, setIsPreview] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [calculation, setCalculation] = useState(null);

    const [dynamicRules, setDynamicRules] = useState({
        UNDER_AMOUNT: 60,
        UNDER_THRESHOLD: 5000,
        NORMAL_AMOUNT: 110,
        NORMAL_THRESHOLD: 15000,
        SURCHARGE_RATE: 20
    });

    // --- Lifecycle ---
    useEffect(() => {
        const fetchRemoteData = async () => {
            try {
                const [conRes, setRes] = await Promise.all([
                    api.get('/admin/consumers'),
                    api.get('/admin/settings')
                ]);

                if (Array.isArray(conRes.data)) {
                    setAllConsumers(conRes.data);
                    setFilteredConsumers(conRes.data);
                }

                // Map dynamic billing rules
                if (Array.isArray(setRes.data)) {
                    const rules = { ...dynamicRules };
                    setRes.data.forEach(s => {
                        if (s.key === 'TARIFF_UNDER_AMOUNT') rules.UNDER_AMOUNT = parseFloat(s.value);
                        if (s.key === 'TARIFF_UNDER_THRESHOLD') rules.UNDER_THRESHOLD = parseFloat(s.value);
                        if (s.key === 'TARIFF_NORMAL_AMOUNT') rules.NORMAL_AMOUNT = parseFloat(s.value);
                        if (s.key === 'TARIFF_NORMAL_THRESHOLD') rules.NORMAL_THRESHOLD = parseFloat(s.value);
                        if (s.key === 'TARIFF_SURCHARGE_RATE') rules.SURCHARGE_RATE = parseFloat(s.value);
                    });
                    setDynamicRules(rules);
                }
            } catch (e) {
                console.error('[READER_FORM] Error fetching init data:', e);
            }
        };
        fetchRemoteData();
    }, []);

    // --- Search Logic ---
    const handleSearch = (text) => {
        setSearchQuery(text);
        if (!text.trim()) {
            setFilteredConsumers(allConsumers);
        } else {
            const lowText = text.toLowerCase();
            const filtered = allConsumers.filter(c =>
                c.name.toLowerCase().includes(lowText) ||
                c.username.toLowerCase().includes(lowText) ||
                (c.meterNumber && c.meterNumber.toLowerCase().includes(lowText))
            );
            setFilteredConsumers(filtered);
        }
    };

    // --- Fetch Consumer Details ---
    const selectConsumer = async (idOrUsername) => {
        setIsFetching(true);
        setStatusMsg('Loading consumer status...');
        setCalculation(null);
        try {
            const response = await api.get(`/admin/consumers/${idOrUsername}/status`);
            const data = response.data;

            // Ensure data integrity
            setConsumerData({
                id: data.id,
                name: data.name,
                username: data.username,
                meterNumber: data.meterNumber,
                previousReading: parseFloat(data.previousReading || 0),
                balance: parseFloat(data.balance || 0),
                lastBillDate: data.lastBillDate
            });

            setFilteredConsumers([]);
            setCurrentReading('');
            setIsPreview(false);
            setStatusMsg('Ready');
        } catch (error) {
            console.error('[READER_FETCH_ERR]', error);
            const msg = error.response?.data?.message || 'Connection Error';
            setStatusMsg(`Error: ${msg}`);
            Alert.alert('Error', msg);
        } finally {
            setIsFetching(false);
        }
    };

    // --- Validation: Check if already billed this month ---
    const isAlreadyBilledThisMonth = () => {
        if (!consumerData || !consumerData.lastBillDate) return false;
        const lastDate = new Date(consumerData.lastBillDate);
        const now = new Date();
        return (
            lastDate.getMonth() === now.getMonth() &&
            lastDate.getFullYear() === now.getFullYear()
        );
    };

    // --- BILL CALCULATION LOGIC ---
    const calculateBill = () => {
        if (isAlreadyBilledThisMonth()) {
            Alert.alert('Blocked', 'This consumer has already been billed for the current month. Duplicate billing is not allowed.');
            return;
        }

        if (!currentReading) {
            Alert.alert('Missing Info', 'Please enter the Current Meter Reading');
            return;
        }

        const curr = parseFloat(currentReading);
        const prev = consumerData.previousReading;

        if (isNaN(curr) || curr < prev) {
            Alert.alert('Entry Error', `Current reading (${curr}) cannot be less than previous (${prev})`);
            return;
        }

        // 1. Calculate Consumption in Litres (Formula: (Current - Previous) * 10)
        // Note: Meter Reads in Units, 1 Unit = 10 Litres
        const consumptionLitres = (curr - prev) * 10;
        const R = dynamicRules;

        let rawMonthlyTotal = 0;
        let tierLabel = 'Normal';
        let extraLitres = 0;
        let extraCharge = 0;
        let baseToApply = R.NORMAL_AMOUNT;

        // --- TIERED CALCULATION LOGIC ---
        if (consumptionLitres <= R.UNDER_THRESHOLD) {
            // TIER 1: Under Usage
            rawMonthlyTotal = R.UNDER_AMOUNT;
            baseToApply = R.UNDER_AMOUNT;
            tierLabel = 'Under Usage';
        } else if (consumptionLitres <= R.NORMAL_THRESHOLD) {
            // TIER 2: Normal Usage
            rawMonthlyTotal = R.NORMAL_AMOUNT;
            baseToApply = R.NORMAL_AMOUNT;
            tierLabel = 'Standard';
        } else {
            // TIER 3: Extra Usage
            extraLitres = consumptionLitres - R.NORMAL_THRESHOLD;
            extraCharge = (extraLitres * R.SURCHARGE_RATE) / 1000;
            rawMonthlyTotal = R.NORMAL_AMOUNT + extraCharge;
            baseToApply = R.NORMAL_AMOUNT;
            tierLabel = 'High Usage';
        }

        const currentBalance = consumerData.balance;
        const rawGrandTotal = rawMonthlyTotal + currentBalance;

        // Round Grand Total to nearest 10 (e.g., 24 -> 20, 25 -> 30)
        const roundedGrandTotal = Math.round(rawGrandTotal / 10) * 10;

        // Adjust the current month's bill so that (Balance + adjustedMonthly) = roundedGrandTotal
        const adjustedMonthlyCharge = roundedGrandTotal - currentBalance;

        setCalculation({
            consumption: consumptionLitres,
            extraLitres: extraLitres,
            baseAmount: baseToApply,
            extraAmount: extraCharge,
            currentMonthTotal: adjustedMonthlyCharge, // Adjusted for rounded final payable
            surchargeRate: R.SURCHARGE_RATE,
            prevBalance: currentBalance,
            grandTotal: roundedGrandTotal,
            tierLabel: tierLabel
        });

        setIsPreview(true);
    };

    // --- SAVE AND SYNC ---
    const handleSaveAndSync = async () => {
        console.log('[READER_SAVE] Checking for monthly update/new bill...');
        // We No longer block duplicates. The server will handle updating the same month.
        performSave();
    };

    const performSave = async () => {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const billData = {
            consumerId: consumerData.id,
            previousReading: consumerData.previousReading,
            currentReading: parseFloat(currentReading),
            consumption: calculation.consumption,
            amount: calculation.currentMonthTotal,
            dueDate: dueDate.toISOString(),
            status: 'Unpaid'
        };

        try {
            console.log('[READER_SAVE] Storing bill locally...', billData);
            setStatusMsg('Saving locally...');
            const offlineId = await insertBillLocally(billData);

            setIsPreview(false);
            setCalculation(null);

            setStatusMsg('Syncing to server...');
            try {
                await AppSyncEngine.syncData();
                console.log('[READER_SAVE] Sync completed successfully.');

                const successMsg = 'Bill generated and synced successfully.';
                if (Platform.OS === 'web') window.alert(successMsg);
                else Alert.alert('Success', successMsg);
            } catch (syncErr) {
                console.warn('[READER_SAVE] Sync failed (offline?), but bill is saved locally:', syncErr);
                const partialMsg = 'Bill saved locally but sync failed. It will sync automatically when online.';
                if (Platform.OS === 'web') window.alert(partialMsg);
                else Alert.alert('Partial Success', partialMsg);
            }

            // RESET FORM
            setSearchQuery('');
            setConsumerData(null);
            setCurrentReading('');
            setStatusMsg('Completed');
            setTimeout(() => setStatusMsg(''), 2000);

        } catch (error) {
            console.error('[READER_SAVE_FATAL_ERR]', error);
            setStatusMsg('Save Error');
            const errorMsg = 'Failed to save bill locally. Please check storage.';
            if (Platform.OS === 'web') window.alert(errorMsg);
            else Alert.alert('Error', errorMsg);
        }
    };

    // --- UI RENDER ---
    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
                <Text style={styles.title}>Reader Portal</Text>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* FETCH/SEARCH SECTION */}
            {!consumerData && !isPreview && (
                <View style={styles.card}>
                    <Text style={styles.sectionHeader}>Search Consumer</Text>
                    <TextInput
                        style={styles.input}
                        value={searchQuery}
                        onChangeText={handleSearch}
                        placeholder="Search Name / Username / Meter#"
                    />

                    <ScrollView style={styles.resultList}>
                        {filteredConsumers.length > 0 ? (
                            filteredConsumers.map(c => (
                                <TouchableOpacity key={c._id} style={styles.userItem} onPress={() => selectConsumer(c.username)}>
                                    <View>
                                        <Text style={styles.userNameText}>{c.name}</Text>
                                        <Text style={styles.userSubText}>@{c.username} | {c.meterNumber}</Text>
                                    </View>
                                    <Text style={styles.fetchTag}>SELECT</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={styles.emptyText}>No consumers matching search.</Text>
                        )}
                    </ScrollView>
                    {isFetching && <ActivityIndicator color="#3182ce" style={{ marginTop: 10 }} />}
                </View>
            )}

            {/* INPUT SECTION */}
            {consumerData && !isPreview && (
                <View style={styles.card}>
                    <View style={styles.flexBetween}>
                        <Text style={styles.sectionHeader}>Billing for {consumerData.name}</Text>
                        <TouchableOpacity onPress={() => setConsumerData(null)}>
                            <Text style={styles.resetLink}>Change User</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoLabel}>Meter Number: {consumerData.meterNumber}</Text>
                        <Text style={styles.infoLabel}>Previous Reading: {consumerData.previousReading}</Text>
                        <Text style={[styles.infoLabel, { color: '#e53e3e' }]}>Current Dues: ₹{consumerData.balance.toFixed(2)}</Text>
                        {isAlreadyBilledThisMonth() && (
                            <Text style={{ color: '#e53e3e', fontWeight: 'bold', marginTop: 10, textAlign: 'center' }}>
                                ⚠️ ALREADY BILLED THIS MONTH
                            </Text>
                        )}
                    </View>

                    <Text style={styles.entryLabel}>Enter Current Reading (Litres):</Text>
                    <TextInput
                        style={[styles.input, styles.activeInput, isAlreadyBilledThisMonth() && { opacity: 0.5 }]}
                        value={currentReading}
                        onChangeText={setCurrentReading}
                        keyboardType="numeric"
                        placeholder="0000"
                        editable={!isAlreadyBilledThisMonth()}
                    />

                    <TouchableOpacity
                        style={[styles.actionButton, isAlreadyBilledThisMonth() && { backgroundColor: '#cbd5e0' }]}
                        onPress={calculateBill}
                        disabled={isAlreadyBilledThisMonth()}
                    >
                        <Text style={styles.actionButtonText}>Calculate Bill</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* PREVIEW SECTION */}
            {isPreview && calculation && (
                <View style={[styles.card, styles.previewCard]}>
                    <Text style={styles.sectionHeader}>Bill Breakdown</Text>

                    <View style={styles.table}>
                        <View style={styles.row}><Text>Reading (Curr)</Text><Text style={styles.val}>{currentReading}</Text></View>
                        <View style={styles.row}><Text>Reading (Prev)</Text><Text style={styles.val}>{consumerData?.previousReading || 0}</Text></View>
                        <View style={styles.row}><Text style={styles.bold}>Total Usage</Text><Text style={styles.bold}>{(calculation?.consumption || 0).toLocaleString()} Litres</Text></View>

                        <View style={styles.divider} />

                        <View style={styles.row}>
                            <Text>{calculation?.tierLabel || 'Usage'} Charge</Text>
                            <Text style={styles.val}>₹{(calculation?.baseAmount || 0).toFixed(2)}</Text>
                        </View>

                        {(calculation?.extraLitres || 0) > 0 && (
                            <View style={styles.row}>
                                <Text>Extra Usage ({calculation.extraLitres.toLocaleString()}L)</Text>
                                <Text style={styles.val}>₹{(calculation?.extraAmount || 0).toFixed(2)}</Text>
                            </View>
                        )}

                        <View style={[styles.row, styles.totalRow]}>
                            <Text style={styles.bold}>Monthly Charge</Text>
                            <Text style={styles.bold}>₹{(calculation?.currentMonthTotal || 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.row}>
                            <Text>Previous Balanced Due</Text>
                            <Text style={styles.val}>₹{(calculation?.prevBalance || 0).toFixed(2)}</Text>
                        </View>

                        <View style={[styles.row, styles.grandTotalRow]}>
                            <Text style={styles.grandText}>Total Payable</Text>
                            <Text style={styles.grandText}>₹{(calculation?.grandTotal || 0).toFixed(2)}</Text>
                        </View>
                    </View>

                    <View style={styles.flexBetween}>
                        <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={() => setIsPreview(false)}>
                            <Text style={styles.secondaryBtnText}>Edit Reading</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.btn, styles.primaryBtn]} onPress={handleSaveAndSync}>
                            <Text style={styles.primaryBtnText}>Confirm & Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {statusMsg ? <Text style={styles.statusFooter}>{statusMsg}</Text> : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15, backgroundColor: '#f7fafc' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    title: { fontSize: 24, fontWeight: '900', color: '#1a202c' },
    logoutBtn: { padding: 5 },
    logoutText: { color: '#e53e3e', fontWeight: 'bold' },

    card: { backgroundColor: 'white', borderRadius: 16, padding: 20, marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#2d3748', marginBottom: 15 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 15 },
    activeInput: { borderColor: '#3182ce', borderWidth: 2 },

    resultList: { maxHeight: 300 },
    userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    userNameText: { fontSize: 16, fontWeight: '700', color: '#2d3748' },
    userSubText: { fontSize: 12, color: '#a0aec0' },
    fetchTag: { fontSize: 11, fontWeight: 'bold', color: '#3182ce' },

    flexBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    resetLink: { color: '#3182ce', fontWeight: 'bold', fontSize: 13 },
    infoBox: { backgroundColor: '#f1f5f9', padding: 15, borderRadius: 12, marginBottom: 20 },
    infoLabel: { fontSize: 14, marginBottom: 4, color: '#4a5568' },
    entryLabel: { fontSize: 15, fontWeight: 'bold', color: '#4a5568', marginBottom: 10 },

    actionButton: { backgroundColor: '#3182ce', padding: 16, borderRadius: 12, alignItems: 'center' },
    actionButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    previewCard: { backgroundColor: '#fff' },
    table: { marginBottom: 20 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    divider: { height: 1, backgroundColor: '#edf2f7', marginVertical: 10 },
    val: { color: '#2d3748', fontWeight: '600' },
    bold: { fontWeight: 'bold', color: '#1a202c' },
    totalRow: { backgroundColor: '#f8fafc', paddingHorizontal: 5, borderRadius: 5 },
    grandTotalRow: { marginTop: 10, padding: 12, backgroundColor: '#ebf8ff', borderRadius: 10 },
    grandText: { fontSize: 20, fontWeight: '900', color: '#2b6cb0' },

    btn: { flex: 0.48, padding: 15, borderRadius: 12, alignItems: 'center' },
    primaryBtn: { backgroundColor: '#2b6cb0' },
    secondaryBtn: { backgroundColor: '#edf2f7' },
    primaryBtnText: { color: 'white', fontWeight: 'bold' },
    secondaryBtnText: { color: '#4a5568', fontWeight: 'bold' },

    statusFooter: { textAlign: 'center', color: '#a0aec0', marginTop: 10, marginBottom: 40, fontStyle: 'italic' },
    emptyText: { textAlign: 'center', color: '#cbd5e0', padding: 20 }
});

export default MeterReaderForm;
