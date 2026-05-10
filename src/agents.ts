import { Readable } from 'stream';
import { BotProviderClient } from './client.js';
import { BotProviderConfig, MessageRequestOptions } from './config.js';
import {
  Blob,
  GenericBotMessage,
  GenericBotReply,
} from './models.js';
import { BotProviderStreamer } from './streamer.js';

// ─── BotAgent ────────────────────────────────────────────────────────────────

export interface BotAgent {
  sendMessage(
    message: GenericBotMessage,
    opts?: MessageRequestOptions,
  ): Promise<GenericBotReply>;
  newStreamer(
    message: GenericBotMessage,
    opts?: MessageRequestOptions,
  ): BotProviderStreamer;
  uploadBlob(
    channelId: string,
    file: { stream: Readable; filename: string; mime?: string },
  ): Promise<Blob>;
}

// ─── FunctionAgent ───────────────────────────────────────────────────────────

export interface FunctionAgent {
  triggerJson(payload: Record<string, unknown>): Promise<unknown>;
  triggerForm(
    payload: Record<string, unknown>,
    file?: { stream: Readable; filename: string; mime?: string },
  ): Promise<unknown>;
}

// ─── Implementations ─────────────────────────────────────────────────────────

class BotAgentImpl implements BotAgent {
  private readonly client: BotProviderClient;

  constructor(config: BotProviderConfig) {
    this.client = new BotProviderClient(config);
  }

  sendMessage(message: GenericBotMessage, opts?: MessageRequestOptions) {
    return this.client.sendMessage(message, opts);
  }

  newStreamer(message: GenericBotMessage, opts?: MessageRequestOptions) {
    return this.client.newStreamer(message, opts);
  }

  uploadBlob(
    channelId: string,
    file: { stream: Readable; filename: string; mime?: string },
  ) {
    return this.client.uploadBlob(channelId, file);
  }
}

class FunctionAgentImpl implements FunctionAgent {
  private readonly client: BotProviderClient;

  constructor(config: BotProviderConfig) {
    this.client = new BotProviderClient(config);
  }

  triggerJson(payload: Record<string, unknown>) {
    return this.client.triggerJson(payload);
  }

  triggerForm(
    payload: Record<string, unknown>,
    file?: { stream: Readable; filename: string; mime?: string },
  ) {
    return this.client.triggerForm(payload, file);
  }
}

// ─── Factory functions ───────────────────────────────────────────────────────

export function newBotAgent(
  edgeServerHost: string,
  namespace: string,
  botProviderName: string,
  botProviderApiKey: string,
): BotAgent {
  return new BotAgentImpl({
    edgeServerHost,
    namespace,
    botProviderName,
    botProviderApiKey,
  });
}

export function newBotAgentWithConfig(config: BotProviderConfig): BotAgent {
  return new BotAgentImpl(config);
}

export function newFunctionAgent(
  edgeServerHost: string,
  namespace: string,
  botProviderName: string,
  botProviderApiKey: string,
): FunctionAgent {
  return new FunctionAgentImpl({
    edgeServerHost,
    namespace,
    botProviderName,
    botProviderApiKey,
  });
}

export function newFunctionAgentWithConfig(
  config: BotProviderConfig,
): FunctionAgent {
  return new FunctionAgentImpl(config);
}
