import { CopilotRuntime, AzureOpenAIAdapter } from '@copilotkit/react-core';  
import { AzureOpenAI } from 'openai';
import { observeOpenAI } from 'melodi-observe-openai';

const runtime = new CopilotRuntime();

export async function POST(req: Request) {
  try {
    console.log('🚀 CopilotKit API route called');
    
    // Create Azure OpenAI client
    const azureClient = new AzureOpenAI({
      apiKey: process.env.AZURE!,
      apiVersion: '2025-03-01-preview',
      endpoint: 'https://melodi.openai.azure.com/',
    });

    console.log('✅ Azure OpenAI client created');

    // CRITICAL TEST: Wrap with melodi observability
    const wrappedClient = observeOpenAI(azureClient, {
      traceName: 'copilotkit-streaming-test',
      userId: 'test-user',
      metadata: {
        test: 'streaming-compatibility',
        framework: 'copilotkit',
      },
    });

    console.log('✅ Melodi wrapper applied');

    // Create Azure OpenAI adapter with wrapped client
    const serviceAdapter = new AzureOpenAIAdapter({
      client: wrappedClient as any, // Type assertion for compatibility
      model: 'gpt-4o-mini',
    });

    console.log('✅ CopilotKit adapter created');

    // This is where the streaming issue will occur if it exists
    const result = await runtime.process({
      request: req,
      serviceAdapter,
    });

    console.log('✅ CopilotKit runtime processed successfully');
    return result;

  } catch (error: any) {
    console.error('❌ CopilotKit API Error:', error);
    console.error('❌ Error Stack:', error.stack);
    
    if (error.message?.includes('stream is not async iterable')) {
      console.error('🚨 STREAMING COMPATIBILITY ISSUE DETECTED!');
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'See server logs for full error details'
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 