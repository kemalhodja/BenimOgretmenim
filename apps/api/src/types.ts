export type AdminScope = "full" | "finance" | "support";

export type AppVariables = {
  requestId?: string;
  userId: string;
  userRole: string;
  adminScope?: AdminScope;
  authMethod?: "bearer" | "cookie";
  accountStatus?: "active" | "suspended" | "deletion_requested";
};
