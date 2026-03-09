import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware, JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '7d' } // 7 days expiration suitable for mobile
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/auth/me
router.get('/me', authMiddleware(), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Seed endpoint for initial admin (for testing/setup)
router.post('/seed_admin', async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'Admin' });
        if (adminExists) {
            return res.status(400).json({ message: 'Admin already exists' });
        }

        const adminUser = new User({
            username: 'admin',
            password: 'password123',
            name: 'System Administrator',
            role: 'Admin'
        });

        await adminUser.save();
        res.json({ message: 'Admin created successfully', username: 'admin', password: 'password123' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// POST /api/auth/update-profile
router.post('/update-profile', authMiddleware(), async (req, res) => {
    try {
        const { currentPassword, newPassword, newUsername } = req.body;
        const user = await User.findById(req.user.id);

        // Current password is only required if trying to set a NEW password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password' });
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ message: 'Incorrect current password' });
            }
            console.log(`Updating password for user: ${user.username}`);
            user.password = newPassword;
        }

        if (newUsername) {
            // Check if username is already taken by another user
            if (newUsername !== user.username) {
                const existing = await User.findOne({ username: newUsername });
                if (existing) return res.status(400).json({ message: 'Username already taken' });
                user.username = newUsername;
            }
        }

        await user.save();
        console.log(`Profile updated successfully for: ${user.username}`);

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                name: user.name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
