/**
 * API Configuration for API Sequence Runner
 * Configure different environments and settings
 */

module.exports = {
  // environment-specific configurations
  environments: {
    local: {
      baseUrl: "http://localhost:3000",
      timeout: 5000,
      headers: {
        Accept: "application/json",
        "User-Agent": "API-Sequence-Runner/1.0",
      },
    },

    development: {
      baseUrl: "https://dev-api.example.com",
      timeout: 10000,
      headers: {
        Accept: "application/json",
        "User-Agent": "API-Sequence-Runner/1.0",
      },
    },

    staging: {
      baseUrl: "https://staging-api.example.com",
      timeout: 10000,
      headers: {
        Accept: "application/json",
        "User-Agent": "API-Sequence-Runner/1.0",
      },
    },

    production: {
      baseUrl: "https://api.example.com",
      timeout: 15000,
      headers: {
        Accept: "application/json",
        "User-Agent": "API-Sequence-Runner/1.0",
      },
    },
  },

  // default configuration
  default: {
    timeout: 10000,
    retries: 3,
    retryDelay: 1000,
    requestDelay: 0,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  },

  // authentication settings
  auth: {
    // api key authentication
    apiKey: process.env.API_KEY,

    // bearer token authentication
    bearerToken: process.env.BEARER_TOKEN,

    // basic authentication
    username: process.env.API_USERNAME,
    password: process.env.API_PASSWORD,

    // custom headers
    customHeaders: {
      // 'X-API-Version': '1.0',
      // 'X-Client-ID': 'api-sequence-runner'
    },
  },

  // validation settings
  validation: {
    // strict mode - fail on any validation error
    strict: true,

    // skip SSL certificate validation (for development)
    skipSslVerification: false,
  },

  // reporting settings
  reporting: {
    // generate JSON report
    json: {
      enabled: true,
      outputFile: "./reports/api-sequence-runner-report.json",
    },

    // generate HTML report
    html: {
      enabled: false,
      outputFile: "./reports/api-sequence-runner-report.html",
    },
  },
};
