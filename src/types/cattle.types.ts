export type AgeGroup = "CALF" | "ADULT" | "RETIRED";
export type Gender = "MALE" | "FEMALE";

export interface Cattle {
  cattleId: string; // UUID for the cattle
  userId: string; // Owner's user ID
  tagId: string; // Associated collar tag ID
  name: string; // Name of the cattle
  dateOfBirth: number; // Timestamp of birth date
  gender: Gender; // Gender of the cattle
  ageGroup: AgeGroup; // Age classification
  breed: string; // Breed type
  governmentId?: string; // Optional government registration ID
  fatherName?: string; // Optional father's name
  motherName?: string; // Optional mother's name
  createdAt: number; // Creation timestamp
  updatedAt: number; // Last update timestamp
  notes: string[]; // List of notes about the cattle
}
