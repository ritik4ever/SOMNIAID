import { LucideIcon } from 'lucide-react'

interface ReputationCardProps {
    score: number
    level: number
    title: string
    subtitle: string
    icon: LucideIcon
    gradient: string
}

export function ReputationCard({
    score,
    level,
    title,
    subtitle,
    icon: Icon,
    gradient
}: ReputationCardProps) {
    return (
        <div className={`bg-gradient-to-r ${gradient} rounded-3xl p-6 text-white shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
                <Icon className="w-8 h-8 text-white/80" />
                <div className="text-right">
                    <div className="text-3xl font-bold">{score}</div>
                    <div className="text-white/80 text-sm">{subtitle}</div>
                </div>
            </div>
            <h3 className="text-lg font-semibold text-white/90">{title}</h3>
        </div>
    )
}