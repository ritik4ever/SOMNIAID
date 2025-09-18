import mongoose, { Schema, Document } from 'mongoose';

export interface INFTTransfer extends Document {
    token_id: number;
    from_address: string;
    to_address: string;
    price: number; // in ETH
    timestamp: Date;
    tx_hash: string;
    block_number?: number;
    gas_used?: number;
    transfer_type: 'mint' | 'sale' | 'transfer';
}

const NFTTransferSchema: Schema = new Schema({
    token_id: {
        type: Number,
        required: true,
        index: true
    },
    from_address: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    to_address: {
        type: String,
        required: true,
        lowercase: true,
        index: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    tx_hash: {
        type: String,
        required: true,
        unique: true
    },
    block_number: {
        type: Number
    },
    gas_used: {
        type: Number
    },
    transfer_type: {
        type: String,
        enum: ['mint', 'sale', 'transfer'],
        default: 'transfer'
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
NFTTransferSchema.index({ token_id: 1, timestamp: -1 });
NFTTransferSchema.index({ from_address: 1, timestamp: -1 });
NFTTransferSchema.index({ to_address: 1, timestamp: -1 });

// ✅ Fix OverwriteModelError by reusing existing model if already compiled
export default mongoose.models.NFTTransfer ||
    mongoose.model<INFTTransfer>('NFTTransfer', NFTTransferSchema);
