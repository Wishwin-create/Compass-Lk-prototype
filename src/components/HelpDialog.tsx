import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

type HelpDialogProps = {
  onOpen?: () => void;
};

const HelpDialog: React.FC<HelpDialogProps> = ({ onOpen }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && onOpen) onOpen();
  }, [open, onOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>How to use Compass LK</DialogTitle>
          <DialogDescription>Quick guide to get started with the site.</DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 text-sm">
          <p>
            <strong>Explore:</strong> Visit <em>Destinations</em> to browse places and open a destination to
            see photos, descriptions and reviews.
          </p>
          <p>
            <strong>Plan:</strong> From a destination page you can add items to your itinerary and set dates.
          </p>
          <p>
            <strong>Calendar:</strong> View and adjust itinerary days and scheduled events in the
            <em>Calendar</em> page.
          </p>
          <p>
            <strong>Account:</strong> Sign in to save itineraries, add reviews, and manage your profile.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HelpDialog;
