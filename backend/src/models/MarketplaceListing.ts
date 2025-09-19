import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketplaceListing extends Document {
    tokenId: number;
    sellerAddress: string;
    price: number; // in ETH
    isActive: boolean;
    listedAt: Date;
    unlistedAt?: Date;
    soldAt?: Date;
    soldTo?: string;
    soldPrice?: number;
    txHash?: string; // Transaction hash when listed
    createdAt: Date;
    updatedAt: Date;
}

const MarketplaceListingSchema: Schema = new Schema({
    tokenId: {
        type: Number,
        required: true,
        index: true
    },
    sellerAddress: {
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
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    listedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    unlistedAt: {
        type: Date
    },
    soldAt: {
        type: Date
    },
    soldTo: {
        type: String,
        lowercase: true
    },
    soldPrice: {
        type: Number,
        min: 0
    },
    txHash: {
        type: String
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
MarketplaceListingSchema.index({ tokenId: 1, isActive: 1 });
MarketplaceListingSchema.index({ sellerAddress: 1, isActive: 1 });
MarketplaceListingSchema.index({ price: 1, isActive: 1 });
MarketplaceListingSchema.index({ listedAt: -1, isActive: 1 });

// Prevent duplicate active listings for the same token
MarketplaceListingSchema.index(
    { tokenId: 1, isActive: 1 },
    {
        unique: true,
        partialFilterExpression: { isActive: true }
    }
);

export default mongoose.model<IMarketplaceListing>('MarketplaceListing', MarketplaceListingSchema);