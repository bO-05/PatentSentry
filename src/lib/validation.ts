/**
 * Patent validation utilities
 * Validates patent IDs, dates, and URLs before API calls
 */

// US Patent ID format: 7-11 digits, optionally prefixed with "US" or "US-"
const US_PATENT_REGEX = /^(US[-]?)?(\d{7,11})([A-Z]\d*)?$/i;

// Date format: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Google Patents URL
const GOOGLE_PATENTS_REGEX = /^https?:\/\/patents\.google\.com\/patent\/([A-Z]{2}\d+)/i;

export interface ValidationResult {
    valid: boolean;
    normalized?: string;
    error?: string;
}

/**
 * Validate and normalize US patent ID
 * Handles formats: "US1234567", "US-1234567", "1234567", "US1234567B2"
 */
export function validatePatentId(input: string): ValidationResult {
    const trimmed = input.trim().toUpperCase();

    if (!trimmed) {
        return { valid: false, error: 'Patent ID is required' };
    }

    const match = trimmed.match(US_PATENT_REGEX);
    if (!match) {
        return { valid: false, error: 'Invalid patent ID format. Use 7-11 digit US patent number.' };
    }

    // Normalize: US + digits + optional kind code
    const digits = match[2];
    const kindCode = match[3] || '';
    const normalized = `US${digits}${kindCode}`;

    return { valid: true, normalized };
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDate(input: string): ValidationResult {
    const trimmed = input.trim();

    if (!trimmed) {
        return { valid: true }; // Dates are often optional
    }

    if (!DATE_REGEX.test(trimmed)) {
        return { valid: false, error: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    // Check if date is valid (e.g., Feb 30 is invalid)
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid date' };
    }

    return { valid: true, normalized: trimmed };
}

/**
 * Validate and extract patent ID from Google Patents URL
 */
export function validatePatentUrl(input: string): ValidationResult {
    const trimmed = input.trim();

    if (!trimmed) {
        return { valid: false, error: 'URL is required' };
    }

    const match = trimmed.match(GOOGLE_PATENTS_REGEX);
    if (!match) {
        return { valid: false, error: 'Invalid Google Patents URL' };
    }

    return { valid: true, normalized: match[1] };
}

/**
 * Sanitize string input to prevent injection
 */
export function sanitizeInput(input: string, maxLength = 500): string {
    return input
        .trim()
        .slice(0, maxLength)
        .replace(/[<>'"&]/g, ''); // Remove potential HTML/SQL injection chars
}

/**
 * Validate batch of patent IDs
 */
export function validatePatentIds(inputs: string[]): {
    valid: string[];
    invalid: Array<{ input: string; error: string }>;
} {
    const valid: string[] = [];
    const invalid: Array<{ input: string; error: string }> = [];

    for (const input of inputs) {
        const result = validatePatentId(input);
        if (result.valid && result.normalized) {
            valid.push(result.normalized);
        } else {
            invalid.push({ input, error: result.error || 'Invalid format' });
        }
    }

    return { valid, invalid };
}
