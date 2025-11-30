import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin } from "lucide-react";
import { format } from "date-fns";

type Event = {
  id: string;
  title: string;
  date: string;
  description: string | null;
  district: string | null;
  type: string;
  image_url: string | null;
  is_public: boolean;
};

type EventDetailDialogProps = {
  event: Event | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const eventTypeColors = {
  Cultural: "bg-primary/20 text-primary border-primary/30",
  Religious: "bg-secondary/20 text-secondary border-secondary/30",
  National: "bg-accent/20 text-accent border-accent/30"
};

export function EventDetailDialog({ event, open, onOpenChange }: EventDetailDialogProps) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image */}
          {event.image_url && (
            <div className="w-full h-64 rounded-lg overflow-hidden">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Event Type Badge */}
          <div>
            <Badge
              variant="outline"
              className={`${eventTypeColors[event.type as keyof typeof eventTypeColors]} text-sm`}
            >
              {event.type}
            </Badge>
          </div>

          {/* Date */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(new Date(event.date), "EEEE, MMMM d, yyyy")}</span>
          </div>

          {/* Location */}
          {event.district && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{event.district}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed">{event.description}</p>
            </div>
          )}

          {/* Personal Event Indicator */}
          {!event.is_public && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                This is your personal event
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
