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
 "group/select flex h-11 w-full appearance-none items-center justify-between gap-2 rounded-xl border border-border/75 bg-card px-4 py-2.5 text-sm font-bold text-foreground ring-offset-background placeholder:text-muted-foreground/60 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/55 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.04] data-[state=open]:border-primary/65 data-[state=open]:bg-primary/[0.065] data-[state=open]:ring-2 data-[state=open]:ring-primary/15",
 className,
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-300 group-data-[state=open]/select:rotate-180 group-data-[state=open]/select:text-primary" />
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
   "relative z-50 max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[8rem] overflow-hidden rounded-2xl border border-primary/20 bg-popover text-popover-foreground overlay-surface shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.97] data-[state=open]:zoom-in-[0.97] data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
 position === "popper" &&
 "data-[side=bottom]:translate-y-1.5 data-[side=left]:-translate-x-1.5 data-[side=right]:translate-x-1.5 data-[side=top]:-translate-y-1.5",
 className,
 )}
 position={position}
 {...props}
 >
 <SelectPrimitive.Viewport
 className={cn(
 "p-1.5",
 position === "popper" &&
 "w-full min-w-[var(--radix-select-trigger-width)] max-h-[min(var(--radix-select-content-available-height),20rem)] overflow-y-auto",
 )}
 >
 {children}
 </SelectPrimitive.Viewport>
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
   "group/item relative flex w-full cursor-pointer select-none items-center rounded-xl py-2.5 pl-10 pr-3.5 text-sm font-bold outline-none transition-[background-color,color,padding-left,transform] duration-200 ease-out data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
   "before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-[3px] before:origin-center before:scale-y-50 before:rounded-r-full before:bg-primary before:opacity-0 before:transition-all before:duration-200",
   "hover:bg-gradient-to-r hover:from-primary/[0.10] hover:to-primary/[0.02] hover:pl-[2.75rem] focus:bg-primary/[0.08] focus:text-foreground data-[highlighted]:bg-gradient-to-r data-[highlighted]:from-primary/[0.10] data-[highlighted]:to-primary/[0.02] data-[highlighted]:pl-[2.75rem] data-[highlighted]:before:scale-y-100 data-[highlighted]:before:opacity-100",
   "data-[state=checked]:text-primary data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary/[0.14] data-[state=checked]:to-primary/[0.04] data-[state=checked]:font-black data-[state=checked]:before:scale-y-100 data-[state=checked]:before:opacity-100 data-[state=checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.18)]",
 className,
 )}
 {...props}
 >
 <span className="absolute left-2.5 flex h-[18px] w-[18px] items-center justify-center">
 <SelectPrimitive.ItemIndicator>
 <div className="h-[18px] w-[18px] rounded-md bg-primary/20 border border-primary/25 flex items-center justify-center shadow-[inset_0_1px_0_hsl(var(--primary)/0.25)]">
 <Check className="h-3 w-3 text-primary" strokeWidth={3} />
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
