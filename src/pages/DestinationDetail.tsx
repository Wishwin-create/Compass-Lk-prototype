import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Star, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReviewForm } from "@/components/ReviewForm";
import { ReviewsList } from "@/components/ReviewsList";
import { Separator } from "@/components/ui/separator";

// Load local pictures from src/pictures and src/assets/destinations as fallback assets
const _localImages = {
  ...import.meta.glob('/src/pictures/**/*.{jpg,jpeg,png,webp,gif}', { as: 'url', eager: true }),
  ...import.meta.glob('/src/pictures/**/*.{JPG,JPEG,PNG,WEBP,GIF}', { as: 'url', eager: true }),
  ...import.meta.glob('/src/assets/destinations/*.{jpg,jpeg,png,webp,gif}', { as: 'url', eager: true }),
  ...import.meta.glob('/src/assets/destinations/*.{JPG,JPEG,PNG,WEBP,GIF}', { as: 'url', eager: true }),
} as Record<string, string>;

const normalizeForKey = (s: string) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/['’`\u2019]/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Manual text overrides for specific destination names (normalized keys)
const manualTextOverrides: Record<string, string> = {
  kegallepinnawalaelephanthorphanage: `The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka.`,
  // additional common variants to match exact destination names like 'Kegalle Pinnawela Elephant Orphanage'
  kegallepinnawelaelephanthorphanage: `The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka.`,
  pinnawelaelephanthorphanage: `The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka.`,
  pinnawela: `The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka.`,
  pinnawalaelephanthorphanage: `The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka.`,
};

const localImageEntries = Object.entries(_localImages).map(([path, url]) => {
  const parts = path.split('/');
  const filename = parts[parts.length - 1] || '';
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const key = normalizeForKey(nameWithoutExt);
  return { path, url, filename, key };
});

// Prefer images located in `src/pictures` over `src/assets` when both exist
localImageEntries.sort((a, b) => {
  const picPattern = /\/src\/pictures\/|\\src\\pictures\\/i;
  const aPic = picPattern.test(String(a.path));
  const bPic = picPattern.test(String(b.path));
  if (aPic === bPic) return 0;
  return aPic ? -1 : 1;
});

const findLocalImages = (name: string) => {
  const key = normalizeForKey(name || '');
  const tokens = String(name || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return localImageEntries
    .filter((e) => {
      if (!e.key) return false;
      if (e.key.includes(key) || key.includes(e.key)) return true;
      const lowerFilename = e.filename.toLowerCase();
      const lowerPath = String(e.path).toLowerCase();
      for (const t of tokens) {
        if (!t) continue;
        if (lowerFilename.includes(t) || lowerPath.includes(t)) return true;
      }
      return false;
    })
    .map((e) => e.url);
};

// Manual overrides for destinations with ambiguous filenames or wrong matches
const findManualOverride = (name: string) => {
  const key = normalizeForKey(name || '');
  if (/aluvihare/.test(key) || /aluviharetemple/.test(key) || /aluvihare\stemple/.test(key)) {
    const found = localImageEntries.find((e) => e.filename.toLowerCase().includes('aluvihare'));
    return found ? found.url : null;
  }
  if (/independence/.test(key) || /independencesquare/.test(key) || /independence\s*square/.test(key)) {
    const found = localImageEntries.find((e) => e.filename.toLowerCase().includes('independence'));
    return found ? found.url : null;
  }
  // Horton Plains: prefer the picture in `src/pictures/New folder/horton plains.jpg` if available
  if (/horton plains|world's end|worlds end/i.test(name)) {
    const found = localImageEntries.find((e) => /horton ?plains/i.test(e.filename) && /pictures/i.test(String(e.path)));
    if (found) return found.url;
  }
  return null;
};

// DEV: print available local image entries and their normalized keys to help debugging
if (import.meta.env && import.meta.env.DEV) {
  try {
    console.debug(
      'localImageEntries:',
      localImageEntries.map((e) => ({ filename: e.filename, key: e.key, path: e.path }))
    );
  } catch (err) {
    /* ignore */
  }
}

type Destination = {
  id: string;
  name: string;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  opening_hours: string | null;
  average_rating: number;
  total_reviews: number;
  provinces: {
    name: string;
  };
  destination_categories: Array<{
    categories: {
      name: string;
      icon: string | null;
    };
  }>;
  destination_images: Array<{
    image_url: string;
    caption: string | null;
    is_primary: boolean;
  }>;
};

const DestinationDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingReview, setEditingReview] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchDestination();
    }
  }, [id]);

  const fetchDestination = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("destinations")
        .select(`
          *,
          provinces (name),
          destination_categories (
            categories (name, icon)
          ),
          destination_images (image_url, caption, is_primary)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      const name = String(data?.name || '');

      // If this is 'Munneshwaram Temple' (generic) but a 'Munneshwaram Kali Kovil' exists,
      // redirect to the Kali Kovil record.
      // match both 'munneshwaram' and 'munneswaram'
      const munnesPattern = /munneshwaram|munneswaram/i;
      if (munnesPattern.test(name) && !/kali|kovil/i.test(name)) {
        const { data: mRows, error: mErr } = await supabase
          .from('destinations')
          .select('id, name')
          .ilike('name', '%munneshwaram%')
          .or(`name.ilike.%munneswaram%`)
          .limit(10);

        if (!mErr && Array.isArray(mRows) && mRows.length > 0) {
          const kali = (mRows as any[]).find((r) => /kali|kovil/i.test(String(r.name || '')));
          if (kali) {
            navigate(`/destination/${kali.id}`);
            return;
          }
        }

        // no Kali variant found — treat as not found to avoid duplicate display
        setDestination(null);
        return;
      }
      setDestination(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load destination details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 text-center">
          <p className="text-muted-foreground">Destination not found</p>
          <Link to="/destinations">
            <Button variant="outline" className="mt-4">
              Back to Destinations
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Determine primary image: prefer DB primary image, otherwise try local pictures
  const primaryImage = destination.destination_images.find((img) => img.is_primary);
  const localFallbacks = findLocalImages(destination.name);
  const manual = findManualOverride(destination.name);
  const provinceFallback = (() => {
    try {
      return (localImageEntries.find((e) =>
        String(e.path).toLowerCase().includes(String(destination.provinces.name).toLowerCase()) ||
        e.key.includes(normalizeForKey(destination.provinces.name))
      ) || null)?.url || null;
    } catch {
      return null;
    }
  })();

  const primaryImageUrl = primaryImage ? primaryImage.image_url : (localFallbacks[0] || manual) || provinceFallback || null;

  const fallbackDescriptions: { pattern: RegExp; text: string }[] = [
    {
      pattern: /galle face/i,
      text:
        "Galle Face Green is a long, oceanfront promenade built during the Dutch colonial period. It is one of the most popular places in Colombo for evening walks, relaxing by the sea, and enjoying street food like isso wade and kottu. The strong sea breeze and open space make it perfect for flying kites. It is also a great spot to watch sunsets, attracting locals and tourists alike.",
    },
    {
      pattern: /lotus tower/i,
      text:
        "The Lotus Tower is the tallest structure in South Asia at 350 meters, offering a panoramic observation deck with 360-degree views of Colombo. The tower houses restaurants, exhibitions, and entertainment zones, and its colorful night lighting makes it a striking city landmark.",
    },
    {
      pattern: /independence square|independence arcade/i,
      text:
        "Independence Square is a national monument commemorating Sri Lanka’s independence. The surrounding gardens are peaceful and ideal for jogging, photos, and evening walks. The nearby Independence Arcade houses shops and restaurants in a restored colonial building.",
    },
    {
      pattern: /colombo national museum|national museum/i,
      text:
        "The National Museum showcases Sri Lanka’s ancient heritage with royal regalia, statues, and Kandyan monarchy artifacts. Its historic architecture provides a classic colonial atmosphere and the grounds are spacious and shaded for a pleasant educational visit.",
    },
    {
      pattern: /dutch hospital/i,
      text:
        "The Dutch Hospital precinct is a restored colonial building converted into a stylish shopping and dining complex featuring cafes, pubs, restaurants, and boutique shops. The preserved architecture creates a charming ambience, lively at night with music and entertainment.",
    },
    {
      pattern: /mount lavinia/i,
      text:
        "Mount Lavinia Beach is a popular urban beach with golden sand and calm waves, known for seafood restaurants along the shore. It’s ideal for swimming, beach photography, and offers a lively nightlife after sunset.",
    },
    {
      pattern: /dehiwala zoo|zoo/i,
      text:
        "Dehiwala Zoo is one of Asia’s oldest zoological gardens, home to a wide range of animals and birds, daily animal shows including elephants, and a beautiful butterfly garden — a family-friendly attraction.",
    },
    {
      pattern: /diyatha uyana/i,
      text:
        "Diyatha Uyana is a lakeside recreational area with walking paths, fish ponds, open-air restaurants, and a weekend market — clean, calm, and ideal for evening strolls with beautiful night lighting by the water.",
    },
    {
      pattern: /beddagana/i,
      text:
        "Beddagana Wetland Park preserves a wetland ecosystem of birds and butterflies with elevated wooden paths for safe exploration — perfect for nature lovers, joggers, and photographers.",
    },
    {
      pattern: /attidiya/i,
      text:
        "Attidiya Bird Sanctuary is a natural wetland sanctuary attracting local and migratory bird species, offering excellent birdwatching opportunities and a peaceful ecosystem close to the city.",
    },
    {
      pattern: /kelaniya|kelaniya raja maha viharaya/i,
      text:
        "Kelaniya Raja Maha Viharaya is a sacred Buddhist temple famed for its stunning murals and architecture. It hosts the annual Duruthu Perahera and is known as a place for spiritual ceremonies and blessings.",
    },
    {
      pattern: /negombo beach/i,
      text:
        "Negombo Beach is a long sandy coastline known for water sports, sunset views, and traditional fishing catamarans. The nearby town offers lively restaurants and markets, and it’s close to the airport.",
    },
    {
      pattern: /negombo lagoon/i,
      text:
        "Negombo Lagoon is a rich brackish-water ecosystem with mangroves and birdlife, popular for boat rides and eco-tours. Local fishermen use traditional methods and lagoon crab harvesting is common.",
    },
    {
      pattern: /hamilton canal/i,
      text:
        "Hamilton Canal, built during colonial times, once connected Colombo and Negombo. Today visitors enjoy peaceful boat rides and scenic views of village life and wetlands along the canal.",
    },
    {
      pattern: /muthurajawela/i,
      text:
        "Muthurajawela Wetlands is one of Sri Lanka’s largest wetlands, home to rare birds, crocodiles, and diverse plant life. Boat tours explore deep into the marshes and highlight an important biodiversity zone.",
    },
    {
      pattern: /kalutara bodhiya|kalutara temple/i,
      text:
        "Kalutara Bodhiya is a major Buddhist shrine identifiable by its large white stupa beside the riverside. The hollow stupa allows visitors to walk inside and many devotees stop to offer prayers.",
    },
    {
      pattern: /richmond castle/i,
      text:
        "Richmond Castle is an elegant early 1900s mansion inspired by Indian palace architecture, noted for carved woodwork, stained glass, spacious halls and picturesque gardens.",
    },
    {
      pattern: /kalutara beach/i,
      text:
        "Kalutara Beach is a wide sandy shore popular for resorts and peaceful seaside relaxation, quieter than Colombo and Negombo and suitable for swimming in calmer areas.",
    },
    {
      pattern: /moragalla/i,
      text:
        "Moragalla Beach is a shallow, calm beach with crystal-clear water ideal for snorkeling and peaceful escapes away from crowds.",
    },
    {
      pattern: /barberyn|beruwala lighthouse|barberyn island/i,
      text:
        "Beruwala (Barberyn) Island features a historic lighthouse built in 1889; a short boat ride offers great ocean views and photography opportunities.",
    },
    {
      pattern: /kande viharaya/i,
      text:
        "Kande Viharaya is a large southern Buddhist temple famous for its giant Buddha statue, ancient frescoes, and peaceful meditation areas — a popular pilgrimage site.",
    },
    {
      pattern: /thudugala/i,
      text:
        "Thudugala Waterfall is a small scenic waterfall with a shallow natural pool suitable for bathing, surrounded by forest walking paths and wildlife.",
    },
    {
      pattern: /horana lakshapana|lakshapana tea museum/i,
      text:
        "Horana Lakshapana Tea Museum showcases Sri Lanka’s tea industry history, old machinery, and offers tea tastings in a setting surrounded by small tea estates.",
    },
    {
      pattern: /temple of the tooth|dalada maligawa|tooth relic/i,
      text:
        "The Temple of the Tooth Relic (Sri Dalada Maligawa) is one of Sri Lanka’s most sacred Buddhist temples, housing the revered tooth relic of Lord Buddha. Its Kandyan architecture features golden ornaments and traditional wooden carvings. Hundreds of devotees visit daily, and during the Esala Perahera the temple becomes the center of a grand cultural festival.",
    },
    {
      pattern: /kandy lake|sea of milk/i,
      text:
        "Kandy Lake (the ‘Sea of Milk’) is an artificial lake built in 1807. The lakeside walkway is perfect for peaceful strolls, birdwatching, and photography. The calm water and surrounding hills create a serene atmosphere in the heart of Kandy.",
    },
    {
      pattern: /peradeniya botanical|peradeniya garden/i,
      text:
        "Peradeniya Botanical Garden is Sri Lanka’s largest botanical garden, home to over 4,000 plant species. It is famous for its orchid house, Royal Palm Avenue and ancient fig trees — a must-visit for nature lovers and photographers.",
    },
    {
      pattern: /udawatte kele|udawatta kele|udawatte/i,
      text:
        "Udawatte Kele Sanctuary is a historic forest reserve behind the Temple of the Tooth, once reserved for Kandyan royalty. The shaded trails host diverse birdlife, monkeys and reptiles — a refreshing escape from the city.",
    },
    {
      pattern: /knuckles|knuckles mountain/i,
      text:
        "The Knuckles Mountain Range, a UNESCO-listed area, is known for misty peaks, deep valleys and rich biodiversity. It’s a premier hiking destination offering routes from easy walks to challenging treks and spectacular viewpoints.",
    },
    {
      pattern: /hunnasgiriya/i,
      text:
        "Hunnasgiriya is a cool, misty mountain near the Knuckles Range offering panoramic views of tea plantations and villages — a peaceful spot for moderate hikes and nature observation.",
    },
    {
      pattern: /sembuwatta/i,
      text:
        "Sembuwatta Lake is a scenic man-made lake surrounded by pine forests and tea estates with turquoise waters ideal for picnics, paddle boating and relaxing in the cool mountain air.",
    },
    {
      pattern: /ambuluwawa/i,
      text:
        "Ambuluwawa Tower is a multi-religious biodiversity center with a distinctive spiral tower. Visitors can climb the external winding staircase for panoramic 360-degree views and explore the gardens and sanctuaries.",
    },
    {
      pattern: /riverston/i,
      text:
        "Riverston is a cool plateau in the Knuckles region known for windy viewpoints, dramatic drops and scenic drives — a favorite among hikers and photographers.",
    },
    {
      pattern: /bambarakiri|bambarakiri ella/i,
      text:
        "Bambarakiri Ella is a picturesque waterfall surrounded by lush greenery with a hanging bridge offering great views; it’s an ideal spot for nature lovers and peaceful picnics.",
    },
    {
      pattern: /balangoda|fa\-?hien|fa hien|fa-hien cave|fa hien cave/i,
      text:
        "Balangoda Caves, also known as Fa-Hien Cave, are among the largest prehistoric cave sites in Sri Lanka, famous for discoveries related to the island’s earliest human settlers known as the ‘Balangoda Man.’ The cave has revealed tools, skeletal remains, and evidence of human activity dating back over 38,000 years, making it a significant archaeological treasure. Its massive rock overhang and forest surroundings create a dramatic and atmospheric natural setting. Today, the cave stands as one of Sri Lanka’s most important prehistoric heritage sites, offering insights into human evolution and ancient lifestyles.",
    },

    {
      pattern: /bogoda|bogoda wooden bridge/i,
      text:
        "Bogoda Wooden Bridge is one of Sri Lanka’s oldest surviving wooden bridges, believed to date back to the 16th century during the Kandyan era. It is built entirely from timber—without a single nail—using traditional carpentry techniques and beautifully carved wooden pillars. The bridge sits beside the historic Bogoda Raja Maha Viharaya and spans a quiet stream surrounded by lush greenery. Today, it stands as a rare example of ancient craftsmanship and remains a peaceful cultural landmark in the Badulla district.",
    },
    {
      pattern: /nalanda gedige/i,
      text:
        "Nalanda Gedige is an ancient stone temple blending Hindu and Buddhist architectural styles, considered by some to be the geographical center of Sri Lanka and notable for its mysterious historical significance.",
    },
    {
      pattern: /(?:abha?ya(?:giri|giriya)|abayagiri|abhayagiri)(?:\s*(?:stupa|vihara|temple|monastery))?/i,
      text:
        "A sprawling monastery complex once home to 5,000 monks, Abhayagiri was one of the greatest Buddhist universities in the ancient world. Built in the 1st century BC, it attracted scholars from China, India, and Southeast Asia. The massive Abhayagiri Stupa, ornate carvings, and monastic ruins reveal the brilliance of ancient architecture and the intellectual vibrancy of the kingdom.",
    },
    {
      pattern: /aluvihare|aluvihare rock temple/i,
      text:
        "Aluvihare Rock Temple is the place where Buddhist scriptures (Tripitaka) were first written down on palm leaves. The temple features a series of caves filled with ancient paintings and statues. It played a critical role in preserving Buddhist teachings. The atmosphere is quiet, spiritual, and full of historical significance.",
    },
    {
      pattern: /avukana|aukana|avukana buddha|aukana buddha|avukana statue/i,
      text:
        "The Avukana Buddha Statue is a towering 40-foot standing Buddha carved out of a single granite rock during the 5th century, showcasing extraordinary ancient craftsmanship. The statue depicts the Buddha in the Asisa Mudra, symbolizing blessing and reassurance, with incredibly detailed robes that appear to flow naturally. It stands near the Kala Wewa reservoir, adding to its serene and majestic atmosphere. Today, Avukana remains one of Sri Lanka’s most iconic Buddhist sculptures and a remarkable testament to the island’s artistic and spiritual heritage.",
    },
    {
      pattern: /matale spice|spice gardens/i,
      text:
        "Matale Spice Gardens showcase cinnamon, pepper, cardamom and vanilla cultivation with guided tours, spice demonstrations and shops selling natural products and Ayurvedic oils.",
    },
    {
      pattern: /anuradhapura|anuradhapura sacred city/i,
      text:
        "Anuradhapura Sacred City is an ancient royal capital founded in the 4th century BC and is one of South Asia’s greatest archaeological and spiritual centers. It is home to massive stupas, vast monastic complexes, and the revered Jaya Sri Maha Bodhi, believed to be the oldest historically documented tree in the world. The city showcases the height of early Sri Lankan engineering, including intricate irrigation systems and monumental architecture. Today, Anuradhapura is a UNESCO World Heritage Site and remains a major pilgrimage destination that reflects the island’s deep Buddhist heritage.",
    },
    {
      pattern: /katugas ella|katugasella|katugas/i,
      text:
        "Katugas Ella is a beautiful waterfall hidden within the lush greenery of Kegalle. It is known for its peaceful natural pool formed at the base of the falls. The surrounding forest provides a cool and refreshing atmosphere, making it perfect for short hikes and nature relaxation.",
    },
    {
      pattern: /kegalle\s*-?\s*pinnawala|pinnawala|pinnawala elephant orphanage|kegalle pinnawala elephant orphanage/i,
      text:
        "The Pinnawala Elephant Orphanage is a sanctuary that cares for abandoned and injured elephants. Visitors can watch elephants being fed and bathed in the nearby river. It offers a rare opportunity to observe herds in a semi-natural environment. The orphanage plays a key role in elephant conservation in Sri Lanka and provides educational visits for visitors who want to learn about elephant care and rehabilitation.",
    },
    {
      pattern: /kitulgala|kithulgala/i,
      text:
        "Kitulgala is a scenic town famous for adventurous water activities, especially white-water rafting. Surrounded by dense rainforests, waterfalls and natural pools, the area is ideal for eco-tourism, birdwatching and hiking. It is also known as a filming location for ‘The Bridge on the River Kwai’.",
    },
    {
      pattern: /pahiyangala|pahiyangala cave|fa-?hien cave|fa hien cave/i,
      text:
        "Pahiyangala (Fa Hien Cave) is one of the largest natural rock caves in Asia and holds great archaeological importance. Named after the Chinese monk Fa Hien, excavations have revealed evidence of prehistoric human settlements. The cave’s massive entrance and surrounding forest make it a stunning natural attraction.",
    },
    {
      pattern: /pelmadulla falls|pelmadulla/i,
      text:
        "Pelmadulla Falls refers to several picturesque waterfalls in the Pelmadulla area, where natural streams flow through rocky terrain and thick greenery. These falls offer peaceful picnic spots, cool waters and tranquil environments popular with nature lovers.",
    },
    {
      pattern: /saman dewalaya|saman devalaya|saman dewalaya sabaragamuwa/i,
      text:
        "Saman Dewalaya is a major Buddhist temple in Sabaragamuwa dedicated to God Saman, a revered guardian deity of Sri Lanka. The shrine is known for its historic architecture and spiritual significance; devotees gather during the annual Saman Devala Perahera to participate in colorful processions.",
    },
    {
      pattern: /sinharaja|sinharaja rain forest|sinharaja rainforest/i,
      text:
        "Sinharaja Rain Forest is Sri Lanka’s last remaining primary tropical rainforest and a UNESCO World Heritage Site. It is exceptionally rich in biodiversity with many rare and endemic species. Guided nature trails offer a chance to explore its untouched canopy and unique wildlife.",
    },
    {
      pattern: /udawalawa elephant transit home|udawalawa transit home|elephant transit home udawalawe/i,
      text:
        "The Udawalawe Elephant Transit Home rehabilitates orphaned baby elephants until they are fit to return to the wild. Visitors can observe feeding times from a safe distance; the facility focuses on minimal human contact to encourage natural behavior and supports national conservation efforts.",
    },
    {
      pattern: /udawalawe national park|udawalawe national park|udawalawe/i,
      text:
        "Udawalawe National Park is one of the best places in Sri Lanka to see wild elephants in their natural habitat. The park’s open grasslands, forests and reservoir create diverse ecosystems supporting elephants, water buffalo, deer, crocodiles and many bird species — making it ideal for safari tours.",
    },
    {
      pattern: /isurumuniya/i,
      text:
        "Isurumuniya is a beautiful ancient rock temple in Anuradhapura known for its exquisite stone carvings. The famous ‘Isurumuniya Lovers’ sculpture is one of Sri Lanka’s most iconic artworks. The temple combines natural rock formations with serene Buddhist architecture. Its peaceful atmosphere makes it a favorite spiritual and historical site.",
    },
    {
      pattern: /jaya sri maha bodhi|jaya sri maha bodhiya|jaya sri maha bodhi/i,
      text:
        "The Jaya Sri Maha Bodhiya is one of the oldest living trees in the world with a recorded history. It is believed to be a sapling from the Bodhi tree under which Lord Buddha attained Enlightenment. Revered by millions, it is among the most sacred Buddhist sites in Sri Lanka. Devotees visit daily to offer prayers, flowers, and traditional rituals.",
    },
    {
      pattern: /kala wewa|kalawewa|kala wewa reservoir/i,
      text:
        "Kala Wewa is a massive ancient reservoir built by King Dhatusena in the 5th century. It showcases the advanced engineering skills of ancient Sri Lankan civilization. The tank provides irrigation to large farming areas in the North Central Province. Its scenic surroundings and calm waters make it a peaceful getaway.",
    },
    {
      pattern: /kaudulla national park|kaudulla/i,
      text:
        "Kaudulla National Park is a wildlife sanctuary famous for its large herds of wild elephants. The park’s lush landscapes and water sources attract animals throughout the year. Safari visitors often spot deer, peacocks, crocodiles, and many bird species. It is one of the best places in Sri Lanka to observe elephants in their natural habitat.",
    },
    {
      pattern: /mihinthale/i,
      text:
        "Mihinthale is the sacred mountain where Buddhism was first introduced to Sri Lanka. It is considered the birthplace of Buddhism in the country. The site has ancient stupas, stone stairways, and panoramic viewpoints. Pilgrims and travellers visit to experience its deep spiritual and historical significance.",
    },
    {
      pattern: /minneriya national park|minneriya/i,
      text:
        "Minneriya National Park is home to the world-famous ‘Gathering’ of elephants, one of the largest yearly elephant gatherings. The Minneriya Tank attracts wildlife during the dry season, making it ideal for safaris. Visitors can see elephants, monkeys, reptiles, and many birds. The park’s grasslands and forests offer a vibrant wildlife experience.",
    },
    {
      pattern: /parakrama samudra|parakrama samudraya/i,
      text:
        "Parakrama Samudra is a vast ancient reservoir built by King Parakramabahu the Great. It consists of several interconnected tanks forming one large water body. The famous saying ‘Not even a drop of water should flow to the sea unused’ reflects its purpose. Its surroundings are picturesque, especially during sunrise and sunset.",
    },
    {
      pattern: /pidurangala rock|pidurangala/i,
      text:
        "Pidurangala Rock is a popular hiking destination offering stunning views of Sigiriya Lion Rock. The climb is adventurous, with rocks and forest pathways. At the summit, travellers are rewarded with panoramic landscapes and peaceful views. It is a quieter and more natural alternative to climbing Sigiriya.",
    },
    {
      pattern: /polonnaruwa|polonnaruwa ancient city/i,
      text:
        "Polonnaruwa Ancient City is a UNESCO World Heritage Site filled with well-preserved ruins of palaces, temples, and statues. It was once a thriving royal capital of Sri Lanka. Highlights include the Gal Vihara Buddha statues and the Royal Palace complex. The city showcases the grandeur of medieval Sri Lankan architecture.",
    },
    {
      pattern: /ritigala/i,
      text:
        "Ritigala is a mysterious forest-covered mountain with ancient monastic ruins. The site is known for its cool climate and unique biodiversity compared to the surrounding dry zone. Ancient meditation pathways and stone structures reveal its monastic history. Its peaceful, untouched environment gives it an almost mythical atmosphere.",
    },
    {
      pattern: /ruwanweliseya|ruwanwelisaya|ruwan weliseya/i,
      text:
        "Ruwanweliseya is one of the most revered stupas in Sri Lanka, built by King Dutugemunu. Its large white dome symbolizes purity and Buddhist devotion. The stupa holds great historical and religious significance for Buddhists worldwide. Thousands of pilgrims visit each year to pay homage.",
    },
    {
      pattern: /thuparamaya|thuparamaya stupa/i,
      text:
        "Thuparamaya is the earliest documented Buddhist stupa in Sri Lanka, built during King Devanampiya Tissa’s reign. It is believed to enshrine the sacred right collarbone relic of Lord Buddha. The stupa’s distinctive ‘vata-da-ge’ structure of stone pillars surrounds it. It remains an important pilgrimage site with deep cultural value.",
    },
    {
      pattern: /nuwara eliya|little england/i,
      text:
        "Nuwara Eliya (‘Little England’) is a cool hill station known for colonial-era architecture, tea plantations, lakes and gardens — a romantic and scenic mountain retreat.",
    },
    {
      pattern: /horton plains|world's end|worlds end/i,
      text:
        "Horton Plains National Park features misty grasslands and the famous ‘World’s End’ cliff with an 870m drop. Early morning visits are best to avoid fog and to see sweeping views and Baker’s Falls.",
    },
    {
      pattern: /gregory lake/i,
      text:
        "Gregory Lake is a central reservoir in Nuwara Eliya offering boat rides, water sports, horse rides and lakeside picnics with well-maintained walking paths and lively evenings.",
    },
    {
      pattern: /victoria park/i,
      text:
        "Victoria Park is one of Sri Lanka’s oldest parks featuring flowers, ponds and shaded walkways; it’s especially colorful during the flowering season and popular with birdwatchers.",
    },
    {
      pattern: /lovers' leap|lovers leap/i,
      text:
        "Lovers’ Leap Waterfall is a tall, narrow fall framed by tea estates and a local legend; the short trek offers scenic valley views and a peaceful setting.",
    },
    {
      pattern: /moon plains/i,
      text:
        "Moon Plains is an open grassland with panoramic 360-degree mountain views and a ‘Mini World’s End’ viewpoint overlooking deep valleys — ideal for photography and quiet walks.",
    },
    {
      pattern: /bomburu ella/i,
      text:
        "Bomburu Ella is a wide, multi-cascade waterfall offering impressive views; the hike through forests and streams makes it a rewarding eco-tourism destination.",
    },
    {
      pattern: /diyaluma|diyaluma falls|diyaluma waterfall/i,
      text:
        "Diyaluma Falls is the second-highest waterfall in Sri Lanka, standing at about 220 meters near Koslanda in the Badulla District. It is famous for its multi-tier cascading streams and the natural infinity pools at the top, where visitors can swim while enjoying breathtaking views of the surrounding mountains and valleys. The hike to the upper pools is relatively easy and offers one of the most scenic waterfall experiences in the country.",
    },
    {
      pattern: /dunhinda|dunhinda falls|dunhinda waterfall/i,
      text:
        "Dunhinda Falls is one of Sri Lanka’s most beautiful waterfalls, located near Badulla in the Uva Province. The waterfall is about 64 meters high and is famous for the misty spray created as the water crashes down—this mist inspired the name ‘Dunhinda’ meaning ‘smoky waterfall’. Visitors walk a scenic jungle path to the viewpoint, enjoying small streams and wildlife along the way. It’s a peaceful, picturesque location popular among both tourists and locals.",
    },
    {
      pattern: /haputale|haputhale|haputal?e/i,
      text:
        "Haputale is a cool, misty mountain town in the Badulla District, famous for its stunning viewpoints and lush green tea estates. Located on the southern edge of Sri Lanka’s hill country at over 1,400 meters above sea level, it offers refreshing weather and dramatic scenery. The town is surrounded by Lipton's Seat, Adisham Bungalow, and sprawling plantations that create some of the country’s most scenic train rides. Haputale is peaceful, nature-rich, and perfect for hiking, photography, and enjoying quiet hill-country life.",
    },
    {
      pattern: /lipton'?s\s*seat|liptons\s*seat|lipton seat/i,
      text:
        "Lipton's Seat is a famous viewpoint in the Haputale hills, rising to about 1,970 meters above sea level. Named after Sir Thomas Lipton, who used it to view his Dambatenne tea plantation, the lookout provides sweeping panoramas of misty tea fields, undulating hills and distant lakes on clear mornings. The route to the viewpoint — a scenic trek or short tuk‑tuk ride through lush tea estates — is part of the experience and adds to its charm.",
    },
    {
      pattern: /little\s*adam'?s?\s*peak|little\s*adam/i,
      text:
        "Little Adam’s Peak, located in Ella in the Badulla District, is one of Sri Lanka’s most popular and easily accessible hiking spots. The trail is short and beginner-friendly, offering stunning panoramic views of rolling hills, tea plantations, and surrounding valleys; the summit provides a peaceful atmosphere with spectacular sunrise and sunset scenes. It’s an ideal hike for travelers seeking a rewarding climb without high difficulty.",
    },
    {
      pattern: /namunukula|namu?nukula\s*mountain/i,
      text:
        "Namunukula Mountain, located near Ella and Badulla, is a prominent peak known for its nine summits and panoramic views over the Uva Province. The trek offers a mix of pine forests, grasslands, and misty cloud forests, and is popular among hikers for its peaceful, untouched natural setting. From the top, visitors can enjoy breathtaking sunrise and sunset views.",
    },
    {
      pattern: /okkampitiya|okkampitiya archaeological|okkampitiya site/i,
      text:
        "The Okkampitiya Archaeological Site in Monaragala is an ancient heritage area linked to early Buddhist settlements. The site contains ruins of old monasteries, stone pillars and artifacts that reflect the region’s historical significance. It’s a quiet, less-visited site ideal for exploring Sri Lanka’s early cultural history and archaeological context.",
    },
    {
      pattern: /ravana\s*cave|ravana'?s?\s*cave/i,
      text:
        "Ravana Cave near Ella is a small limestone cave associated with the legend of King Ravana from the Ramayana. Access requires climbing a steep stairway through a forested path; inside you’ll find narrow passages and rock formations that lend a mysterious atmosphere. It’s a popular cultural stop when exploring Ravana heritage sites.",
    },
    {
      pattern: /ravana\s*falls|ravana\s*fall/i,
      text:
        "Ravana Falls is one of Sri Lanka’s most famous waterfalls, cascading in multiple tiers from the Ella mountain range. The falls are especially scenic during the rainy season and are easily accessible from the Ella–Wellawaya road, making them popular with visitors who enjoy the cool mist and natural rock pools nearby.",
    },
    {
      pattern: /st\. clair|devon falls|st clair/i,
      text:
        "St. Clair’s and Devon Falls are two of Sri Lanka’s most photographed waterfalls, offering dramatic views along the Hatton–Nuwara Eliya road with excellent photo vantage points.",
    },
    {
      pattern: /pidurutalagala|mount pidurutalagala/i,
      text:
        "Pidurutalagala is Sri Lanka’s highest mountain (2,524m) with restricted summit access; on clear days it offers sweeping highland views and cool mountain air.",
    },
    {
      pattern: /ramboda falls/i,
      text:
        "Ramboda Falls is a multi-layered waterfall near the Ramboda Pass surrounded by tea estates and forests — a scenic stop on routes to Nuwara Eliya.",
    },
    {
      pattern: /bluefield|pedro tea|pedro estate/i,
      text:
        "Bluefield and Pedro Tea Estates offer guided tours of tea cultivation and processing, tea tastings, and scenic views across rolling hills and misty tea country.",
    },
    {
      pattern: /galle fort/i,
      text:
        "Galle Fort is a UNESCO World Heritage Site first built by the Portuguese and later expanded by the Dutch in the 17th century. It’s a living colonial town with narrow cobbled streets, churches, museums, boutique cafes, old mansions and ocean ramparts — ideal for strolling, exploring history and watching sunsets from the walls.",
    },
    {
      pattern: /unawatuna beach|unawatuna/i,
      text:
        "Unawatuna Beach is a popular golden-sand beach with calm shallow waters perfect for swimming, snorkeling and beginner diving. The shoreline is lined with beach restaurants and guesthouses, producing a lively evening atmosphere.",
    },
    {
      pattern: /jungle beach/i,
      text:
        "Jungle Beach is a small secluded bay tucked between forested hills near Unawatuna, with turquoise water ideal for snorkeling and kayaking — a peaceful alternative to busier beaches.",
    },
    {
      pattern: /japanese peace pagoda/i,
      text:
        "The Japanese Peace Pagoda is a serene white stupa built by Japanese Buddhist monks, located on a hill between Unawatuna and Jungle Beach. It symbolizes peace and offers panoramic coastal views including Galle Fort and nearby lighthouses.",
    },
    {
      pattern: /koggala lake|koggala/i,
      text:
        "Koggala Lake is a freshwater lake surrounded by cinnamon plantations, small islands, temples and rich birdlife. Boat rides to Cinnamon Island, spice gardens and hermitages are popular activities.",
    },
    {
      pattern: /mirissa beach|mirissa/i,
      text:
        "Mirissa Beach is a crescent-shaped, turquoise-sanded beach known for surfing, a lively nightlife, beachfront restaurants and as a departure point for whale-watching tours.",
    },
    {
      pattern: /secret beach/i,
      text:
        "Secret Beach (near Mirissa) is a quiet, hidden cove with coconut trees, shallow lagoons and rock pools — a peaceful spot for photography and relaxation.",
    },
    {
      pattern: /coconut hill/i,
      text:
        "Coconut Hill is a scenic headland of leaning coconut palms known for dramatic sunset photography and sweeping coastal views.",
    },
    {
      pattern: /whale watching|whale watching mirissa|mirissa whale/i,
      text:
        "Mirissa is one of the world’s top whale-watching spots; early-morning boat tours commonly sight blue whales, sperm whales and dolphins during peak season (November–April).",
    },
    {
      pattern: /hikkaduwa coral|hikkaduwa coral sanctuary/i,
      text:
        "Hikkaduwa Coral Sanctuary protects colorful coral reefs and tropical fish; snorkeling provides close encounters with marine life and sometimes sea turtles.",
    },
    {
      pattern: /hikkaduwa beach/i,
      text:
        "Hikkaduwa Beach is a surfing and water-sports hotspot with lively seafood dining, nightlife and a mix of backpacker and luxury offerings.",
    },
    {
      pattern: /dodanduwa turtle|dodanduwa/i,
      text:
        "Dodanduwa Turtle Hatchery is a conservation project protecting rescued turtle eggs and releasing hatchlings; visitors learn about sea turtle rehabilitation and conservation efforts.",
    },
    {
      pattern: /tangalle beach|tangalle/i,
      text:
        "Tangalle Beach is a long, quiet coastline with turquoise water, soft golden sand, luxury resorts and lagoon tours — ideal for relaxation and romantic stays.",
    },
    {
      pattern: /rekawa|rekawa turtle/i,
      text:
        "Rekawa Beach is a key turtle-nesting site where guided night tours allow visitors to witness nesting sea turtles and conservation activities.",
    },
    {
      pattern: /mulkirigala/i,
      text:
        "Mulkirigala Rock Temple is an ancient cave temple complex atop a 200m rock with murals, reclining Buddha statues and panoramic summit views.",
    },
    {
      pattern: /kalametiya/i,
      text:
        "Kalametiya Bird Sanctuary is a coastal wetland of lagoons and mangroves supporting 150+ bird species; boat safaris are popular for birdwatching and photography.",
    },
    {
      pattern: /ridgeway safari|hambantota ridgeway/i,
      text:
        "Ridgeway Safari (Hambantota) is a quieter nature safari across wetlands and scrublands where visitors can spot deer, peacocks, reptiles and migratory birds.",
    },
    {
      pattern: /bundala/i,
      text:
        "Bundala National Park is a UNESCO biosphere reserve famed for large flocks of flamingos, storks, crocodiles, elephants and diverse birdlife — a paradise for birdwatchers.",
    },
    {
      pattern: /yala national park/i,
      text:
        "Yala National Park (southern access) is Sri Lanka’s most famous wildlife park, known for its high density of leopards and diverse wildlife including elephants and sloth bears.",
    },
    {
      pattern: /kirinda/i,
      text:
        "Kirinda Beach & Temple is a coastal Buddhist shrine on rocky cliffs offering sweeping ocean views; the quiet nearby beach is ideal for contemplation.",
    },
    {
      pattern: /hambantota birds research|hambantota birds/i,
      text:
        "Hambantota Birds Research Center focuses on bird conservation, breeding and field research, supporting endangered species and public education.",
    },
    {
      pattern: /nilaveli/i,
      text:
        "Nilaveli Beach is an east-coast gem known for long stretches of soft white sand and calm turquoise waters ideal for swimming, snorkeling and relaxing — family-friendly and often ranked among the top beaches on the east coast.",
    },
    {
      pattern: /uppuveli/i,
      text:
        "Uppuveli Beach is a laid-back shore near Trincomalee popular with backpackers and divers, featuring wide sandy beaches, dive centers and a relaxed seaside atmosphere.",
    },
    {
      pattern: /pigeon island/i,
      text:
        "Pigeon Island National Park, off Nilaveli, is one of Sri Lanka’s marine national parks with coral reefs, colorful reef fish, turtles and excellent snorkeling and underwater photography spots.",
    },
    {
      pattern: /koneswaram/i,
      text:
        "Koneswaram Temple is a historic Hindu shrine perched on Swami Rock overlooking the Indian Ocean — famed for its thousand-pillared architecture, priceless sea views and ties to ancient legends.",
    },
    {
      pattern: /fort frederick/i,
      text:
        "Fort Frederick, built by the Portuguese in 1623 and later used by the Dutch and British, houses Koneswaram Temple and colonial structures; sambar deer occasionally roam the grounds.",
    },
    {
      pattern: /marble beach/i,
      text:
        "Marble Beach is a pristine, glass-clear bay managed by the Sri Lankan Air Force — extremely clean, peaceful and ideal for swimming and quiet relaxation.",
    },
    {
      pattern: /trincomalee hot wells|hot wells/i,
      text:
        "Trincomalee Hot Wells (Kanniyai) feature seven natural hot water wells with varying temperatures that attract pilgrims and visitors seeking cultural bathing rituals and relaxation.",
    },
    {
      pattern: /pasikuda|pasikudah/i,
      text:
        "Pasikuda Beach is famed for its exceptionally shallow lagoon stretching hundreds of meters, making it very safe for swimming and popular with family-friendly resorts and watersports.",
    },
    {
      pattern: /kalkuda/i,
      text:
        "Kalkuda Beach, south of Pasikuda, offers a quieter and more peaceful environment with wide sandy shores and calm seas ideal for long walks and sunsets.",
    },
    {
      pattern: /batticaloa lagoon/i,
      text:
        "Batticaloa Lagoon is a large mangrove-rich lagoon system known for its fishing communities, birdlife and the unique ‘singing fish’ phenomenon; boat tours explore islands and local life.",
    },
    {
      pattern: /batticaloa fort/i,
      text:
        "Batticaloa Fort, originally built by the Portuguese in 1628 and expanded by the Dutch, sits between the lagoon and sea and contains colonial-era bastions and scenic waterfront views.",
    },
    {
      pattern: /arugam bay/i,
      text:
        "Arugam Bay is a world-class surfing destination with top right-hand breaks, attracting surfers, backpackers and eco-tourists; the surrounding landscape includes lagoons and wildlife.",
    },
    {
      pattern: /elephant rock/i,
      text:
        "Elephant Rock (Arugam Bay) is an iconic granite outcrop rising from the coast offering short hikes and panoramic views; it’s a popular sunset viewpoint and occasionally sighting area for elephants.",
    },
    {
      pattern: /peanut farm beach/i,
      text:
        "Peanut Farm Beach is a secluded stretch south of Arugam Bay favored for intermediate surfing, camping and quiet coastal scenery with rock formations and lagoons.",
    },
    {
      pattern: /kumana national park|kumana/i,
      text:
        "Kumana National Park is a southeastern bird and wildlife sanctuary known for nesting and migratory birds, elephants, leopards and coastal wetlands — a quieter alternative to busier parks.",
    },
    {
      pattern: /okanda/i,
      text:
        "Okanda Beach & Temple is a sacred site on the eastern coast linked to Kataragama pilgrimage routes, known for rugged coastal scenery and traditional devotional activities.",
    },
    {
      pattern: /gal oya/i,
      text:
        "Gal Oya National Park is Sri Lanka’s unique boat-safari park where elephants swim between islands in the Senanayake Samudraya reservoir; it features forests, wildlife tours and village visits.",
    },
    {
      pattern: /senanayake samudraya/i,
      text:
        "Senanayake Samudraya is Sri Lanka’s largest reservoir surrounded by mountains and forests, offering boating, wildlife observation and scenic photography — sometimes elephants are spotted along the shore.",
    },
    {
      pattern: /jaffna fort|jaffna/i,
      text:
        "Jaffna Fort, originally built by the Portuguese in 1618 and later expanded by the Dutch and British, is one of Sri Lanka’s largest and best-preserved forts. Surrounded by water and star-shaped ramparts, it offers insights into colonial military architecture and expansive lagoon views.",
    },
    {
      pattern: /nallur kovil|nallur kovil/i,
      text:
        "Nallur Kovil is one of the most important Hindu temples in Sri Lanka, dedicated to Lord Murugan. The temple features a magnificent golden gopuram (tower), daily pujas, traditional Tamil ceremonies and a large annual festival drawing thousands of devotees.",
    },
    {
      pattern: /jaffna public library|public library/i,
      text:
        "The Jaffna Public Library is a cultural symbol of the region, known for classical architecture and a once-vast collection of books. Destroyed in 1981 and rebuilt, it stands for knowledge, resilience and the intellectual history of northern Sri Lanka.",
    },
    {
      pattern: /casuarina beach/i,
      text:
        "Casuarina Beach on Karainagar Island is famed for Casuarina trees lining the shore, shallow calm waters and powdery sands — a clean, family-friendly beach ideal for swimming and relaxation.",
    },
    {
      pattern: /keerimalai|keerimalai holy springs/i,
      text:
        "Keerimalai Holy Springs are natural freshwater springs adjacent to the sea, believed to have healing powers. The sacred bathing pool and nearby temples attract pilgrims and visitors for ritual bathing.",
    },
    {
      pattern: /nagadeepa|nagadeepa temple|nainativu/i,
      text:
        "Nagadeepa Temple on Nainativu Island is an important Buddhist pilgrimage site said to have been visited by the Buddha. Accessible by boat, the island hosts sacred shrines and a serene pilgrimage atmosphere.",
    },
    {
      pattern: /delft island|delft/i,
      text:
        "Delft Island is a remote island with Dutch colonial remnants, baobab trees, wild horses and salt plains. Its rugged, sparsely populated landscape offers a step-back-in-time experience.",
    },
    {
      pattern: /nagarkovil|nagar kovil/i,
      text:
        "Nagarkovil (Nagar Kovil) Beach is a quiet stretch known for clear waters and serene surroundings — popular for evening walks and local fishing activities.",
    },
    {
      pattern: /point pedro/i,
      text:
        "Point Pedro is the northernmost point of Sri Lanka, marked by a lighthouse and coastal viewpoint; the area features traditional fishing villages and open ocean horizons.",
    },
    {
      pattern: /charty beach|charty jetty/i,
      text:
        "Charty Beach (Charty Jetty Beach) is a picturesque local beach near Jaffna, ideal for swimming, relaxing and enjoying sunsets in a quiet setting.",
    },
    {
      pattern: /mannar island|mannar/i,
      text:
        "Mannar Island is a large dry-zone island connected by causeway, offering birdwatching, historical sites, salt pans and coastal habitats — a rewarding spot for nature and history lovers.",
    },
    {
      pattern: /doric at arippu|arippu/i,
      text:
        "Doric at Arippu are the ruins of the first British governor’s residence built in the early 1800s; the crumbling coastal structure and ocean views make it a photogenic historical site.",
    },
    {
      pattern: /thiruketheeswaram|thiruketheeswaram temple/i,
      text:
        "Thiruketheeswaram Temple is a sacred Hindu shrine dedicated to Lord Shiva, with ancient roots in Tamil devotional tradition and ongoing ritual practices attracting pilgrims.",
    },
    {
      pattern: /adam'?s\s*bridge|rama'?s\s*bridge/i,
      text:
        "Adam’s Bridge (Rama’s Bridge) is a chain of submerged sandbars and shoals between Mannar and India, steeped in myth and natural history; it’s a striking feature for photography and coastal ecology.",
    },
    {
      pattern: /mullaitivu beach/i,
      text:
        "Mullaitivu Beach is a quiet, largely undeveloped coastline with wide sands and strong waves — a reflective place for long walks and coastal scenery.",
    },
    {
      pattern: /vavuniya archaeological museum|vavuniya museum/i,
      text:
        "Vavuniya Archaeological Museum displays artifacts from northern civilizations including pottery, coins and inscriptions that highlight the region’s multicultural past.",
    },
    {
      pattern: /wilpattu/i,
      text:
        "Wilpattu National Park is Sri Lanka’s largest and one of its oldest national parks, famous for its natural ‘Willus’ (rainwater lakes), diverse wildlife including leopards, elephants, sloth bears, crocodiles and over 200 bird species. Safaris here are quieter and more immersive than other parks.",
    },
    {
      pattern: /kalpitiya/i,
      text:
        "Kalpitiya is an unspoiled coastal region known for calm beaches, world-class kitesurfing (May–September), dolphin and whale watching in the lagoon, and a relaxed eco-resort atmosphere blending naturally with the environment.",
    },
    {
      pattern: /kalpitiya lagoon|dolphin/i,
      text:
        "Kalpitiya Lagoon is a top destination for wild dolphin watching, especially spinner dolphins. Early-morning boat tours often encounter large pods and the area also offers kayaking and calm waters for paddle sports.",
    },
    {
      pattern: /kalpitiya dutch fort|kalpitiya fort/i,
      text:
        "The Kalpitiya Dutch Fort, built in the 17th century, features coral-stone walls and bastions used historically to control trade across the lagoon; it offers a compact but insightful look into colonial maritime history.",
    },
    {
      pattern: /munneswaram temple|munneshwaram/i,
      text:
        "Munneswaram Temple is a major Hindu pilgrimage complex dedicated mainly to Lord Shiva, with a history spanning centuries and rich festival traditions including the vibrant Munneswaram Festival.",
    },
    {
      pattern: /chilaw beach|chilaw/i,
      text:
        "Chilaw Beach is a local favorite near the town of Chilaw, offering calm seas, evening strolls and scenic sunsets often visited alongside nearby Munneswaram Temple.",
    },
    {
      pattern: /kudawa/i,
      text:
        "Kudawa Beach (Kalpitiya) is a popular kitesurfing spot with seasonal winds, lagoon views and a laid-back adventure atmosphere supported by kite schools and eco-lodges.",
    },
    {
      pattern: /yapahuwa/i,
      text:
        "Yapahuwa Rock Fortress was a 13th-century capital built atop a granite rock with a dramatic steep staircase leading to palace ruins, carvings and panoramic summit views — an impressive archaeological site.",
    },
    {
      pattern: /kurunegala lake/i,
      text:
        "Kurunegala Lake is an urban reservoir with walking paths, landscaped areas and viewpoints; locals enjoy evening strolls, jogging and dining near the lakeside restaurants.",
    },
    {
      pattern: /athugala|elephant rock/i,
      text:
        "Athugala (Elephant Rock) is a massive hill resembling a resting elephant, with a climb to a white Buddha and panoramic views of Kurunegala and surrounding countryside.",
    },
    {
      pattern: /panduwasnuwara/i,
      text:
        "Panduwasnuwara Ruins are the remains of an ancient capital featuring palaces, moats, monasteries and stone foundations that offer a quiet glimpse into early Sri Lankan royal civilization.",
    },
    {
      pattern: /ridi viharaya|ridi/i,
      text:
        "Ridi Viharaya (Silver Temple) is an ancient temple complex with frescoes, carved stairways, rock caves and image houses, historically tied to the Ruwanweliseya construction through silver offerings.",
    },
    {
      pattern: /munneshwaram kali|kali kovil/i,
      text:
        "Munneshwaram Kali Kovil (Kali Kovil) is part of the Munneswaram complex dedicated to Goddess Kali; it’s known for vibrant rituals, drumming and devotional festivals.",
    },
  ];

  const getFallback = (name: string) => {
    const key = normalizeForKey(name || '');
    if (manualTextOverrides[key]) return manualTextOverrides[key];
    const found = fallbackDescriptions.find((f) => f.pattern.test(name));
    return found ? found.text : null;
  };

  const displayDescription = destination.description || getFallback(destination.name);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-16">
        {/* Hero Image */}
        <div className="relative h-96 bg-gray-50">
          {primaryImageUrl && (
            <img
              src={primaryImageUrl}
              alt={destination.name}
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-4 -mt-32 relative z-10 pb-12">
          <Link to="/destinations">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Destinations
            </Button>
          </Link>

          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="mb-6">
                <h1 className="text-4xl font-bold mb-3">{destination.name}</h1>
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <span>{destination.provinces.name}</span>
                  </div>
                  {destination.opening_hours && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span>{destination.opening_hours}</span>
                    </div>
                  )}
                  {destination.total_reviews > 0 && (
                    <div className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-secondary fill-secondary" />
                      <span className="font-semibold text-foreground">
                        {destination.average_rating.toFixed(1)}
                      </span>
                      <span>({destination.total_reviews} reviews)</span>
                    </div>
                  )}
                </div>
              </div>

              {destination.destination_categories.length > 0 && (
                <div className="mb-6">
                  <div className="flex flex-wrap gap-2">
                    {destination.destination_categories.map((cat, idx) => (
                      <Badge key={idx} variant="secondary">
                        {cat.categories.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {displayDescription && (
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold mb-3">About</h2>
                  <p className="text-muted-foreground leading-relaxed">{displayDescription}</p>
                </div>
              )}

              {/* Gallery removed: gallery images caused wrong pictures. */}

              <Separator className="my-8" />

              {/* Reviews Section */}
              <div>
                <h2 className="text-2xl font-semibold mb-6">Reviews & Ratings</h2>
                
                <div className="mb-8">
                  <ReviewForm
                    destinationId={id}
                    existingReview={editingReview}
                    onSuccess={() => {
                      setEditingReview(null);
                      fetchDestination();
                    }}
                  />
                </div>

                <ReviewsList
                  destinationId={id}
                  onEditReview={(review) => setEditingReview(review)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DestinationDetail;
