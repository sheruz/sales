export type IcpTemplateId =
  | "trucking"
  | "construction"
  | "clinics"
  | "property_management"
  | "generic";

export type IcpTemplate = {
  id: IcpTemplateId;
  name: string;
  description: string;
  industries: string[];
  companySizes: string[];
  decisionMakerTitles: string[];
  buyingSignals: string[];
  countries: string[];
};

export const ICP_TEMPLATES: IcpTemplate[] = [
  {
    id: "trucking",
    name: "Trucking / logistics",
    description: "Fleet owners and brokers who need ops software, websites, or lead gen.",
    industries: ["Trucking", "Logistics", "Freight"],
    companySizes: ["11-50", "51-200", "201-500"],
    decisionMakerTitles: ["Owner", "Operations Manager", "Dispatch Manager"],
    buyingSignals: ["hiring drivers", "new terminals", "fleet expansion"],
    countries: ["United States", "Canada"],
  },
  {
    id: "construction",
    name: "Construction",
    description: "General contractors and specialty trades seeking project leads.",
    industries: ["Construction", "General Contracting", "Specialty Trade"],
    companySizes: ["11-50", "51-200"],
    decisionMakerTitles: ["Owner", "Estimator", "Business Development"],
    buyingSignals: ["new projects", "bidding", "growth markets"],
    countries: ["United States"],
  },
  {
    id: "clinics",
    name: "Clinics / healthcare",
    description: "Dental, physio, and specialty clinics that need patients online.",
    industries: ["Healthcare", "Dental", "Medical Practice"],
    companySizes: ["1-10", "11-50"],
    decisionMakerTitles: ["Practice Manager", "Owner", "Office Manager"],
    buyingSignals: ["new location", "online booking", "reviews"],
    countries: ["United States", "United Kingdom", "Canada"],
  },
  {
    id: "property_management",
    name: "Property management",
    description: "Residential and commercial PMs needing leasing and reputation.",
    industries: ["Property Management", "Real Estate"],
    companySizes: ["11-50", "51-200"],
    decisionMakerTitles: ["Owner", "Property Manager", "Leasing Manager"],
    buyingSignals: ["portfolio growth", "online applications", "vacancies"],
    countries: ["United States"],
  },
  {
    id: "generic",
    name: "Generic B2B",
    description: "Flexible ICP for professional services and software.",
    industries: ["Professional Services", "Software", "B2B Services"],
    companySizes: ["11-50", "51-200"],
    decisionMakerTitles: ["Owner", "CEO", "Marketing Manager", "Sales Director"],
    buyingSignals: ["hiring", "expansion", "digital transformation"],
    countries: ["United States", "United Kingdom", "Canada", "Australia"],
  },
];

export function getIcpTemplate(id: string): IcpTemplate | undefined {
  return ICP_TEMPLATES.find((t) => t.id === id);
}
