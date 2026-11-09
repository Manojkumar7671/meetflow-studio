import { AlertCircle, Check, Circle, LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AgentStep } from "@/lib/agent";

export type AgentStepsProps = {
  steps: AgentStep[];
};

const statusDetails = {
  waiting: { label: "Waiting", variant: "secondary" as const, Icon: Circle },
  running: { label: "Running", variant: "default" as const, Icon: LoaderCircle },
  done: { label: "Done", variant: "outline" as const, Icon: Check },
  failed: { label: "Failed", variant: "destructive" as const, Icon: AlertCircle },
};

export function AgentSteps({ steps }: AgentStepsProps) {
  return (
    <ol className="space-y-2" aria-label="Agent progress" aria-live="polite">
      {steps.map((step, index) => {
        const detail = statusDetails[step.status];
        const Icon = detail.Icon;

        return (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground",
                step.status === "running" && "border-primary/30 text-primary",
                step.status === "done" && "border-primary/20 text-primary",
                step.status === "failed" && "border-destructive/30 text-destructive",
              )}
              aria-hidden="true"
            >
              <Icon className={cn("h-3.5 w-3.5", step.status === "running" && "animate-spin")} />
            </span>
            <span className={cn("min-w-0 flex-1", step.status === "waiting" ? "text-muted-foreground" : "text-foreground")}>
              <span className="mr-2 text-xs font-medium text-muted-foreground">0{index + 1}</span>
              {step.label}
            </span>
            <Badge variant={detail.variant}>{detail.label}</Badge>
          </li>
        );
      })}
    </ol>
  );
}
