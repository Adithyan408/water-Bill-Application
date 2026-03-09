import React, { useContext, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Platform } from 'react-native';
import { AuthContext } from '../../context/AuthContext';

const LoginScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);

    const { login, isLoading } = useContext(AuthContext);

    const handleLogin = async () => {
        setError(null);
        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        console.log(`[LOGIN_ATTEMPT] User: ${username}`);
        const result = await login(username, password);

        if (!result || result.success !== true) {
            setError('Enter correct credentials');
            if (Platform.OS === 'web') {
                window.alert('Enter correct credentials');
            } else {
                Alert.alert('Login Failed', 'Enter correct credentials');
            }
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>WaterBill App Login</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />

            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                >
                    <Text style={{ fontSize: 18 }}>{showPassword ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
            </View>

            {error && <Text style={[styles.errorText, { fontWeight: '900', fontSize: 16, borderBottomWidth: 1, borderColor: 'rgba(255,0,0,0.1)', paddingBottom: 5 }]}>{error}</Text>}

            {isLoading ? (
                <ActivityIndicator size="large" color="#0000ff" />
            ) : (
                <Button title="Login" onPress={handleLogin} />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
        color: '#005b96',
    },
    input: {
        height: 50,
        borderColor: '#ccc',
        borderWidth: 1,
        marginBottom: 15,
        paddingHorizontal: 10,
        borderRadius: 5,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        marginBottom: 15,
        height: 50,
    },
    passwordInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: 10,
    },
    eyeIcon: {
        paddingHorizontal: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: 'red',
        marginBottom: 10,
        textAlign: 'center',
    }
});

export default LoginScreen;
