import { MelodiClient } from './MelodiClient';
import { MelodiSingleton } from './MelodiSingleton';
import { MelodiConfig, CreateThreadRequest, CreateMessageRequest, ThreadResponse } from '../types';
import {
  transformOpenAIMessagesToMelodi,
  transformResponsesAPIInputToMelodi,
  transformOpenAIResponseToMelodi,
  extractModelName,
  extractProvider,
} from '../utils/openaiTransformers';

let threadIdCounter = 0;

function generateThreadId(): string {
  return `thread-${Date.now()}-${++threadIdCounter}`;
}

export function withTracing<T extends (...args: any[]) => any>(
  originalMethod: T,
  config: MelodiConfig
): T {
  return (async function (...args: any[]) {
    const melodiClient = config.parent?.client || MelodiSingleton.getInstance();
    
    let threadId = generateThreadId();
    let promptMessages: CreateMessageRequest[] = [];
    let model = 'unknown';
    let provider = 'openai';
    let metadata: Record<string, string | number> = {};

    try {
      const methodArgs = args[0] || {};
      model = extractModelName(methodArgs);
      provider = extractProvider(methodArgs, methodArgs.azure_endpoint !== undefined);

      if (config.metadata) {
        Object.entries(config.metadata).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            metadata[key] = value;
          }
        });
      }

      metadata.model = model;
      metadata.provider = provider;
      if (config.traceName) metadata.traceName = config.traceName;
      if (config.tags) metadata.tags = config.tags.join(',');

      const isResponsesAPI = config.apiContext === 'responses';

      if (isResponsesAPI && methodArgs.input) {
        promptMessages = transformResponsesAPIInputToMelodi(methodArgs.input);
      } else if (methodArgs.messages) {
        promptMessages = transformOpenAIMessagesToMelodi(methodArgs.messages);
      }

      const initialThread: CreateThreadRequest = {
        externalId: threadId,
        projectId: parseInt(process.env.MELODI_PROJECT_ID || config.projectId || '0'),
        messages: promptMessages,
        metadata,
        externalUser: config.userId ? {
          externalId: config.userId,
        } : undefined,
      };

      await melodiClient.createOrUpdateThread(initialThread);

      const response = await originalMethod(...args);

      if (isStreamingResponse(response)) {
        return createStreamWrapper(response, threadId, promptMessages, melodiClient as MelodiClient, metadata);
      } else {
        const allMessages = transformOpenAIResponseToMelodi(response, promptMessages);
        
        const updatedThread: CreateThreadRequest = {
          externalId: threadId,
          projectId: parseInt(process.env.MELODI_PROJECT_ID || config.projectId || '0'),
          messages: allMessages,
          metadata: {
            ...metadata,
            prompt_tokens: response.usage?.prompt_tokens || 0,
            completion_tokens: response.usage?.completion_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0,
          },
          externalUser: config.userId ? {
            externalId: config.userId,
          } : undefined,
        };

        await melodiClient.createOrUpdateThread(updatedThread);

        return response;
      }
    } catch (error) {
      const errorThread: CreateThreadRequest = {
        externalId: threadId,
        projectId: parseInt(process.env.MELODI_PROJECT_ID || config.projectId || '0'),
        messages: promptMessages,
        metadata: {
          ...metadata,
          error: String(error),
        },
        externalUser: config.userId ? {
          externalId: config.userId,
        } : undefined,
      };

      await melodiClient.createOrUpdateThread(errorThread);
      throw error;
    }
  }) as T;
}

function isStreamingResponse(response: any): boolean {
  return response && typeof response[Symbol.asyncIterator] === 'function';
}

async function* createStreamWrapper(
  stream: any,
  threadId: string,
  promptMessages: CreateMessageRequest[],
  melodiClient: MelodiClient,
  metadata: Record<string, string | number>
): AsyncGenerator<any, void, unknown> {
  const chunks: any[] = [];
  let fullContent = '';
  let usage: any = null;

  try {
    for await (const chunk of stream) {
      chunks.push(chunk);
      yield chunk;

      if (chunk.choices?.[0]?.delta?.content) {
        fullContent += chunk.choices[0].delta.content;
      }

      if (chunk.output_text_delta) {
        fullContent += chunk.output_text_delta;
      }

      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    const responseMessage: CreateMessageRequest = {
      externalId: `msg-${Date.now()}-response`,
      role: 'assistant',
      content: fullContent,
    };

    const allMessages = [...promptMessages, responseMessage];

    const updatedThread: CreateThreadRequest = {
      externalId: threadId,
      projectId: parseInt(process.env.MELODI_PROJECT_ID!),
      messages: allMessages,
      metadata: {
        ...metadata,
        prompt_tokens: usage?.prompt_tokens || 0,
        completion_tokens: usage?.completion_tokens || 0,
        total_tokens: usage?.total_tokens || 0,
      },
    };

    await melodiClient.createOrUpdateThread(updatedThread);
  } catch (error) {
    const errorThread: CreateThreadRequest = {
      externalId: threadId,
      projectId: parseInt(process.env.MELODI_PROJECT_ID!),
      messages: promptMessages,
      metadata: {
        ...metadata,
        error: String(error),
      },
    };

    await melodiClient.createOrUpdateThread(errorThread);
    throw error;
  }
} 