export interface Cattle {
  cattleId: string; // UUID for the cattle
  userId: string; // Owner's user ID
  tagId: string; // Associated collar tag ID
  name: string; // Name of the cattle
  age: number; // Age in months
  gender: "male" | "female"; // Gender
  breed: string; // Breed type
  healthStatus: "healthy" | "sick" | "under_observation";
  createdAt: number; // Creation timestamp
  updatedAt: number; // Last update timestamp
  notes?: string; // Optional notes about the cattle
}
