import mongoose, { Document, Schema } from 'mongoose';

export interface IAchievement {
    id: string;
    title: string;
    description: string;
    category: 'hackathon' | 'certification' | 'project' | 'education' | 'work' | 'community';
    points: number;
    valueImpact: number; // How much this affects NFT price
    dateAchieved: Date;
    verified: boolean;
    proof?: {
        type: 'url' | 'ipfs' | 'document';
        value: string;
    };
    verifier?: string;
}

export interface IGoal {
    id: string;
    title: string;
    description: string;
    category: string;
    targetDate: Date;
    progress: number; // 0-100
    valueImpact: number; // Potential price impact if achieved
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

    // Basic Profile
    primarySkill: string;
    experience: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    location?: string;

    // Reputation System
    reputationScore: number;
    skillLevel: number;
    achievementCount: number;
    isVerified: boolean;

    // Dynamic Pricing
    nftBasePrice: number; // Starting price in STT
    currentPrice: number; // Current market price
    priceHistory: Array<{
        price: number;
        date: Date;
        trigger: string; // What caused price change
    }>;

    // Enhanced Profile
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

    // Analytics
    profileViews: number;
    followers: string[]; // Array of wallet addresses
    following: string[];

    // Metadata
    txHash: string;
    lastUpdate: number;
    createdAt: Date;
    updatedAt: Date;
}

const AchievementSchema = new Schema({
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
        type: String,
        enum: ['hackathon', 'certification', 'project', 'education', 'work', 'community'],
        required: true
    },
    points: { type: Number, required: true },
    valueImpact: { type: Number, default: 0 },
    dateAchieved: { type: Date, required: true },
    verified: { type: Boolean, default: false },
    proof: {
        type: { type: String, enum: ['url', 'ipfs', 'document'] },
        value: { type: String }
    },
    verifier: { type: String }
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

    // Basic Profile
    primarySkill: { type: String, required: true },
    experience: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'expert'],
        default: 'beginner'
    },
    location: { type: String },

    // Reputation System
    reputationScore: { type: Number, default: 100 },
    skillLevel: { type: Number, default: 1 },
    achievementCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },

    // Dynamic Pricing
    nftBasePrice: { type: Number, default: 10 }, // 10 STT base price
    currentPrice: { type: Number, default: 10 },
    priceHistory: [{
        price: { type: Number, required: true },
        date: { type: Date, default: Date.now },
        trigger: { type: String, required: true }
    }],

    // Enhanced Profile
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

    // Analytics
    profileViews: { type: Number, default: 0 },
    followers: [{ type: String }], // Wallet addresses
    following: [{ type: String }],

    // Metadata
    txHash: { type: String },
    lastUpdate: { type: Number, default: Date.now }
}, {
    timestamps: true
});

// Price calculation method
IdentitySchema.methods.calculatePrice = function () {
    let price = this.nftBasePrice;

    // Add value based on achievements
    this.profile.achievements.forEach((achievement: IAchievement) => {
        if (achievement.verified) {
            price += achievement.valueImpact;
        }
    });

    // Add potential value based on goals
    this.profile.goals.forEach((goal: IGoal) => {
        const completionBonus = (goal.progress / 100) * goal.valueImpact;
        price += completionBonus;
    });

    // Experience multiplier - FIXED with proper typing
    const experienceMultipliers: Record<string, number> = {
        beginner: 1,
        intermediate: 1.2,
        advanced: 1.5,
        expert: 2
    };

    // FIXED: Add type checking
    const multiplier = experienceMultipliers[this.experience] || 1;
    price *= multiplier;

    // Verification bonus
    if (this.isVerified) {
        price *= 1.3;
    }

    // Network effect (followers)
    const followerBonus = Math.min(this.followers.length * 0.1, 10);
    price += followerBonus;

    return Math.round(price * 100) / 100;
};

export default mongoose.model<IIdentity>('Identity', IdentitySchema);