import * as React from "react";
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
    <>
      <style>{`
        .rdp-chevron {
          fill: white;          
          stroke: white;
          color: white;
        }
        .rdp-outside {
          color: rgb(135, 135, 135) !important;
          pointer-events: none !important;
          cursor: not-allowed !important;
        }
        button.rdp-outside {
          pointer-events: none !important;
          cursor: not-allowed !important;
        }
      `}</style>
      <DayPicker
      showOutsideDays={true}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 relative flex flex-col items-center",
        caption: "relative flex items-center justify-center w-full h-8",
        caption_label: "text-base font-semibold text-white",
        nav: "absolute top-6 inset-x-0 flex items-center justify-between px-8 pointer-events-auto z-10",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-cyan-500/20 hover:bg-cyan-500/40 p-0 border-cyan-500/60 hover:border-cyan-500 !text-cyan-300 hover:!text-cyan-200 pointer-events-auto transition-all duration-200 mx-1"
        ),
        nav_button_previous: "",
        nav_button_next: "",
        table: "grid grid-cols-7 gap-2",
        head_row: "contents",
        head_cell:
          "text-cyan-300 rounded-md font-semibold text-[0.7rem] flex items-center justify-center uppercase tracking-wider h-7",
        row: "contents",
        cell: "h-9 flex items-center justify-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal text-white rounded-md hover:bg-cyan-500/30 transition-colors duration-150 data-[selected]:bg-cyan-500 data-[selected]:text-white"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-cyan-500 text-white hover:bg-cyan-600 hover:text-white focus:bg-cyan-600 focus:text-white font-semibold",
        day_today: "text-cyan-300 font-bold ring-2 ring-cyan-500/50",
        day_outside:
          "!text-gray-500",
        day_disabled: "text-gray-600 opacity-25 cursor-not-allowed",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
    </>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
