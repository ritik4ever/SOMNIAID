import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/somniaID';
        console.log('🔍 Using Mongo URI:', mongoURI.replace(/\/\/.*@/, '//<hidden>@'));

        await mongoose.connect(mongoURI);

        console.log('📊 MongoDB connected successfully');

        // Create indexes for performance
        await createIndexes();
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

const createIndexes = async () => {
    try {
        const db = mongoose.connection.db;
        if (!db) {
            console.warn('⚠️ Database connection not available for index creation');
            return;
        }

        // Identity collection indexes (MISSING FROM YOUR CURRENT CODE)
        await db.collection('identities').createIndex({ tokenId: 1 }, { unique: true });
        await db.collection('identities').createIndex({ ownerAddress: 1 });
        await db.collection('identities').createIndex({ username: 1 }, { unique: true });
        await db.collection('identities').createIndex({ ownerAddress: 1, tokenId: 1 });
        await db.collection('identities').createIndex({ isVerified: 1 });

        // NFT Transfers collection indexes  
        await db.collection('nfttransfers').createIndex({ token_id: 1 });
        await db.collection('nfttransfers').createIndex({ from_address: 1 });
        await db.collection('nfttransfers').createIndex({ to_address: 1 });
        await db.collection('nfttransfers').createIndex({ timestamp: -1 });
        // Composite indexes for portfolio queries
        await db.collection('nfttransfers').createIndex({ to_address: 1, timestamp: -1 });
        await db.collection('nfttransfers').createIndex({ from_address: 1, timestamp: -1 });

        // Achievement History indexes
        await db.collection('achievementhistories').createIndex({ token_id: 1 });
        await db.collection('achievementhistories').createIndex({ timestamp: -1 });
        await db.collection('achievementhistories').createIndex({ token_id: 1, timestamp: -1 });

        // Goal Progress indexes
        await db.collection('goalprogresses').createIndex({ token_id: 1 });
        await db.collection('goalprogresses').createIndex({ deadline: 1 });
        await db.collection('goalprogresses').createIndex({ completed: 1 });
        await db.collection('goalprogresses').createIndex({ token_id: 1, completed: 1 });

        // Price History indexes
        await db.collection('pricehistories').createIndex({ token_id: 1 });
        await db.collection('pricehistories').createIndex({ timestamp: -1 });
        await db.collection('pricehistories').createIndex({ token_id: 1, timestamp: -1 });

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.warn('⚠️ Index creation warning:', error);
    }
};

export default connectDB;