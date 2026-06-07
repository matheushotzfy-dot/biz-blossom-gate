import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Trigger>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
 <SelectPrimitive.Trigger
 ref={ref}
 className={cn(
 "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium ring-offset-background placeholder:text-muted-foreground/60 transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:border-primary/25 hover:shadow-[0_2px_8px_hsl(var(--primary)/0.06)] data-[state=open]:border-primary/35 data-[state=open]:ring-2 data-[state=open]:ring-primary/15",
 className,
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
 <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-300 data-[state=open]:rotate-180" />
 </SelectPrimitive.Icon>
 </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.ScrollUpButton
 ref={ref}
 className={cn("flex cursor-default items-center justify-center py-1.5 text-muted-foreground/50", className)}
 {...props}
 >
 <ChevronUp className="h-3.5 w-3.5" />
 </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.ScrollDownButton
 ref={ref}
 className={cn("flex cursor-default items-center justify-center py-1.5 text-muted-foreground/50", className)}
 {...props}
 >
 <ChevronDown className="h-3.5 w-3.5" />
 </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Content>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
 <SelectPrimitive.Portal>
 <SelectPrimitive.Content
 ref={ref}
 className={cn(
 "relative z-50 max-h-[min(var(--radix-select-content-available-height),22rem)] min-w-[8rem] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
 position === "popper" &&
 "data-[side=bottom]:translate-y-1.5 data-[side=left]:-translate-x-1.5 data-[side=right]:translate-x-1.5 data-[side=top]:-translate-y-1.5",
 className,
 )}
 position={position}
 {...props}
 >
  <SelectScrollUpButton />
 <SelectScrollUpButton />
 <SelectPrimitive.Viewport
 className={cn(
 "p-1.5",
 position === "popper" &&
 "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
 )}
 >
 {children}
 </SelectPrimitive.Viewport>
  <SelectScrollDownButton />
 </SelectPrimitive.Content>
 </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Label>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.Label ref={ref} className={cn("px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Item>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
 <SelectPrimitive.Item
 ref={ref}
 className={cn(
 "relative flex w-full cursor-pointer select-none items-center rounded-xl py-2.5 pl-9 pr-3.5 text-sm font-medium outline-none transition-all duration-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
 "hover:bg-primary/8 focus:bg-primary/10 focus:text-foreground",
 "data-[highlighted]:bg-primary/8 data-[highlighted]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.12)]",
 "data-[state=checked]:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:font-bold data-[state=checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]",
 className,
 )}
 {...props}
 >
 <span className="absolute left-2.5 flex h-[18px] w-[18px] items-center justify-center">
 <SelectPrimitive.ItemIndicator>
 <div className="h-[18px] w-[18px] rounded-md bg-primary/15 flex items-center justify-center">
 <Check className="h-3 w-3 text-primary" />
 </div>
 </SelectPrimitive.ItemIndicator>
 </span>

 <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
 </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
 React.ElementRef<typeof SelectPrimitive.Separator>,
 React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
 <SelectPrimitive.Separator ref={ref} className={cn("mx-2 my-1 h-px bg-border/30", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
 Select,
 SelectGroup,
 SelectValue,
 SelectTrigger,
 SelectContent,
 SelectLabel,
 SelectItem,
 SelectSeparator,
 SelectScrollUpButton,
 SelectScrollDownButton,
};
