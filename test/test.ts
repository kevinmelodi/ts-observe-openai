import * as dotenv from 'dotenv';
import { AzureOpenAI } from 'openai';
import { observeOpenAI } from '../src';

dotenv.config({ path: '.env' });

async function testChatCompletions() {
  console.log('=== Testing Chat Completions API ===');
  
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE!,
    apiVersion: '2025-03-01-preview',
    endpoint: 'https://melodi.openai.azure.com/',
  });

  const wrappedClient = observeOpenAI(client, {
    traceName: 'test-chat-completions',
    userId: 'test-user',
    sessionId: 'test-session',
    tags: ['test', 'chat'],
    metadata: {
      test: true,
      environment: 'development',
    },
  });

  try {
    const response = await wrappedClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'What is 2+2?',
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    console.log('Response:', response.choices[0].message.content);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testResponsesAPI() {
  console.log('\n=== Testing Responses API ===');
  
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE!,
    apiVersion: '2025-03-01-preview',
    endpoint: 'https://melodi.openai.azure.com/',
  });

  const wrappedClient = observeOpenAI(client, {
    traceName: 'test-responses-api',
    userId: 'test-user',
    sessionId: 'test-session',
    tags: ['test', 'responses'],
    metadata: {
      test: true,
      api: 'responses',
    },
  });

  try {
    const response = await (wrappedClient as any).responses.create({
      model: 'gpt-4.1-mini',
      input: 'This is a test of the responses API with TypeScript observability',
    });

    console.log('Response text:', response.output_text);
    console.log('Response ID:', response.id);
  } catch (error) {
    console.error('Error:', error);
  }
}

async function testStreaming() {
  console.log('\n=== Testing Streaming API ===');
  
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE!,
    apiVersion: '2025-03-01-preview',
    endpoint: 'https://melodi.openai.azure.com/',
  });

  const wrappedClient = observeOpenAI(client, {
    traceName: 'test-streaming',
    userId: 'test-user',
    sessionId: 'test-session',
    tags: ['test', 'streaming'],
  });

  try {
    const stream = await wrappedClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: 'Count from 1 to 5',
        },
      ],
      stream: true,
    });

    console.log('Streaming response:');
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log('\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

async function main() {
  console.log('Starting Melodi OpenAI Observability Tests\n');

  // Check if required environment variables are set
  if (!process.env.MELODI_API_KEY) {
    console.error('Error: MELODI_API_KEY not found in environment variables');
    process.exit(1);
  }
  if (!process.env.MELODI_PROJECT_ID) {
    console.error('Error: MELODI_PROJECT_ID not found in environment variables');
    process.exit(1);
  }
  if (!process.env.AZURE) {
    console.error('Error: AZURE (API key) not found in environment variables');
    process.exit(1);
  }

  console.log('Using Melodi API Key:', process.env.MELODI_API_KEY.substring(0, 10) + '...');
  console.log('Using Melodi Project ID:', process.env.MELODI_PROJECT_ID);

  await testChatCompletions();
  await testResponsesAPI();
  await testStreaming();

  console.log('\nFlushing pending requests...');
  const client = new AzureOpenAI({
    apiKey: process.env.AZURE!,
    apiVersion: '2025-03-01-preview',
    endpoint: 'https://melodi.openai.azure.com/',
  });
  const wrappedClient = observeOpenAI(client);
  await wrappedClient.flushAsync();
  
  console.log('Tests completed!');
}

main().catch(console.error); 