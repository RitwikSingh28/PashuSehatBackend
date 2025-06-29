export interface Alert {
  alertId: string;
  userId: string;
  cattleId: string;
  tagId: string;
  cattleName: string;  // Added cattle name
  timestamp: number;
  type: "temperature" | "pulseRate" | "motion" | "battery";
  severity: "low" | "medium" | "high";
  value: number;
  threshold: {
    min?: number;
    max?: number;
  };
  status: "new" | "acknowledged";
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}
