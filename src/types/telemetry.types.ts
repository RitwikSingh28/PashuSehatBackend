export interface TelemetryReading {
  tagId: string; // Partition key
  timestamp: number; // Sort key
  temperature: number; // Body temperature in Celsius
  pulseRate: number; // Heart rate in BPM
  motionData: number; // Motion intensity value
  batteryLevel?: number; // Optional battery level percentage
  ttl: number; // Time to live (expiry timestamp)
}
