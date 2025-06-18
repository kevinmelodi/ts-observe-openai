import { observeOpenAI } from '../src';
import { OpenAI, AzureOpenAI } from 'openai';

// Example 1: Basic Usage with OpenAI
async function basicExample() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const client = observeOpenAI(openai, {
    userId: 'user-123',
    metadata: {
      environment: 'production',
      feature: 'chat',
    },
  });

  const response = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'What is the capital of France?' },
    ],
  });

  console.log(response.choices[0].message.content);
}

// Example 2: Azure OpenAI with Responses API
async function azureResponsesExample() {
  const azure = new AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: '2025-03-01-preview',
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  });

  const client = observeOpenAI(azure, {
    traceName: 'azure-responses-demo',
    userId: 'user-456',
    tags: ['azure', 'responses-api'],
  });

  const response = await (client as any).responses.create({
    model: 'gpt-4',
    input: 'Explain quantum computing in simple terms',
  });

  console.log(response.output_text);
}

// Example 3: Streaming with Observability
async function streamingExample() {
  const openai = new OpenAI();
  const client = observeOpenAI(openai, {
    sessionId: 'session-789',
    metadata: {
      streamingEnabled: true,
    },
  });

  const stream = await client.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: 'Write a haiku about coding' }],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }

  // Ensure all logs are sent
  await client.flushAsync();
}

// Example 4: Error Handling
async function errorHandlingExample() {
  const openai = new OpenAI();
  const client = observeOpenAI(openai, {
    metadata: {
      test: 'error-handling',
    },
  });

  try {
    await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test message' }],
      max_tokens: -1, // Invalid parameter to trigger error
    });
  } catch (error) {
    console.error('Error caught and logged to Melodi:', error);
  }
}

// Main function to run examples
async function main() {
  // Set up environment variables
  process.env.MELODI_API_KEY = 'your-melodi-api-key';
  process.env.MELODI_PROJECT_ID = 'your-project-id';

  console.log('Running Melodi OpenAI Observability Examples\n');

  // Run examples
  await basicExample();
  await azureResponsesExample();
  await streamingExample();
  await errorHandlingExample();

  console.log('\nExamples completed!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
} 