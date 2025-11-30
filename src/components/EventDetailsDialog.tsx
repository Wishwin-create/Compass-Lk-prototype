import { format } from "date-fns";
import { Calendar, MapPin, Tag, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

const EVENT_TYPE_COLORS = {
  Cultural: "bg-primary/10 text-primary border-primary/20",
  Religious: "bg-secondary/10 text-secondary-foreground border-secondary/20",
  National: "bg-accent/10 text-accent-foreground border-accent/20",
};

type Props = {
  event: Event | null;
  open: boolean;
  onClose: () => void;
};

export function EventDetailsDialog({ event, open, onClose }: Props) {
  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {event.image_url && (
            <div className="w-full h-48 rounded-lg overflow-hidden bg-muted">
              <img
                src={event.image_url}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {format(new Date(event.date), "MMMM d, yyyy")}
              </span>
            </div>

            {event.district && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.district}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <Badge className={EVENT_TYPE_COLORS[event.type]}>
                {event.type}
              </Badge>
            </div>
          </div>

          <Separator />

          {event.description && (
            <div>
              <h3 className="font-semibold mb-2">About this event</h3>
              <p className="text-muted-foreground leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {!event.is_public && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This is a personal event visible only to you.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
