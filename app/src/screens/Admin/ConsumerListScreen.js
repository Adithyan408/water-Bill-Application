import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView, Modal, TextInput, Alert, Button } from 'react-native';
import api from '../../api';

const ConsumerListScreen = ({ navigation }) => {
    const [consumers, setConsumers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Payment Modal State
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    // Add User Modal State
    const [addUserModalVisible, setAddUserModalVisible] = useState(false);
    const [newUserData, setNewUserData] = useState({
        name: '',
        phoneNumber: '',
        address: '',
        previousReading: '',
        initialBalance: ''
    });
    const [isCreatingUser, setIsCreatingUser] = useState(false);

    // Consumer Profile Edit Modal State
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [profileFormData, setProfileFormData] = useState({
        id: '', name: '', phoneNumber: '', altPhoneNumber: '', email: '',
        address: '', username: '', meterNumber: '',
        previousReading: '', currentReading: '', totalBalance: ''
    });
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    const fetchConsumers = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/admin/consumers');
            if (Array.isArray(response.data)) {
                setConsumers(response.data);
            }
        } catch (e) {
            console.error('[CLIENT] Fetch error', e);
            setError('Failed to fetch consumers');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConsumers();
    }, []);

    // --- PAYMENT ACTIONS ---
    const openPaymentModal = (user) => {
        setSelectedUser(user);
        setPaymentAmount('');
        setPaymentModalVisible(true);
    };

    const handlePayment = async () => {
        if (!paymentAmount || isNaN(paymentAmount) || parseFloat(paymentAmount) <= 0) {
            Alert.alert('Error', 'Please enter a valid amount');
            return;
        }

        setIsSubmittingPayment(true);
        try {
            await api.post(`/admin/consumers/${selectedUser._id}/collect-payment`, {
                amount: paymentAmount,
                method: 'Cash'
            });

            Alert.alert('Success', `Recorded ₹${paymentAmount} payment for ${selectedUser.name}`);
            setPaymentModalVisible(false);
            fetchConsumers();
        } catch (e) {
            console.error('[PAYMENT_ERR]', e);
            Alert.alert('Error', 'Failed to record payment');
        } finally {
            setIsSubmittingPayment(false);
        }
    };

    // --- ADD USER ACTIONS ---
    const handleAddUser = async () => {
        const { name } = newUserData;
        if (!name) {
            Alert.alert('Error', 'Name is required');
            return;
        }

        setIsCreatingUser(true);
        try {
            const response = await api.post('/admin/consumers', newUserData);
            const user = response.data.user;

            Alert.alert(
                'User Created',
                `Credentials saved successfully.\n\nName: ${user.name}\nUsername: ${user.username}\nSerial: ${user.meterNumber}\nPassword: ${user.password}`
            );

            setAddUserModalVisible(false);
            setNewUserData({ name: '', phoneNumber: '', address: '', previousReading: '', initialBalance: '' });
            fetchConsumers();
        } catch (e) {
            console.error('[ADD_USER_ERR]', e);
            Alert.alert('Error', e.response?.data?.message || 'Failed to create user');
        } finally {
            setIsCreatingUser(false);
        }
    };

    // --- PROFILE EDIT ACTIONS ---
    const fetchAndOpenProfile = async (id) => {
        try {
            const response = await api.get(`/admin/consumers/${id}/status`);
            const d = response.data;
            // Get original address/phone from consumers list if status route is minimal
            const fullInfo = consumers.find(c => c._id === id) || {};

            setProfileFormData({
                id: d.id,
                name: d.name,
                username: d.username,
                phoneNumber: fullInfo.phoneNumber || '',
                altPhoneNumber: fullInfo.altPhoneNumber || '',
                email: fullInfo.email || '',
                address: fullInfo.address || '',
                meterNumber: d.meterNumber || '',
                previousReading: d.previousReading.toString(),
                currentReading: d.previousReading.toString(),
                totalBalance: d.balance.toString()
            });
            setProfileModalVisible(true);
        } catch (e) {
            Alert.alert('Error', 'Failed to fetch user details');
        }
    };

    const handleUpdateProfile = async () => {
        setIsUpdatingProfile(true);
        try {
            await api.patch(`/admin/consumers/${profileFormData.id}`, profileFormData);
            Alert.alert('Success', 'Credentials saved successfully');
            setProfileModalVisible(false);
            fetchConsumers();
        } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleDeleteProfile = async () => {
        const confirmMsg = `Are you sure you want to permanently delete ${profileFormData.name}? This cannot be undone.`;

        let proceed = false;
        if (Platform.OS === 'web') {
            proceed = window.confirm(confirmMsg);
        } else {
            // Standard Alert.alert for mobile but for simplicity we can assume web for this demo
            // or just use window.confirm which works in many web-based RN environments
            proceed = window.confirm(confirmMsg);
        }

        if (!proceed) return;

        setIsUpdatingProfile(true);
        try {
            await api.delete(`/admin/consumers/${profileFormData.id}`);
            Alert.alert('Deleted', 'Consumer removed successfully.');
            setProfileModalVisible(false);
            fetchConsumers();
        } catch (e) {
            Alert.alert('Error', 'Failed to delete user');
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const getBalanceColor = (amount) => {
        if (amount <= 0) return '#38a169';
        if (amount < 500) return '#3182ce';
        if (amount < 1000) return '#d69e2e';
        return '#e53e3e';
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => navigation.navigate('Admin Home')} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Consumers</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setAddUserModalVisible(true)}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#3182ce" />
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <Button title="Retry" onPress={fetchConsumers} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.listContent}>
                    {consumers.length > 0 ? (
                        consumers.map((item) => (
                            <TouchableOpacity
                                key={item._id}
                                style={styles.userCard}
                                onPress={() => fetchAndOpenProfile(item._id)}
                            >
                                <View style={styles.userInfo}>
                                    <View style={styles.nameRow}>
                                        <Text style={styles.userName}>{item.name}</Text>
                                        <Text style={styles.serialBadge}>{item.meterNumber || 'NO METER'}</Text>
                                    </View>
                                    <Text style={styles.userSub}>@{item.username} | {item.phoneNumber || 'No Phone'}</Text>
                                </View>
                                <View style={styles.userAction}>
                                    <Text style={[styles.balanceText, { color: getBalanceColor(item.totalBalance || 0) }]}>
                                        ₹{(item.totalBalance || 0).toLocaleString()}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => openPaymentModal(item)}
                                    >
                                        <Text style={styles.actionBtnText}>Payment</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.noData}>No consumers found.</Text>
                    )}
                </ScrollView>
            )}

            {/* PAYMENT MODAL */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={paymentModalVisible}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Collect Payment</Text>
                        <Text style={styles.modalSub}>Customer: {selectedUser?.name}</Text>
                        <Text style={styles.modalSub}>Current Dues: ₹{selectedUser?.totalBalance?.toFixed(2)}</Text>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Enter Amount Paid (₹)"
                            keyboardType="numeric"
                            value={paymentAmount}
                            onChangeText={setPaymentAmount}
                            autoFocus={true}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setPaymentModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.submitBtn]} onPress={handlePayment} disabled={isSubmittingPayment}>
                                {isSubmittingPayment ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Submit</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ADD USER MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={addUserModalVisible}
                onRequestClose={() => setAddUserModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { width: '92%' }]}>
                        <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Create New Consumer</Text>
                        <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Enter Name"
                                value={newUserData.name}
                                onChangeText={(val) => setNewUserData({ ...newUserData, name: val })}
                            />

                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Enter Phone"
                                keyboardType="phone-pad"
                                value={newUserData.phoneNumber}
                                onChangeText={(val) => setNewUserData({ ...newUserData, phoneNumber: val })}
                            />

                            <Text style={styles.inputLabel}>Address</Text>
                            <TextInput
                                style={styles.formInput}
                                placeholder="Full Address"
                                value={newUserData.address}
                                onChangeText={(val) => setNewUserData({ ...newUserData, address: val })}
                                multiline
                            />

                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.inputLabel}>Opening Reading</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="0"
                                        keyboardType="numeric"
                                        value={newUserData.previousReading}
                                        onChangeText={(val) => setNewUserData({ ...newUserData, previousReading: val })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Initial Balance</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        placeholder="₹ 0.00"
                                        keyboardType="numeric"
                                        value={newUserData.initialBalance}
                                        onChangeText={(val) => setNewUserData({ ...newUserData, initialBalance: val })}
                                    />
                                </View>
                            </View>
                            <Text style={styles.helpText}>Login credentials and meter number will be generated automatically.</Text>
                        </ScrollView>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setAddUserModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.saveAllBtn, { marginTop: 0 }]} onPress={handleAddUser} disabled={isCreatingUser}>
                                {isCreatingUser ? <ActivityIndicator color="white" /> : <Text style={styles.saveAllBtnText}>Create Account</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* CONSUMER PROFILE EDIT MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={profileModalVisible}
                onRequestClose={() => setProfileModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { width: '92%', maxHeight: '90%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.modalTitle}>Manage Profile</Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleDeleteProfile}
                                style={[styles.deleteBtn, { marginRight: 15 }]}
                                disabled={isUpdatingProfile}
                            >
                                <Text style={styles.deleteBtnText}>Delete User</Text>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={styles.closeModalBtn}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.fieldSectionTitle}>Basic Information</Text>
                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.inputLabel}>Full Name</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.name}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, name: v })}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Username (@)</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.username}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, username: v })}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.inputLabel}>Phone Number</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.phoneNumber}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, phoneNumber: v })}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Alt Phone</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.altPhoneNumber}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, altPhoneNumber: v })}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Email Address</Text>
                            <TextInput
                                style={styles.formInput}
                                value={profileFormData.email}
                                onChangeText={(v) => setProfileFormData({ ...profileFormData, email: v })}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>Meter / Serial (WTR-XXXXXX)</Text>
                            <TextInput
                                style={styles.formInput}
                                value={profileFormData.meterNumber}
                                onChangeText={(v) => setProfileFormData({ ...profileFormData, meterNumber: v })}
                            />

                            <Text style={styles.inputLabel}>Address</Text>
                            <TextInput
                                style={styles.formInput}
                                value={profileFormData.address}
                                onChangeText={(v) => setProfileFormData({ ...profileFormData, address: v })}
                                multiline
                            />

                            <View style={styles.divider} />

                            <Text style={styles.fieldSectionTitle}>Meter Readings (Units)</Text>
                            <View style={styles.formRow}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.inputLabel}>Prev Reading</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.previousReading?.toString()}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, previousReading: v })}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Curr Reading</Text>
                                    <TextInput
                                        style={styles.formInput}
                                        value={profileFormData.currentReading?.toString()}
                                        onChangeText={(v) => setProfileFormData({ ...profileFormData, currentReading: v })}
                                        keyboardType="numeric"
                                    />
                                </View>
                            </View>

                            <View style={styles.divider} />

                            <Text style={styles.inputLabel}>Outstanding Balance (₹)</Text>
                            <TextInput
                                style={[styles.formInput, { fontSize: 20, fontWeight: 'bold', color: '#e53e3e' }]}
                                value={profileFormData.totalBalance?.toString()}
                                onChangeText={(v) => setProfileFormData({ ...profileFormData, totalBalance: v })}
                                keyboardType="numeric"
                            />
                            <Text style={styles.warnText}>* Modifying the balance updates the latest bill amount.</Text>

                        </ScrollView>

                        <TouchableOpacity
                            style={[styles.saveAllBtn, isUpdatingProfile && styles.disabledBtn]}
                            onPress={handleUpdateProfile}
                            disabled={isUpdatingProfile}
                        >
                            {isUpdatingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.saveAllBtnText}>Save All Changes</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f7fafc', padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    backBtn: { marginRight: 15, paddingVertical: 10, paddingRight: 20 },
    backBtnText: { fontSize: 26, fontWeight: 'bold', color: '#3182ce' },
    title: { fontSize: 22, fontWeight: '900', color: '#1a202c' },
    addBtn: { backgroundColor: '#3182ce', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
    addBtnText: { color: 'white', fontWeight: 'bold' },
    listContent: { paddingBottom: 50 },
    userCard: {
        backgroundColor: 'white',
        padding: 18,
        borderRadius: 15,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 18, fontWeight: 'bold', color: '#1a202c' },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    serialBadge: { marginLeft: 8, backgroundColor: '#ebf8ff', color: '#2b6cb0', fontSize: 10, fontWeight: 'bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    userSub: { fontSize: 13, color: '#718096', marginTop: 3 },
    userAction: { alignItems: 'flex-end', marginLeft: 10 },
    balanceText: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
    actionBtn: { backgroundColor: '#38a169', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    actionBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
    noData: { textAlign: 'center', color: '#a0aec0', marginTop: 50, fontStyle: 'italic' },
    errorText: { color: '#e53e3e', marginBottom: 10 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: 'white', width: '85%', padding: 25, borderRadius: 30, elevation: 15 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 22, fontWeight: '900', color: '#1a202c' },
    closeModalBtn: { padding: 5 },
    closeText: { fontSize: 20, color: '#a0aec0', fontWeight: 'bold' },
    fieldSectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#3182ce', textTransform: 'uppercase', marginBottom: 10, marginTop: 5 },
    formRow: { flexDirection: 'row', justifyContent: 'space-between' },
    modalSub: { fontSize: 14, color: '#718096', marginBottom: 20, lineHeight: 20 },
    modalInput: {
        borderWidth: 2,
        borderColor: '#edf2f7',
        borderRadius: 12,
        padding: 12,
        fontSize: 18,
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: '#f8fafc'
    },
    inputLabel: { fontSize: 11, fontWeight: 'bold', color: '#94a3b8', marginBottom: 5, textTransform: 'uppercase' },
    formInput: {
        borderWidth: 2,
        borderColor: '#f1f5f9',
        borderRadius: 12,
        padding: 12,
        marginBottom: 15,
        backgroundColor: '#f8fafc',
        fontSize: 15,
        color: '#1a202c'
    },
    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
    deleteBtn: { backgroundColor: '#fff5f5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#feb2b2' },
    deleteBtnText: { color: '#c53030', fontSize: 12, fontWeight: 'bold' },
    warnText: { fontSize: 11, color: '#a0aec0', fontStyle: 'italic', marginBottom: 10 },
    helpText: { fontSize: 12, color: '#a0aec0', fontStyle: 'italic', marginBottom: 10 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 0.48, padding: 15, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f1f5f9' },
    submitBtn: { backgroundColor: '#38a169' },
    saveAllBtn: { backgroundColor: '#2b6cb0', padding: 16, borderRadius: 15, alignItems: 'center', marginTop: 10 },
    disabledBtn: { opacity: 0.6 },
    saveAllBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
    submitBtnText: { color: 'white', fontWeight: 'bold' },

    // Calculator Styles
    calculationPreview: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#cbd5e0', marginTop: 10, marginBottom: 20 },
    previewTitle: { fontSize: 13, fontWeight: 'bold', color: '#2b6cb0', textTransform: 'uppercase', marginBottom: 12, textAlign: 'center' },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
    calcLabel: { fontSize: 13, color: '#64748b' },
    calcVal: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
    applyBtn: { backgroundColor: '#ebf8ff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: '#bee3f8', alignItems: 'center' },
    applyBtnText: { color: '#2b6cb0', fontSize: 12, fontWeight: 'bold' },
    calcActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    smallApplyBtn: { flex: 0.48, padding: 8, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    smallApplyText: { fontSize: 10, fontWeight: 'bold' }
});

export default ConsumerListScreen;
