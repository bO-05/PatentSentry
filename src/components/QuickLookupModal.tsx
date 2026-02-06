import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2, CheckCircle, AlertCircle, Clock, ArrowRight } from 'lucide-react';

interface QuickLookupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAnalyze: (patentId: string) => void;
}

type ValidationState = 'empty' | 'valid' | 'invalid';
type LookupState = 'idle' | 'loading' | 'success' | 'error';

const RECENT_LOOKUPS_KEY = 'patentsentry_recent_lookups';
const MAX_RECENT_LOOKUPS = 5;

function getRecentLookups(): string[] {
    try {
        const stored = localStorage.getItem(RECENT_LOOKUPS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveRecentLookup(patentId: string): void {
    try {
        const recent = getRecentLookups().filter(id => id !== patentId);
        recent.unshift(patentId);
        localStorage.setItem(
            RECENT_LOOKUPS_KEY,
            JSON.stringify(recent.slice(0, MAX_RECENT_LOOKUPS))
        );
    } catch {
        // Ignore storage errors
    }
}

export default function QuickLookupModal({ isOpen, onClose, onAnalyze }: QuickLookupModalProps) {
    const [input, setInput] = useState('');
    const [lookupState, setLookupState] = useState<LookupState>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [recentLookups, setRecentLookups] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (isOpen) {
            setInput('');
            setLookupState('idle');
            setErrorMessage('');
            setRecentLookups(getRecentLookups());
            setTimeout(() => inputRef.current?.focus(), 50);
        }
        return () => {
            if (successTimeoutRef.current) {
                clearTimeout(successTimeoutRef.current);
            }
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const normalizePatentId = useCallback((id: string): string => {
        const cleaned = id.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const match = cleaned.match(/^(US)?(\d{6,11})(B\d)?$/);
        if (match) {
            return match[2];
        }
        return cleaned;
    }, []);

    const getValidationState = useCallback((id: string): ValidationState => {
        if (!id.trim()) return 'empty';
        const normalized = normalizePatentId(id);
        return /^\d{6,11}$/.test(normalized) ? 'valid' : 'invalid';
    }, [normalizePatentId]);

    const validationState = getValidationState(input);

    const handleSubmit = useCallback(() => {
        if (validationState !== 'valid') return;

        const normalized = normalizePatentId(input);
        setLookupState('loading');

        setTimeout(() => {
            saveRecentLookup(normalized);
            setLookupState('success');
            
            successTimeoutRef.current = setTimeout(() => {
                onAnalyze(normalized);
                onClose();
            }, 400);
        }, 100);
    }, [input, validationState, normalizePatentId, onAnalyze, onClose]);

    const handleRecentClick = useCallback((patentId: string) => {
        setInput(patentId);
        setLookupState('loading');
        
        setTimeout(() => {
            saveRecentLookup(patentId);
            setLookupState('success');
            
            successTimeoutRef.current = setTimeout(() => {
                onAnalyze(patentId);
                onClose();
            }, 400);
        }, 100);
    }, [onAnalyze, onClose]);

    const renderValidationFeedback = () => {
        if (lookupState === 'loading') {
            return (
                <span className="flex items-center gap-1.5 text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Looking up patent...
                </span>
            );
        }

        if (lookupState === 'success') {
            return (
                <span className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Patent found! Opening...
                </span>
            );
        }

        if (lookupState === 'error') {
            return (
                <span className="flex items-center gap-1.5 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {errorMessage || 'Patent not found. Check the number and try again.'}
                </span>
            );
        }

        switch (validationState) {
            case 'empty':
                return <span className="text-gray-500">Enter a patent number</span>;
            case 'valid':
                return (
                    <span className="flex items-center gap-1.5 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        Valid US patent format: {normalizePatentId(input)}
                    </span>
                );
            case 'invalid':
                return (
                    <span className="flex items-center gap-1.5 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        Invalid format - try US followed by 6-11 digits
                    </span>
                );
        }
    };

    if (!isOpen) return null;

    const isLoading = lookupState === 'loading';
    const isSuccess = lookupState === 'success';

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]"
            onClick={onClose}
        >
            <div
                className={`bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden transition-all duration-200 ${
                    isSuccess ? 'ring-2 ring-green-500' : ''
                }`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
                    ) : isSuccess ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                        <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => {
                            setInput(e.target.value);
                            setLookupState('idle');
                            setErrorMessage('');
                        }}
                        onKeyDown={e => e.key === 'Enter' && !isLoading && handleSubmit()}
                        placeholder="e.g., US10123456, 10123456, US-10123456-B2"
                        className="flex-1 text-lg outline-none placeholder-gray-400 disabled:bg-transparent"
                        aria-label="Patent number"
                        disabled={isLoading || isSuccess}
                    />
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="text-sm">
                        {renderValidationFeedback()}
                    </div>
                </div>

                {recentLookups.length > 0 && lookupState === 'idle' && !input && (
                    <div className="px-4 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <Clock className="w-3.5 h-3.5" />
                            Recent lookups
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {recentLookups.map(patentId => (
                                <button
                                    key={patentId}
                                    onClick={() => handleRecentClick(patentId)}
                                    className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors flex items-center gap-1.5 group"
                                >
                                    <span className="font-mono">US{patentId}</span>
                                    <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-xs text-gray-400">
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Ctrl</kbd>
                        <span className="mx-0.5">+</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">K</kbd>
                        <span className="ml-1.5">to open anytime</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>
                            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Enter</kbd>
                            <span className="ml-1">to lookup</span>
                        </span>
                        <span>
                            <kbd className="px-1.5 py-0.5 bg-gray-200 rounded font-mono">Esc</kbd>
                            <span className="ml-1">to close</span>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
