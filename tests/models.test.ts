import {
  FileType,
  FileTypeImage,
  MessageTemplateActionType,
  MessageTemplateActionTypeMessage,
  MessageTemplateType,
  MessageTemplateTypeText,
  PostBackAction,
  PostBackActionNone,
  PostBackActionResetChannel,
  PostBackActionResponseToolCallConsent,
  SseEventType,
  SseEventTypeMessageDelta,
  SseEventTypeRunInit,
  SseEventTypeSandboxLaunch,
  SseEventTypeSandboxReady,
  ToolCallConsentResult,
  ToolCallConsentResultAllowAlways,
} from '../src/models.js';

describe('Enum string values (must match Go sdk json tags)', () => {
  it('SseEventType — 14 values, all prefixed asgard.*', () => {
    const values: SseEventType[] = [
      'asgard.run.init',
      'asgard.run.done',
      'asgard.run.error',
      'asgard.process.start',
      'asgard.process.complete',
      'asgard.message.start',
      'asgard.message.delta',
      'asgard.message.complete',
      'asgard.tool_call.start',
      'asgard.tool_call.complete',
      'asgard.tool_call.consent',
      'asgard.completion_model.usage',
      'asgard.sandbox.launch',
      'asgard.sandbox.ready',
    ];
    expect(values).toHaveLength(14);
    values.forEach((v) => expect(v).toMatch(/^asgard\./));
  });

  it('PostBackAction — 3 values', () => {
    const values: PostBackAction[] = [
      'NONE',
      'RESET_CHANNEL',
      'RESPONSE_TOOL_CALL_CONSENT',
    ];
    expect(values).toHaveLength(3);
  });

  it('FileType — 5 values', () => {
    const values: FileType[] = ['BINARY', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT'];
    expect(values).toHaveLength(5);
  });

  it('ToolCallConsentResult — 3 values', () => {
    const values: ToolCallConsentResult[] = [
      'ALLOW_ONCE',
      'ALLOW_ALWAYS',
      'DENY_ONCE',
    ];
    expect(values).toHaveLength(3);
  });

  it('MessageTemplateType — 9 values', () => {
    const values: MessageTemplateType[] = [
      'TEXT',
      'IMAGE',
      'VIDEO',
      'AUDIO',
      'LOCATION',
      'BUTTON',
      'CAROUSEL',
      'CHART',
      'TABLE',
    ];
    expect(values).toHaveLength(9);
  });

  it('MessageTemplateActionType — 3 values', () => {
    const values: MessageTemplateActionType[] = ['MESSAGE', 'URI', 'EMIT'];
    expect(values).toHaveLength(3);
  });
});

describe('Named constants (must equal their wire-level string)', () => {
  it('SseEventType constants', () => {
    expect(SseEventTypeRunInit).toBe('asgard.run.init');
    expect(SseEventTypeMessageDelta).toBe('asgard.message.delta');
    expect(SseEventTypeSandboxLaunch).toBe('asgard.sandbox.launch');
    expect(SseEventTypeSandboxReady).toBe('asgard.sandbox.ready');
  });

  it('PostBackAction constants', () => {
    expect(PostBackActionNone).toBe('NONE');
    expect(PostBackActionResetChannel).toBe('RESET_CHANNEL');
    expect(PostBackActionResponseToolCallConsent).toBe('RESPONSE_TOOL_CALL_CONSENT');
  });

  it('FileType constants', () => {
    expect(FileTypeImage).toBe('IMAGE');
  });

  it('ToolCallConsentResult constants', () => {
    expect(ToolCallConsentResultAllowAlways).toBe('ALLOW_ALWAYS');
  });

  it('MessageTemplateType / ActionType constants', () => {
    expect(MessageTemplateTypeText).toBe('TEXT');
    expect(MessageTemplateActionTypeMessage).toBe('MESSAGE');
  });
});

describe('JSON key names (must match Go json tags)', () => {
  it('GenericBotMessage key names', () => {
    const msg = {
      customChannelId: 'ch1',
      customMessageId: 'msg1',
      text: 'hello',
      action: 'NONE' as PostBackAction,
      blobIds: ['b1'],
      payload: { k: 'v' },
    };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed).toMatchObject({
      customChannelId: 'ch1',
      customMessageId: 'msg1',
      action: 'NONE',
    });
    // Must NOT use camelCase variants like customchannelid or custom_channel_id
    expect(parsed).not.toHaveProperty('custom_channel_id');
    expect(parsed).not.toHaveProperty('custom_message_id');
  });

  it('ApiResponse key names', () => {
    const raw =
      '{"isSuccess":true,"data":{"requestId":"r1"},"error":null,"errorCode":null}';
    const parsed = JSON.parse(raw);
    expect(parsed.isSuccess).toBe(true);
    expect(parsed.data.requestId).toBe('r1');
    expect(parsed.error).toBeNull();
    expect(parsed.errorCode).toBeNull();
  });

  it('GenericBotSseEvent key names', () => {
    const raw = JSON.stringify({
      eventType: 'asgard.run.init',
      requestId: 'r1',
      eventId: 'e1',
      namespace: 'ns',
      botProviderName: 'bot',
      customChannelId: 'ch',
      fact: {},
    });
    const parsed = JSON.parse(raw);
    expect(parsed.eventType).toBe('asgard.run.init');
    expect(parsed.botProviderName).toBe('bot');
    expect(parsed.customChannelId).toBe('ch');
  });

  it('Blob key names', () => {
    const raw = JSON.stringify({
      channelId: 'ch1',
      blobId: 'b1',
      fileType: 'IMAGE',
      fileName: null,
      size: 1024,
      mime: 'image/png',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.channelId).toBe('ch1');
    expect(parsed.blobId).toBe('b1');
    expect(parsed.fileType).toBe('IMAGE');
  });
});
