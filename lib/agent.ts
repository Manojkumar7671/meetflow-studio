export const AGENT_STEPS = [
  "Reading your notes",
  "Pulling out action items",
  "Drafting the follow-up email",
] as const;

export type AgentStepLabel = (typeof AGENT_STEPS)[number];
export type StreamStatus = "running" | "done" | "failed";
export type StepStatus = StreamStatus | "waiting";

export type ActionItem = {
  task: string;
  owner: string;
  due: string;
};

export type EmailDraft = {
  subject: string;
  body: string;
};

export type AgentResult = {
  summary: string;
  actionItems: ActionItem[];
  email: EmailDraft;
};

export type AgentEvent = {
  step: AgentStepLabel;
  status: StreamStatus;
  data?: {
    summary?: string;
    actionItems?: ActionItem[];
    result?: AgentResult;
    message?: string;
  };
};

export type AgentStep = {
  label: AgentStepLabel;
  status: StepStatus;
};
