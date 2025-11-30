import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';

type Destination = {
  id: string;
  name: string;
  description: string | null;
  location_lat: number | null;
  location_lng: number | null;
  average_rating: number;
  total_reviews: number;
  provinces: {
    name: string;
  };
};

type DestinationsMapProps = {
  destinations: Destination[];
};

const DestinationsMap = ({ destinations }: DestinationsMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const navigate = useNavigate();

  // Get Mapbox token from environment
  const mapboxToken = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    // Initialize map centered on Sri Lanka
    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [80.7718, 7.8731], // Sri Lanka center
      zoom: 7,
      pitch: 0,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Cleanup
    return () => {
      markers.current.forEach(marker => marker.remove());
      markers.current = [];
      map.current?.remove();
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Filter destinations that have coordinates
    const destinationsWithCoords = destinations.filter(
      dest => dest.location_lat && dest.location_lng
    );

    if (destinationsWithCoords.length === 0) {
      // If no destinations have coordinates, show a message
      return;
    }

    // Add markers for each destination
    destinationsWithCoords.forEach((destination) => {
      if (!destination.location_lat || !destination.location_lng) return;

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.style.cssText = `
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        border: 3px solid white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
      `;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.2)';
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });

      // Create popup
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: false,
        className: 'custom-popup'
      }).setHTML(`
        <div style="padding: 8px; min-width: 200px;">
          <h3 style="font-weight: 600; font-size: 16px; margin-bottom: 8px; color: #1a1a1a;">
            ${destination.name}
          </h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 8px;">
            ${destination.provinces.name}
          </p>
          ${destination.total_reviews > 0 ? `
            <div style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: #666;">
              <span style="color: #f59e0b;">⭐</span>
              <span style="font-weight: 600;">${destination.average_rating.toFixed(1)}</span>
              <span>(${destination.total_reviews} reviews)</span>
            </div>
          ` : ''}
          <p style="font-size: 11px; color: #999; margin-top: 8px;">Click to view details</p>
        </div>
      `);

      // Create marker
      const marker = new mapboxgl.Marker(el)
        .setLngLat([destination.location_lng, destination.location_lat])
        .setPopup(popup)
        .addTo(map.current!);

      // Navigate to destination detail on click
      el.addEventListener('click', () => {
        navigate(`/destination/${destination.id}`);
      });

      markers.current.push(marker);
    });

    // Fit bounds to show all markers
    if (destinationsWithCoords.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      destinationsWithCoords.forEach(dest => {
        if (dest.location_lng && dest.location_lat) {
          bounds.extend([dest.location_lng, dest.location_lat]);
        }
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 12 });
    }
  }, [destinations, mapLoaded, navigate]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
        <p className="text-muted-foreground">Map token not configured</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-[600px] rounded-lg shadow-lg" />
      {mapLoaded && destinations.filter(d => d.location_lat && d.location_lng).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <div className="text-center p-6">
            <p className="text-lg font-semibold mb-2">No locations available yet</p>
            <p className="text-muted-foreground">
              Destination coordinates will be displayed on the map once they're added
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DestinationsMap;
