import { Info } from 'lucide-react';

interface AIDisclaimerProps {
    compact?: boolean;
    className?: string;
}

/**
 * Legal disclaimer for all AI-generated content.
 * This must be shown on every AI panel per the AI architecture audit.
 */
export function AIDisclaimer({ compact = false, className = '' }: AIDisclaimerProps) {
    if (compact) {
        return (
            <div className={`flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded ${className}`}>
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>AI-generated analysis. Not legal advice.</span>
            </div>
        );
    }

    return (
        <div className={`flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 px-3 py-2 rounded-lg ${className}`}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
                <span className="font-medium">AI-Generated Content:</span>{' '}
                <span className="text-amber-700">
                    This analysis is for informational purposes only and does not constitute legal advice.
                    Always consult a qualified patent attorney for legal decisions.
                </span>
            </div>
        </div>
    );
}

export default AIDisclaimer;
