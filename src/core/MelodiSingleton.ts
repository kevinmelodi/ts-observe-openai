import { MelodiClient } from './MelodiClient';

export class MelodiSingleton {
  private static instance: MelodiClient | null = null;

  static getInstance(): MelodiClient {
    if (!this.instance) {
      const apiKey = process.env.MELODI_API_KEY;
      const projectId = process.env.MELODI_PROJECT_ID;
      const baseUrl = process.env.MELODI_BASE_URL;

      if (!apiKey || !projectId) {
        throw new Error('MELODI_API_KEY and MELODI_PROJECT_ID environment variables must be set');
      }

      this.instance = new MelodiClient({
        apiKey,
        projectId,
        baseUrl,
      });
    }

    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
} 