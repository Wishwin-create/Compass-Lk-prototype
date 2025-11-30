-- Create itineraries table
CREATE TABLE public.itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create itinerary_days table
CREATE TABLE public.itinerary_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_id UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_number INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(itinerary_id, date),
  UNIQUE(itinerary_id, day_number)
);

-- Create itinerary_items table
CREATE TABLE public.itinerary_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  itinerary_day_id UUID NOT NULL REFERENCES public.itinerary_days(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('destination', 'activity', 'accommodation', 'transportation')),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIME,
  end_time TIME,
  location TEXT,
  cost NUMERIC(10, 2),
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for itineraries
CREATE POLICY "Users can view their own itineraries"
  ON public.itineraries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own itineraries"
  ON public.itineraries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries"
  ON public.itineraries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries"
  ON public.itineraries FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for itinerary_days
CREATE POLICY "Users can view days of their itineraries"
  ON public.itinerary_days FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.itineraries
    WHERE itineraries.id = itinerary_days.itinerary_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can create days for their itineraries"
  ON public.itinerary_days FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itineraries
    WHERE itineraries.id = itinerary_days.itinerary_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can update days of their itineraries"
  ON public.itinerary_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.itineraries
    WHERE itineraries.id = itinerary_days.itinerary_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete days of their itineraries"
  ON public.itinerary_days FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.itineraries
    WHERE itineraries.id = itinerary_days.itinerary_id
    AND itineraries.user_id = auth.uid()
  ));

-- RLS Policies for itinerary_items
CREATE POLICY "Users can view items of their itinerary days"
  ON public.itinerary_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.itinerary_days
    JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
    WHERE itinerary_days.id = itinerary_items.itinerary_day_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can create items for their itinerary days"
  ON public.itinerary_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.itinerary_days
    JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
    WHERE itinerary_days.id = itinerary_items.itinerary_day_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can update items of their itinerary days"
  ON public.itinerary_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.itinerary_days
    JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
    WHERE itinerary_days.id = itinerary_items.itinerary_day_id
    AND itineraries.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete items of their itinerary days"
  ON public.itinerary_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.itinerary_days
    JOIN public.itineraries ON itineraries.id = itinerary_days.itinerary_id
    WHERE itinerary_days.id = itinerary_items.itinerary_day_id
    AND itineraries.user_id = auth.uid()
  ));

-- Trigger for updating itineraries updated_at
CREATE TRIGGER update_itineraries_updated_at
  BEFORE UPDATE ON public.itineraries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();