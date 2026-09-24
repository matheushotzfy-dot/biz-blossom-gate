import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
 return (
 <textarea
 className={cn(
 "flex min-h-[88px] w-full resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-[13px] text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.025)] ring-offset-background placeholder:text-muted-foreground/55 transition-[border-color,box-shadow,background-color] duration-200 hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50",
 className,
 )}
 ref={ref}
 {...props}
 />
 );
});
Textarea.displayName = "Textarea";

export { Textarea };
