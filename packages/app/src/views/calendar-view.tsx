import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@honocube/ui";
import type { Collection, InferRecord } from "../types/collection.js";
import { useCollectionQuery } from "../query/use-query.js";
import type { CalendarViewProps } from "./types.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function CalendarView<TCollection extends Collection<any>>({
  collection,
  startField: propStartField,
  endField: _propEndField,
  titleField: propTitleField,
  initialDate,
  onEventClick,
  onDateClick,
  className = "",
}: CalendarViewProps<TCollection>): React.JSX.Element {
  const queryResult = useCollectionQuery({
    collection,
    params: { limit: 200 },
  });

  const records: InferRecord<TCollection>[] = useMemo(() => {
    const data = queryResult.data?.data;
    return Array.isArray(data) ? (data as InferRecord<TCollection>[]) : [];
  }, [queryResult.data]);

  const [activeDate, setActiveDate] = useState<Date>(() => initialDate || new Date());

  const currentYear = activeDate.getFullYear();
  const currentMonth = activeDate.getMonth();

  const startField = String(
    propStartField || collection.calendar?.start || "startDate"
  );
  const titleField = String(
    propTitleField || collection.calendar?.title || "title"
  );

  const prevMonth = () => {
    setActiveDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    setActiveDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    setActiveDate(new Date());
  };

  // Generate Calendar Days (42 cells: 6 rows x 7 days)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday
    const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: Array<{ date: Date; isCurrentMonth: boolean; isToday: boolean }> = [];
    const today = new Date();
    const isTodayMatch = (d: Date) =>
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, daysInPrevMonth - i);
      cells.push({ date: d, isCurrentMonth: false, isToday: isTodayMatch(d) });
    }

    // Current month days
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const d = new Date(currentYear, currentMonth, day);
      cells.push({ date: d, isCurrentMonth: true, isToday: isTodayMatch(d) });
    }

    // Next month padding days to complete 35 or 42 cells
    const remaining = 35 - cells.length > 0 ? 35 - cells.length : 42 - cells.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(currentYear, currentMonth + 1, day);
      cells.push({ date: d, isCurrentMonth: false, isToday: isTodayMatch(d) });
    }

    return cells;
  }, [currentYear, currentMonth]);

  // Index records by date string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map: Record<string, InferRecord<TCollection>[]> = {};

    records.forEach((rec: any) => {
      const rawVal = rec[startField];
      if (!rawVal) return;

      const dateObj = new Date(rawVal);
      if (isNaN(dateObj.getTime())) return;

      const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
      if (!map[key]) map[key] = [];
      map[key].push(rec);
    });

    return map;
  }, [records, startField]);

  return (
    <div className={`space-y-4 rounded-lg border bg-card p-4 ${className}`}>
      {/* 1. Calendar Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-bold tracking-tight">
            {`${MONTH_NAMES[currentMonth]} ${currentYear}`}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-8 text-xs font-medium"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={prevMonth}
            className="h-8 w-8"
            aria-label="Previous Month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={nextMonth}
            className="h-8 w-8"
            aria-label="Next Month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {queryResult.isLoading && records.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <span className="text-sm">Loading schedule...</span>
        </div>
      ) : (
        /* 2. Monthly Days Grid */
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-px bg-muted rounded-t-md text-center py-2 text-xs font-semibold text-muted-foreground">
              {DAY_NAMES.map((name) => (
                <div key={name}>{name}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-px bg-muted border border-t-0 rounded-b-md overflow-hidden">
              {calendarCells.map((cell, idx) => {
                const dateKey = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
                const dayEvents = eventsByDate[dateKey] || [];

                return (
                  <div
                    key={idx}
                    onClick={() => onDateClick?.(cell.date)}
                    className={`min-h-[100px] p-1.5 flex flex-col justify-between transition-colors ${
                      cell.isCurrentMonth
                        ? "bg-card hover:bg-muted/30"
                        : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {/* Day number header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full ${
                          cell.isToday
                            ? "bg-primary text-primary-foreground font-bold"
                            : ""
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {`${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </div>

                    {/* Events list for this day */}
                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[80px]">
                      {dayEvents.slice(0, 3).map((event: any) => {
                        const title = event[titleField] || event.title || event.name || event.id;
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className="text-[11px] truncate px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer font-medium transition-colors"
                          >
                            {String(title)}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground font-medium pl-1">
                          {`+${dayEvents.length - 3} more`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
