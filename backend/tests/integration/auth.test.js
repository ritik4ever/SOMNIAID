const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/server');
const User = require('../../src/models/User');

describe('Auth Integration Tests', () => {
    beforeAll(async () => {
        const url = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/somniaID_test';
        await mongoose.connect(url);
    });

    beforeEach(async () => {
        await User.deleteMany({});
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    describe('POST /api/auth/verify', () => {
        it('should verify wallet signature and create user', async () => {
            const mockData = {
                address: '0x742d35Cc6636C0532925a3b8F39c3ee2C96afeCf',
                signature: '0x...',
                message: 'Sign this message to authenticate with SomniaID'
            };

            const response = await request(app)
                .post('/api/auth/verify')
                .send(mockData)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            expect(response.body.user.address).toBe(mockData.address.toLowerCase());
        });

        it('should return error for invalid signature', async () => {
            const mockData = {
                address: '0x742d35Cc6636C0532925a3b8F39c3ee2C96afeCf',
                signature: 'invalid_signature',
                message: 'Sign this message'
            };

            const response = await request(app)
                .post('/api/auth/verify')
                .send(mockData)
                .expect(400);

            expect(response.body.error).toBe('Invalid signature');
        });
    });

    describe('GET /api/auth/profile', () => {
        let authToken;
        let userId;

        beforeEach(async () => {
            const user = await User.create({
                address: '0x742d35cc6636c0532925a3b8f39c3ee2c96afecf',
                username: 'testuser'
            });
            userId = user._id;

            // Create JWT token for testing
            const jwt = require('jsonwebtoken');
            authToken = jwt.sign(
                { userId: user._id, address: user.address },
                process.env.JWT_SECRET || 'test-secret'
            );
        });

        it('should get user profile with valid token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.username).toBe('testuser');
        });

        it('should return error without token', async () => {
            const response = await request(app)
                .get('/api/auth/profile')
                .expect(401);

            expect(response.body.error).toBe('Access token required');
        });
    });
});