import { z } from "zod";
import { AGENT_STEPS, type ActionItem, type AgentEvent, type AgentResult, type EmailDraft } from "@/lib/agent";

const ADAPTION_ENDPOINT = "https://api.prod.adaptionlabs.ai/api/v1/responses";
const ADAPTION_MODEL = "qwen3.5-397b";

const RequestSchema = z.object({
  notes: z.string().trim().min(1, "Paste some meeting notes first.").max(16000, "Keep notes under 16,000 characters."),
});

const ActionItemSchema = z.object({
  task: z.string().trim().min(1),
  owner: z.string().nullable().optional(),
  due: z.string().nullable().optional(),
});

const EmailDraftSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
});

type AdaptionResponse = {
  status?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { code?: string; message?: string };
  incomplete_details?: { reason?: string };
};

class AgentFlowError extends Error {}

class AdaptionApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super("Adaption API request failed");
  }
}

function parseJsonBlock(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstObject = cleaned.indexOf("{");
    const firstArray = cleaned.indexOf("[");
    const starts = [firstObject, firstArray].filter((index) => index >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start < 0 || end < start) {
      throw new AgentFlowError("The model returned an unexpected format. Please retry.");
    }
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new AgentFlowError("The model returned an unexpected format. Please retry.");
    }
  }
}

function readText(content: string | null | undefined) {
  const text = content?.trim();
  if (!text) throw new AgentFlowError("The model returned an empty response. Please retry.");
  return text;
}

function normalizeActionItems(text: string): ActionItem[] {
  const parsed = parseJsonBlock(text);
  const candidate = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && "actionItems" in parsed
      ? (parsed as { actionItems: unknown }).actionItems
      : parsed;
  const items = z.array(ActionItemSchema).safeParse(candidate);
  if (!items.success) {
    throw new AgentFlowError("The model returned action items in an unexpected format. Please retry.");
  }
  return items.data.map((item) => ({
    task: item.task,
    owner: item.owner?.trim() || "not stated",
    due: item.due?.trim() || "not stated",
  }));
}

function normalizeEmail(text: string): EmailDraft {
  const parsed = EmailDraftSchema.safeParse(parseJsonBlock(text));
  if (!parsed.success) {
    throw new AgentFlowError("The model returned an email in an unexpected format. Please retry.");
  }
  return parsed.data;
}

async function adaptionResponse(
  apiKey: string,
  input: string,
  instructions: string,
  maxOutputTokens: number,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(ADAPTION_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ADAPTION_MODEL,
      input,
      instructions,
      max_output_tokens: maxOutputTokens,
      store: false,
    }),
    signal,
  });

  const data = (await response.json().catch(() => null)) as AdaptionResponse | null;
  if (!response.ok) throw new AdaptionApiError(response.status, data?.error?.code);
  if (!data) throw new AgentFlowError("Adaption returned an invalid response. Please retry.");

  const outputText = data.output_text?.trim() || data.output
    ?.flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  if (data.status && data.status !== "completed") {
    const reason = data.incomplete_details?.reason;
    console.error("Adaption response incomplete", data.status, reason ?? "no reason", data.error?.code ?? "no code");
    if (data.status !== "incomplete" || !outputText) {
      throw new AgentFlowError("Adaption did not complete this step. Check model availability or inference credits, then retry.");
    }
  }

  return readText(outputText);
}

function publicError(error: unknown) {
  if (error instanceof AgentFlowError) return error.message;
  if (error instanceof AdaptionApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Adaption rejected the API key or model access. Check the key and account access, then retry.";
    }
    if (error.status === 429) return "Adaption reached a request or credit limit. Check the account limit before retrying.";
    if (error.status === 503) return "Adaption is busy. Please retry in a few seconds.";
    return `Adaption returned HTTP ${error.status}. Please retry.`;
  }
  return "The agent could not complete this step. Please retry.";
}

function eventLine(event: AgentEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send valid JSON with a notes field." }, { status: 400 });
  }

  const input = RequestSchema.safeParse(body);
  if (!input.success) {
    return Response.json(
      { error: input.error.issues[0]?.message ?? "Meeting notes are required." },
      { status: 400 },
    );
  }

  const notes = input.data.notes;
  const apiKey = process.env.ADAPTION_API_KEY;
  const upstreamController = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(eventLine(event)));
      let activeStep: (typeof AGENT_STEPS)[number] = AGENT_STEPS[0];

      try {
        if (!apiKey) throw new AgentFlowError("Adaption API key is not configured for this environment.");

        activeStep = AGENT_STEPS[0];
        send({ step: activeStep, status: "running" });
        const summary = await adaptionResponse(
          apiKey,
          notes,
          "Read meeting notes conservatively. Return one concise factual summary. Do not invent people, decisions, or dates.",
          2048,
          upstreamController.signal,
        );
        send({ step: activeStep, status: "done", data: { summary } });

        activeStep = AGENT_STEPS[1];
        send({ step: activeStep, status: "running" });
        const extraction = await adaptionResponse(
          apiKey,
          notes,
          "Extract explicit action items only. Return JSON only in this shape: {\"actionItems\":[{\"task\":\"...\",\"owner\":\"...\",\"due\":\"...\"}]}. For an owner or due date not stated in the notes, use the exact text \"not stated\". Do not infer or invent. Use an empty actionItems array if none are explicit.",
          3072,
          upstreamController.signal,
        );
        const actionItems = normalizeActionItems(extraction);
        send({ step: activeStep, status: "done", data: { actionItems } });

        activeStep = AGENT_STEPS[2];
        send({ step: activeStep, status: "running" });
        const emailText = await adaptionResponse(
          apiKey,
          JSON.stringify({ notes, summary, actionItems }),
          "Draft a concise, professional follow-up email from the meeting notes and extracted actions. Do not invent owners, dates, decisions, or commitments. Return valid JSON only with string fields subject and body.",
          3072,
          upstreamController.signal,
        );
        const email = normalizeEmail(emailText);
        const result: AgentResult = { summary, actionItems, email };
        send({ step: activeStep, status: "done", data: { result } });
      } catch (error) {
        if (error instanceof AdaptionApiError) {
          console.error("Adaption request failed", error.status, error.code ?? "no error code");
        } else if (!(error instanceof AgentFlowError)) {
          console.error("Agent flow failed", error instanceof Error ? error.name : "unknown error");
        }
        if (!upstreamController.signal.aborted) {
          send({ step: activeStep, status: "failed", data: { message: publicError(error) } });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      upstreamController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
