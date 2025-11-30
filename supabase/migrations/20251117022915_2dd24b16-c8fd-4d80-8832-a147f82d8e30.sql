-- Create reviews table for destinations and activities
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE CASCADE,
  itinerary_item_id UUID REFERENCES public.itinerary_items(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT review_target_check CHECK (
    (destination_id IS NOT NULL AND itinerary_item_id IS NULL) OR
    (destination_id IS NULL AND itinerary_item_id IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Create policies for reviews
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
USING (true);

CREATE POLICY "Users can create their own reviews"
ON public.reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update destination ratings
CREATE OR REPLACE FUNCTION public.update_destination_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dest_id UUID;
BEGIN
  -- Get the destination_id from OLD or NEW
  IF TG_OP = 'DELETE' THEN
    dest_id := OLD.destination_id;
  ELSE
    dest_id := NEW.destination_id;
  END IF;

  -- Only update if this is a destination review
  IF dest_id IS NOT NULL THEN
    UPDATE public.destinations
    SET 
      average_rating = (
        SELECT COALESCE(AVG(rating), 0)
        FROM public.reviews
        WHERE destination_id = dest_id
      ),
      total_reviews = (
        SELECT COUNT(*)
        FROM public.reviews
        WHERE destination_id = dest_id
      )
    WHERE id = dest_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger to update destination ratings automatically
CREATE TRIGGER update_destination_rating_on_review_change
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_destination_rating();