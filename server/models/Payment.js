import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
    billId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    method: { type: String, enum: ['Cash', 'CreditCard', 'BankTransfer'], required: true },

    status: { type: String, enum: ['Success', 'Failed'], default: 'Success' }
}, { timestamps: true });

export default mongoose.model('Payment', paymentSchema);
