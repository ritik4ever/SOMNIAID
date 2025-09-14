import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/somniaID';
        console.log('🔍 Using Mongo URI:', mongoURI.replace(/\/\/.*@/, '//<hidden>@'));

        await mongoose.connect(mongoURI); // no options needed for Mongoose v7+

        console.log('📊 MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

export default connectDB;
