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
 "group/select flex h-9 w-full appearance-none items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-[13px] font-medium text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/0.025)] ring-offset-background placeholder:text-muted-foreground/55 transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/12 data-[state=open]:border-primary/60 data-[state=open]:ring-2 data-[state=open]:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
 className,
 )}
 {...props}
 >
 {children}
 <SelectPrimitive.Icon asChild>
  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/65 transition-transform duration-200 group-data-[state=open]/select:rotate-180 group-data-[state=open]/select:text-foreground" />
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
   "relative z-50 max-h-[min(var(--radix-select-content-available-height),20rem)] min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground overlay-surface shadow-[0_14px_40px_hsl(var(--background)/0.45)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98] data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1 duration-200 ease-out",
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
 "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
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
   "group/item relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-9 pr-3 text-[13px] font-medium outline-none transition-colors duration-150 ease-out data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
   "focus:bg-accent focus:text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-foreground data-[state=checked]:bg-primary/10 data-[state=checked]:font-semibold data-[state=checked]:text-primary",
 className,
 )}
 {...props}
 >
 <span className="absolute left-2.5 flex h-[18px] w-[18px] items-center justify-center">
 <SelectPrimitive.ItemIndicator>
 <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
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
