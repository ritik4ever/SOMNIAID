import { ethers } from 'ethers';

export const validateEthereumAddress = (address: string): boolean => {
    try {
        return ethers.isAddress(address);
    } catch {
        return false;
    }
};

export const validateSignature = (message: string, signature: string, address: string): boolean => {
    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch {
        return false;
    }
};

export const validateUsername = (username: string): { valid: boolean; error?: string } => {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Username is required' };
    }

    if (username.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters long' };
    }

    if (username.length > 20) {
        return { valid: false, error: 'Username must be no more than 20 characters long' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
    }

    return { valid: true };
};

export const validateSkill = (skill: string): { valid: boolean; error?: string } => {
    if (!skill || typeof skill !== 'string') {
        return { valid: false, error: 'Primary skill is required' };
    }

    if (skill.length < 2) {
        return { valid: false, error: 'Skill must be at least 2 characters long' };
    }

    if (skill.length > 50) {
        return { valid: false, error: 'Skill must be no more than 50 characters long' };
    }

    return { valid: true };
};

export const validateBio = (bio: string): { valid: boolean; error?: string } => {
    if (bio && bio.length > 500) {
        return { valid: false, error: 'Bio must be no more than 500 characters long' };
    }

    return { valid: true };
};

export const validateEmail = (email: string): { valid: boolean; error?: string } => {
    if (!email) {
        return { valid: true }; // Email is optional
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, error: 'Invalid email format' };
    }

    return { valid: true };
};

export const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .trim()
        .replace(/[<>\"']/g, '') // Remove potentially harmful characters
        .substring(0, 1000); // Limit length
};