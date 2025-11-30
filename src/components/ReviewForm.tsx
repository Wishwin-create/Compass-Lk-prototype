import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StarRating } from "@/components/StarRating";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  review_text: z.string().max(1000, "Review must be less than 1000 characters").optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewFormProps {
  destinationId?: string;
  itineraryItemId?: string;
  onSuccess?: () => void;
  existingReview?: {
    id: string;
    rating: number;
    review_text: string | null;
  };
}

export const ReviewForm = ({ destinationId, itineraryItemId, onSuccess, existingReview }: ReviewFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: existingReview?.rating || 0,
      review_text: existingReview?.review_text || "",
    },
  });

  const onSubmit = async (data: ReviewFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to submit a review",
          variant: "destructive",
        });
        return;
      }

      const reviewData = {
        user_id: user.id,
        rating: data.rating,
        review_text: data.review_text || null,
        destination_id: destinationId || null,
        itinerary_item_id: itineraryItemId || null,
      };

      if (existingReview) {
        const { error } = await supabase
          .from("reviews")
          .update(reviewData)
          .eq("id", existingReview.id);

        if (error) throw error;

        toast({
          title: "Review updated",
          description: "Your review has been updated successfully",
        });
      } else {
        const { error } = await supabase.from("reviews").insert(reviewData);

        if (error) throw error;

        toast({
          title: "Review submitted",
          description: "Thank you for your review!",
        });
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating</FormLabel>
              <FormControl>
                <StarRating
                  rating={field.value}
                  onRatingChange={field.onChange}
                  size="lg"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="review_text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Review (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Share your experience..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            existingReview ? "Update Review" : "Submit Review"
          )}
        </Button>
      </form>
    </Form>
  );
};
