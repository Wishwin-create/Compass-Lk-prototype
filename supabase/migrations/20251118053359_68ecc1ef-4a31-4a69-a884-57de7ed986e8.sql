-- Create events table for calendar
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  district TEXT,
  type TEXT NOT NULL CHECK (type IN ('Cultural', 'Religious', 'National')),
  image_url TEXT,
  is_public BOOLEAN DEFAULT true,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Public events are viewable by everyone
CREATE POLICY "Anyone can view public events"
  ON public.events
  FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- Users can create their own events
CREATE POLICY "Users can create their own events"
  ON public.events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own events
CREATE POLICY "Users can update their own events"
  ON public.events
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own events
CREATE POLICY "Users can delete their own events"
  ON public.events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Sri Lankan cultural and religious events for 2025
INSERT INTO public.events (title, date, description, district, type, is_public, user_id) VALUES
  ('Thaipongal', '2025-01-14', 'Tamil harvest festival celebrated with traditional rice dishes and gratitude to the Sun God.', 'Jaffna', 'Cultural', true, NULL),
  ('Independence Day', '2025-02-04', 'National day celebrating Sri Lanka''s independence from British rule in 1948.', 'Colombo', 'National', true, NULL),
  ('Sinhala & Tamil New Year', '2025-04-13', 'Traditional New Year celebrated by Sinhalese and Tamil communities with rituals and festivities.', NULL, 'Cultural', true, NULL),
  ('Sinhala & Tamil New Year', '2025-04-14', 'Second day of traditional New Year celebrations with family gatherings and traditional games.', NULL, 'Cultural', true, NULL),
  ('Vesak Festival', '2025-05-12', 'Most important Buddhist festival commemorating the birth, enlightenment, and death of Buddha.', NULL, 'Religious', true, NULL),
  ('Poson Festival', '2025-06-10', 'Celebrates the arrival of Buddhism to Sri Lanka with religious ceremonies and pilgrimages.', 'Anuradhapura', 'Religious', true, NULL),
  ('Kandy Esala Perahera (Start)', '2025-07-25', 'One of the oldest and grandest Buddhist festivals featuring elaborate processions of dancers, drummers, and decorated elephants.', 'Kandy', 'Cultural', true, NULL),
  ('Kandy Esala Perahera (Peak)', '2025-08-05', 'Grand finale of the Esala Perahera with the most spectacular procession.', 'Kandy', 'Cultural', true, NULL),
  ('Deepavali', '2025-11-01', 'Hindu festival of lights celebrating the victory of light over darkness.', NULL, 'Religious', true, NULL),
  ('Christmas', '2025-12-25', 'Christian celebration of the birth of Jesus Christ.', NULL, 'Religious', true, NULL),
  ('Eid-ul-Fitr', '2025-03-31', 'Islamic festival marking the end of Ramadan fasting period.', NULL, 'Religious', true, NULL),
  ('Eid-ul-Adha', '2025-06-07', 'Islamic festival of sacrifice commemorating Prophet Ibrahim''s willingness to sacrifice his son.', NULL, 'Religious', true, NULL);