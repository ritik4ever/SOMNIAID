import mongoose, { Document, Schema } from 'mongoose';

export interface IAchievement {
    id: string;
    title: string;
    description: string;
    category: 'hackathon' | 'certification' | 'project' | 'education' | 'work' | 'community' | 'milestone' | 'social' | 'skill' | 'time' | 'special' | 'external';
    points: number;
    valueImpact: number;
    dateAchieved: Date;
    verified: boolean;
    proof?: {
        type: 'url' | 'ipfs' | 'document';
        value: string;
    } | string;
    verifier?: string;
    verificationHash?: string;
    txHash?: string;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    badge?: string;
    verificationSource?: string;
}

export interface IGoal {
    id: string;
    title: string;
    description: string;
    category: string;
    targetDate: Date;
    progress: number;
    valueImpact: number;
    milestones: Array<{
        title: string;
        completed: boolean;
        date?: Date;
    }>;
}

export interface IIdentity extends Document {
    tokenId: number;
    username: string;
    ownerAddress: string;

    primarySkill: string;
    experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    location?: string;

    reputationScore: number;
    skillLevel: number;
    achievementCount: number;
    isVerified: boolean;
    isOriginalOwner: boolean; // ADDED: Distinguishes identity creator from NFT buyer

    nftBasePrice: number;
    currentPrice: number;
    priceHistory: Array<{
        price: number;
        date: Date;
        trigger: string;
    }>;

    profile: {
        bio: string;
        avatar?: string;
        coverImage?: string;
        skills: string[];
        achievements: IAchievement[];
        goals: IGoal[];
        socialLinks: {
            twitter?: string;
            github?: string;
            linkedin?: string;
            website?: string;
            discord?: string;
        };
        education: Array<{
            institution: string;
            degree: string;
            year: number;
            verified: boolean;
        }>;
        workExperience: Array<{
            company: string;
            position: string;
            startDate: Date;
            endDate?: Date;
            description: string;
            verified: boolean;
        }>;
    };

    profileViews: number;
    followers: string[];
    following: string[];

    txHash?: string;
    lastUpdate: number;
    lastMetadataUpdate?: number;
    lastKnownReputation?: number;
    createdAt: Date;
    updatedAt: Date;
}

// Schema definitions remain the same but with extended achievement schema
const AchievementSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
        type: String,
        enum: ['hackathon', 'certification', 'project', 'education', 'work', 'community', 'milestone', 'social', 'skill', 'time', 'special', 'external'],
        required: true
    },
    points: { type: Number, required: true },
    valueImpact: { type: Number, default: 0 },
    dateAchieved: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    proof: { type: Schema.Types.Mixed }, // Allow both string and object
    verifier: { type: String },
    verificationHash: { type: String },
    txHash: { type: String },
    rarity: {
        type: String,
        enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
        default: 'common'
    },
    badge: { type: String },
    verificationSource: { type: String }
});

const GoalSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    targetDate: { type: Date, required: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    valueImpact: { type: Number, default: 0 },
    milestones: [{
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
        date: { type: Date }
    }]
});

const IdentitySchema: Schema = new Schema({
    tokenId: { type: Number, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true, unique: true },

    primarySkill: { type: String, required: true },
    experience: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
    },
    location: { type: String },

    reputationScore: { type: Number, default: 100 },
    skillLevel: { type: Number, default: 1 },
    achievementCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isOriginalOwner: { type: Boolean, default: true }, // ADDED: True for identity creator

    nftBasePrice: { type: Number, default: 10 },
    currentPrice: { type: Number, default: 10 },
    priceHistory: [{
        price: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        trigger: { type: String, required: true }
    }],

    profile: {
        bio: { type: String, default: '' },
        avatar: { type: String },
        coverImage: { type: String },
        skills: [{ type: String }],
        achievements: [AchievementSchema],
        goals: [GoalSchema],
        socialLinks: {
            twitter: { type: String },
            github: { type: String },
            linkedin: { type: String },
            website: { type: String },
            discord: { type: String }
        },
        education: [{
            institution: { type: String, required: true },
            degree: { type: String, required: true },
            year: { type: Number, required: true },
            verified: { type: Boolean, default: false }
        }],
        workExperience: [{
            company: { type: String, required: true },
            position: { type: String, required: true },
            startDate: { type: Date, required: true },
            endDate: { type: Date },
            description: { type: String },
            verified: { type: Boolean, default: false }
        }]
    },

    profileViews: { type: Number, default: 0 },
    followers: [{ type: String }],
    following: [{ type: String }],

    txHash: { type: String },
    lastUpdate: { type: Number, default: Date.now },
    lastMetadataUpdate: { type: Number, default: 0 },
    lastKnownReputation: { type: Number, default: 0 }
}, {
    timestamps: true
});

// Price calculation method with proper typing
IdentitySchema.methods.calculatePrice = function () {
    let price = this.nftBasePrice;

    this.profile.achievements.forEach((achievement: IAchievement) => {
        if (achievement.verified) {
            price += achievement.valueImpact;
        }
    });

    this.profile.goals.forEach((goal: IGoal) => {
        const completionBonus = (goal.progress / 100) * goal.valueImpact;
        price += completionBonus;
    });

    const experienceMultipliers: Record<string, number> = {
        beginner: 1,
        intermediate: 1.2,
        advanced: 1.5,
        expert: 2
    };

    const multiplier = experienceMultipliers[this.experience] || 1;
    price *= multiplier;

    if (this.isVerified) {
        price *= 1.3;
    }

    const followerBonus = Math.min(this.followers.length * 0.1, 10);
    price += followerBonus;

    return Math.round(price * 100) / 100;
};

export default mongoose.model<IIdentity>('Identity', IdentitySchema);