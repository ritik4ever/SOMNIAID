// User Types
export interface User {
    id: string;
    address: string;
    username?: string;
    email?: string;
    profile: UserProfile;
    reputation: UserReputation;
    tokenId?: number;
    createdAt: Date;
    lastActive: Date;
}

export interface UserProfile {
    bio?: string;
    skills: string[];
    achievements: Achievement[];
    socialLinks: {
        twitter?: string;
        linkedin?: string;
        github?: string;
    };
}

export interface UserReputation {
    score: number;
    history: ReputationChange[];
}

export interface ReputationChange {
    change: number;
    reason: string;
    timestamp: Date;
}

// Identity Types
export interface Identity {
    tokenId: number;
    reputationScore: number;
    skillLevel: number;
    achievementCount: number;
    lastUpdate: number;
    primarySkill: string;
    isVerified: boolean;
    username?: string;
    profile?: UserProfile;
}

// Achievement Types
export interface Achievement {
    title: string;
    description: string;
    timestamp: number | Date;
    points: number;
    icon?: string;
}

export interface AvailableAchievement {
    id: string;
    title: string;
    description: string;
    points: number;
    icon: string;
}

// API Response Types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
    };
}

// Socket Types
export interface SocketUpdate {
    type: 'reputation' | 'achievement' | 'levelup' | 'identity';
    tokenId: string;
    data: any;
    timestamp: number;
}

// Form Types
export interface CreateIdentityForm {
    username: string;
    primarySkill: string;
    bio: string;
}

export interface UpdateProfileForm {
    username?: string;
    bio?: string;
    skills?: string[];
    socialLinks?: {
        twitter?: string;
        linkedin?: string;
        github?: string;
    };
}

// Contract Types
export interface ContractIdentity {
    reputationScore: bigint;
    skillLevel: bigint;
    achievementCount: bigint;
    lastUpdate: bigint;
    primarySkill: string;
    isVerified: boolean;
}

export interface ContractAchievement {
    title: string;
    description: string;
    timestamp: bigint;
    points: bigint;
}

// Leaderboard Types
export interface LeaderboardEntry {
    rank: number;
    tokenId: number;
    username: string;
    reputationScore: number;
    achievementCount: number;
    avatar?: string;
}