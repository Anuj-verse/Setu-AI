import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, TrendingUp, Zap } from "lucide-react";
import heroImage from "@/assets/hero-setu-ai.jpg";
import { useSlideUpOnVisible } from "@/hooks/useSlideUpOnVisible";

const HeroSection = () => {
  const { ref, visible } = useSlideUpOnVisible();
  return (
    <section
      ref={ref}
      className={`min-h-screen flex items-center justify-center relative overflow-hidden transition-all duration-700 ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
    >
      {/* Background Image */}
      <div 
      className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
      style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 hero-gradient opacity-90" />
      
      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="max-w-4xl mx-auto text-center">
        {/* Badge
        <div className={`inline-flex items-center space-x-2 bg-primary/10 rounded-full px-4 py-2 mb-8 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
        <Shield className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">AI-Powered Disaster Prevention</span>
        </div> */}

        {/* Heading */}
        <h1 className={`text-4xl md:text-6xl lg:text-7xl font-bold mb-6 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
        <span className="text-foreground">Setu AI</span>
        <br />
        <span className="text-primary">Predictive Disaster</span>
        <br />
        <span className="text-foreground">Management System</span>
        </h1>

        {/* Subtitle */}
        <p className={`text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
        Revolutionizing infrastructure safety with IoT sensors, Edge AI, and predictive analytics. 
        Prevent disasters before they happen.
        </p>

        {/* CTA Buttons */}
        <div className={`flex flex-col sm:flex-row gap-4 justify-center mb-12 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
        <Button 
          size="lg" 
          className="bg-primary hover:bg-primary-glow text-primary-foreground transition-all duration-300 shadow-elegant group"
          onClick={() => window.location.href = '/auth'}
        >
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          onClick={() => window.location.href = '/dashboard'}
        >
          View Live Dashboard
        </Button>
        </div>

        {/* Stats */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
          <TrendingUp className="h-6 w-6 text-status-healthy mr-2" />
          <span className="text-2xl font-bold text-foreground">75%-85%</span>
          </div>
          <p className="text-muted-foreground">Prediction Accuracy</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
          <Shield className="h-6 w-6 text-primary mr-2" />
          <span className="text-2xl font-bold text-foreground">24/7</span>
          </div>
          <p className="text-muted-foreground">Real-time Monitoring</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
          <Zap className="h-6 w-6 text-status-warning mr-2" />
          <span className="text-2xl font-bold text-foreground">50%</span>
          </div>
          <p className="text-muted-foreground">Cost Reduction</p>
        </div>
        </div>
      </div>
      </div>

      {/* Floating Elements */}
      <div className={`absolute top-1/4 left-10 w-16 h-16 bg-primary/20 rounded-full animate-float transition-all duration-700 ${
      visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
      }`} />
      <div className={`absolute bottom-1/4 right-10 w-20 h-20 bg-status-healthy/20 rounded-full animate-float transition-all duration-700 ${
      visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
      }`} style={{ animationDelay: '1s' }} />
      <div className={`absolute top-1/2 right-1/4 w-12 h-12 bg-status-warning/20 rounded-full animate-float transition-all duration-700 ${
      visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
      }`} style={{ animationDelay: '2s' }} />
    </section>
  );
};

export default HeroSection;