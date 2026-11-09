"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, Check, ClipboardList, Mail, NotebookPen, RotateCcw, Sparkles } from "lucide-react";
import { AgentSteps } from "@/components/chat/AgentSteps";
import { Composer } from "@/components/chat/Composer";
import { ExamplePrompts } from "@/components/chat/ExamplePrompts";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_STEPS, type ActionItem, type AgentEvent, type AgentResult, type AgentStep, type AgentStepLabel } from "@/lib/agent";
import { readAgentStream } from "@/lib/stream";

type Turn = {
  id: string;
  notes: string;
  steps: AgentStep[];
  summary?: string;
  actionItems?: ActionItem[];
  result?: AgentResult;
  error?: string;
};

const EXAMPLE_PROMPTS = [
  "On Friday, Priya will send the launch checklist. Jordan will confirm the QA window by Wednesday. We agreed to shorten onboarding emails; no owner or deadline was assigned.",
  "Customer feedback: add a CSV export before next month's review. Sam owns the prototype. The support handoff is urgent, but we did not name an owner or date. Maya will schedule a follow-up on Monday.",
  "Discussed redesigning the billing page. Lee will share updated wireframes Thursday. Finance needs final pricing this month, but no one volunteered. Revisit after the pilot.",
];

function initialSteps(): AgentStep[] {
  return AGENT_STEPS.map((label) => ({ label, status: "waiting" }));
}

function readErrorBody(text: string, status: number) {
  try {
    const value = JSON.parse(text) as { error?: unknown };
    if (typeof value.error === "string") return value.error;
  } catch {
    // Use the safe fallback below for non-JSON error responses.
  }
  return `The request could not be started (HTTP ${status}). Please retry.`;
}

export default function Home() {
  const [notes, setNotes] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, isWorking]);

  const updateTurn = (id: string, update: (turn: Turn) => Turn) => {
    setTurns((current) => current.map((turn) => (turn.id === id ? update(turn) : turn)));
  };

  const runAgent = async (turnId: string, sourceNotes: string) => {
    if (isWorking) return;
    setIsWorking(true);
    let activeStep: AgentStepLabel = AGENT_STEPS[0];
    let finished = false;
    let failureMessage: string | undefined;

    updateTurn(turnId, (turn) => ({
      ...turn,
      steps: initialSteps(),
      summary: undefined,
      actionItems: undefined,
      result: undefined,
      error: undefined,
    }));

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: sourceNotes }),
      });

      if (!response.ok) {
        throw new Error(readErrorBody(await response.text(), response.status));
      }
      if (!response.body) throw new Error("The agent stream was unavailable. Please retry.");

      await readAgentStream(response.body, (event: AgentEvent) => {
        activeStep = event.step;
        updateTurn(turnId, (turn) => {
          const steps = turn.steps.map((step) =>
            step.label === event.step ? { ...step, status: event.status } : step,
          );
          const summary = event.data?.summary ?? turn.summary;
          const actionItems = event.data?.actionItems ?? turn.actionItems;
          const result = event.data?.result ?? turn.result;
          if (event.status === "failed") failureMessage = event.data?.message ?? "The agent could not complete this step. Please retry.";
          if (event.status === "done" && event.step === AGENT_STEPS[2] && result) finished = true;
          return {
            ...turn,
            steps,
            summary,
            actionItems,
            result,
            error: event.status === "failed" ? failureMessage : turn.error,
          };
        });
      });

      if (failureMessage) throw new Error(failureMessage);
      if (!finished) throw new Error("The agent stream ended before all steps completed. Please retry.");
      setNotes("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The agent could not complete this request. Please retry.";
      updateTurn(turnId, (turn) => ({
        ...turn,
        steps: turn.steps.map((step) => step.label === activeStep ? { ...step, status: "failed" } : step),
        error: message,
      }));
    } finally {
      setIsWorking(false);
    }
  };

  const sendNotes = () => {
    const submittedNotes = notes.trim();
    if (!submittedNotes || isWorking) return;
    const id = crypto.randomUUID();
    const turn: Turn = { id, notes: submittedNotes, steps: initialSteps() };
    setTurns((current) => [...current, turn]);
    void runAgent(id, submittedNotes);
  };

  const retryTurn = (turn: Turn) => {
    if (isWorking) return;
    setNotes(turn.notes);
    void runAgent(turn.id, turn.notes);
  };

  return (
    <main className="relative flex min-h-svh flex-col bg-background text-foreground">
      <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-border py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-end justify-center gap-1 rounded-xl bg-primary px-3 py-2 text-primary-foreground" aria-hidden="true">
              <span className="h-2.5 w-1 rounded-full bg-current" />
              <span className="h-4 w-1 rounded-full bg-current" />
              <span className="h-3 w-1 rounded-full bg-current" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-serif text-lg font-semibold tracking-tight">MeetFlow Studio</h1>
                <Badge variant="outline" className="hidden sm:inline-flex">Build League</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">Paste meeting notes, get action items and a follow-up email.</p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            Powered by BharatCode
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-4 py-5 sm:py-6" aria-label="Meeting notes assistant">
          <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border bg-muted/20">
            <div className="min-h-full p-4 sm:p-6">
              {turns.length === 0 ? (
                <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 py-6">
                  <div className="space-y-4">
                    <Badge variant="secondary" className="gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      From discussion to follow-up
                    </Badge>
                    <div className="space-y-2">
                      <h2 className="max-w-xl font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                        Leave the meeting with the next steps already clear.
                      </h2>
                      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                        Paste rough notes. MeetFlow finds explicit owners and dates, flags what was not stated, and drafts the follow-up email.
                      </p>
                    </div>
                  </div>
                  <ExamplePrompts prompts={EXAMPLE_PROMPTS} onPick={setNotes} />
                </div>
              ) : (
                <div className="mx-auto max-w-3xl space-y-7 py-2">
                  {turns.map((turn) => (
                    <article key={turn.id} className="space-y-4" aria-label="Conversation turn">
                      <MessageBubble variant="user">
                        <p className="whitespace-pre-wrap">{turn.notes}</p>
                      </MessageBubble>

                      <div className="px-1 sm:px-3">
                        <AgentSteps steps={turn.steps} />
                      </div>

                      <MessageBubble variant="agent">
                        {turn.error ? (
                          <div className="space-y-3">
                            <p className="flex items-start gap-2 text-destructive">
                              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{turn.error}</span>
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={() => retryTurn(turn)} disabled={isWorking}>
                              <RotateCcw className="h-4 w-4" aria-hidden="true" />
                              Retry
                            </Button>
                          </div>
                        ) : turn.result ? (
                          <div className="w-full space-y-5">
                            <p className="text-muted-foreground">{turn.result.summary}</p>
                            <section className="space-y-3" aria-labelledby={`actions-${turn.id}`}>
                              <h3 id={`actions-${turn.id}`} className="flex items-center gap-2 font-semibold">
                                <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                                Action items
                              </h3>
                              {turn.result.actionItems.length ? (
                                <ul className="space-y-2">
                                  {turn.result.actionItems.map((item, index) => (
                                    <li key={`${item.task}-${index}`} className="rounded-xl border border-border bg-background p-3">
                                      <p className="font-medium">{item.task}</p>
                                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                        <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" aria-hidden="true" />Owner: {item.owner}</span>
                                        <span className="inline-flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />Due: {item.due}</span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">No explicit action items were found in these notes.</p>
                              )}
                            </section>

                            <Card className="overflow-hidden border-border bg-background">
                              <CardHeader className="pb-3">
                                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
                                  Follow-up email
                                </div>
                                <CardTitle className="pt-1 text-base">{turn.result.email.subject}</CardTitle>
                              </CardHeader>
                              <CardContent>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{turn.result.email.body}</p>
                              </CardContent>
                            </Card>
                          </div>
                        ) : (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <NotebookPen className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
                            Working through your notes…
                          </p>
                        )}
                      </MessageBubble>
                    </article>
                  ))}
                  <div ref={endOfMessages} aria-hidden="true" />
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="mx-auto w-full max-w-3xl space-y-2">
            <Composer value={notes} onChange={setNotes} onSend={sendNotes} disabled={isWorking} />
            <p className="text-center text-xs text-muted-foreground">Conversation history stays in this tab and is not saved across reloads.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
