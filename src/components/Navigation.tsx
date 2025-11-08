import { useState } from "react";
import { Menu, X, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavLink } from "react-router-dom";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: "Home", href: "/" },
    { name: "Dashboard", href: "/dashboard" },
    { name: "Simulation", href: "/arduino" },
    { name: "Features", href: "#features" },
    { name: "Team", href: "#team" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <Activity className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-foreground">Setu AI</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
                      item.href.startsWith("#") ? (
            <a
              key={item.name}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground"
              onClick={e => {
              e.preventDefault();
              const targetId = item.href.replace("#", "");
              const el = document.getElementById(targetId);
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              }
              }}
            >
              {item.name}
            </a>
          ) : (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors hover:text-primary ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`
                }
              >
                {item.name}
              </NavLink>
  )
            ))}
            
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-card border border-border rounded-lg mt-2 p-4">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                item.href.startsWith("#") ? (
            <a
              key={item.name}
              href={item.href}
              className="text-sm font-medium transition-colors hover:text-primary text-muted-foreground"
            >
              {item.name}
            </a>
          ) : (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </NavLink>
              )))}
              <Button variant="default" size="sm" className="mt-4">
                Get Started
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;