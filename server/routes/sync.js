import express from 'express';
import Bill from '../models/Bill.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// POST /api/sync/push - Meter Readers push offline bills to the server
router.post('/push', authMiddleware(['MeterReader', 'Admin']), async (req, res) => {
    console.log(`[SYNC_PUSH] User ${req.user.username} (${req.user.role}) is pushing bills...`);
    try {
        const { bills } = req.body; // Array of bill objects created locally
        console.log(`[SYNC_PUSH] Received ${bills?.length} bills.`);

        if (!Array.isArray(bills) || bills.length === 0) {
            return res.status(400).json({ message: 'No bills provided for sync' });
        }

        const insertedBills = [];
        const errors = [];

        // Process each bill
        for (const billData of bills) {
            try {
                console.log(`[PUSH] Processing bill for consumer ${billData.consumerId}, offlineId: ${billData.offlineId}`);

                // 1. Get Month/Year of the bill being pushed
                const bDate = new Date(billData.billingDate || new Date());
                const startOfMonth = new Date(bDate.getFullYear(), bDate.getMonth(), 1);
                const endOfMonth = new Date(bDate.getFullYear(), bDate.getMonth() + 1, 0, 23, 59, 59);

                // 2. Consistency Check: Ensure Reading Chain Integrity
                const lastBillOnServer = await Bill.findOne({ consumerId: billData.consumerId }).sort({ billingDate: -1 });
                if (lastBillOnServer) {
                    // Check for Monthly Duplicates
                    const sMonth = lastBillOnServer.billingDate.getMonth();
                    const sYear = lastBillOnServer.billingDate.getFullYear();
                    if (sMonth === bDate.getMonth() && sYear === bDate.getFullYear()) {
                        console.log(`[PUSH_BLOCKED] Monthly Duplicate: ${billData.consumerId} for ${bDate.getMonth() + 1}/${bDate.getFullYear()}.`);
                        errors.push({
                            offlineId: billData.offlineId,
                            error: `Duplicate: Billing already completed for ${bDate.getMonth() + 1}/${bDate.getFullYear()}.`
                        });
                        continue;
                    }

                    // Check for Reading Gaps or Inconsistencies
                    if (billData.previousReading !== lastBillOnServer.currentReading) {
                        console.log(`[PUSH_BLOCKED] Reading Discrepancy: Consumer ${billData.consumerId}. Expected Prev: ${lastBillOnServer.currentReading}, Received: ${billData.previousReading}`);
                        errors.push({
                            offlineId: billData.offlineId,
                            error: `Inconsistency: System expects Previous Reading to be ${lastBillOnServer.currentReading}.`
                        });
                        continue;
                    }
                } else {
                    // 3. Create NEW bill if none exists for this month
                    console.log(`[PUSH] Creating NEW bill for ${billData.consumerId}`);
                    const newBill = new Bill({
                        consumerId: billData.consumerId,
                        readerId: req.user.id,
                        previousReading: billData.previousReading,
                        currentReading: billData.currentReading,
                        consumption: billData.consumption,
                        amount: billData.amount,
                        billingDate: billData.billingDate || new Date(),
                        dueDate: billData.dueDate,
                        status: billData.status || 'Unpaid',
                        offlineId: billData.offlineId
                    });
                    const saved = await newBill.save();
                    insertedBills.push(saved);
                }
            } catch (err) {
                console.error(`[PUSH_ITEM_ERROR] ${billData.offlineId}:`, err.message);
                errors.push({ offlineId: billData.offlineId, error: err.message });
            }
        }

        console.log(`[PUSH_COMPLETE] Synced: ${insertedBills.length}, Errors: ${errors.length}`);
        res.json({
            message: 'Sync push completed',
            syncedCount: insertedBills.length,
            errorsCount: errors.length,
            errors
        });

    } catch (error) {
        console.error('Sync push error:', error);
        res.status(500).json({ message: 'Server error during sync push' });
    }
});

// GET /api/sync/pull - Consumers pull their last 12 months history
router.get('/pull', authMiddleware(['Consumer']), async (req, res) => {
    console.log(`[SYNC_PULL] Consumer ${req.user.username} is pulling history...`);
    try {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const bills = await Bill.find({
            consumerId: req.user.id,
            billingDate: { $gte: twelveMonthsAgo }
        }).sort({ billingDate: -1 });
        console.log(`[SYNC_PULL] Found ${bills.length} bills for user ${req.user.id}`);

        res.json({
            message: 'Sync pull completed',
            count: bills.length,
            bills
        });
    } catch (error) {
        console.error('Sync pull error:', error);
        res.status(500).json({ message: 'Server error during sync pull' });
    }
});

export default router;
