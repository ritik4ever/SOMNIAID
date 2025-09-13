import express from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import User from '../models/User';
import { authenticateToken } from '../middleware/auth';
import { validateEthereumAddress, validateSignature, validateUsername, validateEmail } from '../utils/validation';

const router = express.Router();

// Verify wallet signature
router.post('/verify', async (req, res): Promise<void> => {
    try {
        const { address, signature, message } = req.body;

        // Validate inputs
        if (!address || !signature || !message) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }

        if (!validateEthereumAddress(address)) {
            res.status(400).json({ error: 'Invalid Ethereum address' });
            return;
        }

        // Verify signature
        if (!validateSignature(message, signature, address)) {
            res.status(400).json({ error: 'Invalid signature' });
            return;
        }

        // Find or create user
        let user = await User.findOne({ address: address.toLowerCase() });

        if (!user) {
            user = new User({
                address: address.toLowerCase(),
                lastActive: new Date()
            });
            await user.save();
        } else {
            user.lastActive = new Date();
            await user.save();
        }

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, address: user.address },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                address: user.address,
                username: user.username,
                tokenId: user.tokenId,
                reputation: user.reputation
            }
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Get user profile
router.get('/profile', authenticateToken, async (req: any, res): Promise<void> => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                address: user.address,
                username: user.username,
                tokenId: user.tokenId,
                profile: user.profile,
                reputation: user.reputation,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req: any, res): Promise<void> => {
    try {
        const { username, bio, skills, socialLinks, email } = req.body;

        // Validate inputs
        if (username) {
            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                res.status(400).json({ error: usernameValidation.error });
                return;
            }

            // Check if username is taken
            const existingUser = await User.findOne({
                username,
                _id: { $ne: req.user.userId }
            });

            if (existingUser) {
                res.status(400).json({ error: 'Username already taken' });
                return;
            }
        }

        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                res.status(400).json({ error: emailValidation.error });
                return;
            }
        }

        // Update user
        const updateData: any = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;
        if (bio !== undefined) updateData['profile.bio'] = bio;
        if (skills) updateData['profile.skills'] = Array.isArray(skills) ? skills : [];
        if (socialLinks) updateData['profile.socialLinks'] = socialLinks;

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true }
        );

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                address: user.address,
                username: user.username,
                email: user.email,
                profile: user.profile,
                reputation: user.reputation
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Get auth status
router.get('/status', authenticateToken, async (req: any, res): Promise<void> => {
    try {
        const user = await User.findById(req.user.userId).select('-__v');

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            success: true,
            authenticated: true,
            user: {
                id: user._id,
                address: user.address,
                username: user.username,
                tokenId: user.tokenId
            }
        });

    } catch (error) {
        console.error('Auth status error:', error);
        res.status(500).json({ error: 'Failed to get auth status' });
    }
});

export default router;