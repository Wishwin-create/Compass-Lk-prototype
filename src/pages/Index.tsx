import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Star, Calendar, Shield } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroImage from "@/assets/hero-sri-lanka.jpg";

const Index = () => {
  const features = [
    {
      icon: MapPin,
      title: "Discover Destinations",
      description: "Explore beautiful places across all provinces of Sri Lanka with detailed information and stunning imagery.",
    },
    {
      icon: Calendar,
      title: "Plan Your Journey",
      description: "Create personalized itineraries with destinations, activities, and accommodations tailored to your interests.",
    },
    {
      icon: Star,
      title: "Read Reviews",
      description: "Make informed decisions with ratings and reviews from travelers who've been there.",
    },
    {
      icon: Shield,
      title: "Trusted Platform",
      description: "Your travel companion for exploring Sri Lanka safely with up-to-date information.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Beautiful Sri Lankan landscape"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-foreground drop-shadow-lg">
            Discover the Pearl of the{" "}
            <span className="bg-gradient-tropical bg-clip-text text-transparent">
              Indian Ocean
            </span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-foreground/90 drop-shadow-md">
            Your intelligent travel companion for exploring Sri Lanka's hidden gems,
            pristine beaches, ancient temples, and vibrant culture.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/destinations">
              <Button variant="hero" size="lg" className="text-lg px-8 py-6">
                Explore Destinations
              </Button>
            </Link>
            <Link to="/auth?mode=register">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 bg-background/80 backdrop-blur-sm">
                Start Planning
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-tropical bg-clip-text text-transparent">
                Plan Your Trip
              </span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Compass LK provides all the tools and information for an unforgettable Sri Lankan adventure
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="border-border hover:shadow-card transition-all duration-300 hover:-translate-y-1"
                >
                  <CardContent className="pt-6">
                    <div className="bg-gradient-tropical p-3 rounded-lg w-fit mb-4">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section id="help" className="py-20 px-4 bg-background/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              How to Use Compass LK
            </h2>
            <p className="text-muted-foreground">Quick instructions to get the most out of the site</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Card className="border-border">
                <CardContent>
                  <h3 className="text-xl font-semibold mb-2">Explore Destinations</h3>
                  <p className="text-muted-foreground">Browse the Destinations page to discover places. Open any destination to see photos, descriptions and traveler reviews.</p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent>
                  <h3 className="text-xl font-semibold mb-2">Plan Your Trip</h3>
                  <p className="text-muted-foreground">Add destinations and activities to your itinerary. Use the Itinerary editor to organize days and times.</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="border-border">
                <CardContent>
                  <h3 className="text-xl font-semibold mb-2">Calendar & Scheduling</h3>
                  <p className="text-muted-foreground">See your planned items on the Calendar page. Adjust dates and event order there.</p>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardContent>
                  <h3 className="text-xl font-semibold mb-2">Account Features</h3>
                  <p className="text-muted-foreground">Sign in to save itineraries, write reviews, and manage your profile. Use the Get Started button to create an account.</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of travelers discovering the beauty of Sri Lanka
          </p>
          <Link to="/auth?mode=register">
            <Button variant="hero" size="lg" className="text-lg px-12 py-6">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <p>© 2024 Compass LK. Your trusted travel companion for Sri Lanka.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
