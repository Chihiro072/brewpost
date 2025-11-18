import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "relative flex items-center justify-center py-1",
        caption_label: "text-sm font-medium text-white",
        nav: "absolute inset-0 flex items-center justify-between px-2 pointer-events-auto",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 !text-white !border-white pointer-events-auto"
        ),
        nav_button_previous: "absolute left-1 z-50",
        nav_button_next: "absolute right-1 z-50",
        table: "w-full grid grid-cols-7 gap-1",
        head_row: "contents",
        head_cell:
          "text-white rounded-md font-semibold text-[0.75rem] flex items-center justify-center uppercase tracking-wider",
        row: "contents",
        cell: "h-9 flex items-center justify-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-white aria-selected:opacity-100 hover:bg-accent/50"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-white text-black hover:bg-white hover:text-black focus:bg-white focus:text-black",
        day_today: "text-cyan-400 font-bold",
        day_outside:
          "day-outside text-gray-500 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-gray-600 opacity-30 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
