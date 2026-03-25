import { AnyResponse } from "./groq"

export const MOCK_DATA: AnyResponse = {
  type: "schema",
  tables: [
    {
      id: 1,
      table_name: "users",
      description:
        "Core user accounts. All other tables reference this as the root entity.",
      columns: [
        {
          name: "id",
          type: "UUID",
          constraints: ["PK", "NOT NULL"],
          references: null,
        },
        {
          name: "username",
          type: "VARCHAR(50)",
          constraints: ["UNIQUE", "NOT NULL"],
          references: null,
        },
        {
          name: "email",
          type: "VARCHAR(255)",
          constraints: ["UNIQUE", "NOT NULL"],
          references: null,
        },
        {
          name: "password_hash",
          type: "TEXT",
          constraints: ["NOT NULL"],
          references: null,
        },
        { name: "avatar_url", type: "TEXT", constraints: [], references: null },
        {
          name: "is_verified",
          type: "BOOLEAN",
          constraints: ["DEFAULT"],
          references: null,
        },
        {
          name: "created_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL", "INDEX"],
          references: null,
        },
        {
          name: "updated_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL"],
          references: null,
        },
      ],
      depends_upon: [],
    },
    {
      id: 2,
      table_name: "tweets",
      description:
        "Stores all tweet content. Supports threading via parent_tweet_id self-reference.",
      columns: [
        {
          name: "id",
          type: "UUID",
          constraints: ["PK", "NOT NULL"],
          references: null,
        },
        {
          name: "user_id",
          type: "UUID",
          constraints: ["FK", "NOT NULL", "INDEX"],
          references: "users.id",
        },
        {
          name: "content",
          type: "TEXT",
          constraints: ["NOT NULL"],
          references: null,
        },
        {
          name: "parent_tweet_id",
          type: "UUID",
          constraints: ["FK", "INDEX"],
          references: "tweets.id",
        },
        {
          name: "like_count",
          type: "INT",
          constraints: ["DEFAULT"],
          references: null,
        },
        {
          name: "retweet_count",
          type: "INT",
          constraints: ["DEFAULT"],
          references: null,
        },
        {
          name: "is_deleted",
          type: "BOOLEAN",
          constraints: ["DEFAULT"],
          references: null,
        },
        {
          name: "created_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL", "INDEX"],
          references: null,
        },
      ],
      depends_upon: [1],
    },
    {
      id: 3,
      table_name: "follows",
      description:
        "Junction table for user follow relationships. Composite PK prevents duplicate follows.",
      columns: [
        {
          name: "follower_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "users.id",
        },
        {
          name: "following_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "users.id",
        },
        {
          name: "created_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL"],
          references: null,
        },
      ],
      depends_upon: [1],
    },
    {
      id: 4,
      table_name: "likes",
      description:
        "Tracks which users liked which tweets. Composite PK prevents duplicate likes.",
      columns: [
        {
          name: "user_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "users.id",
        },
        {
          name: "tweet_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "tweets.id",
        },
        {
          name: "created_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL", "INDEX"],
          references: null,
        },
      ],
      depends_upon: [1, 2],
    },
    {
      id: 5,
      table_name: "hashtags",
      description:
        "Normalized hashtag dictionary for trend analysis and efficient search.",
      columns: [
        {
          name: "id",
          type: "UUID",
          constraints: ["PK", "NOT NULL"],
          references: null,
        },
        {
          name: "tag",
          type: "VARCHAR(100)",
          constraints: ["UNIQUE", "NOT NULL", "INDEX"],
          references: null,
        },
        {
          name: "tweet_count",
          type: "INT",
          constraints: ["DEFAULT"],
          references: null,
        },
        {
          name: "created_at",
          type: "TIMESTAMPTZ",
          constraints: ["NOT NULL"],
          references: null,
        },
      ],
      depends_upon: [],
    },
    {
      id: 6,
      table_name: "tweet_hashtags",
      description: "Many-to-many junction between tweets and hashtags.",
      columns: [
        {
          name: "tweet_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "tweets.id",
        },
        {
          name: "hashtag_id",
          type: "UUID",
          constraints: ["PK", "FK", "NOT NULL"],
          references: "hashtags.id",
        },
      ],
      depends_upon: [2, 5],
    },
  ],
}

export const MOCK_EXAMPLES: Record<string, AnyResponse> = {
  flow: {
    type: "flow",
    nodes: [
      {
        id: 1,
        title: "Sunlight Absorption",
        description:
          "Chlorophyll in the thylakoid membrane absorbs red and blue light wavelengths, reflecting green light back to our eyes.",
        depends_upon: [],
        category: "input",
      },
      {
        id: 2,
        title: "Water Splitting",
        description:
          "Water molecules (H2O) are split via photolysis in the light reactions, releasing O2 as a byproduct and freeing electrons.",
        depends_upon: [1],
        category: "process",
      },
      {
        id: 3,
        title: "Electron Transport Chain",
        description:
          "Freed electrons pass through protein complexes in the thylakoid membrane, pumping protons and generating a gradient.",
        depends_upon: [2],
        category: "process",
      },
      {
        id: 4,
        title: "ATP & NADPH Synthesis",
        description:
          "The proton gradient drives ATP synthase to produce ATP. NADP+ is reduced to NADPH, storing chemical energy.",
        depends_upon: [3],
        category: "process",
      },
      {
        id: 5,
        title: "CO2 Fixation (Calvin Cycle)",
        description:
          "RuBisCO enzyme in the stroma fixes atmospheric CO2 into 3-carbon molecules (3-PGA) using ATP and NADPH.",
        depends_upon: [4],
        category: "process",
      },
      {
        id: 6,
        title: "Glucose Synthesis",
        description:
          "The Calvin cycle reduces 3-PGA into G3P, which is used to synthesize glucose (C6H12O6) and other carbohydrates.",
        depends_upon: [5],
        category: "output",
      },
    ],
  },

  mindmap: {
    type: "mindmap",
    nodes: [
      {
        id: 1,
        label: "Machine Learning",
        detail: "A subset of AI that enables systems to learn from data.",
        parent_id: null,
        level: 0,
      },
      {
        id: 2,
        label: "Supervised Learning",
        detail: "Learns from labeled training data.",
        parent_id: 1,
        level: 1,
      },
      {
        id: 3,
        label: "Unsupervised Learning",
        detail: "Finds patterns in unlabeled data.",
        parent_id: 1,
        level: 1,
      },
      {
        id: 4,
        label: "Reinforcement Learning",
        detail: "Learns via rewards and penalties.",
        parent_id: 1,
        level: 1,
      },
      {
        id: 5,
        label: "Neural Networks",
        detail: "Deep learning foundations.",
        parent_id: 1,
        level: 1,
      },
      {
        id: 6,
        label: "Classification",
        detail: "Predicts discrete categories (e.g. spam/not spam).",
        parent_id: 2,
        level: 2,
      },
      {
        id: 7,
        label: "Regression",
        detail: "Predicts continuous values (e.g. house prices).",
        parent_id: 2,
        level: 2,
      },
      {
        id: 8,
        label: "K-Means Clustering",
        detail: "Groups data into k clusters by similarity.",
        parent_id: 3,
        level: 2,
      },
      {
        id: 9,
        label: "Dimensionality Reduction",
        detail: "PCA reduces features while preserving variance.",
        parent_id: 3,
        level: 2,
      },
      {
        id: 10,
        label: "Q-Learning",
        detail: "Agent learns optimal actions via Q-value table.",
        parent_id: 4,
        level: 2,
      },
      {
        id: 11,
        label: "Policy Gradients",
        detail: "Directly optimizes the agent's policy function.",
        parent_id: 4,
        level: 2,
      },
      {
        id: 12,
        label: "CNNs",
        detail: "Convolutional nets excel at image recognition.",
        parent_id: 5,
        level: 2,
      },
      {
        id: 13,
        label: "Transformers",
        detail: "Attention-based architecture powering LLMs.",
        parent_id: 5,
        level: 2,
      },
    ],
  },

  timeline: {
    type: "timeline",
    nodes: [
      {
        id: 1,
        title: "ARPANET Goes Live",
        description:
          "The US Defense Department's ARPANET sends its first message between UCLA and Stanford, marking the birth of networked computing.",
        date_label: "1969",
        depends_upon: [],
      },
      {
        id: 2,
        title: "TCP/IP Protocol Defined",
        description:
          "Vint Cerf and Bob Kahn publish the TCP/IP specification, creating the universal language all internet devices still use today.",
        date_label: "1974",
        depends_upon: [1],
      },
      {
        id: 3,
        title: "Domain Name System (DNS)",
        description:
          "DNS is introduced, replacing numeric IP addresses with human-readable domain names like 'example.com'.",
        date_label: "1983",
        depends_upon: [2],
      },
      {
        id: 4,
        title: "World Wide Web Invented",
        description:
          "Tim Berners-Lee at CERN proposes the WWW — HTML, HTTP, and URLs — turning the internet into a navigable information space.",
        date_label: "1991",
        depends_upon: [3],
      },
      {
        id: 5,
        title: "Netscape & the Browser Wars",
        description:
          "Netscape Navigator launches, making the web accessible to the public and triggering fierce competition with Microsoft's Internet Explorer.",
        date_label: "1994",
        depends_upon: [4],
      },
      {
        id: 6,
        title: "Google Founded",
        description:
          "Larry Page and Sergey Brin found Google, introducing PageRank and transforming how people discover information online.",
        date_label: "1998",
        depends_upon: [5],
      },
      {
        id: 7,
        title: "Web 2.0 & Social Media",
        description:
          "YouTube, Facebook, and Twitter launch, shifting the web from static pages to user-generated content and social networks.",
        date_label: "2004–2006",
        depends_upon: [6],
      },
      {
        id: 8,
        title: "Mobile Internet Dominance",
        description:
          "The iPhone launches, and by 2016 mobile traffic surpasses desktop, fundamentally changing how and where people access the internet.",
        date_label: "2007–2016",
        depends_upon: [7],
      },
    ],
  },

  comparison: {
    type: "comparison",
    title_a: "React",
    title_b: "Vue",
    items: [
      {
        id: 1,
        category: "Learning Curve",
        option_a:
          "Steeper — JSX and ecosystem choices can overwhelm beginners.",
        option_b:
          "Gentler — single-file components and clear docs make it beginner-friendly.",
        winner: "b",
      },
      {
        id: 2,
        category: "Performance",
        option_a:
          "Excellent with virtual DOM and concurrent rendering in React 18.",
        option_b:
          "Excellent with virtual DOM; Vue 3 Proxy-based reactivity is very fast.",
        winner: null,
      },
      {
        id: 3,
        category: "Ecosystem Size",
        option_a:
          "Massive — largest frontend ecosystem, most jobs, most libraries.",
        option_b:
          "Large but smaller — fewer third-party libraries and job postings.",
        winner: "a",
      },
      {
        id: 4,
        category: "State Management",
        option_a:
          "Context + hooks or Redux/Zustand/Jotai — flexible but fragmented.",
        option_b:
          "Pinia (Vue 3) is simpler and more opinionated out of the box.",
        winner: "b",
      },
      {
        id: 5,
        category: "Company Backing",
        option_a: "Meta (Facebook) — battle-tested at massive scale.",
        option_b:
          "Community-driven with Evan You leading — independent and focused.",
        winner: null,
      },
      {
        id: 6,
        category: "TypeScript Support",
        option_a: "Excellent — built with TS in mind, strong tooling.",
        option_b:
          "Excellent in Vue 3 — rewritten in TypeScript with full support.",
        winner: null,
      },
      {
        id: 7,
        category: "Job Market",
        option_a:
          "Dominant — React skills are required in most frontend roles.",
        option_b: "Growing but React is far more in-demand globally.",
        winner: "a",
      },
    ],
    verdict:
      "React wins for career opportunities and ecosystem size. Vue wins for developer experience and simplicity. Choose React for enterprise/career, Vue for productivity and smaller teams.",
  },
}
