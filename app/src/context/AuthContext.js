import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';
import { clearDatabase } from '../database';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [userToken, setUserToken] = useState(null);
    const [userInfo, setUserInfo] = useState(null);

    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const response = await api.post('/auth/login', { username, password });

            const { token, user } = response.data;

            setUserInfo(user);
            setUserToken(token);

            await AsyncStorage.setItem('userInfo', JSON.stringify(user));
            await AsyncStorage.setItem('userToken', token);

            return { success: true };
        } catch (e) {
            console.log(`Login error: ${e}`);
            return { success: false, message: e.response?.data?.message || 'Login failed' };
        } finally {
            setIsLoading(false);
        }
    };

    const updateUser = async (user) => {
        setUserInfo(user);
        await AsyncStorage.setItem('userInfo', JSON.stringify(user));
    };

    const logout = async () => {
        setIsLoading(true);
        setUserToken(null);
        setUserInfo(null);
        await AsyncStorage.removeItem('userInfo');
        await AsyncStorage.removeItem('userToken');
        await clearDatabase();
        setIsLoading(false);
    };

    const isLoggedIn = async () => {
        try {
            setIsLoading(true);
            let info = await AsyncStorage.getItem('userInfo');
            let token = await AsyncStorage.getItem('userToken');

            if (info && token) {
                setUserInfo(JSON.parse(info));
                setUserToken(token);
            }
        } catch (e) {
            console.log(`isLoggedIn error: ${e}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        isLoggedIn();
    }, []);

    return (
        <AuthContext.Provider value={{ login, logout, isLoading, userToken, userInfo, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};
