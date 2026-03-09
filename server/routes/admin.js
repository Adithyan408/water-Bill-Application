import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Bill from '../models/Bill.js';
import Payment from '../models/Payment.js';
import Setting from '../models/Setting.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Helper to get dynamic tariff settings
const getTariffSettings = async () => {
    const keys = [
        'TARIFF_UNDER_AMOUNT', 'TARIFF_UNDER_THRESHOLD',
        'TARIFF_NORMAL_AMOUNT', 'TARIFF_NORMAL_THRESHOLD',
        'TARIFF_SURCHARGE_RATE'
    ];
    const settings = await Setting.find({ key: { $in: keys } });

    const defaults = {
        UNDER_AMOUNT: 60,
        UNDER_THRESHOLD: 5000,
        NORMAL_AMOUNT: 110,
        NORMAL_THRESHOLD: 15000,
        SURCHARGE_RATE: 20
    };

    settings.forEach(s => {
        if (s.key === 'TARIFF_UNDER_AMOUNT') defaults.UNDER_AMOUNT = parseFloat(s.value);
        if (s.key === 'TARIFF_UNDER_THRESHOLD') defaults.UNDER_THRESHOLD = parseFloat(s.value);
        if (s.key === 'TARIFF_NORMAL_AMOUNT') defaults.NORMAL_AMOUNT = parseFloat(s.value);
        if (s.key === 'TARIFF_NORMAL_THRESHOLD') defaults.NORMAL_THRESHOLD = parseFloat(s.value);
        if (s.key === 'TARIFF_SURCHARGE_RATE') defaults.SURCHARGE_RATE = parseFloat(s.value);
    });

    return defaults;
};

// === SETTINGS MANAGEMENT === (Moved to top to allow specific middleware)

// Get current settings - Visible to all logged in users so they can see support info
router.get('/settings', authMiddleware(['Admin', 'MeterReader', 'Consumer']), async (req, res) => {
    try {
        const settings = await Setting.find();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update or create a setting - Admin only
router.post('/settings', authMiddleware(['Admin']), async (req, res) => {
    try {
        const { key, value } = req.body;
        const setting = await Setting.findOneAndUpdate(
            { key },
            { value },
            { upsert: true, new: true }
        );
        res.json(setting);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// All OTHER routes here require Admin or MeterReader
router.use(authMiddleware(['Admin', 'MeterReader']));

// Get Admin Dashboard Overview
router.get('/dashboard-stats', authMiddleware(['Admin']), async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. Amount consumers paid this month
        const paymentsThisMonth = await Payment.find({
            paymentDate: { $gte: startOfMonth },
            status: 'Success'
        });
        const paidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        // 2. Total amount to be paid by all customers (ever unpaid)
        const allUnpaidBills = await Bill.find({ status: { $ne: 'Paid' } });
        const totalUnpaid = allUnpaidBills.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

        // 3. List of users with pending > 1000
        // Grouping by consumerId
        const consumerUnpaidMap = {};
        allUnpaidBills.forEach(bill => {
            const cid = bill.consumerId.toString();
            consumerUnpaidMap[cid] = (consumerUnpaidMap[cid] || 0) + parseFloat(bill.amount || 0);
        });

        const highDebtorIds = Object.keys(consumerUnpaidMap).filter(id => consumerUnpaidMap[id] > 1000);

        // Fetch details for these high debtors
        const highDebtors = await User.find({ _id: { $in: highDebtorIds } })
            .select('name username meterNumber')
            .lean();

        const debtorsList = highDebtors.map(u => ({
            ...u,
            totalPending: consumerUnpaidMap[u._id.toString()]
        })).sort((a, b) => b.totalPending - a.totalPending);

        res.json({
            paidThisMonth,
            totalUnpaid,
            debtorsAbove1000: debtorsList
        });

    } catch (error) {
        console.error('[ADMIN_STATS_ERROR]', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get consumer latest status (reading and balance)
router.get('/consumers/:id/status', async (req, res) => {
    const searchId = req.params.id.trim();
    console.log(`[ROUTE] Fetching status for: ${searchId}`);
    try {
        let consumer;
        // Try by ID first
        if (mongoose.Types.ObjectId.isValid(searchId)) {
            consumer = await User.findById(searchId);
        }

        // If not found, try by username (case-insensitive)
        if (!consumer) {
            consumer = await User.findOne({
                username: { $regex: new RegExp("^" + searchId + "$", "i") },
                role: 'Consumer'
            });
        }

        if (!consumer) {
            console.log(`[ROUTE] Consumer NOT FOUND: ${searchId}`);
            return res.status(404).json({ message: 'Consumer not found' });
        }

        // Latest bill to get previous reading
        const latestBill = await Bill.findOne({ consumerId: consumer._id }).sort({ billingDate: -1 });

        // Total unpaid balance
        const unpaidBills = await Bill.find({ consumerId: consumer._id, status: 'Unpaid' });
        const totalBalance = unpaidBills.reduce((sum, bill) => sum + parseFloat(bill.amount || 0), 0);

        res.json({
            id: consumer._id.toString(),
            username: consumer.username, // Added for frontend consistency
            name: consumer.name,
            meterNumber: consumer.meterNumber,
            previousReading: latestBill ? latestBill.currentReading : 0,
            lastBillDate: latestBill ? latestBill.billingDate : null,
            balance: totalBalance
        });
    } catch (error) {
        console.error('[STATUS_FETCH_ERROR]', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// === USER MANAGEMENT ===

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all consumers with their balances
router.get('/consumers', async (req, res) => {
    console.log(`[ADMIN] Fetching consumer list... User: ${req.user.username}`);
    try {
        const consumers = await User.find({ role: 'Consumer' }).select('-password').lean();
        const allUnpaidBills = await Bill.find({ status: 'Unpaid' });

        // Map unpaid totals
        const consumerUnpaidMap = {};
        allUnpaidBills.forEach(bill => {
            const cid = bill.consumerId.toString();
            consumerUnpaidMap[cid] = (consumerUnpaidMap[cid] || 0) + parseFloat(bill.amount || 0);
        });

        const consumerListWithBalance = consumers.map(c => ({
            ...c,
            totalBalance: consumerUnpaidMap[c._id.toString()] || 0
        })).sort((a, b) => b.totalBalance - a.totalBalance);

        res.json(consumerListWithBalance);
    } catch (error) {
        console.error('[GET_CONSUMERS_ERROR]', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a new Consumer with initial reading and balance
router.post('/consumers', async (req, res) => {
    try {
        const { name, phoneNumber, address, previousReading, initialBalance } = req.body;

        // 1. Generate Automatic Serial Number (Meter Number)
        // Format: WTR-XXXXXX (random 6 digits)
        const serialNumber = 'WTR-' + Math.floor(100000 + Math.random() * 900000);

        // 2. Generate Username (name without spaces + random suffix)
        const cleanName = name.toLowerCase().replace(/\s+/g, '');
        const username = cleanName + Math.floor(10 + Math.random() * 89);
        const password = 'password123'; // Default password

        console.log(`[CREATE_CONSUMER] Creating ${name} (${username}) with Serial: ${serialNumber}`);

        // 3. Create User
        const newUser = new User({
            username,
            password,
            name,
            role: 'Consumer',
            address: address || '',
            phoneNumber: phoneNumber || '',
            meterNumber: serialNumber
        });

        await newUser.save();

        // 4. Handle Opening Reading and Balance
        // We create a "Migration Bill" so the system has a record of the starting point
        const reading = parseFloat(previousReading || 0);
        const balance = parseFloat(initialBalance || 0);

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        const migrationBill = new Bill({
            consumerId: newUser._id,
            readerId: req.user.id, // Admin who created it
            previousReading: reading,
            currentReading: reading,
            consumption: 0,
            amount: balance,
            billingDate: new Date(),
            dueDate: dueDate,
            status: balance > 0 ? 'Unpaid' : 'Paid',
            offlineId: `initial-${newUser._id}-${Date.now()}`
        });

        await migrationBill.save();

        res.status(201).json({
            message: 'Consumer created successfully',
            user: {
                id: newUser._id,
                username: newUser.username,
                password: 'password123',
                name: newUser.name,
                meterNumber: newUser.meterNumber
            }
        });

    } catch (error) {
        console.error('[CREATE_CONSUMER_ERROR]', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update a specific consumer (Administrative Profile Management)
router.patch('/consumers/:id', async (req, res) => {
    const consumerId = req.params.id;
    console.log(`[ADMIN] Updating consumer ${consumerId}...`);
    try {
        const { name, phoneNumber, address, username, previousReading, currentReading, totalBalance } = req.body;

        const consumer = await User.findById(consumerId);
        if (!consumer) return res.status(404).json({ message: 'Consumer not found' });

        // 1. Update User Record
        if (name) consumer.name = name;
        if (phoneNumber) consumer.phoneNumber = phoneNumber;
        if (address) consumer.address = address;

        if (username && username !== consumer.username) {
            const existing = await User.findOne({ username });
            if (existing) return res.status(400).json({ message: 'Username already taken' });
            consumer.username = username;
        }

        await consumer.save();

        // 2. Adjust Balance & Readings (Modifies latest bill)
        const latestBill = await Bill.findOne({ consumerId: consumer._id }).sort({ billingDate: -1 });
        if (latestBill) {
            let changed = false;

            if (previousReading !== undefined && !isNaN(previousReading)) {
                latestBill.previousReading = parseFloat(previousReading);
                changed = true;
            }
            if (currentReading !== undefined && !isNaN(currentReading)) {
                latestBill.currentReading = parseFloat(currentReading);
                changed = true;
            }

            if (changed) {
                // Formula: (Current - Previous) * 10 = Consumption in Litres (direct)
                const consumptionL = (latestBill.currentReading - latestBill.previousReading) * 10;
                latestBill.consumption = consumptionL;

                // If they provided a new balance, use that as the bill amount.
                // Otherwise AUTO-CALCULATE based on the new readings!
                if (totalBalance === undefined || isNaN(totalBalance)) {
                    const t = await getTariffSettings();
                    let billAmount = 0;

                    if (consumptionL <= t.UNDER_THRESHOLD) {
                        // TIER 1: Under Usage
                        billAmount = t.UNDER_AMOUNT;
                    } else if (consumptionL <= t.NORMAL_THRESHOLD) {
                        // TIER 2: Normal Usage
                        billAmount = t.NORMAL_AMOUNT;
                    } else {
                        // TIER 3: Extra Usage
                        const extraL = consumptionL - t.NORMAL_THRESHOLD;
                        const extraCharge = (extraL * t.SURCHARGE_RATE) / 1000;
                        billAmount = t.NORMAL_AMOUNT + extraCharge;
                    }

                    latestBill.amount = billAmount;
                    latestBill.status = latestBill.amount > 0 ? 'Unpaid' : 'Paid';
                    console.log(`[ADMIN_CALC] Tiered Tariff Applied. Consumption: ${consumptionL}L. New bill: ₹${latestBill.amount}`);
                }
            }
            if (totalBalance !== undefined && !isNaN(totalBalance)) {
                latestBill.amount = parseFloat(totalBalance);
                latestBill.status = latestBill.amount > 0 ? 'Unpaid' : 'Paid';
                changed = true;
            }

            if (changed) await latestBill.save();
        }

        res.json({ message: 'Consumer profile updated successfully', user: consumer });
    } catch (error) {
        console.error('[PATCH_CONSUMER_ERROR]', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// DELETE a consumer
router.delete('/consumers/:id', async (req, res) => {
    try {
        const id = req.params.id;
        console.log(`[ADMIN] Deleting consumer: ${id}`);
        await User.findByIdAndDelete(id);
        await Bill.deleteMany({ consumerId: id });
        await Payment.deleteMany({ consumerId: id });
        res.json({ message: 'User and associated records deleted permanently' });
    } catch (error) {
        res.status(500).json({ message: 'Server error during deletion' });
    }
});

// Create user (Consumer/MeterReader)
router.post('/users', async (req, res) => {
    try {
        const { username, password, name, role, address, meterNumber } = req.body;

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const newUser = new User({
            username,
            password,
            name,
            role,
            address,
            meterNumber
        });

        await newUser.save();

        // Don't return password
        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// === BILL MANAGEMENT ===

// Get all bills
router.get('/bills', async (req, res) => {
    try {
        const bills = await Bill.find()
            .populate('consumerId', 'name username')
            .populate('readerId', 'name username')
            .sort({ createdAt: -1 });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// === PAYMENT MANAGEMENT ===

// Record a payment for a specific bill
router.post('/payments', async (req, res) => {
    try {
        const { billId, amount, method } = req.body;

        const bill = await Bill.findById(billId);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        const newPayment = new Payment({
            billId,
            consumerId: bill.consumerId,
            amount,
            method: method || 'Cash',
            status: 'Success'
        });

        await newPayment.save();

        bill.status = 'Paid';
        await bill.save();

        res.status(201).json({ message: 'Payment recorded', payment: newPayment });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Quick payment collection from a consumer (auto-allocate to unpaid bills)
router.post('/consumers/:id/collect-payment', async (req, res) => {
    const { amount, method } = req.body;
    const consumerId = req.params.id;

    console.log(`[PAYMENT_START] Consumer: ${consumerId}, Amount: ₹${amount}`);

    try {
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({ message: 'Invalid payment amount' });
        }

        const unpaidBills = await Bill.find({ consumerId, status: 'Unpaid' }).sort({ billingDate: 1 });
        let remainingToApply = paymentAmount;

        // 1. Record the overall payment in Payments collection
        const paymentRecord = new Payment({
            consumerId,
            amount: paymentAmount,
            method: method || 'Cash',
            status: 'Success'
        });
        await paymentRecord.save();
        console.log(`[PAYMENT_SAVE] Record created: ${paymentRecord._id}`);

        // 2. Allocate across bills
        console.log(`[PAYMENT_ALLOC] Found ${unpaidBills.length} unpaid bills.`);
        for (const bill of unpaidBills) {
            if (remainingToApply <= 0) break;

            const billAmount = parseFloat(bill.amount);
            console.log(`[PAYMENT_ALLOC] Processing Bill ${bill._id} (₹${billAmount})`);

            if (remainingToApply >= billAmount) {
                // Full coverage
                bill.status = 'Paid';
                await bill.save();
                remainingToApply -= billAmount;
                console.log(`[PAYMENT_ALLOC] Bill ${bill._id} marked PAID.`);
            } else {
                // Partial coverage: Reduce the bill amount (minimise the balance)
                bill.amount = billAmount - remainingToApply;
                await bill.save();
                console.log(`[PAYMENT_ALLOC] Bill ${bill._id} reduced by ₹${remainingToApply}. New Amount: ₹${bill.amount}`);
                remainingToApply = 0;
            }
        }

        console.log(`[PAYMENT_DONE] Success. Remaining unapplied: ₹${remainingToApply}`);
        res.json({
            message: 'Payment recorded and balance updated',
            totalPaid: paymentAmount,
            appliedBillsCount: unpaidBills.filter(b => b.status === 'Paid').length
        });
    } catch (error) {
        console.error('[PAYMENT_COLLECT_ERROR]', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all payments
router.get('/payments', async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate('billId')
            .populate('consumerId', 'name username')
            .sort({ createdAt: -1 });
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET current admin's profile
router.get('/my-profile', authMiddleware(['Admin']), async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching profile' });
    }
});

// Update admin's profile with password verification
router.patch('/my-profile', authMiddleware(['Admin']), async (req, res) => {
    try {
        const { name, email, phoneNumber, altPhoneNumber, verifyUsername, verifyPassword } = req.body;

        // Verify who is trying to change
        const admin = await User.findById(req.user.id);
        if (!admin || admin.username !== verifyUsername) {
            return res.status(401).json({ message: 'Verification failed: Incorrect username' });
        }

        const isMatch = await admin.comparePassword(verifyPassword);
        if (!isMatch) {
            return res.status(401).json({ message: 'Verification failed: Incorrect password' });
        }

        // Apply changes
        if (name) admin.name = name;
        if (email) admin.email = email;
        if (phoneNumber) admin.phoneNumber = phoneNumber;
        admin.altPhoneNumber = altPhoneNumber; // Can be empty

        // 2. Update password if provided
        if (req.body.newPassword) {
            if (!req.body.currentPassword) {
                return res.status(400).json({ message: 'Current password is required to change it' });
            }
            const isCurrentMatch = await admin.comparePassword(req.body.currentPassword);
            if (!isCurrentMatch) {
                return res.status(401).json({ message: 'Current password verification failed' });
            }
            console.log(`[ADMIN_PWD_CHANGE] Password updated for ${admin.username}`);
            admin.password = req.body.newPassword;
        }

        await admin.save();
        res.json({ message: 'Profile updated successfully', user: admin });
    } catch (error) {
        console.error('[ADMIN_PROFILE_PATCH_ERR]', error);
        res.status(500).json({ message: 'Server error during profile update' });
    }
});

export default router;
