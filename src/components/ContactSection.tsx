import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Building, Shield, Users } from "lucide-react";
import { useSlideUpOnVisible } from "@/hooks/useSlideUpOnVisible";

const ContactSection = () => {
  const { ref, visible } = useSlideUpOnVisible();
  return (
    <section id="contact" className="py-20 bg-secondary/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-16">
            <h2
            ref={ref}
            className={`text-3xl md:text-4xl font-bold mb-6 text-foreground transition-all duration-700 ${
              visible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
            }`}
            >
            Partner with Us
            </h2>
          <p className="text-lg text-muted-foreground">
            Join State Disaster Management Authorities and government agencies in building 
            resilient infrastructure for safer communities.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Information */}
          <div>
            <h3 className="text-2xl ml-40 font-semibold mb-6 text-foreground">
              Get in Touch
            </h3>
            
            <div className="space-y-6 mb-2 ml-20">
              <div className="flex items-start space-x-4">
                <div className="bg-primary/20 p-3 rounded-lg">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Email</h4>
                  <p className="text-muted-foreground">kunwar.2428ece858@kiet.edu</p>
                  <p className="text-muted-foreground">anuj.2428cse1032@kiet.edu</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary/20 p-3 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Phone</h4>
                  <p className="text-muted-foreground">+91 9695195559</p>
                  <p className="text-muted-foreground">+91 9956029319 (Emergency)</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-primary/20 p-3 rounded-lg">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1">Address</h4>
                  <p className="text-muted-foreground">
                    KIET Group of institutions<br />
                    Meerut Road,<br />
                    Ghaziabad, India
                  </p>
                </div>
              </div>
            </div>

            {/* Collaboration Partners
            <div>
              <h4 className="text-lg font-semibold mb-4 text-foreground">
                Current Collaborations
              </h4>
              <div className="space-y-4">
                <Card className="bg-card/30 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Building className="h-5 w-5 text-status-healthy" />
                      <div>
                        <p className="font-medium text-foreground">Delhi State Disaster Management Authority</p>
                        <p className="text-xs text-muted-foreground">Pilot deployment on 25 critical bridges</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">National Disaster Management Authority</p>
                        <p className="text-xs text-muted-foreground">Technical advisory and standards development</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-status-warning" />
                      <div>
                        <p className="font-medium text-foreground">Municipal Corporation of Ghaziabad</p>
                        <p className="text-xs text-muted-foreground">Smart city infrastructure monitoring</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div> */}
            {/* </div> */}
          </div>

          {/* Contact Form */}
          <div>
            <Card className="card-gradient border-border">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-6 text-foreground">
                  Request Partnership Information
                </h3>
                
                <form className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        First Name
                      </label>
                      <Input  className="bg-secondary" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">
                        Last Name
                      </label>
                      <Input className="bg-secondary" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Organization
                    </label>
                    <Input className="bg-secondary" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Email
                    </label>
                    <Input type="email" className="bg-secondary" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Phone
                    </label>
                    <Input  className="bg-secondary" />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Message
                    </label>
                    <Textarea 
                      placeholder="Tell us about your infrastructure monitoring needs and how we can collaborate..." 
                      className="bg-secondary min-h-[100px]"
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Send Partnership Request
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    We'll respond within 24 hours. For urgent matters, please call our emergency line.
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;