import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Star } from "lucide-react";
import Navbar from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Province = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
};

type Destination = {
  id: string;
  name: string;
  description: string | null;
  province_id: string;
  location_lat: number | null;
  location_lng: number | null;
  average_rating: number;
  total_reviews: number;
  provinces: Province;
  destination_images?: Array<{
    image_url: string;
    is_primary?: boolean;
    caption?: string | null;
  }>;
};

const Destinations = () => {
  // Load local pictures from src/pictures and src/assets/destinations using Vite's glob
  // These are used as fallbacks when the DB has no images.
  const _localImages = {
    ...import.meta.glob('/src/pictures/**/*.{jpg,jpeg,png,webp,gif}', { as: 'url', eager: true }),
    ...import.meta.glob('/src/assets/destinations/*.{jpg,jpeg,png,webp,gif}', { as: 'url', eager: true }),
  } as Record<string, string>;

  const normalizeForKey = (s: string) =>
    String(s || '')
      .normalize('NFKD')
      .replace(/['’`\u2019]/g, "")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

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

  // DEV: print available local image entries and their normalized keys to help debugging
  if (import.meta.env && import.meta.env.DEV) {
    try {
      // Log a concise list of filename -> key mappings
      console.debug(
        'localImageEntries:',
        localImageEntries.map((e) => ({ filename: e.filename, key: e.key, path: e.path }))
      );
    } catch (err) {
      /* ignore */
    }
  }

  const findLocalImages = (name: string) => {
    const key = normalizeForKey(name);
    return localImageEntries.filter((e) => e.key.includes(key)).map((e) => e.url);
  };

  const findProvinceImage = (provinceName: string | null | undefined) => {
    if (!provinceName) return null;
    const pKey = normalizeForKey(provinceName);
    const found = localImageEntries.find((e) => {
      // Prefer images located in a folder matching the province name
      const pathLower = String(e.path).toLowerCase();
      if (provinceName && pathLower.includes(provinceName.toLowerCase())) return true;
      // Fallback: match by normalized key
      return e.key.includes(pKey);
    });
    return found ? found.url : null;
  };

  // Manual overrides for destinations with ambiguous filenames or wrong matches
  const findManualOverride = (name: string) => {
    const key = normalizeForKey(name || '');
    // Aluvihare Temple: prefer the specific picture file in Central Province
    if (/aluvihare/.test(key) || /aluviharetemple/.test(key) || /aluvihare\stemple/.test(key)) {
      const found = localImageEntries.find((e) => e.filename.toLowerCase().includes('aluvihare'));
      return found ? found.url : null;
    }
    // Horton Plains: prefer the picture in `src/pictures/New folder/horton plains.jpg` if available
    if (/horton plains|world's end|worlds end/i.test(name)) {
      const found = localImageEntries.find((e) => /horton ?plains/i.test(e.filename) && /pictures/i.test(String(e.path)));
      if (found) return found.url;
    }
    return null;
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProvinces();
    fetchDestinations();
  }, []);

  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from("provinces")
        .select("*")
        .order("name");

      if (error) throw error;
      setProvinces(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load provinces",
        variant: "destructive",
      });
    }
  };

  const fetchDestinations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("destinations")
        .select(`
          *,
          provinces (*),
          destination_images (image_url, is_primary, caption)
        `)
        .order("name");

      if (error) throw error;
      const rows = data || [];

      // 1) Drop 'Colombo Lotus Tower' when a generic 'Lotus Tower' exists
      const hasGenericLotus = rows.some((r: any) => /\blotus tower\b/i.test(String(r.name || '')) && !/\bcolombo\b/i.test(String(r.name || '')));
      let cleaned = rows.filter((r: any) => {
        const name = String(r.name || '');
        if (/\blotus\b/i.test(name) && /\bcolombo\b/i.test(name) && hasGenericLotus) {
          return false; // drop Colombo Lotus Tower when generic Lotus Tower exists
        }
        return true;
      });

      // 2) Drop duplicates like 'Temple of the Tooth Relic' when a canonical 'Temple of the Tooth' exists
      const hasGenericTooth = cleaned.some((r: any) => {
        const name = String(r.name || '');
        return /\btooth\b/i.test(name) && /temple/i.test(name) && !/relic/i.test(name);
      });
      if (hasGenericTooth) {
        cleaned = cleaned.filter((r: any) => {
          const name = String(r.name || '');
          if (/\btooth\b/i.test(name) && /relic/i.test(name)) {
            return false; // drop the 'tooth relic' variant
          }
          return true;
        });
      }

      // 3) Prefer 'Munneshwaram Kali Kovil' over generic 'Munneshwaram Temple'
      // match both common spellings 'munneshwaram' and 'munneswaram'
      const munnesPattern = /munneshwaram|munneswaram/i;
      const hasMunneshwaramKali = cleaned.some((r: any) => munnesPattern.test(String(r.name || '')) && /kali|kovil/i.test(String(r.name || '')));
      if (hasMunneshwaramKali) {
        cleaned = cleaned.filter((r: any) => {
          const name = String(r.name || '');
          // drop generic Munneshwaram/Munneswaram entries that explicitly mention 'temple'
          // and do not reference Kali/Kovil when a Kali record exists
          if (munnesPattern.test(name) && /temple/i.test(name) && !/kali|kovil/i.test(name)) return false;
          return true;
        });
      }

      setDestinations(cleaned);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load destinations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDestinations = destinations.filter((dest) => {
    const matchesSearch = dest.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesProvince = selectedProvince
      ? dest.province_id === selectedProvince
      : true;
    return matchesSearch && matchesProvince;
  });

  // UI-only deduplication: group by normalized name and keep the best-scored entry per group
  const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  const dedupeDestinations = (items: Destination[]) => {
    const groups: Record<string, Destination[]> = {};
    items.forEach((d) => {
      const key = normalize(d.name || '');
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    });

    const chosen: Destination[] = [];
    Object.values(groups).forEach((list) => {
      if (list.length === 1) {
        chosen.push(list[0]);
        return;
      }
      const scored = list.map((item) => {
        let score = 0;
        if (item.description && String(item.description).trim().length > 0) score += 2;
        if (item.province_id) score += 1;
        // Prefer records that have a top-level image_url or destination_images entries
        if ((item as any).image_url) score += 2;
        if ((item as any).destination_images && (item as any).destination_images.length > 0) score += 3;
        if (item.location_lat || item.location_lng) score += 1;
        return { item, score };
      });
      scored.sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.item.id || '').localeCompare(String(b.item.id || ''));
      });
      chosen.push(scored[0].item);
    });

    // Preserve original ordering as much as possible by sorting chosen items by their index in the original array
    const indexMap = new Map(items.map((it, idx) => [it.id, idx]));
    chosen.sort((a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0));
    return chosen;
  };

  const displayDestinations = dedupeDestinations(filteredDestinations);

  const fallbackSnippets: { pattern: RegExp; text: string }[] = [
    {
      pattern: /galle face/i,
      text:
        "Galle Face Green — oceanfront promenade popular for evening walks, street food like isso wade and kottu, kite flying, and sunsets.",
    },
    {
      pattern: /lotus tower/i,
      text:
        "Lotus Tower — 350m landmark with a panoramic observation deck, dining, exhibitions, and colorful night lighting.",
    },
    {
      pattern: /independence square|independence arcade/i,
      text:
        "Independence Square — a national monument with peaceful gardens and the nearby Independence Arcade of shops and restaurants.",
    },
    {
      pattern: /colombo national museum|national museum/i,
      text:
        "National Museum — showcases Sri Lanka’s heritage with royal regalia, statues, and shaded grounds for educational visits.",
    },
    {
      pattern: /dutch hospital/i,
      text:
        "Dutch Hospital — restored colonial precinct now a lively dining and shopping complex with preserved architecture.",
    },
    {
      pattern: /mount lavinia/i,
      text:
        "Mount Lavinia Beach — golden sand shore known for seafood restaurants, swimming, and vibrant nightlife.",
    },
    {
      pattern: /dehiwala zoo|zoo/i,
      text:
        "Dehiwala Zoo — historic zoological garden with diverse animals, daily shows, and a butterfly garden.",
    },
    {
      pattern: /diyatha uyana/i,
      text:
        "Diyatha Uyana — lakeside park with walking paths, ponds, open-air restaurants, and a weekend market.",
    },
    {
      pattern: /beddagana/i,
      text:
        "Beddagana Wetland Park — conserved wetland with elevated paths for birdwatching and nature walks.",
    },
    {
      pattern: /attidiya/i,
      text:
        "Attidiya Bird Sanctuary — wetland sanctuary ideal for birdwatching and peaceful nature visits.",
    },
    {
      pattern: /kelaniya|kelaniya raja maha viharaya/i,
      text:
        "Kelaniya Temple — sacred site known for stunning murals and annual Duruthu Perahera procession.",
    },
    {
      pattern: /negombo beach/i,
      text:
        "Negombo Beach — long sandy coastline popular for sunsets, water sports and nearby markets.",
    },
    {
      pattern: /negombo lagoon/i,
      text:
        "Negombo Lagoon — expansive brackish-water ecosystem with mangroves and boat tours.",
    },
    {
      pattern: /hamilton canal/i,
      text:
        "Hamilton Canal — colonial-era canal offering scenic boat rides and views of village life.",
    },
    {
      pattern: /muthurajawela/i,
      text:
        "Muthurajawela Wetlands — vast wetland ecosystem with rich biodiversity and boat tour options.",
    },
    {
      pattern: /kalutara bodhiya|kalutara temple/i,
      text:
        "Kalutara Bodhiya — riverside Buddhist shrine with a large white stupa and devotional atmosphere.",
    },
    {
      pattern: /richmond castle/i,
      text:
        "Richmond Castle — elegant early 1900s mansion notable for carved woodwork and picturesque gardens.",
    },
    {
      pattern: /kalutara beach/i,
      text:
        "Kalutara Beach — wide sandy beach popular for resorts and peaceful seaside relaxation.",
    },
    {
      pattern: /moragalla/i,
      text:
        "Moragalla Beach — calm shallow beach ideal for snorkeling and peaceful escapes.",
    },
    {
      pattern: /barberyn|beruwala lighthouse|barberyn island/i,
      text:
        "Beruwala (Barberyn) Island — historic lighthouse island accessible by a short boat ride.",
    },
    {
      pattern: /kande viharaya/i,
      text:
        "Kande Viharaya — large temple famous for its giant Buddha statue and meditation spaces.",
    },
    {
      pattern: /thudugala/i,
      text:
        "Thudugala Waterfall — a scenic waterfall with a shallow natural pool and forest trails.",
    },
    {
      pattern: /horana lakshapana|lakshapana tea museum/i,
      text:
        "Horana Lakshapana Tea Museum — museum showcasing the tea industry and tasting experiences.",
    },
    {
      pattern: /temple of the tooth|dalada maligawa|tooth relic/i,
      text:
        "Temple of the Tooth — Sri Dalada Maligawa, a sacred Kandyan temple housing the tooth relic and hosting the Esala Perahera festival.",
    },
    {
      pattern: /kandy lake|sea of milk/i,
      text:
        "Kandy Lake — scenic lakeside walkway ideal for peaceful walks, birdwatching and photography in the heart of Kandy.",
    },
    {
      pattern: /peradeniya botanical|peradeniya garden/i,
      text:
        "Peradeniya Botanical Garden — Sri Lanka’s largest botanical garden with orchids, Royal Palms and ancient fig trees.",
    },
    {
      pattern: /udawatte kele|udawatta kele/i,
      text:
        "Udawatte Kele — historic forest reserve behind the Temple of the Tooth with shaded trails and diverse birdlife.",
    },
    {
      pattern: /knuckles|knuckles mountain/i,
      text:
        "Knuckles Range — misty peaks and deep valleys offering hiking routes, waterfalls and cloud-forest scenery.",
    },
    {
      pattern: /hunnasgiriya/i,
      text:
        "Hunnasgiriya — cool mountain offering panoramic views of tea plantations and a peaceful hiking spot.",
    },
    {
      pattern: /sembuwatta/i,
      text:
        "Sembuwatta Lake — picturesque man-made lake with turquoise water, pine forests and paddle boating options.",
    },
    {
      pattern: /ambuluwawa/i,
      text:
        "Ambuluwawa Tower — spiral tower with a biodiversity complex and panoramic 360° views after a short climb.",
    },
    {
      pattern: /riverston/i,
      text:
        "Riverston — windy scenic plateau in the Knuckles region known for dramatic viewpoints and photography.",
    },
    {
      pattern: /bambarakiri|bambarakiri ella/i,
      text:
        "Bambarakiri Ella — picturesque waterfall with a hanging bridge and lush surroundings.",
    },
    {
      pattern: /nalanda gedige/i,
      text:
        "Nalanda Gedige — ancient stone temple blending Hindu and Buddhist styles with mysterious ruins.",
    },
    {
      pattern: /balangoda|fa\-?hien|fa hien|fa-hien cave|fa hien cave/i,
      text:
        "Balangoda Caves (Fa-Hien Cave) — major prehistoric cave site where evidence of early human settlement (the ‘Balangoda Man’) and tools dating back over 38,000 years were found; dramatic rock overhang and forest setting make it an important archaeological and heritage site.",
    },
    {
      pattern: /bogoda|bogoda wooden bridge/i,
      text:
        "Bogoda Wooden Bridge — one of Sri Lanka’s oldest surviving timber bridges dating to the Kandyan era; built without nails and featuring carved wooden pillars beside the historic Bogoda Raja Maha Viharaya.",
    },
    {
      pattern: /(?:abha?ya(?:giri|giriya)|abayagiri|abhayagiri)(?:\s*(?:stupa|vihara|temple|monastery))?/i,
      text:
        "Abhayagiri Stupa — sprawling monastery complex once home to thousands of monks, notable for its massive stupa, ornate carvings, and ancient monastic ruins reflecting its role as a major Buddhist university.",
    },
    {
      pattern: /aluvihare|aluvihare rock temple/i,
      text:
        "Aluvihare Rock Temple — historic cave temple where the Tripitaka was first written down on palm leaves.",
    },
    {
      pattern: /avukana|aukana|avukana buddha|aukana buddha|avukana statue/i,
      text:
        "Avukana Buddha Statue — a 40-foot granite standing Buddha from the 5th century, famed for its exquisite carving, Asisa Mudra posture, and serene setting near Kala Wewa.",
    },
    {
      pattern: /matale spice|spice gardens/i,
      text:
        "Matale Spice Gardens — guided spice tours showcasing cinnamon, pepper, cardamom and local Ayurvedic products.",
    },
    {
      pattern: /anuradhapura|anuradhapura sacred city/i,
      text:
        "Anuradhapura Sacred City — ancient royal capital founded in the 4th century BC, home to massive stupas, monastic complexes, and the Jaya Sri Maha Bodhi; a UNESCO World Heritage Site and major pilgrimage center.",
    },
    {
      pattern: /nuwara eliya|little england/i,
      text:
        "Nuwara Eliya — cool hill station with colonial charm, tea plantations and well-kept gardens.",
    },
    {
      pattern: /horton plains|world's end|worlds end/i,
      text:
        "Horton Plains — national park with misty grasslands and ‘World’s End’ cliff offering dramatic highland views.",
    },
    {
      pattern: /gregory lake/i,
      text:
        "Gregory Lake — central reservoir in Nuwara Eliya with boat rides, water sports and lakeside recreation.",
    },
    {
      pattern: /victoria park/i,
      text:
        "Victoria Park — historic garden with colorful seasonal flowers and good birdwatching opportunities.",
    },
    {
      pattern: /lovers' leap|lovers leap/i,
      text:
        "Lovers’ Leap Waterfall — tall waterfall with scenic views and a romantic local legend.",
    },
    {
      pattern: /moon plains/i,
      text:
        "Moon Plains — open grasslands with panoramic mountain views and a ‘Mini World’s End’ viewpoint.",
    },
    {
      pattern: /bomburu ella/i,
      text:
        "Bomburu Ella — wide multi-cascade waterfall reached by a scenic hike through forests and streams.",
    },
    {
      pattern: /bopath\s*ella|bopaths?el?la/i,
      text:
        'Bopath Ella is a beautiful waterfall in Rathnapura, named for its unique shape that resembles a "Bo leaf," making it one of Sri Lanka\'s most recognizable natural attractions. The waterfall cascades down a narrow stream that widens dramatically as it drops, creating a powerful and picturesque flow. Surrounded by lush forest and local village life, it is easily accessible and a popular stop for nature lovers. Today, Bopath Ella is both a scenic getaway and an important eco-tourism spot in the Sabaragamuwa region.',
    },
    {
      pattern: /st\. clair|devon falls|st clair/i,
      text:
        "St. Clair’s & Devon Falls — two iconic waterfalls offering dramatic photographic vantage points.",
    },
    {
      pattern: /pidurutalagala|mount pidurutalagala/i,
      text:
        "Pidurutalagala — Sri Lanka’s highest mountain with restricted access but exceptional highland views on clear days.",
    },
    {
      pattern: /ramboda falls/i,
      text:
        "Ramboda Falls — scenic multi-tiered waterfall near the Ramboda Pass surrounded by tea estates.",
    },
    {
      pattern: /bluefield|pedro tea|pedro estate/i,
      text:
        "Bluefield & Pedro Tea Estates — tea plantations offering tours, tastings and panoramic hill views.",
    },
    {
      pattern: /galle fort/i,
      text:
        "Galle Fort — UNESCO World Heritage Site with cobbled streets, museums, boutique cafes and ocean ramparts ideal for sunset walks.",
    },
    {
      pattern: /unawatuna/i,
      text:
        "Unawatuna Beach — golden sand and calm shallow seas ideal for swimming, snorkeling and lively beachfront dining.",
    },
    {
      pattern: /jungle beach/i,
      text:
        "Jungle Beach — secluded cove with turquoise water perfect for snorkeling and relaxing away from crowds.",
    },
    {
      pattern: /japanese peace pagoda/i,
      text:
        "Japanese Peace Pagoda — serene white stupa offering panoramic coastal views between Unawatuna and Jungle Beach.",
    },
    {
      pattern: /koggala lake|koggala/i,
      text:
        "Koggala Lake — scenic freshwater lake with cinnamon islands, spice gardens and birdwatching boat rides.",
    },
    {
      pattern: /mirissa/i,
      text:
        "Mirissa Beach — crescent-shaped beach known for turquoise water, whale-watching tours, surfing and vibrant nightlife.",
    },
    {
      pattern: /secret beach/i,
      text:
        "Secret Beach — quiet hidden beach with coconut trees, lagoons and natural pools near Mirissa.",
    },
    {
      pattern: /coconut hill/i,
      text:
        "Coconut Hill — iconic headland lined with leaning coconut palms offering dramatic sunset photos.",
    },
    {
      pattern: /whale watching|mirissa whale/i,
      text:
        "Whale Watching (Mirissa) — world-class whale and dolphin tours departing early morning during peak season.",
    },
    {
      pattern: /hikkaduwa coral|hikkaduwa coral sanctuary/i,
      text:
        "Hikkaduwa Coral Sanctuary — protected reef offering snorkeling with colorful corals and tropical fish.",
    },
    {
      pattern: /hikkaduwa beach/i,
      text:
        "Hikkaduwa Beach — surfing, seafood dining and a lively coastal scene popular with many travelers.",
    },
    {
      pattern: /dodanduwa/i,
      text:
        "Dodanduwa Turtle Hatchery — conservation site protecting turtle eggs and releasing hatchlings to the sea.",
    },
    {
      pattern: /tangalle/i,
      text:
        "Tangalle Beach — long quiet coastline with turquoise water and luxurious resorts for peaceful stays.",
    },
    {
      pattern: /rekawa/i,
      text:
        "Rekawa Turtle Nesting Beach — important nesting site where guided night tours reveal turtle conservation in action.",
    },
    {
      pattern: /mulkirigala/i,
      text:
        "Mulkirigala Rock Temple — ancient cave-temple complex atop a towering rock with murals and summit views.",
    },
    {
      pattern: /kalametiya/i,
      text:
        "Kalametiya Bird Sanctuary — coastal wetland with mangroves and over 150 bird species, ideal for boat safaris.",
    },
    {
      pattern: /ridgeway safari|hambantota ridgeway/i,
      text:
        "Ridgeway Safari (Hambantota) — open-landscape safari for birds, deer and occasionally elephants away from crowded parks.",
    },
    {
      pattern: /bundala/i,
      text:
        "Bundala National Park — UNESCO biosphere reserve noted for flamingos, storks, elephants and abundant birdlife.",
    },
    {
      pattern: /yala national park/i,
      text:
        "Yala National Park — premier wildlife park famous for leopard sightings and diverse fauna on guided safaris.",
    },
    {
      pattern: /kirinda/i,
      text:
        "Kirinda Beach & Temple — coastal shrine on rocky cliffs with sweeping ocean views and a quiet nearby beach.",
    },
    {
      pattern: /hambantota birds research|hambantota birds/i,
      text:
        "Hambantota Birds Research Center — bird conservation and research facility promoting endangered species protection.",
    },
    {
      pattern: /nilaveli/i,
      text:
        "Nilaveli Beach — long soft white sands and calm turquoise waters ideal for swimming, snorkeling and relaxed family beach days.",
    },
    {
      pattern: /uppuveli/i,
      text:
        "Uppuveli — laid-back beach near Trincomalee popular with divers, backpackers and relaxed seaside dining.",
    },
    {
      pattern: /pigeon island/i,
      text:
        "Pigeon Island — marine park off Nilaveli with coral reefs, colorful fish and excellent snorkeling.",
    },
    {
      pattern: /koneswaram/i,
      text:
        "Koneswaram Temple — dramatic cliff-top Hindu temple with breathtaking sea views and rich mythology.",
    },
    {
      pattern: /fort frederick/i,
      text:
        "Fort Frederick — colonial fort housing Koneswaram Temple with historic bastions and coastal views.",
    },
    {
      pattern: /marble beach/i,
      text:
        "Marble Beach — pristine glass-clear bay managed by the Air Force, perfect for quiet swimming and relaxation.",
    },
    {
      pattern: /trincomalee hot wells|hot wells/i,
      text:
        "Trincomalee Hot Wells — seven natural hot water wells known for varied temperatures and cultural bathing rituals.",
    },
    {
      pattern: /pasikuda|pasikudah/i,
      text:
        "Pasikuda — shallow, family-friendly lagoon waters stretching far out to sea with luxury resorts and watersports.",
    },
    {
      pattern: /kalkuda/i,
      text:
        "Kalkuda — a quieter beach south of Pasikuda with wide sands and calm seas for long walks and sunsets.",
    },
    {
      pattern: /batticaloa lagoon/i,
      text:
        "Batticaloa Lagoon — large mangrove-rich lagoon famous for the ‘singing fish’ and boat tours of islands and birdlife.",
    },
    {
      pattern: /batticaloa fort/i,
      text:
        "Batticaloa Fort — 17th-century fort with colonial bastions and scenic waterfront views between lagoon and sea.",
    },
    {
      pattern: /arugam bay/i,
      text:
        "Arugam Bay — world-class surf destination with top right-hand breaks attracting surfers and backpackers.",
    },
    {
      pattern: /elephant rock/i,
      text:
        "Elephant Rock — scenic granite viewpoint at Arugam Bay with great sunset views and nearby wildlife sightings.",
    },
    {
      pattern: /peanut farm beach/i,
      text:
        "Peanut Farm Beach — secluded natural beach south of Arugam Bay good for surfing and camping.",
    },
    {
      pattern: /kumana/i,
      text:
        "Kumana National Park — bird-rich sanctuary and wildlife park with wetlands, lagoons and coastal biodiversity.",
    },
    {
      pattern: /okanda/i,
      text:
        "Okanda — sacred beach and temple on pilgrimage routes with rugged coastal scenery.",
    },
    {
      pattern: /gal oya/i,
      text:
        "Gal Oya — unique park with boat safaris where elephants swim between islands in the reservoir.",
    },
    {
      pattern: /senanayake samudraya/i,
      text:
        "Senanayake Samudraya — the nation’s largest reservoir used for boating, wildlife observation and scenic photography.",
    },
    {
      pattern: /jaffna fort|jaffna/i,
      text:
        "Jaffna Fort — large, well-preserved colonial fort with star-shaped ramparts and lagoon views.",
    },
    {
      pattern: /nallur kovil/i,
      text:
        "Nallur Kovil — important Hindu temple with a golden gopuram, daily pujas and major annual festivals.",
    },
    {
      pattern: /jaffna public library|public library/i,
      text:
        "Jaffna Public Library — rebuilt cultural landmark symbolizing knowledge and resilience.",
    },
    {
      pattern: /casuarina beach/i,
      text:
        "Casuarina Beach — family-friendly shallow waters and powdery sands lined by Casuarina trees.",
    },
    {
      pattern: /keerimalai/i,
      text:
        "Keerimalai Holy Springs — natural freshwater springs with sacred bathing pools believed to have healing powers.",
    },
    {
      pattern: /nagadeepa|nainativu/i,
      text:
        "Nagadeepa Temple — sacred Buddhist island shrine accessible by boat with deep religious significance.",
    },
    {
      pattern: /delft island/i,
      text:
        "Delft Island — remote island with baobabs, wild horses and Dutch-era remnants.",
    },
    {
      pattern: /nagarkovil|nagar kovil/i,
      text:
        "Nagarkovil — quiet coastal beach ideal for peaceful walks and local fishing scenes.",
    },
    {
      pattern: /point pedro/i,
      text:
        "Point Pedro — the northernmost point with lighthouse and coastal village scenery.",
    },
    {
      pattern: /charty beach|charty jetty/i,
      text:
        "Charty Beach — picturesque local beach near Jaffna with calm waters and sunsets.",
    },
    {
      pattern: /mannar island|mannar/i,
      text:
        "Mannar Island — dry-zone island with birdwatching, historical sites and salt pans.",
    },
    {
      pattern: /doric at arippu|arippu/i,
      text:
        "Doric at Arippu — ruins of an early British governor’s residence in a dramatic coastal setting.",
    },
    {
      pattern: /thiruketheeswaram/i,
      text:
        "Thiruketheeswaram — ancient Hindu temple with deep devotional importance and ancient traditions.",
    },
    {
      pattern: /adam'?s\s*bridge|rama'?s\s*bridge/i,
      text:
        "Adam’s Bridge — chain of sandbars and shoals between Mannar and India, notable for myth and coastal ecology.",
    },
    {
      pattern: /mullaitivu beach/i,
      text:
        "Mullaitivu Beach — quiet undeveloped coastline with expansive sands and strong waves.",
    },
    {
      pattern: /vavuniya archaeological museum|vavuniya museum/i,
      text:
        "Vavuniya Archaeological Museum — regional exhibits of pottery, inscriptions and archaeological finds.",
    },
    {
      pattern: /wilpattu/i,
      text:
        "Wilpattu National Park — large, lake-dotted wilderness famous for leopards, elephants, sloth bears and rich birdlife; safaris are quieter and more immersive.",
    },
    {
      pattern: /kalpitiya/i,
      text:
        "Kalpitiya — relaxed coastal region known for kitesurfing, peaceful beaches and dolphin-watching tours in the lagoon.",
    },
    {
      pattern: /kalpitiya lagoon|dolphin/i,
      text:
        "Kalpitiya Lagoon — prime dolphin-watching and paddle-sport waters with morning boat tours.",
    },
    {
      pattern: /kalpitiya dutch fort|kalpitiya fort/i,
      text:
        "Kalpitiya Dutch Fort — 17th-century coral-stone fort with colonial-era bastions and lagoon views.",
    },
    {
      pattern: /munneswaram|munneswaram temple/i,
      text:
        "Munneswaram Temple — major Hindu complex with rich festival traditions and pilgrimage activity.",
    },
    {
      pattern: /chilaw/i,
      text:
        "Chilaw Beach — local seaside spot for evening walks, picnics and scenic sunsets.",
    },
    {
      pattern: /kudawa/i,
      text:
        "Kudawa Beach — top kitesurfing spot within Kalpitiya with lagoon and island views.",
    },
    {
      pattern: /yapahuwa/i,
      text:
        "Yapahuwa Rock Fortress — 13th-century capital built on a granite rock with a steep stairway, palace ruins and summit panoramas.",
    },
    {
      pattern: /kurunegala lake/i,
      text:
        "Kurunegala Lake — urban reservoir with walking paths, viewpoints and nearby cafés.",
    },
    {
      pattern: /athugala|elephant rock/i,
      text:
        "Athugala (Elephant Rock) — iconic hill formation with a white Buddha statue and panoramic views of Kurunegala.",
    },
    {
      pattern: /panduwasnuwara/i,
      text:
        "Panduwasnuwara Ruins — ancient capital remains with palaces, monasteries and archaeological features.",
    },
    {
      pattern: /ridi viharaya|ridi/i,
      text:
        "Ridi Viharaya — historic Silver Temple with frescoes, rock caves and ancient image houses.",
    },
    {
      pattern: /munneshwaram kali|kali kovil/i,
      text:
        "Munneshwaram Kali Kovil — vibrant shrine within Munneswaram complex known for colorful rituals and festivals.",
    },
  ];

  // Manual text overrides keyed by normalized name (add more if needed)
  const manualTextOverrides: Record<string, string> = {
    // Diyaluma fallback exact override (normalized key)
    diyalumafalls: "Diyaluma Falls is the second-highest waterfall in Sri Lanka, cascading from a height of 220 meters. It is surrounded by stunning mountain scenery and lush greenery. A natural pool at the base and several rock pools along the way make it ideal for adventurous swims. The falls are also popular among hikers, offering breathtaking views from the top.",
  };

  const getSnippet = (name: string, provinceName?: string | null) => {
    const key = normalizeForKey(name || '');
    if (manualTextOverrides[key]) return manualTextOverrides[key];
    // try pattern matches against the name
    const found = fallbackSnippets.find((f) => f.pattern.test(name));
    if (found) return found.text;
    // try matching against the province name as a last-ditch pattern match
    if (provinceName) {
      const foundProv = fallbackSnippets.find((f) => f.pattern.test(provinceName));
      if (foundProv) return foundProv.text;
    }
    // as a final fallback, generate a short descriptive sentence so thumbnails never appear empty
    const shortProvince = provinceName ? ` in ${provinceName}` : '';
    return `Explore ${name}${shortProvince}. Discover highlights, local culture, and visitor tips for this destination.`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">
              Explore{" "}
              <span className="bg-gradient-tropical bg-clip-text text-transparent">
                Sri Lanka
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Discover amazing destinations across all provinces
            </p>
          </div>

          {/* Search Bar */}
          <div className="mb-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
              <Input
                type="text"
                placeholder="Search destinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-6 text-lg"
              />
            </div>
          </div>

          {/* Province Filter */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Filter by Province</h2>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={selectedProvince === null ? "default" : "outline"}
                className="cursor-pointer px-4 py-2"
                onClick={() => setSelectedProvince(null)}
              >
                All Provinces
              </Badge>
              {provinces.map((province) => (
                <Badge
                  key={province.id}
                  variant={selectedProvince === province.id ? "default" : "outline"}
                  className="cursor-pointer px-4 py-2"
                  onClick={() => setSelectedProvince(province.id)}
                >
                  {province.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Destinations Content */}
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading destinations...</p>
            </div>
          ) : filteredDestinations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                No destinations found. Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayDestinations.map((destination) => (
                <Link key={destination.id} to={`/destination/${destination.id}`}>
                  <Card className="overflow-hidden hover:shadow-card transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full">
                              {(() => {
                                // Prefer DB primary image (if any), then first DB image, then local match, then province fallback
                                const dbPrimary = destination.destination_images?.find((img) => img.is_primary)?.image_url;
                                const dbFirst = dbPrimary || destination.destination_images?.[0]?.image_url;
                                const manual = findManualOverride(destination.name);
                                const local = dbFirst || manual || findLocalImages(destination.name)[0] || findProvinceImage(destination.provinces.name);
                                if (local) {
                                  return (
                                    <div
                                      className="h-48 bg-cover bg-center"
                                      style={{ backgroundImage: `url(${local})` }}
                                    />
                                  );
                                }

                                // No matching image found — show a neutral light background instead of the green gradient
                                return <div className="h-48 bg-gray-100" />;
                              })()}
                    <CardContent className="p-6">
                      <h3 className="text-xl font-semibold mb-2">
                        {destination.name}
                      </h3>
                      <div className="flex items-center gap-2 text-muted-foreground mb-3">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">{destination.provinces.name}</span>
                      </div>
                      {(() => {
                        const snippet = destination.description || getSnippet(destination.name);
                        return snippet ? <p className="text-muted-foreground line-clamp-4 mb-3">{snippet}</p> : null;
                      })()}
                      {destination.total_reviews > 0 && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-secondary fill-secondary" />
                          <span className="font-semibold">
                            {destination.average_rating.toFixed(1)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({destination.total_reviews} reviews)
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Destinations;
