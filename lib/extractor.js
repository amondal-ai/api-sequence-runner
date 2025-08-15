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

module.exports = { Extractor };
