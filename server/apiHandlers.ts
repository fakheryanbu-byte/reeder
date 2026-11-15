import {
  analyzeDocumentImages,
  validateIncomingImages,
} from './geminiDocumentParser.ts';

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

const requestLogByIp = new Map<string, number[]>();

export function isRateLimited(ip: string, now = Date.now()): boolean {
  const timestamps = (requestLogByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLogByIp.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLogByIp.set(ip, timestamps);
  return false;
}

export function resolveGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    ''
  ).trim();
}

export interface AnalyzeDocumentOutcome {
  status: number;
  body: Record<string, unknown>;
}

export async function handleAnalyzeDocumentRequest(
  clientIp: string,
  requestBody: unknown
): Promise<AnalyzeDocumentOutcome> {
  if (isRateLimited(clientIp)) {
    return {
      status: 429,
      body: {
        code: 'RATE_LIMITED',
        message: 'Too many document reading requests. Please wait a moment and try again.',
      },
    };
  }

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return {
      status: 503,
      body: {
        code: 'GEMINI_NOT_CONFIGURED',
        message: 'Document reading service is not configured on the server.',
      },
    };
  }

  const images =
    typeof requestBody === 'object' && requestBody !== null
      ? (requestBody as { images?: unknown }).images
      : undefined;

  const validation = validateIncomingImages(images);
  if (!validation.ok) {
    return {
      status: validation.status,
      body: {
        code: validation.code,
        message: validation.message,
      },
    };
  }

  try {
    const data = await analyzeDocumentImages(validation.images, apiKey);
    return {
      status: 200,
      body: { data },
    };
  } catch (err) {
    // Never log document images or guest PII
    const status =
      typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : 502;
    const errMessage = err instanceof Error ? err.message : '';
    console.error('Document analysis error status:', status || 502, errMessage.slice(0, 160));

    if (status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(errMessage)) {
      return {
        status: 502,
        body: {
          code: 'GEMINI_AUTH_ERROR',
          message: 'Gemini API key is invalid or lacks permission.',
        },
      };
    }
    if (status === 429 || /RESOURCE_EXHAUSTED/i.test(errMessage)) {
      return {
        status: 429,
        body: {
          code: 'GEMINI_QUOTA_EXCEEDED',
          message: 'Gemini API quota exceeded. Please try again shortly or check billing/quota.',
        },
      };
    }

    return {
      status: 502,
      body: {
        code: 'GEMINI_FAILED',
        message: 'Could not extract document details. Please retake the photo or enter details manually.',
      },
    };
  }
}
