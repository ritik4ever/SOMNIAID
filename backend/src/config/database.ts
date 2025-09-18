import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/somniaID';
        console.log('🔍 Using Mongo URI:', mongoURI.replace(/\/\/.*@/, '//<hidden>@'));

        await mongoose.connect(mongoURI); // no options needed for Mongoose v7+

        console.log('📊 MongoDB connected successfully');

        // Create indexes for new collections
        await createIndexes();
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// Create database indexes for performance
const createIndexes = async () => {
    try {
        const db = mongoose.connection.db;
        if (!db) {
            console.warn('⚠️ Database connection not available for index creation');
            return;
        }

        // NFT Transfers collection indexes
        await db.collection('nfttransfers').createIndex({ token_id: 1 });
        await db.collection('nfttransfers').createIndex({ from_address: 1 });
        await db.collection('nfttransfers').createIndex({ to_address: 1 });
        await db.collection('nfttransfers').createIndex({ timestamp: -1 });

        // Achievement History indexes
        await db.collection('achievementhistories').createIndex({ token_id: 1 });
        await db.collection('achievementhistories').createIndex({ timestamp: -1 });

        // Goal Progress indexes
        await db.collection('goalprogresses').createIndex({ token_id: 1 });
        await db.collection('goalprogresses').createIndex({ deadline: 1 });
        await db.collection('goalprogresses').createIndex({ completed: 1 });

        // Price History indexes
        await db.collection('pricehistories').createIndex({ token_id: 1 });
        await db.collection('pricehistories').createIndex({ timestamp: -1 });

        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.warn('⚠️ Index creation warning:', error);
    }
};

export default connectDB;
