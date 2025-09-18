import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPriceHistory extends Document {
    token_id: number;
    old_price: number;
    new_price: number;
    price_change_percent: number;
    change_reason: string;
    timestamp: Date;
    tx_hash?: string;
    triggered_by: 'achievement' | 'goal_completion' | 'goal_failure' | 'reputation_change' | 'manual' | 'market';
    details?: {
        achievement_id?: string;
        goal_id?: string;
        reputation_change?: number;
        market_factor?: number;
    };
}

const PriceHistorySchema: Schema = new Schema(
    {
        token_id: { type: Number, required: true, index: true },
        old_price: { type: Number, required: true, min: 0 },
        new_price: { type: Number, required: true, min: 0 },
        price_change_percent: { type: Number, required: true },
        change_reason: { type: String, required: true, maxlength: 200 },
        timestamp: { type: Date, default: Date.now, index: true },
        tx_hash: { type: String, sparse: true },
        triggered_by: {
            type: String,
            enum: ['achievement', 'goal_completion', 'goal_failure', 'reputation_change', 'manual', 'market'],
            required: true,
        },
        details: {
            achievement_id: String,
            goal_id: String,
            reputation_change: Number,
            market_factor: Number,
        },
    },
    { timestamps: true }
);

// Compound indexes
PriceHistorySchema.index({ token_id: 1, timestamp: -1 });
PriceHistorySchema.index({ triggered_by: 1, timestamp: -1 });

// Virtuals
PriceHistorySchema.virtual('price_change_absolute').get(function (this: IPriceHistory) {
    return this.new_price - this.old_price;
});
PriceHistorySchema.virtual('trend').get(function (this: IPriceHistory) {
    if (this.price_change_percent > 0) return 'up';
    if (this.price_change_percent < 0) return 'down';
    return 'stable';
});

// ✅ Fix: safe export
const PriceHistory: Model<IPriceHistory> =
    mongoose.models.PriceHistory ||
    mongoose.model<IPriceHistory>('PriceHistory', PriceHistorySchema);

export default PriceHistory;
