// pages/api/admin/seed-sources.ts
//
// Seeds all known fallback company/token pairs into the ats_sources table
// so that greenhouse, lever, ashby, workable, smartrecruiters, and workday
// crons use them.
//
// Auth: same CRON_SECRET as cron endpoints.
// Usage: curl -s "$BASE/api/admin/seed-sources" -H "x-cron-secret: $SECRET"
//
import type { NextApiRequest, NextApiResponse } from 'next';
import { addSource, ATSType } from '../../../lib/sources';

function authed(req: NextApiRequest, res: NextApiResponse): boolean {
  if (req.headers['x-vercel-cron']) return true;
  const key =
    (req.headers['x-cron-secret'] as string) ||
    (req.headers['x-cron-key']    as string) ||
    (req.query?.secret as string) ||
    '';
  if (!process.env.CRON_SECRET || key === process.env.CRON_SECRET) return true;
  res.status(401).json({ ok: false, error: 'unauthorized' });
  return false;
}

const SEEDS: { type: ATSType; company: string; token: string }[] = [
  // ── Greenhouse ──────────────────────────────────────────────────────────
  { type: 'greenhouse', company: 'Stripe',        token: 'stripe'        },
  { type: 'greenhouse', company: 'Databricks',    token: 'databricks'    },
  { type: 'greenhouse', company: 'Snowflake',     token: 'snowflakeinc'  },
  { type: 'greenhouse', company: 'Notion',        token: 'notion'        },
  { type: 'greenhouse', company: 'Figma',         token: 'figma'         },
  { type: 'greenhouse', company: 'OpenAI',        token: 'openai'        },
  { type: 'greenhouse', company: 'Plaid',         token: 'plaid'         },
  { type: 'greenhouse', company: 'Cloudflare',    token: 'cloudflare'    },
  { type: 'greenhouse', company: 'Box',           token: 'box'           },
  { type: 'greenhouse', company: 'Atlassian',     token: 'atlassian'     },
  { type: 'greenhouse', company: 'Airbnb',        token: 'airbnb'        },
  { type: 'greenhouse', company: 'Shopify',       token: 'shopify'       },
  { type: 'greenhouse', company: 'Robinhood',     token: 'robinhood'     },
  { type: 'greenhouse', company: 'Dropbox',       token: 'dropbox'       },
  { type: 'greenhouse', company: 'Klaviyo',       token: 'klaviyo'       },
  { type: 'greenhouse', company: 'Datadog',       token: 'datadog'       },
  { type: 'greenhouse', company: 'Lyft',          token: 'lyft'          },
  { type: 'greenhouse', company: 'Coinbase',      token: 'coinbase'      },
  { type: 'greenhouse', company: 'Pinterest',     token: 'pinterest'     },
  { type: 'greenhouse', company: 'GitHub',        token: 'github'        },
  { type: 'greenhouse', company: 'Zendesk',       token: 'zendesk'       },
  { type: 'greenhouse', company: 'Okta',          token: 'okta'          },
  { type: 'greenhouse', company: 'MongoDB',       token: 'mongodb'       },
  { type: 'greenhouse', company: 'HashiCorp',     token: 'hashicorp'     },
  { type: 'greenhouse', company: 'Twilio',        token: 'twilio'        },
  { type: 'greenhouse', company: 'PagerDuty',     token: 'pagerduty'     },
  { type: 'greenhouse', company: 'Confluent',     token: 'confluent'     },
  { type: 'greenhouse', company: 'HubSpot',       token: 'hubspot'       },
  { type: 'greenhouse', company: 'Canva',         token: 'canva'         },
  { type: 'greenhouse', company: 'Instacart',     token: 'instacart'     },
  { type: 'greenhouse', company: 'Asana',         token: 'asana'         },
  { type: 'greenhouse', company: 'GitLab',        token: 'gitlab'        },
  { type: 'greenhouse', company: 'DoorDash',      token: 'doordash'      },
  { type: 'greenhouse', company: 'Splunk',        token: 'splunk'        },
  { type: 'greenhouse', company: 'Elastic',       token: 'elastic'       },
  { type: 'greenhouse', company: 'Fastly',        token: 'fastly'        },
  { type: 'greenhouse', company: 'CockroachDB',   token: 'cockroachlabs' },
  { type: 'greenhouse', company: 'Pendo',         token: 'pendo'         },
  { type: 'greenhouse', company: 'Qualtrics',     token: 'qualtrics'     },
  { type: 'greenhouse', company: 'Palantir',      token: 'palantir'      },
  { type: 'greenhouse', company: 'Anduril',       token: 'anduril'       },
  { type: 'greenhouse', company: 'Scale AI',      token: 'scale-ai'      },
  { type: 'greenhouse', company: 'Intercom',      token: 'intercom'      },
  // more
  { type: 'greenhouse', company: 'Airtable',      token: 'airtable'      },
  { type: 'greenhouse', company: 'Brex',          token: 'brex'          },
  { type: 'greenhouse', company: 'Rippling',      token: 'rippling'      },
  { type: 'greenhouse', company: 'Gusto',         token: 'gusto'         },
  { type: 'greenhouse', company: 'Checkr',        token: 'checkr'        },
  { type: 'greenhouse', company: 'Amplitude',     token: 'amplitude'     },
  { type: 'greenhouse', company: 'Benchling',     token: 'benchling'     },
  { type: 'greenhouse', company: 'Grammarly',     token: 'grammarly'     },
  { type: 'greenhouse', company: 'Lattice',       token: 'lattice'       },

  // ── Lever ────────────────────────────────────────────────────────────────
  { type: 'lever', company: 'Netflix',      token: 'netflix'      },
  { type: 'lever', company: 'Brex',         token: 'brex'         },
  { type: 'lever', company: 'Scale AI',     token: 'scaleai'      },
  { type: 'lever', company: 'Amplitude',    token: 'amplitude'    },
  { type: 'lever', company: 'Benchling',    token: 'benchling'    },
  { type: 'lever', company: 'Grammarly',    token: 'grammarly'    },
  { type: 'lever', company: 'Lattice',      token: 'lattice'      },
  { type: 'lever', company: 'Rippling',     token: 'rippling'     },
  { type: 'lever', company: 'Airtable',     token: 'airtable'     },
  { type: 'lever', company: 'Cohere',       token: 'cohere'       },
  { type: 'lever', company: 'Reddit',       token: 'reddit'       },
  { type: 'lever', company: 'Waymo',        token: 'waymo'        },
  { type: 'lever', company: 'Wealthfront',  token: 'wealthfront'  },
  { type: 'lever', company: 'Figma',        token: 'figma'        },
  { type: 'lever', company: 'Carta',        token: 'carta'        },
  { type: 'lever', company: 'Checkr',       token: 'checkr'       },
  { type: 'lever', company: 'Gusto',        token: 'gusto'        },
  { type: 'lever', company: 'Faire',        token: 'faire'        },
  { type: 'lever', company: 'Watershed',    token: 'watershed'    },
  { type: 'lever', company: 'Roboflow',     token: 'roboflow'     },
  { type: 'lever', company: 'Cruise',       token: 'cruise'       },
  { type: 'lever', company: 'Nuro',         token: 'nuro'         },
  { type: 'lever', company: 'Samsara',      token: 'samsara'      },
  { type: 'lever', company: 'Discord',      token: 'discord'      },
  { type: 'lever', company: 'Figma',        token: 'figma'        },
  { type: 'lever', company: 'Vercel',       token: 'vercel'       },
  { type: 'lever', company: 'Linear',       token: 'linear'       },
  { type: 'lever', company: 'Notion',       token: 'notion'       },

  // ── Workable ─────────────────────────────────────────────────────────────
  { type: 'workable', company: 'Whatnot',     token: 'whatnot'     },
  { type: 'workable', company: 'Samsara',     token: 'samsara'     },
  { type: 'workable', company: 'Squarespace', token: 'squarespace' },
  { type: 'workable', company: 'Intercom',    token: 'intercom'    },
  { type: 'workable', company: 'Pendo',       token: 'pendo'       },
  { type: 'workable', company: 'Miro',        token: 'miro'        },
  { type: 'workable', company: 'Typeform',    token: 'typeform'    },

  // ── SmartRecruiters ──────────────────────────────────────────────────────
  { type: 'smartrecruiters', company: 'NVIDIA',       token: 'nvidia'         },
  { type: 'smartrecruiters', company: 'Samsung R&D',  token: 'samsungresearch'},
  { type: 'smartrecruiters', company: 'Ericsson',     token: 'ericsson'       },
  { type: 'smartrecruiters', company: 'Siemens',      token: 'siemens'        },
  { type: 'smartrecruiters', company: 'Bosch',        token: 'bosch'          },
  { type: 'smartrecruiters', company: 'Philips',      token: 'philips'        },

  // ── Workday ──────────────────────────────────────────────────────────────
  { type: 'workday', company: 'NVIDIA',     token: 'https://nvidia.wd5.myworkdayjobs.com/NVIDIA/'                          },
  { type: 'workday', company: 'Adobe',      token: 'https://adobe.wd5.myworkdayjobs.com/External/'                         },
  { type: 'workday', company: 'Salesforce', token: 'https://salesforce.wd12.myworkdayjobs.com/External_Career_Site/'        },
  { type: 'workday', company: 'ServiceNow', token: 'https://servicenow.wd5.myworkdayjobs.com/External/'                     },
  { type: 'workday', company: 'VMware',     token: 'https://vmware.wd1.myworkdayjobs.com/VMware/'                           },
  { type: 'workday', company: 'Workday',    token: 'https://workday.wd5.myworkdayjobs.com/Workday/'                         },
  { type: 'workday', company: 'Microsoft',  token: 'https://microsoft.wd1.myworkdayjobs.com/en-US/External/'                 },
  { type: 'workday', company: 'Amazon',     token: 'https://amazon.jobs.myworkdayjobs.com/en-US/Amazon_Jobs/'               },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!authed(req, res)) return;

  let added = 0;
  const errors: string[] = [];

  for (const s of SEEDS) {
    try {
      await addSource({ type: s.type, token: s.token, company_name: s.company });
      added++;
    } catch (e: any) {
      errors.push(`${s.type}/${s.token}: ${e?.message ?? e}`);
    }
  }

  return res.status(200).json({
    ok: true,
    added,
    total: SEEDS.length,
    errors: errors.length ? errors : undefined,
  });
}
