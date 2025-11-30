import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ItineraryItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayId: string;
  item?: any;
  onSuccess: () => void;
}

const ItineraryItemDialog = ({
  open,
  onOpenChange,
  dayId,
  item,
  onSuccess,
}: ItineraryItemDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "destination",
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    location: "",
    cost: "",
    notes: "",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        type: item.type,
        title: item.title,
        description: item.description || "",
        start_time: item.start_time || "",
        end_time: item.end_time || "",
        location: item.location || "",
        cost: item.cost || "",
        notes: item.notes || "",
      });
    } else {
      setFormData({
        type: "destination",
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        location: "",
        cost: "",
        notes: "",
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      toast.error("Please enter a title");
      return;
    }

    setLoading(true);
    try {
      const data = {
        itinerary_day_id: dayId,
        type: formData.type,
        title: formData.title,
        description: formData.description || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        location: formData.location || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: formData.notes || null,
        order_index: 0,
      };

      if (item) {
        const { error } = await supabase
          .from("itinerary_items")
          .update(data)
          .eq("id", item.id);

        if (error) throw error;
        toast.success("Item updated successfully");
      } else {
        const { error } = await supabase.from("itinerary_items").insert(data);

        if (error) throw error;
        toast.success("Item added successfully");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Add New Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="destination">Destination</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="accommodation">Accommodation</SelectItem>
                <SelectItem value="transportation">Transportation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Visit Sigiriya Rock Fortress"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Add details about this item..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Sigiriya, Sri Lanka"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cost">Cost (USD)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes or reminders..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : item ? "Update" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ItineraryItemDialog;
