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
  | 'asgard.completion_model.usage'
  | 'asgard.sandbox.launch'
  | 'asgard.sandbox.ready';

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
  | 'TABLE'
  | 'ATTACHMENT';

export type MessageTemplateActionType = 'MESSAGE' | 'URI' | 'EMIT';

export type ImageAspectRatio = 'rectangle' | 'square';
export type ImageSize = 'cover' | 'contain';
export type MessageTemplateRowType = 'OBJECT' | 'ARRAY';
export type MessageTemplateTableColumnFormat = 'DATE' | 'DATE_TIME' | 'CURRENCY';

// ─── Named constants (mirror Go's pkg/models constants) ─────────────────────
// Prefer these over inline string literals — they autocomplete and are
// refactor-safe. Wire-level JSON values are the string on the right-hand side.

export const SseEventTypeRunInit: SseEventType = 'asgard.run.init';
export const SseEventTypeRunDone: SseEventType = 'asgard.run.done';
export const SseEventTypeRunError: SseEventType = 'asgard.run.error';
export const SseEventTypeProcessStart: SseEventType = 'asgard.process.start';
export const SseEventTypeProcessComplete: SseEventType = 'asgard.process.complete';
export const SseEventTypeMessageStart: SseEventType = 'asgard.message.start';
export const SseEventTypeMessageDelta: SseEventType = 'asgard.message.delta';
export const SseEventTypeMessageComplete: SseEventType = 'asgard.message.complete';
export const SseEventTypeToolCallStart: SseEventType = 'asgard.tool_call.start';
export const SseEventTypeToolCallComplete: SseEventType = 'asgard.tool_call.complete';
export const SseEventTypeToolCallConsent: SseEventType = 'asgard.tool_call.consent';
export const SseEventTypeCompletionModelUsage: SseEventType = 'asgard.completion_model.usage';
export const SseEventTypeSandboxLaunch: SseEventType = 'asgard.sandbox.launch';
export const SseEventTypeSandboxReady: SseEventType = 'asgard.sandbox.ready';

export const PostBackActionNone: PostBackAction = 'NONE';
export const PostBackActionResetChannel: PostBackAction = 'RESET_CHANNEL';
export const PostBackActionResponseToolCallConsent: PostBackAction = 'RESPONSE_TOOL_CALL_CONSENT';

export const FileTypeBinary: FileType = 'BINARY';
export const FileTypeImage: FileType = 'IMAGE';
export const FileTypeVideo: FileType = 'VIDEO';
export const FileTypeAudio: FileType = 'AUDIO';
export const FileTypeDocument: FileType = 'DOCUMENT';

export const ToolCallConsentResultAllowOnce: ToolCallConsentResult = 'ALLOW_ONCE';
export const ToolCallConsentResultAllowAlways: ToolCallConsentResult = 'ALLOW_ALWAYS';
export const ToolCallConsentResultDenyOnce: ToolCallConsentResult = 'DENY_ONCE';

export const MessageTemplateTypeText: MessageTemplateType = 'TEXT';
export const MessageTemplateTypeImage: MessageTemplateType = 'IMAGE';
export const MessageTemplateTypeVideo: MessageTemplateType = 'VIDEO';
export const MessageTemplateTypeAudio: MessageTemplateType = 'AUDIO';
export const MessageTemplateTypeLocation: MessageTemplateType = 'LOCATION';
export const MessageTemplateTypeButton: MessageTemplateType = 'BUTTON';
export const MessageTemplateTypeCarousel: MessageTemplateType = 'CAROUSEL';
export const MessageTemplateTypeChart: MessageTemplateType = 'CHART';
export const MessageTemplateTypeTable: MessageTemplateType = 'TABLE';
export const MessageTemplateTypeAttachment: MessageTemplateType = 'ATTACHMENT';

export const MessageTemplateActionTypeMessage: MessageTemplateActionType = 'MESSAGE';
export const MessageTemplateActionTypeUri: MessageTemplateActionType = 'URI';
export const MessageTemplateActionTypeEmit: MessageTemplateActionType = 'EMIT';

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

/**
 * A single attachment chip in an ATTACHMENT template.
 * defaultAction fires when the chip body is tapped; downloadAction, when set,
 * renders an additional download button on the right.
 */
export interface MessageTemplateAttachment {
  title: string;
  text: string;
  defaultAction: MessageTemplateAction;
  downloadAction?: MessageTemplateAction;
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
  attachments?: MessageTemplateAttachment[];
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

export interface GenericBotSseEventFactSandboxLaunch {
  sandboxName: string;
  blueprintName: string;
}

export interface GenericBotSseEventFactSandboxReady {
  sandboxName: string;
  blueprintName: string;
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
  sandboxLaunch: GenericBotSseEventFactSandboxLaunch | null;
  sandboxReady: GenericBotSseEventFactSandboxReady | null;
}

// ─── Sandbox FS ──────────────────────────────────────────────────────────────

export interface SandboxFsDirEntry {
  name: string;
  isDir: boolean;
  sizeBytes: number;
  mtimeUnix: number;
  mode: number;
}

export interface SandboxFsListResult {
  entries: SandboxFsDirEntry[];
  truncated: boolean;
}

/** Metadata returned alongside file bytes by sandboxFsRead — populated from X-Total-Bytes / X-Truncated response headers. */
export interface SandboxFsReadMeta {
  totalBytes: number;
  truncated: boolean;
}

export interface SandboxFsWriteResult {
  bytesWritten: number;
}

export interface SandboxHeartbeatResult {
  /** RFC3339 timestamp of the new sandbox shutdown deadline. */
  shutdownAt: string;
}

// ─── SourceSet ───────────────────────────────────────────────────────────────

export interface SourceSetDirEntry {
  name: string;
  isDir: boolean;
  sizeBytes: number;
  mtimeUnix: number;
}

export interface SourceSetPaging {
  index: number;
  size: number;
  total: number;
}

export interface SourceSetListDirectoryResult {
  entries: SourceSetDirEntry[];
  paging: SourceSetPaging | null;
}

export interface SourceSetStatResult {
  exists: boolean;
  isDir: boolean;
  sizeBytes: number;
  mtimeUnix: number;
  etag: string;
}

export interface SourceSetWriteFileResult {
  bytesWritten: number;
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
