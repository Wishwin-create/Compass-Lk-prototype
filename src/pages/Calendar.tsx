import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getMonth, getYear } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Filter } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EventDetailsDialog } from "@/components/EventDetailsDialog";
import { AddEventDialog } from "@/components/AddEventDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Event = {
  id: string;
  title: string;
  date: string;
  description: string | null;
  district: string | null;
  type: "Cultural" | "Religious" | "National";
  image_url: string | null;
  is_public: boolean;
  user_id: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const EVENT_TYPE_COLORS = {
  Cultural: "bg-primary/10 text-primary border-primary/20",
  Religious: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  National: "bg-accent/10 text-accent-foreground border-accent/20",
};

export default function Calendar() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [user, setUser] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
    fetchEvents();
  }, [currentYear]);

  useEffect(() => {
    applyFilters();
  }, [events, filterType]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .gte("date", `${currentYear}-01-01`)
      .lte("date", `${currentYear}-12-31`)
      .order("date", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load events",
        variant: "destructive",
      });
      return;
    }

    setEvents((data || []) as Event[]);
  };

  const applyFilters = () => {
    if (filterType === "all") {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(event => event.type === filterType));
    }
  };

  const getEventsForDate = (date: Date) => {
    return filteredEvents.filter(event => 
      isSameDay(new Date(event.date), date)
    );
  };

  const renderMonth = (monthIndex: number) => {
    const monthStart = startOfMonth(new Date(currentYear, monthIndex));
    const monthEnd = endOfMonth(monthStart);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Add empty cells for days before month starts
    const startDayOfWeek = monthStart.getDay();
    const emptyDays = Array(startDayOfWeek).fill(null);

    return (
      <Card key={monthIndex} className="overflow-hidden">
        <div className="bg-gradient-primary p-3">
          <h3 className="text-lg font-semibold text-center text-foreground">
            {MONTHS[monthIndex]}
          </h3>
        </div>
        <CardContent className="p-2">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground p-1">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const dayEvents = getEventsForDate(day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <div
                  key={day.toString()}
                  className={`aspect-square p-1 rounded-lg border transition-all hover:border-primary/50 ${
                    hasEvents ? "bg-muted/50" : ""
                  } ${
                    isSameDay(day, new Date()) ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="text-xs font-medium text-center mb-1">
                    {format(day, "d")}
                  </div>
                  {hasEvents && (
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(event => (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`w-full text-[0.5rem] px-1 py-0.5 rounded border ${
                            EVENT_TYPE_COLORS[event.type]
                          } truncate hover:opacity-80 transition-opacity`}
                        >
                          {event.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[0.5rem] text-center text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="pt-24 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Cultural Calendar</h1>
            <p className="text-muted-foreground">
              Discover Sri Lanka's vibrant festivals and cultural events
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Year Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentYear(currentYear - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[80px] text-center">
                {currentYear}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentYear(currentYear + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="Cultural">Cultural</SelectItem>
                <SelectItem value="Religious">Religious</SelectItem>
                <SelectItem value="National">National</SelectItem>
              </SelectContent>
            </Select>

            {/* Add Event Button */}
            {user && (
              <Button onClick={() => setIsAddEventOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Badge className={EVENT_TYPE_COLORS.Cultural}>Cultural</Badge>
            <Badge className={EVENT_TYPE_COLORS.Religious}>Religious</Badge>
            <Badge className={EVENT_TYPE_COLORS.National}>National</Badge>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MONTHS.map((_, index) => renderMonth(index))}
        </div>
      </div>

      {/* Event Details Dialog */}
      <EventDetailsDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* Add Event Dialog */}
      <AddEventDialog
        open={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        onSuccess={() => {
          fetchEvents();
          setIsAddEventOpen(false);
        }}
      />
    </div>
  );
}
