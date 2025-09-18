import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGoalProgress extends Document {
    token_id: number;
    goal_index: number;
    title: string;
    description: string;
    deadline: Date;
    current_progress: number;
    target_value: number;
    progress_type: 'percentage' | 'count' | 'boolean';
    reward_points: number;
    penalty_points: number;
    completed: boolean;
    failed: boolean;
    completed_at?: Date;
    failed_at?: Date;
    proof?: {
        type: string;
        value: string;
        submitted_at: Date;
    };
}

const GoalProgressSchema: Schema = new Schema(
    {
        token_id: { type: Number, required: true, index: true },
        goal_index: { type: Number, required: true },
        title: { type: String, required: true, maxlength: 100 },
        description: { type: String, required: true, maxlength: 500 },
        deadline: { type: Date, required: true, index: true },
        current_progress: { type: Number, default: 0, min: 0 },
        target_value: { type: Number, required: true, min: 1 },
        progress_type: {
            type: String,
            enum: ['percentage', 'count', 'boolean'],
            default: 'percentage',
        },
        reward_points: { type: Number, required: true, min: 0, max: 500 },
        penalty_points: { type: Number, required: true, min: 0, max: 200 },
        completed: { type: Boolean, default: false, index: true },
        failed: { type: Boolean, default: false, index: true },
        completed_at: { type: Date },
        failed_at: { type: Date },
        proof: {
            type: { type: String, enum: ['url', 'file', 'transaction', 'description'] },
            value: String,
            submitted_at: { type: Date, default: Date.now },
        },
    },
    { timestamps: true }
);

// Compound indexes
GoalProgressSchema.index({ token_id: 1, completed: 1 });
GoalProgressSchema.index({ token_id: 1, failed: 1 });
GoalProgressSchema.index({ deadline: 1, completed: 1, failed: 1 });

// Virtuals
GoalProgressSchema.virtual('progress_percentage').get(function (this: IGoalProgress) {
    return Math.min(100, (this.current_progress / this.target_value) * 100);
});
GoalProgressSchema.virtual('time_remaining').get(function (this: IGoalProgress) {
    const now = new Date();
    return Math.max(0, this.deadline.getTime() - now.getTime());
});

// Methods
GoalProgressSchema.methods.isOverdue = function (this: IGoalProgress) {
    return new Date() > this.deadline && !this.completed && !this.failed;
};

// ✅ Fix: safe export
const GoalProgress: Model<IGoalProgress> =
    mongoose.models.GoalProgress ||
    mongoose.model<IGoalProgress>('GoalProgress', GoalProgressSchema);

export default GoalProgress;
