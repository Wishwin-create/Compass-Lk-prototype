import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Calendar, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import Navbar from "@/components/Navbar";
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

interface Itinerary {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
}

const Itineraries = () => {
  const navigate = useNavigate();
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchItineraries();
  }, []);

  const fetchItineraries = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("itineraries")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      setItineraries(data || []);
    } catch (error) {
      console.error("Error fetching itineraries:", error);
      toast.error("Failed to load itineraries");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("itineraries")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setItineraries(itineraries.filter((itinerary) => itinerary.id !== deleteId));
      toast.success("Itinerary deleted successfully");
    } catch (error) {
      console.error("Error deleting itinerary:", error);
      toast.error("Failed to delete itinerary");
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">My Itineraries</h1>
            <p className="text-muted-foreground">Plan and manage your Sri Lankan adventures</p>
          </div>
          <Button onClick={() => navigate("/itinerary/new")} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            New Itinerary
          </Button>
        </div>

        {itineraries.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No itineraries yet</h3>
              <p className="text-muted-foreground mb-6">
                Start planning your perfect Sri Lankan adventure
              </p>
              <Button onClick={() => navigate("/itinerary/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Itinerary
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {itineraries.map((itinerary) => (
              <Card key={itinerary.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{itinerary.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {itinerary.description || "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground mb-4">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(new Date(itinerary.start_date), "MMM dd, yyyy")} -{" "}
                    {format(new Date(itinerary.end_date), "MMM dd, yyyy")}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/itinerary/${itinerary.id}`)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => setDeleteId(itinerary.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Itinerary</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this itinerary? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Itineraries;
