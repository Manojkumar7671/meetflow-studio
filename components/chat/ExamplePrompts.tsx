import { ArrowUpRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type ExamplePromptsProps = {
  prompts: string[];
  onPick: (prompt: string) => void;
};

export function ExamplePrompts({ prompts, onPick }: ExamplePromptsProps) {
  return (
    <section className="space-y-4" aria-labelledby="examples-heading">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 id="examples-heading">Try a sample</h2>
      </div>
      <div className="space-y-2">
        {prompts.map((prompt, index) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            onClick={() => onPick(prompt)}
            className="group h-auto min-h-16 w-full justify-between gap-4 whitespace-normal rounded-xl px-4 py-3 text-left font-normal"
          >
            <span className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 text-xs font-semibold text-muted-foreground">0{index + 1}</span>
              <span className="line-clamp-2 text-sm leading-relaxed text-foreground">{prompt}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Choose an example to fill the composer. It will not send until you press Send.</p>
    </section>
  );
}
