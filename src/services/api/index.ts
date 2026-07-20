import { CONFIG } from '../../config/index.js';
import { getLogger } from '../logger/index.js';

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private logger = getLogger({ service: 'ApiClient' });

  constructor(baseUrl: string, headers: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      params,
      timeout = 30000,
      retries = 3,
    } = options;

    const url = this.buildUrl(path, params);
    const allHeaders = { ...this.defaultHeaders, ...headers };

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
          method,
          headers: allHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json() as T;
        }
        return await response.text() as unknown as T;
      } catch (error) {
        this.logger.warn(`API request failed (attempt ${attempt}/${retries})`, {
          url,
          error: (error as Error).message,
        });

        if (attempt === retries) {
          throw error;
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw new Error('Max retries exceeded');
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { params });
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

// Pre-configured API clients
export const deezerApi = new ApiClient(CONFIG.APIS.DEEZER);
export const nasaApi = new ApiClient(CONFIG.APIS.NASA);
export const spacexApi = new ApiClient(CONFIG.APIS.SPACEX);
export const frankfurterApi = new ApiClient(CONFIG.APIS.FRANKFURTER);
export const metalsApi = new ApiClient(CONFIG.APIS.METALS_LIVE);
export const musicbrainzApi = new ApiClient(CONFIG.APIS.MUSICBRAINZ, {
  'User-Agent': 'IkolBot/1.0 (https://github.com/ikol-bot)',
});
