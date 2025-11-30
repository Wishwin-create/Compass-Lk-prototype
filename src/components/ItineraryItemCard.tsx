import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, MapPin, Clock, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ItineraryItemDialog from "./ItineraryItemDialog";

interface ItineraryItemCardProps {
  item: any;
  onUpdate: () => void;
}

const typeColors: Record<string, string> = {
  destination: "bg-tropical-teal text-white",
  activity: "bg-tropical-amber text-white",
  accommodation: "bg-tropical-green text-white",
  transportation: "bg-accent text-foreground",
};

const typeIcons: Record<string, string> = {
  destination: "🏛️",
  activity: "🎯",
  accommodation: "🏨",
  transportation: "🚗",
};

const ItineraryItemCard = ({ item, onUpdate }: ItineraryItemCardProps) => {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("itinerary_items")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Item deleted successfully");
      onUpdate();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item");
    }
  };

  return (
    <>
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{typeIcons[item.type]}</span>
              <Badge className={typeColors[item.type]}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Badge>
            </div>
            <h4 className="font-semibold text-lg mb-1">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {item.start_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.start_time}
                  {item.end_time && ` - ${item.end_time}`}
                </div>
              )}
              {item.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.location}
                </div>
              )}
              {item.cost && (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  ${item.cost}
                </div>
              )}
            </div>
            {item.notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                {item.notes}
              </p>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEditDialog(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <ItineraryItemDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        dayId={item.itinerary_day_id}
        item={item}
        onSuccess={() => {
          setShowEditDialog(false);
          onUpdate();
        }}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{item.title}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ItineraryItemCard;
