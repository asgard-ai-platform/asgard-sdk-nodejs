// ─── Enums ──────────────────────────────────────────────────────────────────

export type SseEventType =
  | 'asgard.run.init'
  | 'asgard.run.done'
  | 'asgard.run.error'
  | 'asgard.process.start'
  | 'asgard.process.complete'
  | 'asgard.message.start'
  | 'asgard.message.delta'
  | 'asgard.message.complete'
  | 'asgard.tool_call.start'
  | 'asgard.tool_call.complete'
  | 'asgard.tool_call.consent'
  | 'asgard.completion_model.usage';

export type PostBackAction =
  | 'NONE'
  | 'RESET_CHANNEL'
  | 'RESPONSE_TOOL_CALL_CONSENT';

export type FileType = 'BINARY' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export type ToolCallConsentResult = 'ALLOW_ONCE' | 'ALLOW_ALWAYS' | 'DENY_ONCE';

export type MessageTemplateType =
  | 'TEXT'
  | 'IMAGE'
  | 'VIDEO'
  | 'AUDIO'
  | 'LOCATION'
  | 'BUTTON'
  | 'CAROUSEL'
  | 'CHART'
  | 'TABLE';

export type MessageTemplateActionType = 'MESSAGE' | 'URI' | 'EMIT';

export type ImageAspectRatio = 'rectangle' | 'square';
export type ImageSize = 'cover' | 'contain';
export type MessageTemplateRowType = 'OBJECT' | 'ARRAY';
export type MessageTemplateTableColumnFormat = 'DATE' | 'DATE_TIME' | 'CURRENCY';

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface ErrorLocation {
  namespace: string;
  workflowName: string;
  processorName: string;
  processorType: string;
  processorConfigName: string;
  processId: string;
}

export interface ErrorDetail {
  message: string;
  code: string;
  inner: string;
  location: ErrorLocation;
}

// ─── Blob ────────────────────────────────────────────────────────────────────

export interface Blob {
  channelId: string;
  blobId: string;
  fileType: FileType;
  fileName: string | null;
  size: number;
  mime: string;
}

// ─── Message Templates ───────────────────────────────────────────────────────

export interface QuickReply {
  text: string;
}

export interface MessageTemplateAction {
  type: MessageTemplateActionType;
  text: string | null;
  uri: string | null;
  eventName?: string;
  payload: unknown | null;
}

export interface MessageTemplateButton {
  label: string;
  action: MessageTemplateAction;
}

export interface MessageTemplateColumn {
  title: string;
  text: string;
  thumbnailImageUrl?: string;
  imageAspectRatio?: ImageAspectRatio;
  imageSize?: ImageSize;
  imageBackgroundColor?: string;
  buttons: MessageTemplateButton[];
  defaultAction?: MessageTemplateAction;
}

export interface MessageTemplateChartOption {
  type: string;
  title: string;
  spec: Record<string, unknown>;
}

export interface MessageTemplateTableColumn {
  header: string;
  key: string;
  format?: MessageTemplateTableColumnFormat;
}

export interface MessageTemplateTablePagination {
  size: number;
}

export interface MessageTemplateTable {
  rowType: MessageTemplateRowType;
  columns: MessageTemplateTableColumn[];
  pagination?: MessageTemplateTablePagination;
  data: unknown[];
}

export interface MessageTemplateReference {
  title: string;
  uri: string;
}

export interface MessageTemplate {
  type: MessageTemplateType;
  text?: string;
  quickReplies?: QuickReply[];
  originalContentUrl?: string;
  previewImageUrl?: string;
  duration?: number;
  title?: string;
  latitude?: number;
  longitude?: number;
  thumbnailImageUrl?: string;
  imageAspectRatio?: ImageAspectRatio;
  imageSize?: ImageSize;
  imageBackgroundColor?: string;
  buttons?: MessageTemplateButton[];
  defaultAction?: MessageTemplateAction;
  columns?: MessageTemplateColumn[];
  data?: unknown;
  chartOptions?: MessageTemplateChartOption[];
  defaultChart?: string;
  table?: MessageTemplateTable;
  references?: MessageTemplateReference[];
  /** @deprecated */
  description?: string;
}

// ─── Tool Call Consent ───────────────────────────────────────────────────────

export interface PendingToolCall {
  toolCallId: string;
  toolsetName: string;
  toolName: string;
  parameter: unknown;
  alreadyAllowed: boolean;
}

export interface ToolCallConsentResponseItem {
  toolCallId: string;
  result: ToolCallConsentResult;
  denyReason?: string;
}

export interface ToolCallConsentRequest {
  pendingCalls: PendingToolCall[];
}

// ─── Messages ────────────────────────────────────────────────────────────────

export interface BufferedMessage {
  messageId: string;
  replyToCustomMessageId: string;
  text: string;
  payload: unknown;
  isDebug: boolean;
  idx: number | null;
  template: MessageTemplate | null;
}

export interface GenericBotMessage {
  customChannelId: string;
  customMessageId: string;
  text?: string;
  action: PostBackAction;
  blobIds?: string[];
  payload?: Record<string, unknown>;
  toolCallConsents?: ToolCallConsentResponseItem[];
}

export interface GenericBotReply {
  requestId: string;
  namespace: string;
  botProviderName: string;
  customChannelId: string;
  messages: BufferedMessage[];
  errorDetail: ErrorDetail | null;
  toolCallConsentRequest?: ToolCallConsentRequest;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  isSuccess: boolean;
  data: T;
  error: string | null;
  errorCode: string | null;
}

// ─── SSE Events ──────────────────────────────────────────────────────────────

export interface ToolCall {
  toolsetName: string;
  toolName: string;
  parameter: unknown;
}

export interface GenericBotSseEventFactRunInit {}
export interface GenericBotSseEventFactRunDone {}

export interface GenericBotSseEventFactRunError {
  error: ErrorDetail;
}

export interface GenericBotSseEventFactProcessStart {
  processId: string;
  task: unknown | null;
}

export interface GenericBotSseEventFactProcessComplete {
  processId: string;
  taskResult: unknown | null;
}

export interface GenericBotSseEventFactMessage {
  message: BufferedMessage;
}

export interface GenericBotSseEventFactToolCallStart {
  processId: string;
  callSeq: number;
  toolCall: ToolCall;
}

export interface GenericBotSseEventFactToolCallComplete {
  processId: string;
  callSeq: number;
  toolCall: ToolCall;
  toolCallResult: unknown;
}

export interface GenericBotSseEventFactToolCallConsent {
  processId: string;
  pendingCalls: PendingToolCall[];
}

export interface GenericBotSseEventFactCompletionModelUsage {
  processId: string;
  completionModelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GenericBotSseEventFact {
  runInit: GenericBotSseEventFactRunInit | null;
  runDone: GenericBotSseEventFactRunDone | null;
  runError: GenericBotSseEventFactRunError | null;
  processStart: GenericBotSseEventFactProcessStart | null;
  processComplete: GenericBotSseEventFactProcessComplete | null;
  messageStart: GenericBotSseEventFactMessage | null;
  messageDelta: GenericBotSseEventFactMessage | null;
  messageComplete: GenericBotSseEventFactMessage | null;
  toolCallStart: GenericBotSseEventFactToolCallStart | null;
  toolCallComplete: GenericBotSseEventFactToolCallComplete | null;
  toolCallConsent: GenericBotSseEventFactToolCallConsent | null;
  completionModelUsage: GenericBotSseEventFactCompletionModelUsage | null;
}

export interface GenericBotSseEvent {
  eventType: SseEventType;
  requestId: string;
  eventId: string;
  namespace: string;
  botProviderName: string;
  customChannelId: string;
  fact: GenericBotSseEventFact;
}
