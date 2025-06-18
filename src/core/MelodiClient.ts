import axios, { AxiosInstance } from 'axios';
import { IMelodiClient, CreateThreadRequest, ThreadResponse } from '../types';

export class MelodiClient implements IMelodiClient {
  private apiKey: string;
  private baseUrl: string;
  private projectId: string;
  private pendingRequests: Promise<any>[] = [];

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    projectId: string;
  }) {
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.baseUrl = config.baseUrl || 'https://app.melodi.fyi';
  }

  async createOrUpdateThread(thread: CreateThreadRequest): Promise<ThreadResponse> {
    const requestPromise = axios.put(
      `${this.baseUrl}/api/external/threads?apiKey=${this.apiKey}`,
      thread,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    ).then(response => {
      if (response.status !== 200) {
        throw new Error(`Melodi API error: ${response.status} ${response.statusText}`);
      }
      return response.data;
    });

    this.pendingRequests.push(requestPromise);
    
    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests = this.pendingRequests.filter(p => p !== requestPromise);
    }
  }

  async flushAsync(): Promise<void> {
    await Promise.all(this.pendingRequests);
  }

  async shutdownAsync(): Promise<void> {
    await this.flushAsync();
  }
} 