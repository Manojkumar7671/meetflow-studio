import { AGENT_STEPS, type AgentEvent } from "@/lib/agent";

export async function readAgentStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: AgentEvent) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const value: unknown = JSON.parse(line);

    if (typeof value !== "object" || value === null) {
      throw new Error("The agent sent an invalid event.");
    }

    const event = value as AgentEvent;
    if (
      !AGENT_STEPS.includes(event.step) ||
      !["running", "done", "failed"].includes(event.status)
    ) {
      throw new Error("The agent sent an unexpected event.");
    }

    onEvent(event);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }

      if (done) break;
    }

    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }
}
