import { MelodiClient } from './MelodiClient';
import { MelodiSingleton } from './MelodiSingleton';
import { MelodiConfig, CreateThreadRequest, CreateMessageRequest, ThreadResponse } from '../types';
import {
  transformOpenAIMessagesToMelodi,
  transformResponsesAPIInputToMelodi,
  transformOpenAIResponseToMelodi,
  extractModelName,
  extractProvider,
  generateMessageId,
} from '../utils/openaiTransformers';

let threadIdCounter = 0;

function generateThreadId(config?: MelodiConfig): string {
  // Use sessionId if provided, otherwise generate a new thread ID
  if (config?.sessionId) {
    return config.sessionId;
  }
  return `thread-${Date.now()}-${++threadIdCounter}`;
}

export function withTracing<T extends (...args: any[]) => any>(
  originalMethod: T,
  config: MelodiConfig
): T {
  return (function (...args: any[]) {
    const methodArgs = args[0] || {};
    
    // CRITICAL: Check if this is a streaming method BEFORE any async operations
    const isStreamingMethod = methodArgs.stream === true;
    
    if (isStreamingMethod) {
      // Handle streaming methods completely synchronously to preserve ChatCompletionStream type
      return handleStreamingMethod(originalMethod, args, config);
    } else {
      // Handle non-streaming methods (can be async)
      return handleNonStreamingMethod(originalMethod, args, config);
    }
  }) as T;
}

function handleStreamingMethod(originalMethod: any, args: any[], config: MelodiConfig) {
  const melodiClient = config.parent?.client || MelodiSingleton.getInstance();
  
  let threadId = generateThreadId(config);
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

    // Create initial thread asynchronously (fire-and-forget)
    const initialThread: CreateThreadRequest = {
      externalId: threadId,
      projectId: parseInt(process.env.MELODI_PROJECT_ID || config.projectId || '0'),
      messages: promptMessages,
      metadata,
      externalUser: config.userId ? {
        externalId: config.userId,
      } : undefined,
    };

    melodiClient.createOrUpdateThread(initialThread).catch(error => {
      console.error('Melodi initial thread creation error:', error);
    });

    // Call original method synchronously to get ChatCompletionStream
    const stream = originalMethod(...args);

    // Wrap the stream with observability but preserve its type and methods
    return createObservableStream(stream, threadId, promptMessages, melodiClient as MelodiClient, metadata);

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

    melodiClient.createOrUpdateThread(errorThread).catch(logError => {
      console.error('Melodi error thread creation failed:', logError);
    });
    
    throw error;
  }
}

async function handleNonStreamingMethod(originalMethod: any, args: any[], config: MelodiConfig) {
  const melodiClient = config.parent?.client || MelodiSingleton.getInstance();
  
  let threadId = generateThreadId(config);
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
}

function isStreamingResponse(response: any): boolean {
  return response && typeof response[Symbol.asyncIterator] === 'function';
}

function createObservableStream(
  originalStream: any,
  threadId: string,
  promptMessages: CreateMessageRequest[],
  melodiClient: MelodiClient,
  metadata: Record<string, string | number>
): any {
  // Use a Proxy to preserve the exact original stream behavior
  // while transparently adding observability
  let fullContent = '';
  let usage: any = null;
  let isObservabilityAdded = false;

  return new Proxy(originalStream, {
    get(target, prop, receiver) {
      // Get the original property value
      const originalValue = Reflect.get(target, prop, target); // Use target as receiver to preserve 'this' context
      
      // If accessing Symbol.asyncIterator, wrap it with observability
      if (prop === Symbol.asyncIterator && !isObservabilityAdded) {
        isObservabilityAdded = true;
        
        return function() {
          const originalIterator = originalValue.call(target);
          
          return {
            async next() {
              try {
                const result = await originalIterator.next();
                
                if (!result.done && result.value) {
                  // Extract data for observability
                  const chunk = result.value;
                  
                  if (chunk?.choices?.[0]?.delta?.content) {
                    fullContent += chunk.choices[0].delta.content;
                  }

                  if (chunk?.output_text_delta) {
                    fullContent += chunk.output_text_delta;
                  }

                  if (chunk?.usage) {
                    usage = chunk.usage;
                  }
                }
                
                // If stream is done, log the complete response
                if (result.done) {
                  // Log asynchronously without blocking the stream completion
                  setImmediate(async () => {
                    try {
                      const responseMessage: CreateMessageRequest = {
                        externalId: generateMessageId(),
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
                    } catch (logError) {
                      console.error('Melodi observability error:', logError);
                    }
                  });
                }
                
                return result;
              } catch (error) {
                // Log error asynchronously without affecting the stream
                setImmediate(async () => {
                  try {
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
                  } catch (logError) {
                    console.error('Melodi observability error:', logError);
                  }
                });
                
                throw error; // Re-throw the original error
              }
            },
            
            return() {
              return originalIterator.return?.() || Promise.resolve({ done: true, value: undefined });
            },
            
            throw(error: any) {
              return originalIterator.throw?.(error) || Promise.reject(error);
            }
          };
        };
      }
      
      // For methods, bind them to the original target to preserve 'this' context and private fields
      if (typeof originalValue === 'function') {
        return originalValue.bind(target);
      }
      
      // For non-function properties, return as-is
      return originalValue;
    },
    
    // Preserve all other proxy traps to maintain original behavior
    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, target); // Use target as receiver
    },
    
    has(target, prop) {
      return Reflect.has(target, prop);
    },
    
    ownKeys(target) {
      return Reflect.ownKeys(target);
    },
    
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(target, prop);
    }
  });
} 