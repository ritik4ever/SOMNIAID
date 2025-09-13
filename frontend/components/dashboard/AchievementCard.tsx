interface AchievementCardProps {
    title: string
    description: string
    points: number
    timestamp: number | string | Date
    category: string
}

export function AchievementCard({
    title,
    description,
    points,
    timestamp,
    category
}: AchievementCardProps) {
    const formatTimestamp = (ts: number | string | Date) => {
        try {
            const date = new Date(ts)
            return date.toLocaleDateString()
        } catch {
            return 'Recently'
        }
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'achievement':
                return 'from-yellow-400 to-orange-500'
            case 'milestone':
                return 'from-green-400 to-teal-500'
            case 'skill':
                return 'from-blue-400 to-indigo-500'
            default:
                return 'from-purple-400 to-pink-500'
        }
    }

    return (
        <div className={`bg-gradient-to-br ${getCategoryColor(category)} rounded-2xl p-6 text-white shadow-lg`}>
            <div className="flex items-start justify-between mb-4">
                <div className="text-3xl">🏆</div>
                <div className="text-right">
                    <div className="text-2xl font-bold">+{points}</div>
                    <div className="text-white/80 text-sm">points</div>
                </div>
            </div>

            <h3 className="text-lg font-bold mb-2">{title}</h3>
            <p className="text-white/90 text-sm mb-3">{description}</p>

            <div className="flex items-center justify-between text-xs text-white/70">
                <span className="capitalize">{category}</span>
                <span>{formatTimestamp(timestamp)}</span>
            </div>
        </div>
    )
}