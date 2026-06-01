# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-06-01

### Added

- **`ToolCall.reason`** and **`PendingToolCall.reason`** (optional `string`) — the model's stated reason for invoking a tool. Mirrors `asgard-sdk-go` v1.5.4.

- **`MessageTemplateTable.sql`** and **`MessageTemplateTable.sqlExplanation`** (optional `string`) — the SQL query backing a table template and a human-readable explanation of it. Mirrors `asgard-sdk-go` v1.5.5.

- **`MessageRequestOptions.bypassToolCallConsent`** — When `true`, the SSE endpoint (`newStreamer`) auto-approves every tool call in the request without modifying the persistent `tool_call_allow_list`. Mirrors `asgard-sdk-go` v1.5.1. The REST endpoint (`sendMessage`) will ignore it server-side.

- **`MessageTemplateTypeAttachment`** constant (`'ATTACHMENT'`) and the `'ATTACHMENT'` member of the `MessageTemplateType` union type — new template type for rendering a list of attachment chips. Mirrors `asgard-sdk-go` v1.5.2.

- **`MessageTemplateAttachment`** interface — Attachment chip with `title`, `text`, `defaultAction` (required) and `downloadAction` (optional). Mirrors `asgard-sdk-go` v1.5.2.

- **`attachments?: MessageTemplateAttachment[]`** field on `MessageTemplate`. Mirrors `asgard-sdk-go` v1.5.2.

- **Error predicate helpers** — `isBadRequest`, `isUnauthorized`, `isForbidden`, `isNotFound`, `isConflict`, `isPreconditionFailed`, and `statusCodeOf(err)`. All exported from the package root. Mirrors Go's `client.Is<Status>` and `client.StatusCode` functions from `asgard-sdk-go` v1.5.3.

### Fixed

- **`newStreamer` query params** — `buildUrl` now correctly appends both `is_debug=true` and `bypass_tool_call_consent=true` (previously only supported a single `is_debug` param; multiple params now use `URLSearchParams`).

## [0.1.0] - 2026-05-14

Initial public release. Mirrors `asgard-sdk-go` v1.5.0.

### Added

- `BotProviderClient.generateSandboxEditorOpenUrl(sandboxName)` — request a one-time sandbox editor open URL via `POST /sandbox/{sandboxName}/editor/open-url`.
- `BotProviderClient.sandboxFsList(sandboxName, path)` — `GET /sandbox/{sandboxName}/fs/list`, returns `SandboxFsListResult`.
- `BotProviderClient.sandboxFsRead(sandboxName, path, opts?)` — `GET /sandbox/{sandboxName}/fs/file`, returns `{ data: Buffer; meta: SandboxFsReadMeta }` where `meta` carries `totalBytes` / `truncated` from response headers. `opts.offsetBytes` and `opts.limitBytes` are optional.
- `BotProviderClient.sandboxFsWrite(sandboxName, path, file, opts?)` — `PUT /sandbox/{sandboxName}/fs/file` via `multipart/form-data`. `opts.mode` (octal) and `opts.createOnly` are optional.
- `BotProviderClient.sandboxHeartbeat(sandboxName)` — `POST /sandbox/{sandboxName}/heartbeat`, returns `SandboxHeartbeatResult` with the new `shutdownAt` timestamp.
- `SourceSetClient` and `SourceSetConfig` — full coverage of the SourceSet volume API: `listDirectory`, `stat`, `readFile`, `writeFile`, `makeDirectory`, `remove`, `removeAll`.
- SSE event types `asgard.sandbox.launch` and `asgard.sandbox.ready`, along with `GenericBotSseEventFactSandboxLaunch` / `GenericBotSseEventFactSandboxReady` and the matching `sandboxLaunch` / `sandboxReady` fields on `GenericBotSseEventFact`.
- Model types: `SandboxFsDirEntry`, `SandboxFsListResult`, `SandboxFsReadMeta`, `SandboxFsWriteResult`, `SandboxHeartbeatResult`, `SourceSetDirEntry`, `SourceSetPaging`, `SourceSetListDirectoryResult`, `SourceSetStatResult`, `SourceSetWriteFileResult`.
- Named string constants for every enum-style type — `SseEventType*`, `PostBackAction*`, `FileType*`, `ToolCallConsentResult*`, `MessageTemplateType*`, `MessageTemplateActionType*` — mirroring the constants in Go's `pkg/models`. Use these instead of inline string literals.

### Changed

- Package is now published to the public npm registry as `@asgard-js/nodejs` via npm Trusted Publishing (OIDC). The previous GitHub Packages flow and `.npmrc` registry mapping have been removed.

### Removed

- `BotAgent` / `FunctionAgent` interfaces and the `newBotAgent` / `newBotAgentWithConfig` / `newFunctionAgent` / `newFunctionAgentWithConfig` factories. Use `BotProviderClient` directly — it now covers every endpoint these agents wrapped.

[Unreleased]: https://github.com/asgard-ai-platform/asgard-sdk-nodejs/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/asgard-ai-platform/asgard-sdk-nodejs/compare/v0.1.0...v0.1.3
[0.1.0]: https://github.com/asgard-ai-platform/asgard-sdk-nodejs/releases/tag/v0.1.0
