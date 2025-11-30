import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass, Menu, X, User, HelpCircle } from "lucide-react";
import useAdmin from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleHelpClick = () => {
    // Navigate to home and scroll to help section
    navigate("/");
    // small delay to allow home page to mount
    setTimeout(() => {
      const el = document.getElementById("help");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        // try again briefly in case of slower mount
        setTimeout(() => document.getElementById("help")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
      }
    }, 50);
  };

  return (
    <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-gradient-tropical p-2 rounded-lg group-hover:shadow-tropical transition-all">
              <Compass className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-tropical bg-clip-text text-transparent">
              Compass LK
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/destinations"
              className="text-foreground hover:text-primary transition-colors"
            >
              Destinations
            </Link>
            <Link
              to="/calendar"
              className="text-foreground hover:text-primary transition-colors"
            >
              Calendar
            </Link>
            {user && (
              <Link
                to="/itineraries"
                className="text-foreground hover:text-primary transition-colors"
              >
                My Itineraries
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="text-foreground hover:text-primary transition-colors"
              >
                Admin
              </Link>
            )}
            <button onClick={handleHelpClick} className="text-foreground hover:text-primary transition-colors flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              <span>Help</span>
            </button>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="text-foreground hover:text-primary transition-colors flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  Profile
                </Link>
                <Button onClick={handleSignOut} variant="outline" size="sm">
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="outline" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth?mode=register">
                  <Button variant="hero" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <div className="flex flex-col gap-4">
            <Link
              to="/destinations"
              className="text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Destinations
            </Link>
            <Link
              to="/calendar"
              className="text-foreground hover:text-primary transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              Calendar
            </Link>
            {user && (
              <Link
                to="/itineraries"
                className="text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                My Itineraries
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin"
                className="text-foreground hover:text-primary transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </Link>
            )}
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="text-foreground hover:text-primary transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Button
                    onClick={() => {
                      handleSignOut();
                      setIsMenuOpen(false);
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link to="/auth?mode=register" onClick={() => setIsMenuOpen(false)}>
                    <Button variant="hero" size="sm" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
              <div className="pt-2">
                <button
                  onClick={() => {
                    handleHelpClick();
                    setIsMenuOpen(false);
                  }}
                  className="text-foreground hover:text-primary transition-colors flex items-center gap-2 w-full text-left"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="ml-2">Help</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
