import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    address: string;
    tokenId?: number;
    username?: string;
    email?: string;
    profile: {
        bio?: string;
        skills: string[];
        achievements: Array<{
            title: string;
            description: string;
            timestamp: Date;
            points: number;
        }>;
        socialLinks: {
            twitter?: string;
            linkedin?: string;
            github?: string;
        };
    };
    reputation: {
        score: number;
        history: Array<{
            change: number;
            reason: string;
            timestamp: Date;
        }>;
    };
    createdAt: Date;
    lastActive: Date;
}

const userSchema = new Schema<IUser>({
    address: { type: String, required: true, unique: true, lowercase: true },
    tokenId: { type: Number, unique: true, sparse: true },
    username: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    profile: {
        bio: String,
        skills: [String],
        achievements: [{
            title: String,
            description: String,
            timestamp: { type: Date, default: Date.now },
            points: Number
        }],
        socialLinks: {
            twitter: String,
            linkedin: String,
            github: String
        }
    },
    reputation: {
        score: { type: Number, default: 100 },
        history: [{
            change: Number,
            reason: String,
            timestamp: { type: Date, default: Date.now }
        }]
    },
    createdAt: { type: Date, default: Date.now },
    lastActive: { type: Date, default: Date.now }
});

export default mongoose.model<IUser>('User', userSchema);