import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import Collapsible from 'react-native-collapsible';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';
import { getConsumerBills } from '../../database';
import { AppSyncEngine } from '../../services/SyncEngine';

const ConsumerDashboard = () => {
    const { logout, userInfo, updateUser } = useContext(AuthContext);
    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeAccordion, setActiveAccordion] = useState(null);

    // Profile & Password State
    const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [isUsernameEditable, setIsUsernameEditable] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [supportContacts, setSupportContacts] = useState({ admin: 'Not Set', reader: 'Not Set' });

    // Populate data when modal opens
    const openProfileModal = () => {
        setNewUsername(userInfo?.username || '');
        setIsUsernameEditable(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsProfileModalVisible(true);
    };

    const fetchSupportContacts = async () => {
        try {
            const response = await api.get('/admin/settings');
            const contacts = { admin: 'Not Set', adminName: '', reader: 'Not Set', readerName: '' };
            if (Array.isArray(response.data)) {
                response.data.forEach(s => {
                    if (s.key === 'admin_contact') contacts.admin = s.value;
                    if (s.key === 'admin_name') contacts.adminName = s.value;
                    if (s.key === 'reader_contact') contacts.reader = s.value;
                    if (s.key === 'reader_name') contacts.readerName = s.value;
                });
            }
            setSupportContacts(contacts);
        } catch (e) {
            console.error('Error fetching support info:', e);
        }
    };

    const loadData = async () => {
        if (!userInfo?.id) return;
        setLoading(true);
        try {
            // Force a sync to ensure fresh data after login
            console.log(`[DASHBOARD] Triggering sync for ${userInfo.username}`);
            await AppSyncEngine.syncData();
            const localBills = await getConsumerBills(userInfo.id);
            console.log(`[DASHBOARD] Loaded ${localBills.length} bills.`);
            setBills(localBills);
        } catch (e) {
            console.error('Data load error:', e);
            const localBills = await getConsumerBills(userInfo.id);
            setBills(localBills);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userInfo?.id) {
            loadData();
            fetchSupportContacts();
        }
    }, [userInfo?.id]);

    const toggleAccordion = (id) => {
        setActiveAccordion(activeAccordion === id ? null : id);
    };

    const handleUpdateProfile = async () => {
        // Validation: Only require current password if they are trying to change it
        if (newPassword && !currentPassword) {
            Alert.alert('Error', 'Verification Required: Please enter your CURRENT password to set a new one.');
            return;
        }

        if (newPassword && newPassword !== confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        setIsChangingPassword(true);
        try {
            console.log(`[UPDATE_PROFILE] Attempting update for ${userInfo.username} to ${newUsername}`);
            const response = await api.post('/auth/update-profile', {
                currentPassword,
                newPassword: newPassword || undefined,
                newUsername: newUsername !== userInfo?.username ? newUsername : undefined
            });

            Alert.alert('Success', 'Credentials saved successfully');

            // Sync local state
            if (response.data.user) {
                updateUser(response.data.user);
            }

            setIsUsernameEditable(false);
            setIsProfileModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to update profile');
        } finally {
            setIsChangingPassword(false);
        }
    };

    const renderBillDetails = (item) => (
        <View style={styles.billDetails}>
            <Text style={styles.detailText}>Billed On: {new Date(item.billingDate).toLocaleDateString()}</Text>
            <Text style={styles.detailText}>Consumption: {item.consumption.toLocaleString()} Litres</Text>
            <Text style={styles.detailText}>Previous Reading: {item.previousReading}</Text>
            <Text style={styles.detailText}>Current Reading: {item.currentReading}</Text>
            <Text style={styles.detailText}>Due Date: {new Date(item.dueDate).toLocaleDateString()}</Text>
        </View>
    );

    const renderAccordionItem = (item, index) => (
        <View key={item.offlineId} style={styles.accordionContainer}>
            <TouchableOpacity onPress={() => toggleAccordion(item.offlineId)} style={styles.accordionHeader}>
                <View>
                    <Text style={styles.accordionTitle}>
                        {new Date(item.billingDate).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={[styles.statusBadge, item.status === 'Paid' ? styles.paidBadge : styles.unpaidBadge]}>
                        {item.status}
                    </Text>
                </View>
                <Text style={styles.accordionAmount}>₹{item.amount.toFixed(2)}</Text>
            </TouchableOpacity>

            <Collapsible collapsed={activeAccordion !== item.offlineId}>
                {renderBillDetails(item)}
            </Collapsible>
        </View>
    );

    const latestBill = bills.length > 0 ? bills[0] : null;
    const historyBills = bills.length > 1 ? bills.slice(1) : [];

    // Calculate total unpaid balance safely as numbers
    const totalBalanceToPay = bills
        .filter(b => b.status === 'Unpaid')
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerBox}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeText}>Howdy, {userInfo?.name} 👋</Text>
                    <Text style={styles.profileId}>ID: {userInfo?.username}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={openProfileModal}
                        style={styles.profileIconBtn}
                    >
                        <Text style={styles.profileIconText}>👤</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.summaryBox, totalBalanceToPay === 0 ? styles.paidBox : null]}>
                <Text style={styles.summaryTitle}>Current Balance to Pay</Text>
                <Text style={styles.summaryAmount}>
                    ₹{totalBalanceToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
                {totalBalanceToPay > 0 ? (
                    <Text style={styles.allPaidText}>Includes all pending monthly bills</Text>
                ) : (
                    <Text style={styles.allPaidText}>Great! No pending payments.</Text>
                )}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 20 }} />
            ) : (
                <>
                    {latestBill && (
                        <View style={styles.latestCard}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.sectionTitle}>Latest Bill Detailed</Text>
                                <Text style={[styles.statusTag, latestBill.status === 'Paid' ? styles.paidTag : styles.unpaidTag]}>
                                    {latestBill.status === 'Unpaid' ? 'TO BE PAID' : 'SETTLED'}
                                </Text>
                            </View>

                            <View style={styles.latestRow}>
                                <View>
                                    <Text style={styles.latestMonth}>
                                        {new Date(latestBill.billingDate).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                                    </Text>
                                    <Text style={styles.readingSub}>Reader reading: {latestBill.currentReading}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.itemLabel}>Billing Amount</Text>
                                    <Text style={styles.latestAmount}>₹{latestBill.amount.toFixed(2)}</Text>
                                </View>
                            </View>

                            <View style={styles.divider} />
                            {renderBillDetails(latestBill)}

                            {totalBalanceToPay > latestBill.amount && (
                                <View style={styles.balanceInfoBox}>
                                    <Text style={styles.balanceInfoText}>
                                        Total Payable: ₹{totalBalanceToPay.toFixed(2)} (Last Bill ₹{latestBill.amount.toFixed(2)} + Previous Dues)
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {historyBills.length > 0 && (
                        <View style={styles.historySection}>
                            <Text style={styles.sectionTitle}>Recent Bills History</Text>
                            {historyBills.map((item, index) => renderAccordionItem(item, index))}
                        </View>
                    )}

                    {bills.length === 0 && (
                        <Text style={styles.noBillsText}>No bills found on record.</Text>
                    )}
                </>
            )
            }

            <View style={styles.footerBtns}>
                <Button title="Refresh Status" onPress={loadData} color="#3182ce" />
            </View>

            {/* Profile / Update Account Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isProfileModalVisible}
                onRequestClose={() => setIsProfileModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { width: '90%', maxWidth: 400 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Update Account</Text>
                            <TouchableOpacity onPress={() => setIsProfileModalVisible(false)}>
                                <Text style={styles.closeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalSub}>Update your profile details below. Remember to click "Save Changes" at the bottom to sync with server.</Text>

                            <Text style={styles.inputLabel}>Username</Text>
                            <View style={styles.usernameRow}>
                                <TextInput
                                    style={[styles.modalInput, { flex: 1, backgroundColor: isUsernameEditable ? '#fff' : '#f1f5f9' }]}
                                    value={newUsername}
                                    onChangeText={setNewUsername}
                                    editable={isUsernameEditable}
                                    placeholder="Edit username"
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={[styles.editBtn, isUsernameEditable && newUsername !== userInfo?.username ? styles.saveInlineBtn : null]}
                                    onPress={() => {
                                        if (!isUsernameEditable) {
                                            setIsUsernameEditable(true);
                                        } else {
                                            if (newUsername !== userInfo?.username) {
                                                handleUpdateProfile();
                                            } else {
                                                setIsUsernameEditable(false);
                                            }
                                        }
                                    }}
                                >
                                    <Text style={[styles.editBtnText, isUsernameEditable && newUsername !== userInfo?.username ? { color: 'white' } : null]}>
                                        {!isUsernameEditable ? 'Edit' : (newUsername !== userInfo?.username ? 'Save' : 'Done')}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            <Text style={styles.inputLabel}>Current Password (Required)</Text>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={[styles.modalInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    secureTextEntry={!showPasswords}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    placeholder="Verify current password"
                                />
                                <TouchableOpacity
                                    style={styles.eyeBtn}
                                    onPress={() => setShowPasswords(!showPasswords)}
                                >
                                    <Text>{showPasswords ? '👁️' : '🙈'}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.inputLabel}>New Password (Optional)</Text>
                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={[styles.modalInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }]}
                                    secureTextEntry={!showPasswords}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Leave blank to keep current"
                                />
                                <TouchableOpacity
                                    style={styles.eyeBtn}
                                    onPress={() => setShowPasswords(!showPasswords)}
                                >
                                    <Text>{showPasswords ? '👁️' : '🙈'}</Text>
                                </TouchableOpacity>
                            </View>

                            {newPassword.length > 0 && (
                                <>
                                    <Text style={styles.inputLabel}>Confirm New Password</Text>
                                    <View style={styles.passwordInputContainer}>
                                        <TextInput
                                            style={[styles.modalInput, { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }, newPassword !== confirmPassword && confirmPassword ? styles.inputError : null]}
                                            secureTextEntry={!showPasswords}
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            placeholder="Repeat new password"
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeBtn}
                                            onPress={() => setShowPasswords(!showPasswords)}
                                        >
                                            <Text>{showPasswords ? '👁️' : '🙈'}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.cancelBtn]}
                                    onPress={() => setIsProfileModalVisible(false)}
                                >
                                    <Text style={styles.cancelBtnText}>Discard</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, styles.submitBtn]}
                                    onPress={handleUpdateProfile}
                                    disabled={isChangingPassword}
                                >
                                    {isChangingPassword ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>Save Changes</Text>}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            <Text style={[styles.inputLabel, { textAlign: 'center', marginBottom: 15 }]}>Contact Support</Text>
                            <View style={styles.contactSection}>
                                <View style={[styles.contactItem, { borderRightWidth: 1, borderRightColor: '#f1f5f9' }]}>
                                    <Text style={styles.contactLabel}>Admin Office</Text>
                                    <Text style={styles.contactValue}>{supportContacts.adminName || 'N/A'}</Text>
                                    <Text style={[styles.contactValue, { fontSize: 11, fontWeight: 'normal' }]}>{supportContacts.admin}</Text>
                                </View>
                                <View style={styles.contactItem}>
                                    <Text style={styles.contactLabel}>Meter Reader</Text>
                                    <Text style={styles.contactValue}>{supportContacts.readerName || 'N/A'}</Text>
                                    <Text style={[styles.contactValue, { fontSize: 11, fontWeight: 'normal' }]}>{supportContacts.reader}</Text>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },

    headerBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    welcomeText: { fontSize: 22, fontWeight: 'bold', color: '#1a202c' },
    profileId: { fontSize: 13, color: '#718096', marginTop: 2 },
    logoutBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    logoutText: { color: '#991b1b', fontWeight: 'bold', fontSize: 13 },
    profileIconBtn: { marginRight: 10, padding: 5, backgroundColor: '#f1f5f9', borderRadius: 20 },
    profileIconText: { fontSize: 20 },

    summaryBox: { backgroundColor: '#ef4444', padding: 24, borderRadius: 20, marginBottom: 20, alignItems: 'center', elevation: 8, shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
    paidBox: { backgroundColor: '#10b981', shadowColor: '#10b981' },
    summaryTitle: { color: 'white', fontSize: 16, fontWeight: '600', opacity: 0.9 },
    summaryAmount: { color: 'white', fontSize: 42, fontWeight: '900', marginTop: 8 },
    allPaidText: { color: 'white', marginTop: 10, fontSize: 13, opacity: 0.8 },

    contactSection: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30, backgroundColor: 'white', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0' },
    contactItem: { flex: 1, alignItems: 'center' },
    contactLabel: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' },
    contactValue: { fontSize: 14, color: '#0f172a', fontWeight: 'bold', marginTop: 2 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#334155' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },

    latestCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, marginBottom: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, borderWidth: 1, borderColor: '#f1f5f9' },
    latestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    latestMonth: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    readingSub: { fontSize: 14, color: '#64748b', marginTop: 2 },
    itemLabel: { fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
    latestAmount: { fontSize: 24, fontWeight: '800', color: '#0f172a' },

    statusTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, fontSize: 11, fontWeight: '900', overflow: 'hidden' },
    unpaidTag: { backgroundColor: '#fef2f2', color: '#ef4444' },
    paidTag: { backgroundColor: '#ecfdf5', color: '#10b981' },

    divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 15 },
    balanceInfoBox: { marginTop: 15, backgroundColor: '#fff7ed', padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#f97316' },
    balanceInfoText: { fontSize: 13, color: '#c2410c', fontWeight: '500' },

    historySection: { marginBottom: 20 },
    accordionContainer: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#f8fafc' },
    accordionTitle: { fontSize: 16, fontWeight: '600', color: '#4a5568' },
    accordionAmount: { fontSize: 18, fontWeight: '700', color: '#2d3748' },

    billDetails: { padding: 8, backgroundColor: 'white' },
    detailText: { fontSize: 14, color: '#64748b', marginBottom: 4 },

    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, fontSize: 12, fontWeight: 'bold', alignSelf: 'flex-start', marginTop: 4, overflow: 'hidden' },
    paidBadge: { backgroundColor: '#c6f6d5', color: '#22543d' },
    unpaidBadge: { backgroundColor: '#fed7d7', color: '#822727' },

    noBillsText: { textAlign: 'center', color: '#94a3b8', fontSize: 16, marginTop: 20, fontStyle: 'italic' },
    footerBtns: { marginTop: 10, marginBottom: 50 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: 'white', maxHeight: '80%', padding: 25, borderRadius: 25, elevation: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#1a202c' },
    closeBtn: { fontSize: 20, color: '#a0aec0', fontWeight: 'bold' },
    modalSub: { fontSize: 14, color: '#718096', marginBottom: 15 },
    inputLabel: { fontSize: 12, fontWeight: '800', color: '#4a5568', marginBottom: 5, marginTop: 15, textTransform: 'uppercase' },
    modalInput: { borderWidth: 2, borderColor: '#edf2f7', borderRadius: 12, padding: 12, fontSize: 16, backgroundColor: '#f8fafc' },

    usernameRow: { flexDirection: 'row', alignItems: 'center' },
    editBtn: { marginLeft: 10, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, backgroundColor: '#edf2f7' },
    saveInlineBtn: { backgroundColor: '#38a169' },
    editBtnText: { fontSize: 12, fontWeight: 'bold', color: '#4a5568' },

    inputError: { borderColor: '#feb2b2', backgroundColor: '#fff5f5' },
    passwordInputContainer: { flexDirection: 'row' },
    eyeBtn: { backgroundColor: '#edf2f7', borderTopRightRadius: 12, borderBottomRightRadius: 12, justifyContent: 'center', paddingHorizontal: 15, borderLeftWidth: 0 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 10 },
    modalBtn: { flex: 0.48, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f1f5f9' },
    submitBtn: { backgroundColor: '#2b6cb0' },
    cancelBtnText: { color: '#64748b', fontWeight: 'bold' },
    submitBtnText: { color: 'white', fontWeight: 'bold' }
});

export default ConsumerDashboard;
