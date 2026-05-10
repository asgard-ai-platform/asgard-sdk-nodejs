// Public API surface of @asgard-ai-platform/asgard-sdk-nodejs

// Config & Error
export { BotProviderConfig, MessageRequestOptions } from './config.js';
export { AsgardError } from './error.js';

// Client (full 5-method surface)
export { BotProviderClient } from './client.js';

// Streamer
export { BotProviderStreamer } from './streamer.js';

// Agent interfaces & factories
export {
  BotAgent,
  FunctionAgent,
  newBotAgent,
  newBotAgentWithConfig,
  newFunctionAgent,
  newFunctionAgentWithConfig,
} from './agents.js';

// All model types
export * from './models.js';
