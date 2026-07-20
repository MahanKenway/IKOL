// Providers - Cloudflare Workers compatible stubs
export class MultiProvider<T> {
  async execute(_operation: string, ..._args: unknown[]): Promise<{ data: T; provider: string; cached: boolean }> {
    throw new Error('Not implemented');
  }
}
