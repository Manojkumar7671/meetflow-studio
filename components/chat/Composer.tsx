import { ArrowUp, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
};

export function Composer({ value, onChange, onSend, disabled }: ComposerProps) {
  const isSendDisabled = disabled || value.trim().length === 0;

  return (
    <form
      className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!isSendDisabled) onSend();
      }}
    >
      <label htmlFor="meeting-notes" className="sr-only">Meeting notes</label>
      <Textarea
        id="meeting-notes"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !isSendDisabled) {
            event.preventDefault();
            onSend();
          }
        }}
        disabled={disabled}
        placeholder="Paste meeting notes here…"
        className="min-h-28 border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0 disabled:opacity-60"
        aria-describedby="composer-hint"
      />
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p id="composer-hint" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Use Ctrl or ⌘ + Enter to send</span>
        </p>
        <Button type="submit" disabled={isSendDisabled} className="min-w-24">
          Send
          <ArrowUp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
