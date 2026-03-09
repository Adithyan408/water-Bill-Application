import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';
import Bill from './models/Bill.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/waterbill';

const seed = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB for seeding check');

        // CHECK IF DATA EXISTS
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('Database already contains data. Skipping seeding to prevent data loss.');
            await mongoose.connection.close();
            process.exit(0);
        }

        console.log('Database empty. Starting initial seed...');

        // Create Admin
        const admin = new User({
            username: 'admin',
            password: 'password123',
            name: 'System Administrator',
            role: 'Admin'
        });
        await admin.save();
        console.log('Admin created: admin / password123');

        // Create Meter Reader
        const reader = new User({
            username: 'reader',
            password: 'password123',
            name: 'John Reader',
            role: 'MeterReader'
        });
        await reader.save();
        console.log('Meter Reader created: reader / password123');

        // Create Demo User
        const demoUser = new User({
            username: 'demouser',
            password: 'password123',
            name: 'Demo Consumer',
            role: 'Consumer',
            address: '123 Water Street',
            meterNumber: 'MTR-001'
        });
        await demoUser.save();
        console.log('Demo User created: demouser / password123');

        // Create dummy bills
        const bills = [];
        const now = new Date();
        for (let i = 1; i <= 6; i++) {
            const billingDate = new Date(now.getFullYear(), now.getMonth() - i, 15);
            const dueDate = new Date(billingDate);
            dueDate.setDate(dueDate.getDate() + 15);

            const prevReading = 1000 - (i * 50);
            const currReading = 1050 - (i * 50);
            const amount = 150.00;

            bills.push({
                consumerId: demoUser._id,
                readerId: reader._id,
                previousReading: prevReading,
                currentReading: currReading,
                consumption: 50,
                amount: amount,
                billingDate,
                dueDate,
                status: i === 1 ? 'Unpaid' : 'Paid',
                offlineId: `offline-seed-${i}-${Date.now()}`
            });
        }

        await Bill.insertMany(bills);
        console.log(`${bills.length} dummy bills created.`);

        await mongoose.connection.close();
        console.log('Seeding completed successfully');
        process.exit(0);

    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seed();
