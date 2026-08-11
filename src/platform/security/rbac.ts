/** RBAC (§39, §42). Least privilege: roles map to explicit permission codes. */

export const ROLES = [
  'SUPER_ADMIN',
  'BRAND_DIRECTOR',
  'DESIGN_DIRECTOR',
  'JEWELLERY_DESIGNER',
  'ARABIC_SPECIALIST',
  'CAD_ENGINEER',
  'MANUFACTURING_ENGINEER',
  'PRODUCT_MANAGER',
  'MARKETING',
  'FINANCE',
  'OPERATIONS',
  'WORKSHOP_USER',
  'CUSTOMER_SUPPORT',
  'READ_ONLY',
  'CUSTOMER',
] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'design.read'
  | 'design.create'
  | 'design.approve'
  | 'arabic.master.approve'
  | 'religious.text.approve'
  | 'child.product.approve'
  | 'material.manage'
  | 'material.claim.verify'
  | 'rules.engineering.change'
  | 'cost.read'
  | 'cost.manage'
  | 'cad.export'
  | 'production.release'
  | 'prototype.manage'
  | 'marketing.publish'
  | 'passport.read'
  | 'analytics.read'
  | 'user.manage';

const GRANTS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'design.read', 'design.create', 'design.approve', 'arabic.master.approve',
    'religious.text.approve', 'child.product.approve', 'material.manage',
    'material.claim.verify', 'rules.engineering.change', 'cost.read', 'cost.manage',
    'cad.export', 'production.release', 'prototype.manage', 'marketing.publish',
    'passport.read', 'analytics.read', 'user.manage',
  ],
  BRAND_DIRECTOR: ['design.read', 'design.approve', 'religious.text.approve', 'analytics.read', 'passport.read'],
  DESIGN_DIRECTOR: ['design.read', 'design.create', 'design.approve', 'analytics.read', 'passport.read'],
  JEWELLERY_DESIGNER: ['design.read', 'design.create', 'passport.read'],
  ARABIC_SPECIALIST: ['design.read', 'arabic.master.approve', 'religious.text.approve'],
  CAD_ENGINEER: ['design.read', 'cad.export', 'passport.read'],
  MANUFACTURING_ENGINEER: ['design.read', 'rules.engineering.change', 'child.product.approve', 'prototype.manage'],
  PRODUCT_MANAGER: ['design.read', 'design.create', 'analytics.read', 'passport.read', 'prototype.manage'],
  MARKETING: ['design.read', 'marketing.publish', 'passport.read'],
  FINANCE: ['design.read', 'cost.read', 'cost.manage', 'analytics.read'],
  OPERATIONS: ['design.read', 'production.release', 'prototype.manage', 'passport.read'],
  WORKSHOP_USER: ['design.read', 'prototype.manage'],
  CUSTOMER_SUPPORT: ['design.read', 'passport.read'],
  READ_ONLY: ['design.read', 'passport.read', 'analytics.read'],
  CUSTOMER: [],
};

/** Roles that must have MFA enrolled before privileged actions. */
export const MFA_REQUIRED_ROLES: Role[] = [
  'SUPER_ADMIN', 'BRAND_DIRECTOR', 'DESIGN_DIRECTOR', 'FINANCE', 'OPERATIONS', 'MANUFACTURING_ENGINEER',
];

export interface Principal {
  userId: string;
  roles: Role[];
  mfaEnrolled: boolean;
}

export class AccessDenied extends Error {}

export function hasPermission(principal: Principal, permission: Permission): boolean {
  const granted = principal.roles.some((r) => GRANTS[r].includes(permission));
  if (!granted) return false;
  const needsMfa = principal.roles.some((r) => MFA_REQUIRED_ROLES.includes(r));
  if (needsMfa && !principal.mfaEnrolled) return false;
  return true;
}

export function requirePermission(principal: Principal, permission: Permission): void {
  if (!hasPermission(principal, permission)) {
    throw new AccessDenied(`User ${principal.userId} lacks permission ${permission}`);
  }
}
