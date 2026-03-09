import mongoose from 'mongoose';

const billSchema = new mongoose.Schema({
    consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    readerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    previousReading: { type: Number, required: true },
    currentReading: { type: Number, required: true },
    consumption: { type: Number, required: true },

    amount: { type: Number, required: true },
    billingDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },

    status: { type: String, enum: ['Unpaid', 'Paid', 'Overdue'], default: 'Unpaid' },

    // For offline synchronization
    offlineId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

export default mongoose.model('Bill', billSchema);
