import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import readline from "node:readline";

import type {
  CanonicalItemType,
  ProviderRuntimeEvent,
  ProviderRuntimeTurnStatus,
  ProviderSendTurnInput,
  ProviderSession,
  ProviderSessionStartInput,
  ThreadTokenUsageSnapshot,
} from "@t3tools/contracts";
import { EventId, RuntimeItemId, ThreadId, TurnId } from "@t3tools/contracts";
import { DEFAULT_MODEL_BY_PROVIDER } from "@t3tools/contracts";
import { Effect, Layer, PubSub, Stream } from "effect";

import { ServerSettingsService } from "../../serverSettings.ts";
import { type EventNdjsonLogger, makeEventNdjsonLogger } from "./EventNdjsonLogger.ts";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
} from "../Errors.ts";
import { DroidAdapter, type DroidAdapterShape } from "../Services/DroidAdapter.ts";

const PROVIDER = "droid" as const;

interface DroidResumeCursor {
  readonly sessionId: string;
}

interface DroidTurnSnapshot {
  readonly id: TurnId;
  readonly items: Array<unknown>;
}

interface ActiveDroidTurn {
  readonly turnId: TurnId;
  readonly process: ChildProcessWithoutNullStreams;
  readonly items: Array<unknown>;
  readonly assistantItemIdsByMessageId: Map<string, RuntimeItemId>;
  readonly toolItemsByToolUseId: Map<
    string,
    {
      runtimeItemId: RuntimeItemId;
      itemType: CanonicalItemType;
    }
  >;
  completionSeen: boolean;
  interrupted: boolean;
}

interface DroidSessionContext {
  session: ProviderSession;
  droidSessionId: string | undefined;
  readonly turns: Array<DroidTurnSnapshot>;
  activeTurn: ActiveDroidTurn | undefined;
}

export interface DroidAdapterLiveOptions {
  readonly nativeEventLogPath?: string;
  readonly nativeEventLogger?: EventNdjsonLogger;
}

function toMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.length > 0) {
    return cause.message;
  }
  return fallback;
}

function makeEventId(prefix: string): EventId {
  return EventId.makeUnsafe(`${prefix}-${randomUUID()}`);
}

function makeRuntimeItemId(prefix: string): RuntimeItemId {
  return RuntimeItemId.makeUnsafe(`${prefix}-${randomUUID()}`);
}

function readDroidResumeCursor(value: unknown): DroidResumeCursor | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const sessionId = (value as { sessionId?: unknown }).sessionId;
  return typeof sessionId === "string" && sessionId.trim().length > 0 ? { sessionId } : undefined;
}

function toTurnState(value: ProviderRuntimeTurnStatus): ProviderRuntimeTurnStatus {
  return value;
}

function setSessionState(
  context: DroidSessionContext,
  input: {
    readonly status: ProviderSession["status"];
    readonly activeTurnId?: TurnId;
    readonly model?: string;
  },
): void {
  const updatedAt = new Date().toISOString();
  context.session = {
    ...context.session,
    status: input.status,
    updatedAt,
    ...(input.activeTurnId !== undefined
      ? { activeTurnId: input.activeTurnId }
      : { activeTurnId: undefined }),
    ...(input.model !== undefined ? { model: input.model } : {}),
    ...(context.droidSessionId ? { resumeCursor: { sessionId: context.droidSessionId } } : {}),
  };
}

function normalizeToolItemType(
  toolName: string,
  parameters: Record<string, unknown>,
): CanonicalItemType {
  const normalizedTool = toolName.toLowerCase();
  if (normalizedTool === "execute") {
    return "command_execution";
  }
  if (normalizedTool === "edit" || normalizedTool === "applypatch" || normalizedTool === "create") {
    return "file_change";
  }
  if (normalizedTool === "websearch" || normalizedTool === "fetchurl") {
    return "web_search";
  }
  if (normalizedTool === "read" && typeof parameters.path === "string") {
    return parameters.path.match(/\.(png|jpe?g|gif|webp|svg)$/i)
      ? "image_view"
      : "dynamic_tool_call";
  }
  return "dynamic_tool_call";
}

function normalizeDroidTokenUsage(usage: unknown): ThreadTokenUsageSnapshot | undefined {
  if (!usage || typeof usage !== "object") {
    return undefined;
  }
  const record = usage as Record<string, unknown>;
  const inputTokens =
    typeof record.input_tokens === "number" && Number.isFinite(record.input_tokens)
      ? record.input_tokens
      : 0;
  const outputTokens =
    typeof record.output_tokens === "number" && Number.isFinite(record.output_tokens)
      ? record.output_tokens
      : 0;
  const cachedInputTokens =
    typeof record.cache_read_input_tokens === "number" &&
    Number.isFinite(record.cache_read_input_tokens)
      ? record.cache_read_input_tokens
      : 0;
  const usedTokens = inputTokens + outputTokens;

  if (usedTokens <= 0) {
    return undefined;
  }

  const thinkingTokens =
    typeof record.thinking_tokens === "number" && Number.isFinite(record.thinking_tokens)
      ? record.thinking_tokens
      : undefined;
  const durationMs =
    typeof record.duration_ms === "number" && Number.isFinite(record.duration_ms)
      ? record.duration_ms
      : undefined;

  return {
    usedTokens,
    inputTokens,
    outputTokens,
    ...(cachedInputTokens > 0 ? { cachedInputTokens } : {}),
    ...(thinkingTokens !== undefined ? { reasoningOutputTokens: thinkingTokens } : {}),
    lastUsedTokens: usedTokens,
    lastInputTokens: inputTokens,
    lastOutputTokens: outputTokens,
    ...(cachedInputTokens > 0 ? { lastCachedInputTokens: cachedInputTokens } : {}),
    ...(thinkingTokens !== undefined ? { lastReasoningOutputTokens: thinkingTokens } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

function buildDroidArgs(input: {
  readonly prompt: string;
  readonly cwd: string | undefined;
  readonly sessionId: string | undefined;
  readonly model: string;
  readonly effort: string | undefined;
  readonly runtimeMode: ProviderSession["runtimeMode"];
  readonly interactionMode: ProviderSendTurnInput["interactionMode"];
}): Array<string> {
  const args = ["exec", "--output-format", "stream-json"];
  if (input.sessionId) {
    args.push("-s", input.sessionId);
  }
  args.push("--model", input.model);
  if (input.effort) {
    args.push("--reasoning-effort", input.effort);
  }
  if (input.cwd) {
    args.push("--cwd", input.cwd);
  }
  if (input.runtimeMode === "full-access") {
    args.push("--auto", "high");
  }
  if (input.interactionMode === "plan") {
    args.push("--use-spec");
  }
  args.push(input.prompt);
  return args;
}

export const makeDroidAdapterLive = (options?: DroidAdapterLiveOptions) =>
  Layer.effect(
    DroidAdapter,
    Effect.gen(function* () {
      const settingsService = yield* ServerSettingsService;
      const changesPubSub = yield* Effect.acquireRelease(
        PubSub.unbounded<ProviderRuntimeEvent>(),
        PubSub.shutdown,
      );
      const nativeEventLogger =
        options?.nativeEventLogger ??
        (options?.nativeEventLogPath !== undefined
          ? yield* makeEventNdjsonLogger(options.nativeEventLogPath, {
              stream: "native",
            })
          : undefined);
      const sessions = new Map<ThreadId, DroidSessionContext>();
      const services = yield* Effect.services();
      const runFork = Effect.runForkWith(services);

      const emitEvent = (event: ProviderRuntimeEvent) =>
        Effect.succeed(event).pipe(
          Effect.tap((runtimeEvent) =>
            nativeEventLogger
              ? nativeEventLogger.write(runtimeEvent, runtimeEvent.threadId)
              : Effect.void,
          ),
          Effect.flatMap((runtimeEvent) => PubSub.publish(changesPubSub, runtimeEvent)),
          Effect.asVoid,
        );

      const emitFromCallback = (event: ProviderRuntimeEvent) => {
        runFork(
          emitEvent(event).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("failed to publish droid runtime event", { cause }),
            ),
          ),
        );
      };

      const failSessionNotFound = (threadId: ThreadId) =>
        Effect.fail(
          new ProviderAdapterSessionNotFoundError({
            provider: PROVIDER,
            threadId,
          }),
        );

      const completeTurn = (
        context: DroidSessionContext,
        input: {
          readonly turnId: TurnId;
          readonly state: ProviderRuntimeTurnStatus;
          readonly usage?: ThreadTokenUsageSnapshot;
          readonly errorMessage?: string;
        },
      ) => {
        const activeTurn = context.activeTurn;
        if (!activeTurn || activeTurn.turnId !== input.turnId || activeTurn.completionSeen) {
          return;
        }
        activeTurn.completionSeen = true;
        context.turns.push({
          id: input.turnId,
          items: [...activeTurn.items],
        });
        setSessionState(context, {
          status: "ready",
        });

        if (input.usage) {
          emitFromCallback({
            type: "thread.token-usage.updated",
            eventId: makeEventId("droid-token-usage"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt: new Date().toISOString(),
            turnId: input.turnId,
            payload: {
              usage: input.usage,
            },
          });
        }

        emitFromCallback({
          type: "turn.completed",
          eventId: makeEventId("droid-turn-completed"),
          provider: PROVIDER,
          threadId: context.session.threadId,
          createdAt: new Date().toISOString(),
          turnId: input.turnId,
          payload: {
            state: toTurnState(input.state),
            ...(input.usage ? { usage: input.usage } : {}),
            ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
          },
        });
        emitFromCallback({
          type: "session.state.changed",
          eventId: makeEventId("droid-session-ready"),
          provider: PROVIDER,
          threadId: context.session.threadId,
          createdAt: new Date().toISOString(),
          payload: {
            state: "ready",
          },
        });
        context.activeTurn = undefined;
      };

      const handleDroidEvent = (
        context: DroidSessionContext,
        turnId: TurnId,
        event: Record<string, unknown>,
      ) => {
        context.activeTurn?.items.push(event);
        const createdAt = new Date().toISOString();
        const eventType = typeof event.type === "string" ? event.type : null;
        if (eventType === "system" && event.subtype === "init") {
          const droidSessionId =
            typeof event.session_id === "string" && event.session_id.trim().length > 0
              ? event.session_id
              : undefined;
          if (droidSessionId) {
            context.droidSessionId = droidSessionId;
            context.session = {
              ...context.session,
              resumeCursor: { sessionId: droidSessionId },
            };
          }
          return;
        }

        if (
          eventType === "message" &&
          event.role === "assistant" &&
          typeof event.text === "string"
        ) {
          const rawMessageId =
            typeof event.id === "string" && event.id.length > 0 ? event.id : randomUUID();
          const runtimeItemId =
            context.activeTurn?.assistantItemIdsByMessageId.get(rawMessageId) ??
            makeRuntimeItemId("droid-assistant");
          context.activeTurn?.assistantItemIdsByMessageId.set(rawMessageId, runtimeItemId);
          emitFromCallback({
            type: "item.started",
            eventId: makeEventId("droid-assistant-item-started"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            itemId: runtimeItemId,
            payload: {
              itemType: "assistant_message",
              status: "inProgress",
              title: "Assistant message",
            },
          });
          emitFromCallback({
            type: "content.delta",
            eventId: makeEventId("droid-content-delta"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            itemId: runtimeItemId,
            payload: {
              streamKind: "assistant_text",
              delta: event.text,
            },
          });
          emitFromCallback({
            type: "item.completed",
            eventId: makeEventId("droid-assistant-item-completed"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            itemId: runtimeItemId,
            payload: {
              itemType: "assistant_message",
              status: "completed",
              title: "Assistant message",
              data: { text: event.text },
            },
          });
          return;
        }

        if (eventType === "tool_call") {
          const toolName = typeof event.toolName === "string" ? event.toolName : "Tool";
          const parameters =
            event.parameters &&
            typeof event.parameters === "object" &&
            !Array.isArray(event.parameters)
              ? (event.parameters as Record<string, unknown>)
              : {};
          const itemType = normalizeToolItemType(toolName, parameters);
          const runtimeItemId = makeRuntimeItemId("droid-tool");
          const rawToolUseId =
            typeof event.id === "string" && event.id.length > 0 ? event.id : randomUUID();
          context.activeTurn?.toolItemsByToolUseId.set(rawToolUseId, { runtimeItemId, itemType });
          emitFromCallback({
            type: "item.started",
            eventId: makeEventId("droid-tool-started"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            itemId: runtimeItemId,
            payload: {
              itemType,
              status: "inProgress",
              title: toolName,
              ...(typeof parameters.command === "string" ? { detail: parameters.command } : {}),
              data: {
                toolName,
                parameters,
              },
            },
          });
          return;
        }

        if (eventType === "tool_result") {
          const rawToolUseId =
            typeof event.id === "string" && event.id.length > 0 ? event.id : null;
          const toolItem = rawToolUseId
            ? context.activeTurn?.toolItemsByToolUseId.get(rawToolUseId)
            : undefined;
          if (!toolItem) {
            return;
          }
          emitFromCallback({
            type: "item.completed",
            eventId: makeEventId("droid-tool-completed"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            itemId: toolItem.runtimeItemId,
            payload: {
              itemType: toolItem.itemType,
              status: event.isError === true ? "failed" : "completed",
              title: typeof event.toolId === "string" ? event.toolId : "Tool",
              ...(typeof event.value === "string" && event.value.trim().length > 0
                ? { detail: event.value.trim().slice(0, 500) }
                : {}),
              data: {
                isError: event.isError === true,
                value: event.value,
              },
            },
          });
          return;
        }

        if (eventType === "error" && typeof event.message === "string") {
          emitFromCallback({
            type: "runtime.error",
            eventId: makeEventId("droid-runtime-error"),
            provider: PROVIDER,
            threadId: context.session.threadId,
            createdAt,
            turnId,
            payload: {
              message: event.message,
              class: "provider_error",
              detail: event,
            },
          });
          return;
        }

        if (eventType === "completion") {
          const usage = normalizeDroidTokenUsage(event.usage);
          completeTurn(context, {
            turnId,
            state: "completed",
            ...(usage ? { usage } : {}),
          });
        }
      };

      const startSession: DroidAdapterShape["startSession"] = Effect.fn("startSession")(function* (
        input: ProviderSessionStartInput,
      ) {
        const now = new Date().toISOString();
        const existing = sessions.get(input.threadId);
        if (existing?.activeTurn) {
          existing.activeTurn.process.kill();
        }
        const resume = readDroidResumeCursor(input.resumeCursor);
        const model =
          input.modelSelection?.provider === PROVIDER
            ? input.modelSelection.model
            : (existing?.session.model ?? DEFAULT_MODEL_BY_PROVIDER[PROVIDER]);
        const session: ProviderSession = {
          provider: PROVIDER,
          status: "ready",
          runtimeMode: input.runtimeMode,
          threadId: input.threadId,
          ...(input.cwd ? { cwd: input.cwd } : {}),
          ...(model ? { model } : {}),
          ...(resume ? { resumeCursor: resume } : {}),
          createdAt: now,
          updatedAt: now,
        };
        sessions.set(input.threadId, {
          session,
          droidSessionId: resume?.sessionId,
          turns: existing?.turns ?? [],
          activeTurn: undefined,
        });
        yield* emitEvent({
          type: "session.started",
          eventId: makeEventId("droid-session-started"),
          provider: PROVIDER,
          threadId: input.threadId,
          createdAt: now,
          payload: resume ? { resume } : {},
        });
        yield* emitEvent({
          type: "thread.started",
          eventId: makeEventId("droid-thread-started"),
          provider: PROVIDER,
          threadId: input.threadId,
          createdAt: now,
          payload: {},
        });
        yield* emitEvent({
          type: "session.state.changed",
          eventId: makeEventId("droid-session-ready"),
          provider: PROVIDER,
          threadId: input.threadId,
          createdAt: now,
          payload: {
            state: "ready",
          },
        });
        return session;
      });

      const sendTurn: DroidAdapterShape["sendTurn"] = Effect.fn("sendTurn")(function* (input) {
        if ((input.attachments?.length ?? 0) > 0) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "sendTurn",
            issue: "Droid attachment support is not implemented in T3 Code yet.",
          });
        }

        const context = sessions.get(input.threadId);
        if (!context) {
          return yield* failSessionNotFound(input.threadId);
        }
        if (context.activeTurn) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "turn/start",
            detail: "Droid already has an active turn for this thread.",
          });
        }

        const settings = yield* settingsService.getSettings.pipe(
          Effect.map((value) => value.providers.droid),
          Effect.mapError(
            (cause) =>
              new ProviderAdapterRequestError({
                provider: PROVIDER,
                method: "turn/start",
                detail: toMessage(cause, "Failed to load Droid settings."),
                cause,
              }),
          ),
        );

        const model =
          input.modelSelection?.provider === PROVIDER
            ? input.modelSelection.model
            : (context.session.model ?? DEFAULT_MODEL_BY_PROVIDER[PROVIDER]);
        const effort =
          input.modelSelection?.provider === PROVIDER
            ? input.modelSelection.options?.effort
            : undefined;
        const turnId = TurnId.makeUnsafe(`droid-turn-${randomUUID()}`);
        const prompt = input.input?.trim() ?? "";
        const args = buildDroidArgs({
          prompt,
          cwd: context.session.cwd,
          sessionId: context.droidSessionId,
          model,
          effort,
          runtimeMode: context.session.runtimeMode,
          interactionMode: input.interactionMode,
        });

        const child = yield* Effect.tryPromise({
          try: () =>
            new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
              const processRef = spawn(settings.binaryPath, args, {
                cwd: context.session.cwd,
                env: process.env,
                stdio: ["pipe", "pipe", "pipe"],
              });
              processRef.once("spawn", () => resolve(processRef));
              processRef.once("error", reject);
            }),
          catch: (cause) =>
            new ProviderAdapterProcessError({
              provider: PROVIDER,
              threadId: input.threadId,
              detail: toMessage(cause, "Failed to start Droid process."),
              cause,
            }),
        });

        const activeTurn: ActiveDroidTurn = {
          turnId,
          process: child,
          items: [],
          assistantItemIdsByMessageId: new Map(),
          toolItemsByToolUseId: new Map(),
          completionSeen: false,
          interrupted: false,
        };
        context.activeTurn = activeTurn;
        setSessionState(context, {
          status: "running",
          activeTurnId: turnId,
          model,
        });

        yield* emitEvent({
          type: "session.state.changed",
          eventId: makeEventId("droid-session-running"),
          provider: PROVIDER,
          threadId: input.threadId,
          createdAt: new Date().toISOString(),
          turnId,
          payload: {
            state: "running",
          },
        });
        yield* emitEvent({
          type: "turn.started",
          eventId: makeEventId("droid-turn-started"),
          provider: PROVIDER,
          threadId: input.threadId,
          createdAt: new Date().toISOString(),
          turnId,
          payload: {
            model,
            ...(effort ? { effort } : {}),
          },
        });

        const stdoutReader = readline.createInterface({ input: child.stdout });
        stdoutReader.on("line", (line) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            handleDroidEvent(context, turnId, parsed);
          } catch {
            emitFromCallback({
              type: "runtime.warning",
              eventId: makeEventId("droid-runtime-warning"),
              provider: PROVIDER,
              threadId: input.threadId,
              createdAt: new Date().toISOString(),
              turnId,
              payload: {
                message: "Received a non-JSON Droid runtime line.",
                detail: trimmed,
              },
            });
          }
        });

        let stderrBuffer = "";
        const stderrReader = readline.createInterface({ input: child.stderr });
        stderrReader.on("line", (line) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return;
          }
          stderrBuffer = stderrBuffer ? `${stderrBuffer}\n${trimmed}` : trimmed;
        });

        child.once("close", (code, signal) => {
          if (activeTurn.completionSeen) {
            return;
          }
          const interrupted = activeTurn.interrupted || signal !== null;
          const errorMessage =
            stderrBuffer.trim().length > 0
              ? stderrBuffer.trim()
              : interrupted
                ? "Droid turn interrupted."
                : `Droid exited with code ${code ?? -1}.`;
          if (!interrupted) {
            emitFromCallback({
              type: "runtime.error",
              eventId: makeEventId("droid-close-error"),
              provider: PROVIDER,
              threadId: input.threadId,
              createdAt: new Date().toISOString(),
              turnId,
              payload: {
                message: errorMessage,
                class: "provider_error",
              },
            });
          }
          completeTurn(context, {
            turnId,
            state: interrupted ? "interrupted" : "failed",
            errorMessage,
          });
        });

        return {
          threadId: input.threadId,
          turnId,
          ...(context.droidSessionId
            ? { resumeCursor: { sessionId: context.droidSessionId } }
            : {}),
        };
      });

      const interruptTurn: DroidAdapterShape["interruptTurn"] = (threadId, turnId) =>
        Effect.gen(function* () {
          const context = sessions.get(threadId);
          if (!context) {
            return yield* failSessionNotFound(threadId);
          }
          if (!context.activeTurn) {
            return;
          }
          if (turnId && context.activeTurn.turnId !== turnId) {
            return;
          }
          context.activeTurn.interrupted = true;
          context.activeTurn.process.kill();
        });

      const unsupported = (threadId: ThreadId, method: string, detail: string) =>
        Effect.fail(
          new ProviderAdapterRequestError({
            provider: PROVIDER,
            method,
            detail,
          }),
        );

      const respondToRequest: DroidAdapterShape["respondToRequest"] = (
        threadId,
        _requestId,
        _decision,
      ) =>
        unsupported(
          threadId,
          "request/respond",
          "Droid does not expose interactive approvals in this integration.",
        );

      const respondToUserInput: DroidAdapterShape["respondToUserInput"] = (
        threadId,
        _requestId,
        _answers,
      ) =>
        unsupported(
          threadId,
          "user-input/respond",
          "Droid does not expose structured user-input prompts in this integration.",
        );

      const stopSession: DroidAdapterShape["stopSession"] = (threadId) =>
        Effect.gen(function* () {
          const context = sessions.get(threadId);
          if (!context) {
            return yield* failSessionNotFound(threadId);
          }
          if (context.activeTurn) {
            context.activeTurn.interrupted = true;
            context.activeTurn.process.kill();
          }
          sessions.delete(threadId);
        });

      const listSessions: DroidAdapterShape["listSessions"] = () =>
        Effect.succeed(Array.from(sessions.values(), (entry) => entry.session));

      const hasSession: DroidAdapterShape["hasSession"] = (threadId) =>
        Effect.succeed(sessions.has(threadId));

      const readThread: DroidAdapterShape["readThread"] = (threadId) => {
        const context = sessions.get(threadId);
        if (!context) {
          return failSessionNotFound(threadId);
        }
        return Effect.succeed({
          threadId,
          turns: context.turns,
        });
      };

      const rollbackThread: DroidAdapterShape["rollbackThread"] = (threadId, _numTurns) => {
        const context = sessions.get(threadId);
        if (!context) {
          return failSessionNotFound(threadId);
        }
        return unsupported(
          threadId,
          "thread/rollback",
          "Droid session rollback is not implemented in T3 Code yet.",
        );
      };

      const stopAll: DroidAdapterShape["stopAll"] = () =>
        Effect.sync(() => {
          for (const context of sessions.values()) {
            if (context.activeTurn) {
              context.activeTurn.interrupted = true;
              context.activeTurn.process.kill();
            }
          }
          sessions.clear();
        });

      return {
        provider: PROVIDER,
        capabilities: {
          sessionModelSwitch: "in-session",
        },
        startSession,
        sendTurn,
        interruptTurn,
        respondToRequest,
        respondToUserInput,
        stopSession,
        listSessions,
        hasSession,
        readThread,
        rollbackThread,
        stopAll,
        get streamEvents() {
          return Stream.fromPubSub(changesPubSub);
        },
      } satisfies DroidAdapterShape;
    }),
  );
