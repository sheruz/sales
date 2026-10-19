/* eslint-disable @typescript-eslint/no-require-imports */
require("./load-env");
const { ensureDatabaseUrl } = require("./database-url");
ensureDatabaseUrl();

const {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
  maskEmail,
} = require("./s2-lib");

const NEW_FEATURE_KEYS = [
  "emails_daily",
  "audits",
  "crawls",
  "meetings",
  "icps",
  "campaigns",
];

const PLAN_FEATURE_DEFAULTS = {
  Free: {
    emails_daily: 50,
    audits: 25,
    crawls: 100,
    meetings: 50,
    icps: 3,
    campaigns: 2,
  },
  /** Align with Free until Starter limits are edited in admin */
  Starter: {
    emails_daily: 50,
    audits: 25,
    crawls: 100,
    meetings: 50,
    icps: 3,
    campaigns: 2,
  },
  STARTER: {
    emails_daily: 50,
    audits: 25,
    crawls: 100,
    meetings: 50,
    icps: 3,
    campaigns: 2,
  },
  Growth: {
    emails_daily: 200,
    audits: 1000,
    crawls: 5000,
    meetings: 500,
    icps: 20,
    campaigns: 20,
  },
  Agency: {
    emails_daily: 500,
    audits: 2000,
    crawls: 10000,
    meetings: 1000,
    icps: 50,
    campaigns: 50,
  },
  AGENCY: {
    emails_daily: 500,
    audits: 2000,
    crawls: 10000,
    meetings: 1000,
    icps: 50,
    campaigns: 50,
  },
  Scale: {
    emails_daily: 1000,
    audits: 10000,
    crawls: 50000,
    meetings: 5000,
    icps: 100,
    campaigns: 100,
  },
  OWNER: {
    emails_daily: null,
    audits: null,
    crawls: null,
    meetings: null,
    icps: null,
    campaigns: null,
  },
  "Internal Owner": {
    emails_daily: null,
    audits: null,
    crawls: null,
    meetings: null,
    icps: null,
    campaigns: null,
  },
};

const NEW_USAGE_METRICS = [
  "EMAILS_DAILY",
  "AUDITS",
  "CRAWLS",
  "MEETINGS",
  "ICPS",
  "CAMPAIGNS",
];

module.exports = {
  OWNER_ORG_NAME,
  TEST_TENANT_NAME,
  NEW_FEATURE_KEYS,
  PLAN_FEATURE_DEFAULTS,
  NEW_USAGE_METRICS,
  createPrisma,
  readOnlyPrisma,
  tableExists,
  columnExists,
  enumExists,
  enumHasValue,
  isApply,
  maskEmail,
};
