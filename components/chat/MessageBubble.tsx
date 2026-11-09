import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MessageBubbleProps = {
  variant: "user" | "agent";
  children: ReactNode;
};

export function MessageBubble({ variant, children }: MessageBubbleProps) {
  const isUser = variant === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[82%]",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground shadow-sm"
            : "rounded-bl-md border border-border bg-card text-card-foreground shadow-sm",
        )}
      >
        {children}
      </div>
    </div>
  );
}
