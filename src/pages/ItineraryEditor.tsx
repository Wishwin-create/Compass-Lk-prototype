import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays, addDays } from "date-fns";
import { CalendarIcon, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ItineraryDay from "@/components/ItineraryDay";

interface ItineraryData {
  title: string;
  description: string;
  start_date: Date | undefined;
  end_date: Date | undefined;
}

const ItineraryEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [itinerary, setItinerary] = useState<ItineraryData>({
    title: "",
    description: "",
    start_date: undefined,
    end_date: undefined,
  });
  const [days, setDays] = useState<any[]>([]);

  useEffect(() => {
    if (id && id !== "new") {
      loadItinerary();
    }
  }, [id]);

  const loadItinerary = async () => {
    try {
      const { data, error } = await supabase
        .from("itineraries")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      setItinerary({
        title: data.title,
        description: data.description || "",
        start_date: new Date(data.start_date),
        end_date: new Date(data.end_date),
      });

      loadDays();
    } catch (error) {
      console.error("Error loading itinerary:", error);
      toast.error("Failed to load itinerary");
    }
  };

  const loadDays = async () => {
    try {
      const { data, error } = await supabase
        .from("itinerary_days")
        .select(`
          *,
          itinerary_items (*)
        `)
        .eq("itinerary_id", id)
        .order("day_number", { ascending: true });

      if (error) throw error;
      setDays(data || []);
    } catch (error) {
      console.error("Error loading days:", error);
    }
  };

  const handleSave = async () => {
    if (!itinerary.title || !itinerary.start_date || !itinerary.end_date) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (itinerary.end_date < itinerary.start_date) {
      toast.error("End date must be after start date");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const itineraryData = {
        user_id: user.id,
        title: itinerary.title,
        description: itinerary.description,
        start_date: format(itinerary.start_date, "yyyy-MM-dd"),
        end_date: format(itinerary.end_date, "yyyy-MM-dd"),
      };

      if (id === "new") {
        const { data, error } = await supabase
          .from("itineraries")
          .insert(itineraryData)
          .select()
          .single();

        if (error) throw error;

        // Create days for the itinerary
        const numDays = differenceInDays(itinerary.end_date, itinerary.start_date) + 1;
        const daysData = Array.from({ length: numDays }, (_, i) => ({
          itinerary_id: data.id,
          date: format(addDays(itinerary.start_date!, i), "yyyy-MM-dd"),
          day_number: i + 1,
        }));

        const { error: daysError } = await supabase
          .from("itinerary_days")
          .insert(daysData);

        if (daysError) throw daysError;

        toast.success("Itinerary created successfully");
        navigate(`/itinerary/${data.id}`);
      } else {
        const { error } = await supabase
          .from("itineraries")
          .update(itineraryData)
          .eq("id", id);

        if (error) throw error;

        toast.success("Itinerary updated successfully");
        loadDays();
      }
    } catch (error) {
      console.error("Error saving itinerary:", error);
      toast.error("Failed to save itinerary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/itineraries")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Itineraries
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {id === "new" ? "Create New Itinerary" : "Edit Itinerary"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Trip Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Amazing Sri Lanka Adventure"
                value={itinerary.title}
                onChange={(e) =>
                  setItinerary({ ...itinerary, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your trip..."
                value={itinerary.description}
                onChange={(e) =>
                  setItinerary({ ...itinerary, description: e.target.value })
                }
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !itinerary.start_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {itinerary.start_date ? (
                        format(itinerary.start_date, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={itinerary.start_date}
                      onSelect={(date) =>
                        setItinerary({ ...itinerary, start_date: date })
                      }
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>End Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !itinerary.end_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {itinerary.end_date ? (
                        format(itinerary.end_date, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={itinerary.end_date}
                      onSelect={(date) =>
                        setItinerary({ ...itinerary, end_date: date })
                      }
                      initialFocus
                      disabled={(date) =>
                        itinerary.start_date ? date < itinerary.start_date : false
                      }
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button onClick={handleSave} disabled={loading} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {loading ? "Saving..." : "Save Itinerary"}
            </Button>
          </CardContent>
        </Card>

        {id !== "new" && days.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Day-by-Day Plan</h2>
            {days.map((day) => (
              <ItineraryDay key={day.id} day={day} onUpdate={loadDays} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItineraryEditor;
