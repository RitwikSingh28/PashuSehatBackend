// This file extends the Express Request type to include our user object
// which is added by our authentication middleware. This ensures TypeScript
// properly recognizes the req.user property in our routes and middleware.
declare namespace Express {
  export interface Request {
    user?: {
      userId: string;
      phoneNumber: string;
      isVerified: boolean;
      farmLocation: {
        address: string;
        pinCode: string;
      };
    };
  }
}
