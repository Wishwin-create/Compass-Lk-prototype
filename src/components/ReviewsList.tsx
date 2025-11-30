import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "@/components/StarRating";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { format } from "date-fns";

interface Review {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReviewsListProps {
  destinationId?: string;
  itineraryItemId?: string;
  onEditReview?: (review: Review) => void;
}

export const ReviewsList = ({ destinationId, itineraryItemId, onEditReview }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
    getCurrentUser();
  }, [destinationId, itineraryItemId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchReviews = async () => {
    let query = supabase
      .from("reviews")
      .select(`
        *,
        profiles (
          full_name,
          avatar_url
        )
      `)
      .order("created_at", { ascending: false });

    if (destinationId) {
      query = query.eq("destination_id", destinationId);
    }
    if (itineraryItemId) {
      query = query.eq("itinerary_item_id", itineraryItemId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reviews:", error);
      return;
    }

    setReviews(data || []);
  };

  const handleDelete = async () => {
    if (!deleteReviewId) return;

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", deleteReviewId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete review",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Review deleted",
      description: "Your review has been deleted successfully",
    });

    setDeleteReviewId(null);
    fetchReviews();
  };

  if (reviews.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No reviews yet. Be the first to review!
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar>
                  <AvatarImage src={review.profiles?.avatar_url || undefined} />
                  <AvatarFallback>
                    {review.profiles?.full_name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {review.profiles?.full_name || "Anonymous"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                    
                    {currentUserId === review.user_id && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditReview?.(review)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteReviewId(review.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <StarRating rating={review.rating} readonly size="sm" />
                  
                  {review.review_text && (
                    <p className="text-foreground mt-2">{review.review_text}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteReviewId} onOpenChange={() => setDeleteReviewId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review? This action cannot be undone.
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
