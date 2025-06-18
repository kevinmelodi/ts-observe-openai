# melodi-observe-openai

A TypeScript/JavaScript package that automatically logs OpenAI API calls to Melodi for observability, analytics, and monitoring.

## Installation

```bash
npm install melodi-observe-openai
# or
yarn add melodi-observe-openai
```

## Quick Start

```typescript
import { observeOpenAI } from "melodi-observe-openai";
import OpenAI from "openai";

// Create your OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Wrap it with Melodi observability
const client = observeOpenAI(openai, {
  traceName: "my-chat-app",
  userId: "user-123",
  metadata: {
    environment: "production",
    version: "1.0.0",
  },
});

// Use the client normally - all calls are automatically logged to Melodi
const response = await client.chat.completions.create({
  model: "gpt-4.1",
  messages: [{ role: "user", content: "Hello!" }],
});
```

## Configuration

### Environment Variables

Set these environment variables in your `.env` file:

```bash
MELODI_API_KEY=your-melodi-api-key
MELODI_PROJECT_ID=your-project-id
MELODI_BASE_URL=https://app.melodi.fyi  # Optional, defaults to production URL
```

### Configuration Options

The `observeOpenAI` function accepts a configuration object:

```typescript
interface MelodiConfig {
  apiKey?: string; // Override MELODI_API_KEY env var
  baseUrl?: string; // Override MELODI_BASE_URL env var
  projectId?: string; // Override MELODI_PROJECT_ID env var
  traceName?: string; // Name for this trace/session
  sessionId?: string; // Session identifier
  userId?: string; // User identifier
  metadata?: Record<string, any>; // Custom metadata
  tags?: string[]; // Tags for categorization
}
```

## Features

### Automatic Logging

All OpenAI API calls are automatically logged to Melodi, including:

- Chat completions (including streaming)
- Responses API
- All request parameters
- Response content
- Token usage
- Errors and exceptions

### Streaming Compatibility

The package maintains full compatibility with streaming frameworks like CopilotKit by preserving the async iterator protocol (`Symbol.asyncIterator`) that these frameworks expect. Streaming responses work seamlessly while still providing complete observability.

### Streaming Support

Streaming responses are fully supported and logged after completion:

```typescript
const stream = await client.chat.completions.create({
  model: "gpt-4.1",
  messages: [{ role: "user", content: "Tell me a story" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
// Full response is logged to Melodi after streaming completes
```

### Azure OpenAI Support

Works seamlessly with Azure OpenAI:

```typescript
import { AzureOpenAI } from "openai";

const azure = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: "2025-03-01-preview",
  endpoint: "https://your-resource.openai.azure.com",
});

const client = observeOpenAI(azure);
```

### Error Tracking

Errors are automatically captured and logged:

```typescript
try {
  await client.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }],
  });
} catch (error) {
  // Error is automatically logged to Melodi with full context
}
```

### Batching and Performance

The package automatically batches requests to Melodi for optimal performance:

```typescript
// Force flush all pending logs
await client.flushAsync();

// Graceful shutdown
await client.shutdownAsync();
```

## API Reference

### `observeOpenAI(sdk, config?)`

Wraps an OpenAI SDK instance with Melodi logging.

**Parameters:**

- `sdk`: OpenAI SDK instance
- `config`: Optional configuration object

**Returns:** Wrapped SDK instance with the same API plus `flushAsync()` and `shutdownAsync()` methods

### `MelodiSingleton`

Manages the global Melodi client instance.

```typescript
import { MelodiSingleton } from "melodi-observe-openai";

// Get the current instance
const client = MelodiSingleton.getInstance();

// Reset the instance (useful for testing)
MelodiSingleton.reset();
```

## Examples

### Basic Chat Application

```typescript
import { observeOpenAI } from "melodi-observe-openai";
import OpenAI from "openai";

const openai = new OpenAI();
const client = observeOpenAI(openai, {
  traceName: "chat-app",
  metadata: { version: "1.0.0" },
});

async function chat(message: string) {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: message },
    ],
  });

  return response.choices[0].message.content;
}
```

### With User Context

```typescript
const client = observeOpenAI(openai, {
  userId: req.user.id,
  sessionId: req.sessionId,
  metadata: {
    userTier: req.user.tier,
    feature: "chat-support",
  },
  tags: ["production", "support-chat"],
});
```

### Testing

```typescript
// In your tests, you can use a custom API key and project
process.env.MELODI_API_KEY = "test-api-key";
process.env.MELODI_PROJECT_ID = "test-project";

const client = observeOpenAI(openai, {
  metadata: { environment: "test" },
});

// Run your tests...

// Clean up
await client.shutdownAsync();
```

## How It Works

1. The package wraps your OpenAI client using a Proxy
2. All method calls are intercepted and wrapped with logging
3. Request and response data is sent asynchronously to Melodi
4. Original OpenAI functionality is preserved exactly

## Data Privacy

- API keys are never logged
- You control what metadata is attached to logs
- All data is sent securely over HTTPS
- Melodi respects your data retention policies

## Requirements

- Node.js 14+
- OpenAI SDK v4+
- Melodi account and API key

## License

MIT
