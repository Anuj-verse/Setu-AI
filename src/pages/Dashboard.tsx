import { useState, useEffect } from "react";
import { Navigate } from 'react-router-dom';
import Graphs from "@/components/graphs";
import MapDashboardPage from "@/pages/MapDashboardPage";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  TrendingDown,
  Thermometer,
  Droplets,
  MapPin,
  Clock,
  LogOut,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useSensorData } from "@/hooks/useSensorData";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const { user, userRole, signOut, loading } = useAuth();
  const { sensorData, latestReadings, loading: dataLoading } = useSensorData();
  const { toast } = useToast();
  const [selectedStructure, setSelectedStructure] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Prepare chart data for the last 24 hours
  const getChartData = (structureId: string, metric: 'vibration_frequency' | 'humidity' | 'strain_measurement') => {
    return sensorData
      .filter(reading => reading.structure_id === structureId)
      .slice(0, 24)
      .reverse()
      .map(reading => ({
        time: new Date(reading.timestamp).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        value: Number(reading[metric]),
        timestamp: reading.timestamp
      }));
  };

  const getStatusCounts = () => {
    const counts = { critical: 0, warning: 0, healthy: 0 };
    latestReadings.forEach(reading => {
      counts[reading.status]++;
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out successfully",
      description: "You have been logged out of Setu AI Dashboard.",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical": return "status-critical";
      case "warning": return "status-warning";
      case "healthy": return "status-healthy";
      default: return "muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical": return <XCircle className="h-4 w-4" />;
      case "warning": return <AlertTriangle className="h-4 w-4" />;
      case "healthy": return <CheckCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Setu AI Monitoring Dashboard</h1>
              <p className="text-sm text-muted-foreground">Real-time infrastructure health monitoring</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-status-healthy border-status-healthy">
                System Online
              </Badge>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{userRole === 'admin' ? 'Administrator' : 'Bridge Operator'}</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
              <div className="text-sm text-muted-foreground">
                Last Updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid  lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
           <MapDashboardPage />
          </div>
          

          {/* Status Panel */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Critical Structures</span>
                  <span className="text-sm font-medium text-status-critical">{statusCounts.critical}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Warning Structures</span>
                  <span className="text-sm font-medium text-status-warning">{statusCounts.warning}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Healthy Structures</span>
                  <span className="text-sm font-medium text-status-healthy">{statusCounts.healthy}</span>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Total Monitored</span>
                    <span className="text-sm font-bold text-primary">{latestReadings.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2 text-status-warning" />
                  Recent Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestReadings
                  .filter(reading => reading.status !== 'healthy')
                  .slice(0, 3)
                  .map((reading) => (
                  <div key={reading.id} className="p-3 rounded-lg bg-secondary/20 border border-border">
                    <div className="flex items-start space-x-2">
                      <div className={`mt-0.5 text-${getStatusColor(reading.status)}`}>
                        {getStatusIcon(reading.status)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {reading.status === 'critical' ? 'Critical vibration detected' : 'Temperature anomaly detected'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{reading.structure_name}</p>
                        <div className="flex items-center mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {new Date(reading.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {latestReadings.filter(r => r.status !== 'healthy').length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-status-healthy" />
                    <p>All systems operating normally</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Real-time Graphs <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6"> <Card> <CardHeader> <CardTitle className="text-lg flex items-center"> <TrendingUp className="h-5 w-5 mr-2 text-primary" /> Vibration Frequency </CardTitle> </CardHeader> <CardContent> <div className="h-40"> <ChartContainer config={{ vibration: { label: "Vibration (Hz)", color: "hsl(var(--status-critical))", }, }} > <ResponsiveContainer width="100%" height="100%"> <LineChart data={getChartData('STR001', 'vibration_frequency')}> <CartesianGrid strokeDasharray="3 3" className="opacity-30" /> <XAxis dataKey="time" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <ChartTooltip content={<ChartTooltipContent />} /> <Line type="monotone" dataKey="value" stroke="hsl(var(--status-critical))" strokeWidth={2} dot={{ fill: 'hsl(var(--status-critical))', strokeWidth: 2, r: 3 }} /> </LineChart> </ResponsiveContainer> </ChartContainer> </div> <div className="mt-4 text-center"> <div className="text-xl font-bold text-status-critical"> {latestReadings.find(r => r.structure_id === 'STR001')?.vibration_frequency || 'N/A'} Hz </div> <p className="text-xs text-muted-foreground">Current Reading</p> </div> </CardContent> </Card> <Card> <CardHeader> <CardTitle className="text-lg flex items-center"> <Droplets className="h-5 w-5 mr-2 text-blue-500" /> Humidity Levels </CardTitle> </CardHeader> <CardContent> <div className="h-40"> <ChartContainer config={{ humidity: { label: "Humidity (%)", color: "hsl(210, 100%, 50%)", }, }} > <ResponsiveContainer width="100%" height="100%"> <LineChart data={getChartData('STR001', 'humidity')}> <CartesianGrid strokeDasharray="3 3" className="opacity-30" /> <XAxis dataKey="time" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <ChartTooltip content={<ChartTooltipContent />} /> <Line type="monotone" dataKey="value" stroke="hsl(210, 100%, 50%)" strokeWidth={2} dot={{ fill: 'hsl(210, 100%, 50%)', strokeWidth: 2, r: 3 }} /> </LineChart> </ResponsiveContainer> </ChartContainer> </div> <div className="mt-4 text-center"> <div className="text-xl font-bold text-blue-500"> {latestReadings.find(r => r.structure_id === 'STR001')?.humidity || 'N/A'}% </div> <p className="text-xs text-muted-foreground">Current Humidity</p> </div> </CardContent> </Card> <Card> <CardHeader> <CardTitle className="text-lg flex items-center"> <Activity className="h-5 w-5 mr-2 text-status-warning" /> Strain Measurements </CardTitle> </CardHeader> <CardContent> <div className="h-40"> <ChartContainer config={{ strain: { label: "Strain (με)", color: "hsl(var(--status-warning))", }, }} > <ResponsiveContainer width="100%" height="100%"> <LineChart data={getChartData('STR001', 'strain_measurement')}> <CartesianGrid strokeDasharray="3 3" className="opacity-30" /> <XAxis dataKey="time" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} /> <ChartTooltip content={<ChartTooltipContent />} /> <Line type="monotone" dataKey="value" stroke="hsl(var(--status-warning))" strokeWidth={2} dot={{ fill: 'hsl(var(--status-warning))', strokeWidth: 2, r: 3 }} /> </LineChart> </ResponsiveContainer> </ChartContainer> </div> <div className="mt-4 text-center"> <div className="text-xl font-bold text-status-warning"> {latestReadings.find(r => r.structure_id === 'STR001')?.strain_measurement || 'N/A'} με </div> <p className="text-xs text-muted-foreground">Micro-strain</p> </div> </CardContent> </Card> </div> */}

        </div>
        </div>
  );
};

export default Dashboard;