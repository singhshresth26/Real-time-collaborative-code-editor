import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
    const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/collaborative_editor";
    try {
        await mongoose.connect(mongoUri);
        console.log(`Connected to MongoDB at ${mongoUri}`);
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }
};

