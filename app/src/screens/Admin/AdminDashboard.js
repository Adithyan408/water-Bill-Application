import React, { useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Button, ActivityIndicator, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { AuthContext } from '../../context/AuthContext';
import api from '../../api';

const AdminDashboard = ({ navigation }) => {
    const { logout, userInfo } = useContext(AuthContext);
    const [stats, setStats] = useState({ paidThisMonth: 0, totalUnpaid: 0, debtorsAbove1000: [] });
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        admin_contact: '',
        admin_name: '',
        reader_contact: '',
        reader_name: '',
        TARIFF_UNDER_AMOUNT: '60',
        TARIFF_UNDER_THRESHOLD: '5000',
        TARIFF_NORMAL_AMOUNT: '110',
        TARIFF_NORMAL_THRESHOLD: '15000',
        TARIFF_SURCHARGE_RATE: '20'
    });
    const [isEditingAdmin, setIsEditingAdmin] = useState(false);
    const [isEditingReader, setIsEditingReader] = useState(false);
    const [isEditingTariff, setIsEditingTariff] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Admin Profile State
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [authModalVisible, setAuthModalVisible] = useState(false);
    const [adminProfile, setAdminProfile] = useState({ name: '', email: '', phoneNumber: '', altPhoneNumber: '' });
    const [editProfileData, setEditProfileData] = useState({
        name: '', email: '', phoneNumber: '', altPhoneNumber: '',
        currentPassword: '', newPassword: '', confirmPassword: ''
    });
    const [authVerify, setAuthVerify] = useState({ username: '', password: '' });
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    // Password Visibility State
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [showAuthPassword, setShowAuthPassword] = useState(false);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, settingsRes] = await Promise.all([
                api.get('/admin/dashboard-stats'),
                api.get('/admin/settings')
            ]);

            setStats(statsRes.data);

            // Map settings array to object
            const settingsObj = {
                admin_contact: '', admin_name: '', reader_contact: '', reader_name: '',
                TARIFF_UNDER_AMOUNT: '60', TARIFF_UNDER_THRESHOLD: '5000',
                TARIFF_NORMAL_AMOUNT: '110', TARIFF_NORMAL_THRESHOLD: '15000',
                TARIFF_SURCHARGE_RATE: '20'
            };
            if (Array.isArray(settingsRes.data)) {
                settingsRes.data.forEach(s => {
                    if (s.key === 'admin_contact') settingsObj.admin_contact = s.value;
                    if (s.key === 'admin_name') settingsObj.admin_name = s.value;
                    if (s.key === 'reader_contact') settingsObj.reader_contact = s.value;
                    if (s.key === 'reader_name') settingsObj.reader_name = s.value;
                    if (s.key === 'TARIFF_UNDER_AMOUNT') settingsObj.TARIFF_UNDER_AMOUNT = s.value;
                    if (s.key === 'TARIFF_UNDER_THRESHOLD') settingsObj.TARIFF_UNDER_THRESHOLD = s.value;
                    if (s.key === 'TARIFF_NORMAL_AMOUNT') settingsObj.TARIFF_NORMAL_AMOUNT = s.value;
                    if (s.key === 'TARIFF_NORMAL_THRESHOLD') settingsObj.TARIFF_NORMAL_THRESHOLD = s.value;
                    if (s.key === 'TARIFF_SURCHARGE_RATE') settingsObj.TARIFF_SURCHARGE_RATE = s.value;
                });
            }
            setSettings(settingsObj);

            // Fetch own profile
            const profileRes = await api.get('/admin/my-profile');
            setAdminProfile(profileRes.data);
            setEditProfileData(profileRes.data);
        } catch (e) {
            console.error('Error fetching admin data:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        // Validation for password change
        if (editProfileData.newPassword) {
            if (editProfileData.newPassword !== editProfileData.confirmPassword) {
                Alert.alert('Error', 'New passwords do not match');
                return;
            }
            if (editProfileData.newPassword.length < 6) {
                Alert.alert('Error', 'New password must be at least 6 characters');
                return;
            }
            if (!editProfileData.currentPassword) {
                Alert.alert('Error', 'Please enter your current password to change it');
                return;
            }
        }

        setIsUpdatingProfile(true);
        try {
            await api.patch('/admin/my-profile', {
                ...editProfileData,
                verifyUsername: authVerify.username,
                verifyPassword: authVerify.password
            });

            // Update local state without sensitive data
            const updatedProfile = { ...editProfileData };
            delete updatedProfile.currentPassword;
            delete updatedProfile.newPassword;
            delete updatedProfile.confirmPassword;

            setAdminProfile(updatedProfile);
            setAuthModalVisible(false);
            setProfileModalVisible(false);
            setAuthVerify({ username: '', password: '' });
            setEditProfileData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));

            // Success alert for credentials/profile change
            Alert.alert('Success', 'Credentials saved successfully');
        } catch (e) {
            const msg = e.response?.data?.message || 'Update failed';
            Alert.alert('Verification Error', msg);
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleSaveSettings = async (key, value) => {
        setIsSavingSettings(true);
        try {
            await api.post('/admin/settings', { key, value });
            setSettings(prev => ({ ...prev, [key]: value }));
        } catch (e) {
            Alert.alert('Error', 'Failed to save contact number');
        } finally {
            setIsSavingSettings(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Helper for Password Field with Eye
    const PassInput = ({ label, value, onChange, show, setShow, placeholder = "" }) => (
        <View style={{ marginBottom: 12 }}>
            <Text style={styles.inputLabel}>{label}</Text>
            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry={!show}
                    autoCapitalize="none"
                    placeholder={placeholder}
                />
                <TouchableOpacity onPress={() => setShow(!show)} style={styles.eyeIcon}>
                    <Text style={{ fontSize: 16 }}>{show ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderDebtor = ({ item }) => (
        <View style={styles.debtorCard}>
            <View>
                <Text style={styles.debtorName}>{item.name}</Text>
                <Text style={styles.debtorSub}>{item.username} | {item.meterNumber}</Text>
            </View>
            <Text style={styles.debtorAmount}>₹{item.totalPending.toFixed(2)}</Text>
        </View>
    );

    return (
        <ScrollView style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Admin Hub</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity
                        onPress={() => {
                            setEditProfileData(adminProfile);
                            setProfileModalVisible(true);
                        }}
                        style={[styles.logoutBtn, { marginRight: 15 }]}
                    >
                        <Text style={{ fontSize: 24 }}>👤</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3182ce" style={{ marginTop: 50 }} />
            ) : (
                <>
                    <View style={styles.statsGrid}>
                        <View style={[styles.statCard, { borderLeftColor: '#38a169', borderLeftWidth: 5 }]}>
                            <Text style={styles.statLabel}>Paid This Month</Text>
                            <Text style={[styles.statNumber, { color: '#38a169' }]}>
                                ₹{stats.paidThisMonth.toLocaleString()}
                            </Text>
                        </View>

                        <View style={[styles.statCard, { borderLeftColor: '#e53e3e', borderLeftWidth: 5 }]}>
                            <Text style={styles.statLabel}>Total Outstanding</Text>
                            <Text style={[styles.statNumber, { color: '#e53e3e' }]}>
                                ₹{stats.totalUnpaid.toLocaleString()}
                            </Text>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Global Tiered Tariff Configuration</Text>
                    <View style={[styles.statCard, { borderLeftColor: '#3182ce', borderLeftWidth: 5 }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.cardIndicator}>Multi-Tier Billing Rules</Text>
                            <TouchableOpacity
                                style={[styles.editBtn, isEditingTariff ? styles.saveInlineBtn : null]}
                                onPress={async () => {
                                    if (isEditingTariff) {
                                        const confirm = window.confirm(`Update all 5 tariff tiers? This will immediately affect all future bill calculations.`);
                                        if (confirm) {
                                            await Promise.all([
                                                handleSaveSettings('TARIFF_UNDER_AMOUNT', settings.TARIFF_UNDER_AMOUNT),
                                                handleSaveSettings('TARIFF_UNDER_THRESHOLD', settings.TARIFF_UNDER_THRESHOLD),
                                                handleSaveSettings('TARIFF_NORMAL_AMOUNT', settings.TARIFF_NORMAL_AMOUNT),
                                                handleSaveSettings('TARIFF_NORMAL_THRESHOLD', settings.TARIFF_NORMAL_THRESHOLD),
                                                handleSaveSettings('TARIFF_SURCHARGE_RATE', settings.TARIFF_SURCHARGE_RATE)
                                            ]);
                                            setIsEditingTariff(false);
                                            Alert.alert('Updated', 'All tariff tiers updated successfully.');
                                        }
                                    } else {
                                        const proceed = window.confirm("Are you sure? Modifying these 5 fields will change the tiered billing logic for everyone.");
                                        if (proceed) setIsEditingTariff(true);
                                    }
                                }}
                            >
                                <Text style={[styles.editBtnText, isEditingTariff ? { color: 'white' } : null]}>
                                    {isEditingTariff ? 'Confirm All Tiers' : 'Modify Tiers'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Tier 1: Under Usage */}
                        <Text style={styles.tierSubTitle}>Tier 1: Under Usage</Text>
                        <View style={styles.formRow}>
                            <View style={{ flex: 1, marginRight: 15 }}>
                                <Text style={styles.inputLabel}>Under Amount (₹)</Text>
                                <TextInput
                                    style={[styles.input, !isEditingTariff && styles.disabledInput]}
                                    value={settings.TARIFF_UNDER_AMOUNT}
                                    onChangeText={(val) => setSettings({ ...settings, TARIFF_UNDER_AMOUNT: val })}
                                    editable={isEditingTariff}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Under Threshold (L)</Text>
                                <TextInput
                                    style={[styles.input, !isEditingTariff && styles.disabledInput]}
                                    value={settings.TARIFF_UNDER_THRESHOLD}
                                    onChangeText={(val) => setSettings({ ...settings, TARIFF_UNDER_THRESHOLD: val })}
                                    editable={isEditingTariff}
                                    keyboardType="numeric"
                                    placeholder="e.g. 5000"
                                />
                            </View>
                        </View>

                        {/* Tier 2 & 3: Normal & Extra */}
                        <Text style={[styles.tierSubTitle, { marginTop: 15 }]}>Tier 2 & 3: Normal & Surcharge</Text>
                        <View style={styles.formRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.inputLabel}>Normal Base (₹)</Text>
                                <TextInput
                                    style={[styles.input, !isEditingTariff && styles.disabledInput]}
                                    value={settings.TARIFF_NORMAL_AMOUNT}
                                    onChangeText={(val) => setSettings({ ...settings, TARIFF_NORMAL_AMOUNT: val })}
                                    editable={isEditingTariff}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.inputLabel}>Normal Limit (L)</Text>
                                <TextInput
                                    style={[styles.input, !isEditingTariff && styles.disabledInput]}
                                    value={settings.TARIFF_NORMAL_THRESHOLD}
                                    onChangeText={(val) => setSettings({ ...settings, TARIFF_NORMAL_THRESHOLD: val })}
                                    editable={isEditingTariff}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.inputLabel}>Extra/1000L (₹)</Text>
                                <TextInput
                                    style={[styles.input, !isEditingTariff && styles.disabledInput]}
                                    value={settings.TARIFF_SURCHARGE_RATE}
                                    onChangeText={(val) => setSettings({ ...settings, TARIFF_SURCHARGE_RATE: val })}
                                    editable={isEditingTariff}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Support Contact Configuration</Text>

                    {/* Admin Contact Block */}
                    <View style={styles.statCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.cardIndicator}>Admin Office Info</Text>
                            <TouchableOpacity
                                style={[styles.editBtn, isEditingAdmin ? styles.saveInlineBtn : null]}
                                onPress={async () => {
                                    if (isEditingAdmin) {
                                        await Promise.all([
                                            handleSaveSettings('admin_name', settings.admin_name),
                                            handleSaveSettings('admin_contact', settings.admin_contact)
                                        ]);
                                        setIsEditingAdmin(false);
                                    } else {
                                        setIsEditingAdmin(true);
                                    }
                                }}
                            >
                                <Text style={[styles.editBtnText, isEditingAdmin ? { color: 'white' } : null]}>
                                    {isEditingAdmin ? 'Save' : 'Edit Info'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>In-Charge Name</Text>
                            <TextInput
                                style={[styles.input, !isEditingAdmin && styles.disabledInput]}
                                value={settings.admin_name}
                                onChangeText={(val) => setSettings({ ...settings, admin_name: val })}
                                editable={isEditingAdmin}
                                placeholder="Admin Name"
                            />
                        </View>
                        <View style={[styles.inputGroup, { marginTop: 15 }]}>
                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={[styles.input, !isEditingAdmin && styles.disabledInput]}
                                value={settings.admin_contact}
                                onChangeText={(val) => setSettings({ ...settings, admin_contact: val })}
                                editable={isEditingAdmin}
                                placeholder="Admin Phone"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    {/* Reader Contact Block */}
                    <View style={styles.statCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.cardIndicator}>Meter Reader Info</Text>
                            <TouchableOpacity
                                style={[styles.editBtn, isEditingReader ? styles.saveInlineBtn : null]}
                                onPress={async () => {
                                    if (isEditingReader) {
                                        await Promise.all([
                                            handleSaveSettings('reader_name', settings.reader_name),
                                            handleSaveSettings('reader_contact', settings.reader_contact)
                                        ]);
                                        setIsEditingReader(false);
                                    } else {
                                        setIsEditingReader(true);
                                    }
                                }}
                            >
                                <Text style={[styles.editBtnText, isEditingReader ? { color: 'white' } : null]}>
                                    {isEditingReader ? 'Save' : 'Edit Info'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Reader Name</Text>
                            <TextInput
                                style={[styles.input, !isEditingReader && styles.disabledInput]}
                                value={settings.reader_name}
                                onChangeText={(val) => setSettings({ ...settings, reader_name: val })}
                                editable={isEditingReader}
                                placeholder="Reader Name"
                            />
                        </View>
                        <View style={[styles.inputGroup, { marginTop: 15 }]}>
                            <Text style={styles.inputLabel}>Phone Number</Text>
                            <TextInput
                                style={[styles.input, !isEditingReader && styles.disabledInput]}
                                value={settings.reader_contact}
                                onChangeText={(val) => setSettings({ ...settings, reader_contact: val })}
                                editable={isEditingReader}
                                placeholder="Reader Phone"
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>High Debtors ({'>'} ₹1,000)</Text>
                    {stats.debtorsAbove1000.length > 0 ? (
                        stats.debtorsAbove1000.map((item) => renderDebtor({ item }))
                    ) : (
                        <View style={styles.noDataBox}>
                            <Text style={styles.noDataText}>No consumers with debt {'>'} ₹1,000</Text>
                        </View>
                    )}

                    <View style={styles.footerBtns}>
                        <TouchableOpacity
                            style={styles.manageBtn}
                            onPress={() => navigation.navigate('ConsumerList')}
                        >
                            <Text style={styles.manageBtnText}>Manage Consumers</Text>
                        </TouchableOpacity>
                        <Button title="Refresh Dashboard" onPress={fetchDashboardData} color="#3182ce" />
                    </View>
                </>
            )}

            {/* Admin Profile Modal */}
            <Modal
                visible={profileModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setProfileModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Admin Credentials</Text>
                            <TouchableOpacity onPress={() => setProfileModalVisible(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.inputLabel}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                value={editProfileData.name}
                                onChangeText={(val) => setEditProfileData({ ...editProfileData, name: val })}
                            />

                            <Text style={styles.inputLabel}>Email ID</Text>
                            <TextInput
                                style={styles.input}
                                value={editProfileData.email}
                                onChangeText={(val) => setEditProfileData({ ...editProfileData, email: val })}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            <Text style={styles.inputLabel}>Primary Phone</Text>
                            <TextInput
                                style={styles.input}
                                value={editProfileData.phoneNumber}
                                onChangeText={(val) => setEditProfileData({ ...editProfileData, phoneNumber: val })}
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.inputLabel}>Additional Phone</Text>
                            <TextInput
                                style={styles.input}
                                value={editProfileData.altPhoneNumber}
                                onChangeText={(val) => setEditProfileData({ ...editProfileData, altPhoneNumber: val })}
                                keyboardType="phone-pad"
                            />

                            <View style={{ marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#edf2f7' }}>
                                <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 10 }]}>Change Password</Text>
                                <Text style={styles.helpText}>Leave blank if you don't want to change it.</Text>

                                <PassInput
                                    label="Current Password"
                                    value={editProfileData.currentPassword}
                                    onChange={(val) => setEditProfileData({ ...editProfileData, currentPassword: val })}
                                    show={showCurrentPassword}
                                    setShow={setShowCurrentPassword}
                                    placeholder="Required only for password change"
                                />

                                <PassInput
                                    label="New Password"
                                    value={editProfileData.newPassword}
                                    onChange={(val) => setEditProfileData({ ...editProfileData, newPassword: val })}
                                    show={showNewPassword}
                                    setShow={setShowNewPassword}
                                />

                                <PassInput
                                    label="Confirm New Password"
                                    value={editProfileData.confirmPassword}
                                    onChange={(val) => setEditProfileData({ ...editProfileData, confirmPassword: val })}
                                    show={showConfirmPassword}
                                    setShow={setShowConfirmPassword}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.manageBtn, { marginTop: 20 }]}
                                onPress={() => setAuthModalVisible(true)}
                            >
                                <Text style={styles.manageBtnText}>Update Profile</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Identity Verification Sub-Modal */}
            <Modal
                visible={authModalVisible}
                transparent={true}
                animationType="slide"
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={[styles.modalContent, { width: '90%', maxWidth: 400, paddingVertical: 30 }]}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 32, marginBottom: 10 }}>🔒</Text>
                            <Text style={[styles.modalTitle, { textAlign: 'center', marginBottom: 5 }]}>Admin Authorization</Text>
                            <Text style={[styles.helpText, { textAlign: 'center', marginHorizontal: 20 }]}>
                                Please re-verify your identity to confirm these sensitive profile changes.
                            </Text>
                        </View>

                        <View style={{ width: '100%' }}>
                            <Text style={styles.inputLabel}>Admin Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Username"
                                value={authVerify.username}
                                onChangeText={(val) => setAuthVerify({ ...authVerify, username: val })}
                                autoCapitalize="none"
                            />

                            <PassInput
                                label="Current Password"
                                value={authVerify.password}
                                onChange={(val) => setAuthVerify({ ...authVerify, password: val })}
                                show={showAuthPassword}
                                setShow={setShowAuthPassword}
                                placeholder="••••••••"
                            />
                        </View>

                        <View style={[styles.authModalFooter, { marginTop: 10 }]}>
                            <TouchableOpacity
                                style={[styles.cancelAuthBtn, { height: 50, justifyContent: 'center' }]}
                                onPress={() => {
                                    setAuthModalVisible(false);
                                    setAuthVerify({ username: '', password: '' });
                                }}
                            >
                                <Text style={styles.cancelAuthBtnText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmAuthBtn, { height: 50, justifyContent: 'center' }, isUpdatingProfile && { opacity: 0.7 }]}
                                onPress={handleUpdateProfile}
                                disabled={isUpdatingProfile}
                            >
                                {isUpdatingProfile ?
                                    <ActivityIndicator color="white" size="small" /> :
                                    <Text style={styles.confirmAuthBtnText}>Confirm Changes</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f7fafc' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    header: { fontSize: 26, fontWeight: '900', color: '#1a202c' },
    logoutBtn: { padding: 5 },
    logoutText: { color: '#e53e3e', fontWeight: 'bold' },

    statsGrid: { marginBottom: 30 },
    statCard: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 12,
        marginBottom: 15,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5
    },
    statLabel: { fontSize: 13, color: '#718096', textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
    statNumber: { fontSize: 30, fontWeight: '900', marginTop: 5 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2d3748', marginBottom: 15 },
    debtorCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#edf2f7'
    },
    debtorName: { fontSize: 16, fontWeight: 'bold', color: '#1a202c' },
    debtorSub: { fontSize: 12, color: '#a0aec0', marginTop: 2 },
    debtorAmount: { fontSize: 18, fontWeight: 'bold', color: '#e53e3e' },

    inputGroup: { width: '100%' },
    inputLabel: { fontSize: 13, color: '#718096', fontWeight: 'bold', marginBottom: 5 },
    row: { flexDirection: 'row', alignItems: 'center' },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10, backgroundColor: 'white', color: '#2d3748', marginBottom: 12 },
    disabledInput: { backgroundColor: '#f8fafc', color: '#a0aec0' },

    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        backgroundColor: 'white',
        height: 50,
    },
    passwordInput: {
        flex: 1,
        paddingHorizontal: 12,
        height: '100%',
        color: '#2d3748',
    },
    eyeIcon: {
        paddingHorizontal: 15,
        height: '100%',
        justifyContent: 'center',
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: 'white', borderRadius: 16, padding: 25, width: '90%', maxHeight: '80%' },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a202c', marginBottom: 15 },
    closeText: { fontSize: 20, color: '#a0aec0' },

    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    cardIndicator: { fontSize: 14, fontWeight: 'bold', color: '#2b6cb0', textTransform: 'uppercase' },
    editBtn: { backgroundColor: '#edf2f7', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8 },
    saveInlineBtn: { backgroundColor: '#38a169' },
    editBtnText: { fontSize: 12, fontWeight: 'bold', color: '#4a5568' },

    noDataBox: { padding: 40, alignItems: 'center', backgroundColor: '#edf2f7', borderRadius: 10 },
    noDataText: { color: '#718096', fontStyle: 'italic' },
    manageBtn: {
        backgroundColor: '#2b6cb0',
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10
    },
    manageBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16
    },
    helpText: { fontSize: 11, color: '#a0aec0', marginTop: 10, fontStyle: 'italic' },
    tierSubTitle: { fontSize: 13, fontWeight: 'bold', color: '#4a5568', marginTop: 5, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    footerBtns: { marginTop: 20, marginBottom: 50 },

    authModalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
    cancelAuthBtn: { flex: 0.45, padding: 12, borderRadius: 8, backgroundColor: '#edf2f7', alignItems: 'center' },
    cancelAuthBtnText: { color: '#4a5568', fontWeight: 'bold' },
    confirmAuthBtn: { flex: 0.45, padding: 12, borderRadius: 8, backgroundColor: '#38a169', alignItems: 'center' },
    confirmAuthBtnText: { color: 'white', fontWeight: 'bold' }
});

export default AdminDashboard;
