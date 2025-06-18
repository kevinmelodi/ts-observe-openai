import { CreateMessageRequest } from '../types';

let messageIdCounter = 0;

export function generateMessageId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function transformOpenAIMessagesToMelodi(messages: any[]): CreateMessageRequest[] {
  if (!messages || !Array.isArray(messages)) {
    return [];
  }

  return messages.map(message => {
    const providedId = message.externalId || message.id;
    const melodiMessage: CreateMessageRequest = {
      externalId: typeof providedId === 'string' ? providedId : generateMessageId(),
      role: message.role || 'user',
    };

    if (message.content) {
      melodiMessage.content = message.content;
    }

    if (message.tool_calls) {
      melodiMessage.type = 'json';
      melodiMessage.jsonContent = {
        tool_calls: message.tool_calls,
      };
    }

    if (message.name) {
      melodiMessage.metadata = {
        name: message.name,
      };
    }

    return melodiMessage;
  });
}

export function transformResponsesAPIInputToMelodi(input: any): CreateMessageRequest[] {
  if (typeof input === 'string') {
    return [{
      externalId: generateMessageId(),
      role: 'user',
      content: input,
    }];
  }

  if (Array.isArray(input)) {
    return input.map(item => {
      if (item.role && item.content) {
        const message: CreateMessageRequest = {
          externalId: generateMessageId(),
          role: item.role,
        };

        if (Array.isArray(item.content)) {
          const textContent = item.content
            .filter((c: any) => c.type === 'input_text' || c.type === 'text')
            .map((c: any) => c.text || c.input_text)
            .join('\n');
          
          if (textContent) {
            message.content = textContent;
          }
        } else {
          message.content = item.content;
        }

        return message;
      }

      return {
        externalId: (item.externalId || item.id || generateMessageId()),
        role: 'user',
        content: JSON.stringify(item),
      };
    });
  }

  return [{
    externalId: (input.externalId || input.id || generateMessageId()),
    role: 'user',
    content: JSON.stringify(input),
  }];
}

export function transformOpenAIResponseToMelodi(response: any, existingMessages: CreateMessageRequest[]): CreateMessageRequest[] {
  const allMessages = [...existingMessages];

  if (response.choices && Array.isArray(response.choices)) {
    for (const choice of response.choices) {
      if (choice.message) {
        const providedId = choice.message.externalId || choice.message.id;
        const message: CreateMessageRequest = {
          externalId: typeof providedId === 'string' ? providedId : generateMessageId(),
          role: choice.message.role || 'assistant',
        };

        if (choice.message.content) {
          message.content = choice.message.content;
        }

        if (choice.message.tool_calls) {
          message.type = 'json';
          message.jsonContent = {
            tool_calls: choice.message.tool_calls,
          };
        }

        allMessages.push(message);
      }
    }
  }

  if (response.output_text) {
    allMessages.push({
      externalId: response.output_text_id || generateMessageId(),
      role: 'assistant',
      content: response.output_text,
    });
  }

  return allMessages;
}

export function extractModelName(args: any): string {
  return args.model || 'unknown';
}

export function extractProvider(args: any, isAzure: boolean = false): string {
  if (isAzure) {
    return 'azure';
  }
  return 'openai';
} 