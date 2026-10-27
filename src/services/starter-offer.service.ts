import prisma from "@/lib/db/prisma";
import { OfferStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "@/lib/api/response";
import {
  STARTER_FINDING_TYPES,
  type StarterFindingType,
} from "@/lib/pow/constants";

export type StarterOfferInput = {
  name: string;
  price: number;
  currency?: string;
  deliveryDays: number;
  includes: string;
  findingTypes: string[];
  status?: OfferStatus;
};

function normalizeFindingTypes(types: string[]): StarterFindingType[] {
  const allowed = new Set<string>(STARTER_FINDING_TYPES);
  const out = [...new Set(types.map((t) => t.trim()).filter(Boolean))];
  for (const t of out) {
    if (!allowed.has(t)) {
      throw new ValidationError(`Unknown finding type: ${t}`);
    }
  }
  return out as StarterFindingType[];
}

export class StarterOfferService {
  async list(organizationId: string, includeArchived = false) {
    return prisma.starterOffer.findMany({
      where: {
        organizationId,
        ...(includeArchived ? {} : { status: OfferStatus.ACTIVE }),
      },
      orderBy: { name: "asc" },
    });
  }

  async getById(organizationId: string, id: string) {
    const row = await prisma.starterOffer.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundError("Starter offer not found");
    return row;
  }

  async create(organizationId: string, input: StarterOfferInput) {
    if (!input.name.trim()) throw new ValidationError("Name is required");
    if (!(input.price >= 0)) throw new ValidationError("Price is required");
    if (!(input.deliveryDays >= 1)) {
      throw new ValidationError("Delivery days must be ≥ 1");
    }
    if (!input.includes.trim()) {
      throw new ValidationError("Includes is required");
    }
    const findingTypes = normalizeFindingTypes(input.findingTypes);

    return prisma.starterOffer.create({
      data: {
        organizationId,
        name: input.name.trim(),
        price: input.price,
        currency: input.currency?.trim() || "USD",
        deliveryDays: input.deliveryDays,
        includes: input.includes.trim(),
        findingTypes,
        status: input.status ?? OfferStatus.ACTIVE,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<StarterOfferInput>
  ) {
    await this.getById(organizationId, id);
    const data: Record<string, unknown> = {};
    if (input.name != null) data.name = input.name.trim();
    if (input.price != null) data.price = input.price;
    if (input.currency != null) data.currency = input.currency.trim() || "USD";
    if (input.deliveryDays != null) data.deliveryDays = input.deliveryDays;
    if (input.includes != null) data.includes = input.includes.trim();
    if (input.findingTypes != null) {
      data.findingTypes = normalizeFindingTypes(input.findingTypes);
    }
    if (input.status != null) data.status = input.status;
    return prisma.starterOffer.update({ where: { id }, data });
  }

  async archive(organizationId: string, id: string) {
    await this.getById(organizationId, id);
    return prisma.starterOffer.update({
      where: { id },
      data: { status: OfferStatus.ARCHIVED },
    });
  }

  /** Best match for a finding type; null if none */
  async matchForFindingType(
    organizationId: string,
    findingType: string
  ) {
    const offers = await this.list(organizationId, false);
    return (
      offers.find((o) => o.findingTypes.includes(findingType)) ??
      offers.find((o) => o.findingTypes.includes("other")) ??
      null
    );
  }
}

export const starterOfferService = new StarterOfferService();
