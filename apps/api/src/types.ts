export type AppVariables = {
  requestId?: string;
  userId: string;
  userRole: string;
  authMethod?: "bearer" | "cookie";
};
