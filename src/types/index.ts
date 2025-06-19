export interface MelodiConfig {
  apiKey?: string;
  baseUrl?: string;
  projectId?: string;
  traceName?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  parent?: MelodiTrace;
  apiContext?: string;
  /**
   * Enable verbose console logging from the wrapper. You can also enable logging via the
   * environment variable `MELODI_DEBUG_LOG=1` (or "true").
   */
  debug?: boolean;
}

export interface MelodiTrace {
  id: string;
  client: IMelodiClient;
}

export type Metadata = {
  [key: string]: string | number;
};

export interface CreateMessageRequest {
  externalId: string;
  type?: "markdown" | "json";
  role: string;
  content?: string;
  jsonContent?: Record<string, any>;
  metadata?: Metadata;
}

export interface CreateExternalUserRequest {
  externalId: string;
  email?: string;
  name?: string;
  segments?: Record<string, string>;
}

export interface CreateThreadRequest {
  externalId: string;
  projectId: number;
  messages: CreateMessageRequest[];
  metadata?: Metadata;
  externalUser?: CreateExternalUserRequest;
  createdAt?: Date;
}

export interface ThreadResponse {
  id: number;
}

export interface IMelodiClient {
  createOrUpdateThread(thread: CreateThreadRequest): Promise<ThreadResponse>;
  flushAsync(): Promise<void>;
  shutdownAsync(): Promise<void>;
}

export interface MelodiExtension {
  flushAsync(): Promise<void>;
  shutdownAsync(): Promise<void>;
} 