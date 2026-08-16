/**
 * Enhanced hierarchical taxonomy for enterprise records management.
 */

export interface TaxonomyNode {
  code: string;
  label: string;
  children?: TaxonomyNode[];
  parentCode?: string;
}

export const PERSONAL_TAXONOMY: TaxonomyNode[] = [
  {
    code: 'Identity',
    label: 'Identity',
    children: [
      { code: 'Identity.Passport', label: 'Passport', parentCode: 'Identity' },
      { code: 'Identity.NIN', label: 'NIN', parentCode: 'Identity' },
      { code: 'Identity.DriverLicence', label: "Driver's Licence", parentCode: 'Identity' },
      { code: 'Identity.VoterCard', label: "Voter's Card", parentCode: 'Identity' },
      { code: 'Identity.BirthCertificate', label: 'Birth Certificate', parentCode: 'Identity' }
    ]
  },
  {
    code: 'Property',
    label: 'Property',
    children: [
      { code: 'Property.TenancyAgreement', label: 'Tenancy Agreement', parentCode: 'Property' },
      { code: 'Property.CofO', label: 'C of O', parentCode: 'Property' },
      { code: 'Property.Deed', label: 'Deed', parentCode: 'Property' },
      { code: 'Property.UtilityBill', label: 'Utility Bill', parentCode: 'Property' }
    ]
  },
  {
    code: 'Financial',
    label: 'Financial',
    children: [
      { code: 'Financial.BankStatement', label: 'Bank Statement', parentCode: 'Financial' },
      { code: 'Financial.Insurance', label: 'Insurance', parentCode: 'Financial' },
      { code: 'Financial.Tax', label: 'Tax (TIN)', parentCode: 'Financial' },
      { code: 'Financial.Receipt', label: 'Receipt', parentCode: 'Financial' },
      { code: 'Financial.Invoice', label: 'Invoice', parentCode: 'Financial' }
    ]
  },
  {
    code: 'Education',
    label: 'Education',
    children: [
      { code: 'Education.WAEC', label: 'WAEC/NECO', parentCode: 'Education' },
      { code: 'Education.Degree', label: 'Degree', parentCode: 'Education' },
      { code: 'Education.Transcript', label: 'Transcript', parentCode: 'Education' },
      { code: 'Education.ProfessionalCert', label: 'Professional Cert', parentCode: 'Education' }
    ]
  },
  {
    code: 'Legal',
    label: 'Legal',
    children: [
      { code: 'Legal.Contract', label: 'Contract', parentCode: 'Legal' },
      { code: 'Legal.Agreement', label: 'Agreement', parentCode: 'Legal' },
      { code: 'Legal.Affidavit', label: 'Affidavit', parentCode: 'Legal' },
      { code: 'Legal.CourtOrder', label: 'Court Order', parentCode: 'Legal' },
      { code: 'Legal.PowerOfAttorney', label: 'Power of Attorney', parentCode: 'Legal' }
    ]
  },
  {
    code: 'Health',
    label: 'Health',
    children: [
      { code: 'Health.MedicalReport', label: 'Medical Report', parentCode: 'Health' },
      { code: 'Health.VaccinationCard', label: 'Vaccination Card', parentCode: 'Health' },
      { code: 'Health.Prescription', label: 'Prescription', parentCode: 'Health' },
      { code: 'Health.LabResult', label: 'Lab Result', parentCode: 'Health' }
    ]
  }
];

export const ENTERPRISE_TAXONOMY: TaxonomyNode[] = [
  {
    code: 'Contracts',
    label: 'Contracts',
    children: [
      { code: 'Contracts.Vendor', label: 'Vendor', parentCode: 'Contracts' },
      { code: 'Contracts.Client', label: 'Client', parentCode: 'Contracts' },
      { code: 'Contracts.Employment', label: 'Employment', parentCode: 'Contracts' },
      { code: 'Contracts.NDA', label: 'NDA', parentCode: 'Contracts' },
      { code: 'Contracts.SLA', label: 'SLA', parentCode: 'Contracts' },
      { code: 'Contracts.Lease', label: 'Lease', parentCode: 'Contracts' }
    ]
  },
  {
    code: 'HR',
    label: 'HR',
    children: [
      { code: 'HR.EmployeeRecord', label: 'Employee Record', parentCode: 'HR' },
      { code: 'HR.OfferLetter', label: 'Offer Letter', parentCode: 'HR' },
      { code: 'HR.Disciplinary', label: 'Disciplinary', parentCode: 'HR' },
      { code: 'HR.PerformanceReview', label: 'Performance Review', parentCode: 'HR' }
    ]
  },
  {
    code: 'Compliance',
    label: 'Compliance',
    children: [
      { code: 'Compliance.RegulatoryFiling', label: 'Regulatory Filing', parentCode: 'Compliance' },
      { code: 'Compliance.License', label: 'License', parentCode: 'Compliance' },
      { code: 'Compliance.Permit', label: 'Permit', parentCode: 'Compliance' },
      { code: 'Compliance.AuditReport', label: 'Audit Report', parentCode: 'Compliance' },
      { code: 'Compliance.Policy', label: 'Policy', parentCode: 'Compliance' }
    ]
  },
  {
    code: 'Operations',
    label: 'Operations',
    children: [
      { code: 'Operations.SOP', label: 'Standard Operating Procedure', parentCode: 'Operations' },
      { code: 'Operations.Manual', label: 'Manual', parentCode: 'Operations' },
      { code: 'Operations.ProcessDocument', label: 'Process Document', parentCode: 'Operations' }
    ]
  },
  {
    code: 'IP',
    label: 'IP',
    children: [
      { code: 'IP.Patent', label: 'Patent', parentCode: 'IP' },
      { code: 'IP.Trademark', label: 'Trademark', parentCode: 'IP' },
      { code: 'IP.Copyright', label: 'Copyright', parentCode: 'IP' },
      { code: 'IP.TradeSecret', label: 'Trade Secret', parentCode: 'IP' }
    ]
  },
  {
    code: 'Corporate',
    label: 'Corporate',
    children: [
      { code: 'Corporate.BoardResolution', label: 'Board Resolution', parentCode: 'Corporate' },
      { code: 'Corporate.Minutes', label: 'Minutes', parentCode: 'Corporate' },
      { code: 'Corporate.ShareholderAgreement', label: 'Shareholder Agreement', parentCode: 'Corporate' },
      { code: 'Corporate.StatutoryFiling', label: 'Statutory Filing', parentCode: 'Corporate' }
    ]
  }
];

export function flattenTaxonomy(nodes: TaxonomyNode[], prefixPath = ''): { code: string, label: string, path: string }[] {
  let result: { code: string, label: string, path: string }[] = [];
  for (const node of nodes) {
    const currentPath = prefixPath ? `${prefixPath}/${node.label}` : node.label;
    result.push({ code: node.code, label: node.label, path: currentPath });
    if (node.children) {
      result = result.concat(flattenTaxonomy(node.children, currentPath));
    }
  }
  return result;
}

export function findNode(nodes: TaxonomyNode[], code: string): TaxonomyNode | undefined {
  for (const node of nodes) {
    if (node.code === code) return node;
    if (node.children) {
      const found = findNode(node.children, code);
      if (found) return found;
    }
  }
  return undefined;
}

export function isDescendantOf(nodes: TaxonomyNode[], childCode: string, parentCode: string): boolean {
  const child = findNode(nodes, childCode);
  if (!child || !child.parentCode) return false;
  if (child.parentCode === parentCode) return true;
  return isDescendantOf(nodes, child.parentCode, parentCode);
}
