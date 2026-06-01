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
  ToolCall,
  PendingToolCall,
  MessageTemplateTable,
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

  it('MessageTemplateType — 10 values', () => {
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
      'ATTACHMENT',
    ];
    expect(values).toHaveLength(10);
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

describe('v1.5.4 — ToolCall.reason / PendingToolCall.reason', () => {
  it('ToolCall includes reason field', () => {
    const tc: ToolCall = {
      toolsetName: 'builtin',
      toolName: 'search',
      parameter: { q: 'test' },
      reason: 'User asked for weather data',
    };
    const json = JSON.parse(JSON.stringify(tc));
    expect(json.reason).toBe('User asked for weather data');
  });

  it('ToolCall reason is optional', () => {
    const tc: ToolCall = {
      toolsetName: 'x',
      toolName: 'y',
      parameter: null,
    };
    const json = JSON.parse(JSON.stringify(tc));
    expect(json.reason).toBeUndefined();
  });

  it('PendingToolCall includes reason field', () => {
    const ptc: PendingToolCall = {
      toolCallId: 'tc-1',
      toolsetName: '',
      toolName: 'exec',
      parameter: {},
      reason: 'Need to run calculation',
      alreadyAllowed: false,
    };
    const json = JSON.parse(JSON.stringify(ptc));
    expect(json.reason).toBe('Need to run calculation');
    expect(json.alreadyAllowed).toBe(false);
  });

  it('PendingToolCall reason is optional', () => {
    const ptc: PendingToolCall = {
      toolCallId: 'tc-2',
      toolsetName: '',
      toolName: 'z',
      parameter: null,
      alreadyAllowed: true,
    };
    const json = JSON.parse(JSON.stringify(ptc));
    expect(json.reason).toBeUndefined();
  });
});

describe('v1.5.5 — MessageTemplateTable.sql / sqlExplanation', () => {
  it('MessageTemplateTable includes sql and sqlExplanation', () => {
    const table: MessageTemplateTable = {
      rowType: 'OBJECT',
      columns: [{ header: 'Name', key: 'name' }],
      data: [{ name: 'Alice' }],
      sql: "SELECT * FROM users WHERE active = true",
      sqlExplanation: '查詢所有活躍用戶',
    };
    const json = JSON.parse(JSON.stringify(table));
    expect(json.sql).toBe("SELECT * FROM users WHERE active = true");
    expect(json.sqlExplanation).toBe('查詢所有活躍用戶');
  });

  it('MessageTemplateTable sql fields are optional', () => {
    const table: MessageTemplateTable = {
      rowType: 'OBJECT',
      columns: [],
      data: [],
    };
    const json = JSON.parse(JSON.stringify(table));
    expect(json.sql).toBeUndefined();
    expect(json.sqlExplanation).toBeUndefined();
  });
});

// ─── MessageTemplateAttachment (v1.5.2) ─────────────────────────────────────

import { MessageTemplateAttachment, MessageTemplateTypeAttachment } from '../src/models.js';
import { AsgardError, isBadRequest, isUnauthorized, isForbidden, isNotFound, isConflict, isPreconditionFailed, statusCodeOf } from '../src/error.js';

describe('MessageTemplateAttachment', () => {
  it('MessageTemplateTypeAttachment constant equals ATTACHMENT', () => {
    expect(MessageTemplateTypeAttachment).toBe('ATTACHMENT');
  });

  it('attachment wire format has expected keys', () => {
    const attachment: MessageTemplateAttachment = {
      title: 'Report Q1',
      text: '2026 report',
      defaultAction: { type: 'URI', text: null, uri: 'https://example.com', payload: null },
    };
    const raw = JSON.stringify(attachment);
    const parsed = JSON.parse(raw);
    expect(parsed.title).toBe('Report Q1');
    expect(parsed.text).toBe('2026 report');
    expect(parsed.defaultAction.uri).toBe('https://example.com');
    expect(parsed.downloadAction).toBeUndefined();
  });

  it('downloadAction is included when set', () => {
    const attachment: MessageTemplateAttachment = {
      title: 'File',
      text: 'desc',
      defaultAction: { type: 'URI', text: null, uri: 'https://view', payload: null },
      downloadAction: { type: 'URI', text: null, uri: 'https://download', payload: null },
    };
    const raw = JSON.stringify(attachment);
    const parsed = JSON.parse(raw);
    expect(parsed.downloadAction.uri).toBe('https://download');
  });
});

// ─── AsgardError predicate helpers (v1.5.3) ─────────────────────────────────

describe('AsgardError predicate helpers', () => {
  it('isBadRequest returns true for 400', () => {
    expect(isBadRequest(new AsgardError('bad', 400))).toBe(true);
  });
  it('isBadRequest returns false for 401', () => {
    expect(isBadRequest(new AsgardError('unauth', 401))).toBe(false);
  });
  it('isUnauthorized returns true for 401', () => {
    expect(isUnauthorized(new AsgardError('x', 401))).toBe(true);
  });
  it('isForbidden returns true for 403', () => {
    expect(isForbidden(new AsgardError('x', 403))).toBe(true);
  });
  it('isNotFound returns true for 404', () => {
    expect(isNotFound(new AsgardError('x', 404))).toBe(true);
  });
  it('isConflict returns true for 409', () => {
    expect(isConflict(new AsgardError('x', 409))).toBe(true);
  });
  it('isPreconditionFailed returns true for 412', () => {
    expect(isPreconditionFailed(new AsgardError('x', 412, 'FAILED_PRECONDITION'))).toBe(true);
  });
  it('isPreconditionFailed returns false for 400', () => {
    expect(isPreconditionFailed(new AsgardError('x', 400))).toBe(false);
  });
  it('statusCodeOf returns the statusCode', () => {
    expect(statusCodeOf(new AsgardError('x', 412))).toBe(412);
  });
  it('statusCodeOf returns 0 for non-AsgardError', () => {
    expect(statusCodeOf(new Error('plain'))).toBe(0);
    expect(statusCodeOf(null)).toBe(0);
  });
  it('all helpers return false for non-AsgardError', () => {
    const err = new Error('plain');
    expect(isBadRequest(err)).toBe(false);
    expect(isUnauthorized(err)).toBe(false);
    expect(isForbidden(err)).toBe(false);
    expect(isNotFound(err)).toBe(false);
    expect(isConflict(err)).toBe(false);
    expect(isPreconditionFailed(err)).toBe(false);
  });
});
