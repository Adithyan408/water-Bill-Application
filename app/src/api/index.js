import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Use standard localhost for web, 10.0.2.2 for Android emulator
const API_URL = Platform.OS === 'web'
    ? 'http://localhost:3000/api'
    : 'http://10.0.2.2:3000/api';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
