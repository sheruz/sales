import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { INTEGRATION_CATALOG } from "../src/lib/integrations/catalog";
import {
  seedRolesAndPermissions,
  getRoleByKey,
  ensureUniqueOrgSlug,
} from "../src/lib/tenant/rbac";
import { ROLE_KEYS } from "../src/lib/auth/permission-catalog";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await seedRolesAndPermissions();
  console.log("  Roles & permissions seeded");

  const passwordHash = await bcrypt.hash("Admin@123", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@salesplatform.local" },
    update: { role: UserRole.SUPER_ADMIN },
    create: {
      email: "superadmin@salesplatform.local",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: UserRole.SUPER_ADMIN,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@salesplatform.local" },
    update: { role: UserRole.ADMIN },
    create: {
      email: "admin@salesplatform.local",
      passwordHash,
      firstName: "Admin",
      lastName: "User",
      role: UserRole.ADMIN,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@salesplatform.local" },
    update: {},
    create: {
      email: "manager@salesplatform.local",
      passwordHash,
      firstName: "Sales",
      lastName: "Manager",
      role: UserRole.SALES_MANAGER,
    },
  });

  const rep = await prisma.user.upsert({
    where: { email: "rep@salesplatform.local" },
    update: {},
    create: {
      email: "rep@salesplatform.local",
      passwordHash,
      firstName: "Sales",
      lastName: "Rep",
      role: UserRole.SALES_REPRESENTATIVE,
    },
  });

  const slug = await ensureUniqueOrgSlug("default-workspace");
  let org = await prisma.organization.findFirst({
    where: { slug: "default-workspace", deletedAt: null },
  });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "Default Workspace",
        slug,
        status: "ACTIVE",
        settings: { create: {} },
      },
    });
  }

  const memberships: Array<{ userId: string; roleKey: string; primary: boolean }> = [
    { userId: admin.id, roleKey: ROLE_KEYS.COMPANY_ADMIN, primary: true },
    { userId: manager.id, roleKey: ROLE_KEYS.SALES_MANAGER, primary: false },
    { userId: rep.id, roleKey: ROLE_KEYS.SALES_REP, primary: false },
  ];

  for (const m of memberships) {
    const role = await getRoleByKey(m.roleKey);
    await prisma.organizationUser.upsert({
      where: {
        organizationId_userId: { organizationId: org.id, userId: m.userId },
      },
      create: {
        organizationId: org.id,
        userId: m.userId,
        roleId: role.id,
        status: "ACTIVE",
        isPrimaryAdmin: m.primary,
        joinedAt: new Date(),
      },
      update: {
        roleId: role.id,
        status: "ACTIVE",
        isPrimaryAdmin: m.primary,
      },
    });
  }

  const services = [
    {
      name: "Custom Web Development",
      description:
        "End-to-end custom web application development tailored to your business needs.",
      targetClientType: "SMBs, startups, enterprises",
      minBudget: 10000,
      maxBudget: 500000,
      typicalTimeline: "8-24 weeks",
      technologies: ["React", "Next.js", "Node.js", "PostgreSQL", "TypeScript"],
      talkingPoints: [
        "Scalable architecture",
        "Modern tech stack",
        "Agile delivery",
      ],
    },
    {
      name: "Mobile App Development",
      description:
        "Native and cross-platform mobile applications for iOS and Android.",
      targetClientType: "Startups, product companies",
      minBudget: 15000,
      maxBudget: 300000,
      typicalTimeline: "12-20 weeks",
      technologies: ["React Native", "Flutter", "Swift", "Kotlin"],
      talkingPoints: [
        "Cross-platform efficiency",
        "App store deployment",
        "Performance optimization",
      ],
    },
    {
      name: "SaaS Development",
      description:
        "Full SaaS product development from MVP to enterprise-ready platform.",
      targetClientType: "Startups, scale-ups",
      minBudget: 25000,
      maxBudget: 1000000,
      typicalTimeline: "16-40 weeks",
      technologies: ["Next.js", "PostgreSQL", "AWS", "Stripe", "Redis"],
      talkingPoints: [
        "Multi-tenant architecture",
        "Subscription billing",
        "Rapid MVP delivery",
      ],
    },
    {
      name: "AI Automation",
      description:
        "AI-powered automation solutions to streamline business processes.",
      targetClientType: "Enterprises, operations teams",
      minBudget: 20000,
      maxBudget: 500000,
      typicalTimeline: "8-16 weeks",
      technologies: ["OpenAI", "LangChain", "Python", "Node.js"],
      talkingPoints: [
        "Process automation",
        "Custom AI agents",
        "ROI-focused implementation",
      ],
    },
    {
      name: "ERP Development",
      description:
        "Custom ERP systems for inventory, finance, HR, and operations management.",
      targetClientType: "Mid-size to large enterprises",
      minBudget: 50000,
      maxBudget: 2000000,
      typicalTimeline: "24-52 weeks",
      technologies: ["Java", "PostgreSQL", "React", "Microservices"],
      talkingPoints: [
        "Integrated modules",
        "Legacy system migration",
        "Custom workflows",
      ],
    },
    {
      name: "CRM Development",
      description:
        "Custom CRM solutions for sales, marketing, and customer support.",
      targetClientType: "Sales teams, agencies",
      minBudget: 15000,
      maxBudget: 300000,
      typicalTimeline: "10-20 weeks",
      technologies: ["Next.js", "PostgreSQL", "Node.js", "Redis"],
      talkingPoints: [
        "Pipeline management",
        "Integration capabilities",
        "Custom reporting",
      ],
    },
    {
      name: "Dedicated Development Teams",
      description:
        "Skilled development teams dedicated to your project on a monthly basis.",
      targetClientType: "Agencies, enterprises with ongoing needs",
      minBudget: 8000,
      maxBudget: 100000,
      typicalTimeline: "Ongoing monthly engagement",
      technologies: ["Full-stack", "DevOps", "QA", "Project Management"],
      talkingPoints: [
        "Flexible scaling",
        "Direct communication",
        "Long-term partnership",
      ],
    },
  ];

  for (const service of services) {
    await prisma.service.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: service.name },
      },
      update: service,
      create: { ...service, organizationId: org.id },
    });
  }

  const tags = ["Hot Lead", "Enterprise", "Startup", "Referral", "Inbound", "Outbound"];
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: {
        organizationId_name: { organizationId: org.id, name: tagName },
      },
      update: {},
      create: { name: tagName, organizationId: org.id },
    });
  }

  for (const item of INTEGRATION_CATALOG) {
    await prisma.integrationProduct.upsert({
      where: { platform: item.platform },
      create: {
        platform: item.platform,
        name: item.name,
        description: item.description,
        monthlyPriceCents: item.monthlyPriceCents,
        sortOrder: item.sortOrder,
      },
      update: {
        name: item.name,
        description: item.description,
        monthlyPriceCents: item.monthlyPriceCents,
        sortOrder: item.sortOrder,
      },
    });
  }

  console.log("Seed completed:");
  console.log(`  Super Admin: ${superAdmin.email} (no org — /platform)`);
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Company Admin: ${admin.email}`);
  console.log(`  Manager: ${manager.email}`);
  console.log(`  Rep: ${rep.email}`);
  console.log(`  Services: ${services.length}`);
  console.log(`  Tags: ${tags.length}`);
  console.log(`  Integration products: ${INTEGRATION_CATALOG.length}`);
  console.log("\nDefault password for all users: Admin@123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
