export interface Tag {
  tagId: string; // Unique collar ID
  isAssigned: boolean; // Whether it's assigned to any cattle
  createdAt: number; // Timestamp when the tag was registered
  lastSeen?: number; // Last time we received data from this tag
  batteryLevel?: number; // Last reported battery level (percentage)
}
