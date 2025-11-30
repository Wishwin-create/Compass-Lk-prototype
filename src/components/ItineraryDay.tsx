import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import ItineraryItemDialog from "./ItineraryItemDialog";
import ItineraryItemCard from "./ItineraryItemCard";

interface ItineraryDayProps {
  day: any;
  onUpdate: () => void;
}

const ItineraryDay = ({ day, onUpdate }: ItineraryDayProps) => {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="bg-accent/10">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl">Day {day.day_number}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(new Date(day.date), "EEEE, MMMM dd, yyyy")}
              </p>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {day.itinerary_items && day.itinerary_items.length > 0 ? (
            <div className="space-y-3">
              {day.itinerary_items
                .sort((a: any, b: any) => a.order_index - b.order_index)
                .map((item: any) => (
                  <ItineraryItemCard
                    key={item.id}
                    item={item}
                    onUpdate={onUpdate}
                  />
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No activities planned for this day yet</p>
              <Button
                variant="ghost"
                onClick={() => setShowAddDialog(true)}
                className="mt-2"
              >
                Add your first item
              </Button>
            </div>
          )}
          {day.notes && (
            <div className="mt-4 p-3 bg-accent/20 rounded-md">
              <p className="text-sm text-muted-foreground">{day.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ItineraryItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        dayId={day.id}
        onSuccess={() => {
          setShowAddDialog(false);
          onUpdate();
        }}
      />
    </>
  );
};

export default ItineraryDay;
