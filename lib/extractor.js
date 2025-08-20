class Extractor {
  constructor() {
    this.builtInExtractors = {
      // common response extractors
      id: (response) => response.data?.id,
      status: (response) => response.status,
      statusText: (response) => response.statusText,
      message: (response) => response.data?.message,
      error: (response) => response.data?.error,
      success: (response) => response.data?.success,

      // header extractors with AxiosHeaders support
      location: (response) => this.extractByPath("headers.location", response),
      contentType: (response) =>
        this.extractByPath("headers.content-type", response),
      contentLength: (response) =>
        this.extractByPath("headers.content-length", response),
      setCookie: (response) =>
        this.extractByPath("headers.set-cookie", response),
      etag: (response) => this.extractByPath("headers.etag", response),
      lastModified: (response) =>
        this.extractByPath("headers.last-modified", response),

      // data extractors
      data: (response) => response.data,
      fullResponse: (response) => response,
      headers: (response) => response.headers,

      // array extractors
      firstItem: (response) =>
        Array.isArray(response.data) ? response.data[0] : null,
      lastItem: (response) =>
        Array.isArray(response.data)
          ? response.data[response.data.length - 1]
          : null,
      count: (response) =>
        Array.isArray(response.data) ? response.data.length : null,
      secondItem: (response) =>
        Array.isArray(response.data) ? response.data[1] : null,

      // timestamp extractors
      timestamp: () => new Date().toISOString(),
      unixTimestamp: () => Math.floor(Date.now() / 1000),
      dateNow: () => new Date(),

      // utility extractors
      null: () => null,
      undefined: () => undefined,
      empty: () => "",
      emptyArray: () => [],
      emptyObject: () => ({}),

      // response metadata
      // cookie extractors for set-cookie header
      firstCookie: (response) => {
        const cookies = this.extractByPath("headers.set-cookie", response);
        return Array.isArray(cookies) ? cookies[0] : null;
      },

      // response metadata
      responseSize: (response) => {
        if (response.data) {
          return JSON.stringify(response.data).length;
        }
        return 0;
      },
    };
  }

  extract(extractConfig, response) {
    const extracted = {};

    for (const [variableName, extractor] of Object.entries(extractConfig)) {
      try {
        let value;

        if (typeof extractor === "string") {
          // check for built-in extractors first
          if (this.builtInExtractors[extractor]) {
            value = this.builtInExtractors[extractor](response);
          } else {
            // string path extractor (e.g., "data.user.id")
            value = this.extractByPath(extractor, response);
          }
        } else if (typeof extractor === "function") {
          // custom extraction function
          value = extractor(response);
        } else if (typeof extractor === "object" && extractor !== null) {
          // complex extraction configuration
          value = this.extractComplex(extractor, response);
        } else {
          console.warn(
            `Unknown extractor type for variable '${variableName}': ${typeof extractor}`
          );
          continue;
        }

        extracted[variableName] = value;
      } catch (error) {
        console.error(
          `Extraction failed for variable '${variableName}': ${error.message}`
        );
        // continue with other extractions instead of failing completely
      }
    }

    return extracted;
  }

  extractByPath(path, response) {
    try {
      // handle special root paths
      if (path === "status") {
        return response.status;
      }

      if (path === "statusText") {
        return response.statusText;
      }

      if (path.startsWith("headers.")) {
        const headerName = path.substring(8); // Remove 'headers.'
        return response.headers?.[headerName.toLowerCase()];
      }

      // default to data path
      let current = response.data;
      const pathParts = path.split(".");

      // skip 'data' if it's the first part of the path
      const startIndex = pathParts[0] === "data" ? 1 : 0;

      for (let i = startIndex; i < pathParts.length; i++) {
        const part = pathParts[i];

        if (current === null || current === undefined) {
          return undefined;
        }

        // handle array index notation (e.g., items[0], items[0].name)
        const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, arrayName, index] = arrayMatch;
          current = current[arrayName];
          if (Array.isArray(current)) {
            current = current[parseInt(index, 10)];
          } else {
            return undefined;
          }
        } else {
          current = current[part];
        }
      }

      return current;
    } catch (error) {
      console.warn(`Path extraction failed for '${path}': ${error.message}`);
      return undefined;
    }
  }

  extractComplex(config, response) {
    try {
      if (config.path) {
        let value = this.extractByPath(config.path, response);

        // apply transformations
        if (config.transform && typeof config.transform === "function") {
          value = config.transform(value, response);
        }

        // apply filters
        if (config.filter && typeof config.filter === "function") {
          if (!config.filter(value, response)) {
            value = undefined;
          }
        }

        // apply default value if extraction resulted in undefined/null
        if (
          (value === undefined || value === null) &&
          config.default !== undefined
        ) {
          value = config.default;
        }

        return value;
      }

      if (config.multiple) {
        // extract multiple values and combine them
        const results = {};
        for (const [key, extractor] of Object.entries(config.multiple)) {
          results[key] = this.extract({ [key]: extractor }, response)[key];
        }
        return results;
      }

      if (config.conditional) {
        // conditional extraction based on response content
        for (const condition of config.conditional) {
          if (this.evaluateCondition(condition.if, response)) {
            return this.extract({ value: condition.then }, response).value;
          }
        }

        // return default if no conditions matched
        return config.default;
      }

      if (config.array) {
        // array-specific extractions
        const array = this.extractByPath(config.array.path || "data", response);
        if (!Array.isArray(array)) {
          return config.default || [];
        }

        if (config.array.map) {
          // map over array items
          return array.map((item, index) => {
            const mockResponse = { data: item, index };
            return this.extract({ item: config.array.map }, mockResponse).item;
          });
        }

        if (config.array.filter) {
          // filter array items
          return array.filter(config.array.filter);
        }

        if (config.array.find) {
          // find first matching item
          return array.find(config.array.find);
        }

        if (config.array.pluck) {
          // extract specific field from each item
          return array.map((item) =>
            this.extractByPath(config.array.pluck, { data: item })
          );
        }

        return array;
      }

      if (config.computed) {
        // computed value based on entire response
        return config.computed(response);
      }

      if (config.regex) {
        // extract using regular expression
        const source = config.source
          ? this.extractByPath(config.source, response)
          : JSON.stringify(response);
        if (typeof source === "string") {
          const match = source.match(new RegExp(config.regex));
          if (match) {
            return config.group !== undefined ? match[config.group] : match[0];
          }
        }
        return config.default;
      }

      return undefined;
    } catch (error) {
      console.warn(`Complex extraction failed: ${error.message}`);
      return config.default;
    }
  }

  evaluateCondition(condition, response) {
    try {
      if (typeof condition === "function") {
        return condition(response);
      }

      if (typeof condition === "object" && condition !== null) {
        // simple condition object { path: "data.status", equals: "success" }
        if (condition.path && condition.equals !== undefined) {
          const value = this.extractByPath(condition.path, response);
          return value === condition.equals;
        }

        if (condition.path && condition.notEquals !== undefined) {
          const value = this.extractByPath(condition.path, response);
          return value !== condition.notEquals;
        }

        if (condition.path && condition.matches) {
          const value = this.extractByPath(condition.path, response);
          return typeof value === "string" && condition.matches.test(value);
        }

        if (condition.path && condition.exists !== undefined) {
          const value = this.extractByPath(condition.path, response);
          return condition.exists ? value !== undefined : value === undefined;
        }

        if (condition.status) {
          return response.status === condition.status;
        }

        if (condition.statusRange) {
          const [min, max] = condition.statusRange;
          return response.status >= min && response.status <= max;
        }
      }

      return false;
    } catch (error) {
      console.warn(`Condition evaluation failed: ${error.message}`);
      return false;
    }
  }

  // static helper methods for creating common extractors
  static createExtractors() {
    return {
      // path-based extractors
      path: (pathString) => (response) => {
        const extractor = new Extractor();
        return extractor.extractByPath(pathString, response);
      },

      // transform extractors
      transform: (pathString, transformFn) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        return transformFn ? transformFn(value, response) : value;
      },

      // default value extractors
      withDefault: (pathString, defaultValue) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        return value !== undefined ? value : defaultValue;
      },

      // array extractors
      arrayMap: (arrayPath, itemExtractor) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array)) return [];

        return array.map((item, index) => {
          const mockResponse = { data: item, index };
          return extractor.extract({ item: itemExtractor }, mockResponse).item;
        });
      },

      arrayFilter: (arrayPath, filterFn) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array)) return [];

        return array.filter(filterFn);
      },

      arrayFind: (arrayPath, findFn) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array)) return null;

        return array.find(findFn);
      },

      arrayPluck: (arrayPath, fieldPath) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array)) return [];

        return array.map((item) =>
          extractor.extractByPath(fieldPath, { data: item })
        );
      },

      arrayLength: (arrayPath) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        return Array.isArray(array) ? array.length : 0;
      },

      // conditional extractors
      conditional: (conditions) => (response) => {
        const extractor = new Extractor();
        return extractor.extractComplex({ conditional: conditions }, response);
      },

      // computed extractors
      computed: (computeFn) => (response) => {
        return computeFn(response);
      },

      // regular expression extractors
      regex:
        (source, pattern, group = 0) =>
        (response) => {
          const extractor = new Extractor();
          return extractor.extractComplex(
            {
              regex: pattern,
              source: source,
              group: group,
            },
            response
          );
        },

      // header cookie value
      cookieValue: (cookieName) => (response) => {
        const extractor = new Extractor();
        const cookies = extractor.extractByPath("headers.set-cookie", response);
        if (!Array.isArray(cookies)) return null;

        for (const cookie of cookies) {
          if (typeof cookie === "string" && cookie.includes(`${cookieName}=`)) {
            const match = cookie.match(new RegExp(`${cookieName}=([^;]+)`));
            return match ? decodeURIComponent(match[1]) : null;
          }
        }
        return null;
      },

      // url extractors (useful for extracting IDs from location headers)
      urlPath: (segment) => (response) => {
        const location = response.headers?.location;
        if (!location) return null;

        try {
          const url = new URL(location, "http://localhost"); // dummy base for relative URLs
          const pathParts = url.pathname.split("/").filter(Boolean);

          if (typeof segment === "number") {
            return pathParts[segment] || null;
          } else if (typeof segment === "string") {
            const index = pathParts.indexOf(segment);
            return index !== -1 && index + 1 < pathParts.length
              ? pathParts[index + 1]
              : null;
          }

          return pathParts;
        } catch (error) {
          console.warn(`URL parsing failed: ${error.message}`);
          return null;
        }
      },

      urlQuery: (paramName) => (response) => {
        const location = response.headers?.location;
        if (!location) return null;

        try {
          const url = new URL(location, "http://localhost");
          return url.searchParams.get(paramName);
        } catch (error) {
          console.warn(`URL query parsing failed: ${error.message}`);
          return null;
        }
      },

      // json path extractors (JSONPath-like functionality)
      jsonPath: (jsonPathExpression) => (response) => {
        // simple JSONPath implementation for basic cases
        const extractor = new Extractor();

        if (jsonPathExpression.startsWith("$.")) {
          const path = jsonPathExpression.substring(2); // remove '$.'
          return extractor.extractByPath(path, response);
        }

        // todo: for more complex JSONPath expressions, might want to use a library like 'jsonpath'
        console.warn(
          `Complex JSONPath expressions not supported: ${jsonPathExpression}`
        );
        return undefined;
      },

      // type conversion extractors
      toString: (pathString) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        return value !== null && value !== undefined ? String(value) : "";
      },

      toNumber: (pathString) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      },

      toBoolean: (pathString) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        return Boolean(value);
      },

      // date extractors
      toDate: (pathString) => (response) => {
        const extractor = new Extractor();
        const value = extractor.extractByPath(pathString, response);
        try {
          return value ? new Date(value) : null;
        } catch (error) {
          return null;
        }
      },

      formatDate:
        (pathString, format = "ISO") =>
        (response) => {
          const extractor = new Extractor();
          const value = extractor.extractByPath(pathString, response);
          try {
            const date = new Date(value);
            if (format === "ISO") {
              return date.toISOString();
            } else if (format === "locale") {
              return date.toLocaleString();
            } else if (format === "date") {
              return date.toDateString();
            } else if (format === "time") {
              return date.toTimeString();
            }
            return date.toString();
          } catch (error) {
            return null;
          }
        },

      // math extractors
      sum: (arrayPath) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array)) return 0;

        return array.reduce((sum, item) => {
          const num = Number(item);
          return sum + (isNaN(num) ? 0 : num);
        }, 0);
      },

      average: (arrayPath) => (response) => {
        const extractor = new Extractor();
        const array = extractor.extractByPath(arrayPath, response);
        if (!Array.isArray(array) || array.length === 0) return 0;

        const sum = array.reduce((total, item) => {
          const num = Number(item);
          return total + (isNaN(num) ? 0 : num);
        }, 0);

        return sum / array.length;
      },

      // utility extractors
      constant: (value) => () => value,

      combine:
        (...extractors) =>
        (response) => {
          const extractor = new Extractor();
          const results = [];

          for (const ext of extractors) {
            results.push(extractor.extract({ value: ext }, response).value);
          }

          return results;
        },

      format:
        (template, ...extractors) =>
        (response) => {
          const extractor = new Extractor();
          const values = extractors.map(
            (ext) => extractor.extract({ value: ext }, response).value
          );

          return template.replace(/\{(\d+)\}/g, (match, index) => {
            const i = parseInt(index, 10);
            return values[i] !== undefined ? values[i] : match;
          });
        },
    };
  }
}

// random data generators
const RandomDataGenerators = {
  randomEmail: (domain = null) => {
    const domains = domain
      ? [domain]
      : ["example.com", "test.com", "demo.org", "sample.net"];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];

    return `test-${Date.now()}${Math.floor(
      Math.random() * 1000
    )}@${randomDomain}`;
  },

  randomUserName: () => {
    const adjectives = [
      "quick",
      "bright",
      "cool",
      "smart",
      "fast",
      "nice",
      "good",
      "best",
      "agile",
      "lazy",
    ];
    const nouns = [
      "user",
      "tester",
      "demo",
      "sample",
      "trial",
      "test",
      "bot",
      "machine",
      "mock",
      "connection",
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 10000);
    return `${adj}-${noun}-${num}`;
  },

  randomFirstName: () => {
    const names = [
      "John",
      "Jane",
      "Michael",
      "Sarah",
      "David",
      "Emily",
      "Robert",
      "Lisa",
      "James",
      "Maria",
      "William",
      "Jennifer",
      "Richard",
      "Patricia",
      "Charles",
      "Linda",
      "Joseph",
      "Barbara",
      "Thomas",
      "Elizabeth",
      "Christopher",
      "Susan",
    ];
    return names[Math.floor(Math.random() * names.length)];
  },

  randomLastName: () => {
    const names = [
      "Smith",
      "Johnson",
      "Williams",
      "Brown",
      "Jones",
      "Garcia",
      "Miller",
      "Davis",
      "Rodriguez",
      "Martinez",
      "Hernandez",
      "Lopez",
      "Gonzalez",
      "Wilson",
      "Anderson",
      "Thomas",
      "Taylor",
      "Moore",
      "Jackson",
      "Martin",
    ];
    return names[Math.floor(Math.random() * names.length)];
  },

  randomFullName: () => {
    return `${this.builtInExtractors.randomFirstName()} ${this.builtInExtractors.randomLastName()}`;
  },

  randomPhoneNumber: () => {
    let phoneNumber = `${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    // format the number (e.g., (XXX) XXX-XXXX)
    return `(${phoneNumber.substring(0, 3)}) ${phoneNumber.substring(
      3,
      6
    )}-${phoneNumber.substring(6, 10)}`;
  },

  randomCompanyName: () => {
    const prefixes = [
      "Tech",
      "Digital",
      "Smart",
      "Global",
      "Advanced",
      "Future",
      "Innovative",
    ];
    const suffixes = [
      "Solutions",
      "Systems",
      "Corp",
      "Inc",
      "LLC",
      "Technologies",
      "Enterprises",
    ];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    return `${prefix} ${suffix}`;
  },

  randomJobTitle: () => {
    const titles = [
      "Software Engineer",
      "Product Manager",
      "Sales Representative",
      "Marketing Specialist",
      "Data Analyst",
      "Business Analyst",
      "Project Manager",
      "UX Designer",
      "Operations Manager",
      "Customer Success Manager",
      "DevOps Engineer",
      "QA Engineer",
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  },

  randomAlphaNumericCode: () => {
    const alphaNumeric = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 16; i++) {
      result += alphaNumeric.charAt(
        Math.floor(Math.random() * alphaNumeric.length)
      );
    }
    return result;
  },

  randomDescription: () => {
    const descriptions = [
      "Beautiful residential property",
      "Spacious family home",
      "Modern luxury living",
      "Charming neighborhood gem",
      "Investment opportunity",
      "Prime location property",
      "Amazing place to retire",
      "Tall mountains in the backdrop",
      "Gorgeous winery view",
      "Next to nature",
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  },

  randomStreetNumber: () => Math.floor(Math.random() * 99999).toString(),

  randomStreetName: () => {
    const names = [
      "Main",
      "Oak",
      "Elm",
      "Park",
      "First",
      "Second",
      "Third",
      "Maple",
      "Cedar",
      "Pine",
    ];
    const types = ["St", "Ave", "Rd", "Blvd", "Dr", "Ln", "Ct", "Way"];
    const name = names[Math.floor(Math.random() * names.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    return `${name} ${type}`;
  },

  randomCity: () => {
    const cities = [
      "New York",
      "Los Angeles",
      "Chicago",
      "Houston",
      "Phoenix",
      "Philadelphia",
      "San Antonio",
      "San Diego",
      "Dallas",
      "San Jose",
      "Austin",
      "Jacksonville",
      "Fort Worth",
      "Columbus",
      "Charlotte",
      "San Francisco",
      "Indianapolis",
      "Seattle",
    ];
    return cities[Math.floor(Math.random() * cities.length)];
  },

  randomState: () => {
    const states = [
      "AL",
      "AK",
      "AZ",
      "AR",
      "CA",
      "CO",
      "CT",
      "DE",
      "DC",
      "FL",
      "GA",
      "HI",
      "ID",
      "IL",
      "IN",
      "IA",
      "KS",
      "KY",
      "LA",
      "ME",
      "MD",
      "MA",
      "MI",
      "MN",
      "MS",
      "MO",
      "MT",
      "NE",
      "NV",
      "NH",
      "NJ",
      "NM",
      "NY",
      "NC",
      "ND",
      "OH",
      "OK",
      "OR",
      "PA",
      "RI",
      "SC",
      "SD",
      "TN",
      "TX",
      "UT",
      "VT",
      "VA",
      "WA",
      "WV",
      "WI",
      "WY",
    ];
    return states[Math.floor(Math.random() * states.length)];
  },

  randomZipCode: () => {
    const min = 10000; // smallest 5-digit number
    const max = 99999; // largest 5-digit number
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    return String(randomNumber).padStart(5, "0"); // pad with leading zeros if less than 5 digits
  },

  randomDateFuture: (days = 365) => {
    const future = new Date();
    future.setDate(future.getDate() + Math.floor(Math.random() * days));
    return future.toISOString();
  },

  randomDatePast: (days = 365) => {
    const past = new Date();
    past.setDate(past.getDate() - Math.floor(Math.random() * days));
    return past.toISOString();
  },

  randomDateBetween: (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const randomTime =
      start.getTime() + Math.random() * (end.getTime() - start.getTime());
    return new Date(randomTime).toISOString();
  },
};

const extractors = {
  // random data generator extractors
  randomEmail: (domain) => ({
    func: RandomDataGenerators.randomEmail,
    params: [domain],
  }),
  randomUserName: () => ({
    func: RandomDataGenerators.randomUserName,
    params: [],
  }),
  randomFirstName: () => ({
    func: RandomDataGenerators.randomFirstName,
    params: [],
  }),
  randomLastName: () => ({
    func: RandomDataGenerators.randomLastName,
    params: [],
  }),
  randomPhoneNumber: () => ({
    func: RandomDataGenerators.randomPhoneNumber,
    params: [],
  }),
  randomCompanyName: () => ({
    func: RandomDataGenerators.randomCompanyName,
    params: [],
  }),

  randomJobTitle: () => ({
    func: RandomDataGenerators.randomJobTitle,
    params: [],
  }),

  randomAlphaNumericCode: () => ({
    func: RandomDataGenerators.randomAlphaNumericCode,
    params: [],
  }),

  randomDescription: () => ({
    func: RandomDataGenerators.randomDescription,
    params: [],
  }),
  randomStreetNumber: () => ({
    func: RandomDataGenerators.randomStreetNumber,
    params: [],
  }),
  randomStreetName: () => ({
    func: RandomDataGenerators.randomStreetName,
    params: [],
  }),
  randomCity: () => ({ func: RandomDataGenerators.randomCity, params: [] }),
  randomState: () => ({ func: RandomDataGenerators.randomState, params: [] }),
  randomZipCode: () => ({
    func: RandomDataGenerators.randomZipCode,
    params: [],
  }),
  randomDateFuture: (days) => ({
    func: RandomDataGenerators.randomDateFuture,
    params: [days],
  }),
  randomDatePast: (days) => ({
    func: RandomDataGenerators.randomDatePast,
    params: [days],
  }),

  // response extraction helpers (from createExtractors)
  path: Extractor.createExtractors().path,
  transform: Extractor.createExtractors().transform,
  withDefault: Extractor.createExtractors().withDefault,
  arrayMap: Extractor.createExtractors().arrayMap,
  arrayFilter: Extractor.createExtractors().arrayFilter,
  arrayFind: Extractor.createExtractors().arrayFind,
  arrayPluck: Extractor.createExtractors().arrayPluck,
  arrayLength: Extractor.createExtractors().arrayLength,
  conditional: Extractor.createExtractors().conditional,
  computed: Extractor.createExtractors().computed,
  regex: Extractor.createExtractors().regex,
  cookieValue: Extractor.createExtractors().cookieValue,
  urlPath: Extractor.createExtractors().urlPath,
  urlQuery: Extractor.createExtractors().urlQuery,
  jsonPath: Extractor.createExtractors().jsonPath,
  toString: Extractor.createExtractors().toString,
  toNumber: Extractor.createExtractors().toNumber,
  toBoolean: Extractor.createExtractors().toBoolean,
  toDate: Extractor.createExtractors().toDate,
  formatDate: Extractor.createExtractors().formatDate,
  sum: Extractor.createExtractors().sum,
  average: Extractor.createExtractors().average,
};

module.exports = {
  Extractor,
  extractors,
};
