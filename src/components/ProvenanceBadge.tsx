import { CheckCircle, AlertTriangle, Info, ExternalLink } from 'lucide-react';

type BadgeType = 'verified' | 'ai_analysis' | 'insufficient' | 'exa_sourced';

interface ProvenanceBadgeProps {
    type: BadgeType;
    source?: string;
    sourceUrl?: string;
    compact?: boolean;
}

const badgeConfig = {
    verified: {
        icon: CheckCircle,
        label: 'Verified',
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        iconColor: 'text-green-600',
    },
    ai_analysis: {
        icon: Info,
        label: 'AI Analysis',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        iconColor: 'text-blue-600',
    },
    insufficient: {
        icon: AlertTriangle,
        label: 'Limited Data',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        iconColor: 'text-amber-600',
    },
    exa_sourced: {
        icon: ExternalLink,
        label: 'Web Sourced',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        iconColor: 'text-purple-600',
    },
};

/**
 * ProvenanceBadge - Indicates data source trustworthiness
 * Used for Trustworthy AI to show users where data came from
 */
export function ProvenanceBadge({ type, source, sourceUrl, compact = false }: ProvenanceBadgeProps) {
    const config = badgeConfig[type];
    const Icon = config.icon;

    if (compact) {
        return (
            <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${config.bg} ${config.border} ${config.text} border`}
                title={source || config.label}
            >
                <Icon className={`w-3 h-3 ${config.iconColor}`} />
                {config.label}
            </span>
        );
    }

    return (
        <div className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${config.bg} ${config.border} border`}>
            <Icon className={`w-4 h-4 ${config.iconColor}`} />
            <div className="flex flex-col">
                <span className={`text-xs font-semibold ${config.text}`}>{config.label}</span>
                {source && (
                    sourceUrl ? (
                        <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:underline truncate max-w-[200px]"
                        >
                            {source}
                        </a>
                    ) : (
                        <span className="text-xs text-gray-500 truncate max-w-[200px]">{source}</span>
                    )
                )}
            </div>
        </div>
    );
}

export default ProvenanceBadge;
