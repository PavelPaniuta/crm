import { Role } from '@prisma/client';

export type RequestUser = {
  id: string;
  email: string;
  role: Role;
  organizationId: string;
  activeOrganizationId: string;
};

