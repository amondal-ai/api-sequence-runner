class Validator {
  constructor() {
    this.builtInValidators = {
      // status code validators
      status200: (response) => response.status === 200,
      status201: (response) => response.status === 201,
      status204: (response) => response.status === 204,
      status400: (response) => response.status === 400,
      status401: (response) => response.status === 401,
      status403: (response) => response.status === 403,
      status404: (response) => response.status === 404,
      status500: (response) => response.status === 500,
      statusSuccess: (response) =>
        response.status >= 200 && response.status < 300,
      statusRedirect: (response) =>
        response.status >= 300 && response.status < 400,
      statusClientError: (response) =>
        response.status >= 400 && response.status < 500,
      statusServerError: (response) =>
        response.status >= 500 && response.status < 600,

      // content type validators
      hasContentType: (response) =>
        response.headers && response.headers["content-type"],
      isJson: (response) => {
        const contentType =
          response.headers && response.headers["content-type"];
        return contentType && contentType.includes("application/json");
      },
      isXml: (response) => {
        const contentType =
          response.headers && response.headers["content-type"];
        return (
          contentType &&
          (contentType.includes("application/xml") ||
            contentType.includes("text/xml"))
        );
      },
      isHtml: (response) => {
        const contentType =
          response.headers && response.headers["content-type"];
        return contentType && contentType.includes("text/html");
      },
    };
  }

  async validate(validator, response) {
    try {
      let result;

      if (typeof validator === "function") {
        // Custom validation function
        result = await validator(response);
      } else if (
        typeof validator === "string" &&
        this.builtInValidators[validator]
      ) {
        // Built-in validator by name
        result = this.builtInValidators[validator](response);
      } else if (typeof validator === "object" && validator !== null) {
        // Validation object with multiple checks
        result = await this.validateObject(validator, response);
      } else {
        console.warn(
          `Invalid validator type: ${typeof validator}. Expected function, string, or object.`
        );
        return false;
      }

      if (typeof result !== "boolean") {
        console.warn(
          `Validator returned non-boolean value: ${result}. Treating as false.`
        );
        result = Boolean(result);
      }

      return result;
    } catch (error) {
      console.error(`Validation error: ${error.message}`);
      return false;
    }
  }

  async validateObject(validatorObj, response) {
    for (const [key, validator] of Object.entries(validatorObj)) {
      const isValid = await this.validate(validator, response);
      if (!isValid) {
        console.error(`Validation failed for: ${key}`);
        return false;
      }
    }
    return true;
  }

  // schema validation helper using simple JSON schema-like structure
  validateSchema(schema, data) {
    return this.validateSchemaRecursive(schema, data, "root");
  }

  validateSchemaRecursive(schema, data, path) {
    try {
      // type validation
      if (schema.type) {
        const actualType = this.getDataType(data);
        if (actualType !== schema.type) {
          console.error(
            `Schema validation failed at ${path}: expected ${schema.type}, got ${actualType}`
          );
          return false;
        }
      }

      // enum validation
      if (schema.enum && Array.isArray(schema.enum)) {
        if (!schema.enum.includes(data)) {
          console.error(
            `Schema validation failed at ${path}: value '${data}' not in allowed values [${schema.enum.join(
              ", "
            )}]`
          );
          return false;
        }
      }

      // required field validation
      if (schema.required && Array.isArray(schema.required)) {
        if (!data || typeof data !== "object") {
          console.error(
            `Schema validation failed at ${path}: expected object with required fields`
          );
          return false;
        }

        for (const field of schema.required) {
          if (!data.hasOwnProperty(field)) {
            console.error(
              `Schema validation failed at ${path}: missing required field '${field}'`
            );
            return false;
          }
        }
      }

      // properties validation
      if (schema.properties && typeof data === "object" && data !== null) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (data.hasOwnProperty(prop)) {
            const isValid = this.validateSchemaRecursive(
              propSchema,
              data[prop],
              `${path}.${prop}`
            );
            if (!isValid) {
              return false;
            }
          }
        }
      }

      // array items validation
      if (schema.items && Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const isValid = this.validateSchemaRecursive(
            schema.items,
            data[i],
            `${path}[${i}]`
          );
          if (!isValid) {
            return false;
          }
        }
      }

      // array length validation
      if (Array.isArray(data)) {
        if (schema.minItems !== undefined && data.length < schema.minItems) {
          console.error(
            `Schema validation failed at ${path}: array length ${data.length} is less than minimum ${schema.minItems}`
          );
          return false;
        }

        if (schema.maxItems !== undefined && data.length > schema.maxItems) {
          console.error(
            `Schema validation failed at ${path}: array length ${data.length} is greater than maximum ${schema.maxItems}`
          );
          return false;
        }
      }

      // string length validation
      if (typeof data === "string") {
        if (schema.minLength !== undefined && data.length < schema.minLength) {
          console.error(
            `Schema validation failed at ${path}: string length ${data.length} is less than minimum ${schema.minLength}`
          );
          return false;
        }

        if (schema.maxLength !== undefined && data.length > schema.maxLength) {
          console.error(
            `Schema validation failed at ${path}: string length ${data.length} is greater than maximum ${schema.maxLength}`
          );
          return false;
        }

        if (schema.pattern) {
          const regex = new RegExp(schema.pattern);
          if (!regex.test(data)) {
            console.error(
              `Schema validation failed at ${path}: string '${data}' does not match pattern ${schema.pattern}`
            );
            return false;
          }
        }
      }

      // number validation
      if (typeof data === "number") {
        if (schema.minimum !== undefined && data < schema.minimum) {
          console.error(
            `Schema validation failed at ${path}: value ${data} is less than minimum ${schema.minimum}`
          );
          return false;
        }

        if (schema.maximum !== undefined && data > schema.maximum) {
          console.error(
            `Schema validation failed at ${path}: value ${data} is greater than maximum ${schema.maximum}`
          );
          return false;
        }
      }

      // custom validation function
      if (schema.validate && typeof schema.validate === "function") {
        try {
          const result = schema.validate(data);
          if (!result) {
            console.error(`Custom schema validation failed at ${path}`);
            return false;
          }
        } catch (error) {
          console.error(
            `Custom schema validation error at ${path}: ${error.message}`
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Schema validation error at ${path}: ${error.message}`);
      return false;
    }
  }

  getDataType(data) {
    if (data === null) return "null";
    if (Array.isArray(data)) return "array";
    return typeof data;
  }
}

// helper function to get nested object values
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;

  return path.split(".").reduce((current, key) => {
    // handle array notation like "items[0]" or "items[0].name"
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, index] = arrayMatch;
      const array = current && current[arrayKey];
      return Array.isArray(array) ? array[parseInt(index, 10)] : undefined;
    }

    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// validator methods exposed under validators
const validators = {
  // status code validators
  status: (code) => (response) => response.status === code,
  statusIn: (codes) => (response) => codes.includes(response.status),
  statusRange: (min, max) => (response) =>
    response.status >= min && response.status <= max,
  statusNot: (code) => (response) => response.status !== code,
  statusSuccess: (response) => response.status >= 200 && response.status < 300,
  statusRedirect: (response) => response.status >= 300 && response.status < 400,
  statusClientError: (response) =>
    response.status >= 400 && response.status < 500,
  statusServerError: (response) =>
    response.status >= 500 && response.status < 600,

  // data presence validators
  hasData: (response) => response.data !== null && response.data !== undefined,
  hasField: (fieldPath) => (response) => {
    return getNestedValue(response.data, fieldPath) !== undefined;
  },
  hasId: (response) => response.data && response.data.id,
  hasMessage: (response) => response.data && response.data.message,
  hasError: (response) => response.data && response.data.error,

  // data type validators
  isArray: (response) => Array.isArray(response.data),
  isObject: (response) =>
    typeof response.data === "object" &&
    response.data !== null &&
    !Array.isArray(response.data),
  isString: (response) => typeof response.data === "string",
  isNumber: (response) => typeof response.data === "number",
  isBoolean: (response) => typeof response.data === "boolean",

  // data content validators
  notEmpty: (response) => {
    if (Array.isArray(response.data)) {
      return response.data.length > 0;
    }
    if (typeof response.data === "object" && response.data !== null) {
      return Object.keys(response.data).length > 0;
    }
    return response.data != null && response.data !== "";
  },

  isEmpty: (response) => {
    if (Array.isArray(response.data)) {
      return response.data.length === 0;
    }
    if (typeof response.data === "object" && response.data !== null) {
      return Object.keys(response.data).length === 0;
    }
    return response.data == null || response.data === "";
  },

  // field validators
  fieldEquals: (fieldPath, value) => (response) => {
    return getNestedValue(response.data, fieldPath) === value;
  },
  fieldNotEquals: (fieldPath, value) => (response) => {
    return getNestedValue(response.data, fieldPath) !== value;
  },
  fieldMatches: (fieldPath, regex) => (response) => {
    const value = getNestedValue(response.data, fieldPath);
    return typeof value === "string" && regex.test(value);
  },
  fieldExists: (fieldPath) => (response) => {
    return getNestedValue(response.data, fieldPath) !== undefined;
  },
  fieldType: (fieldPath, expectedType) => (response) => {
    const value = getNestedValue(response.data, fieldPath);
    const actualType = Array.isArray(value) ? "array" : typeof value;
    return actualType === expectedType;
  },

  // array validators
  arrayLength: (expectedLength) => (response) => {
    return (
      Array.isArray(response.data) && response.data.length === expectedLength
    );
  },
  arrayMinLength: (minLength) => (response) => {
    return Array.isArray(response.data) && response.data.length >= minLength;
  },
  arrayMaxLength: (maxLength) => (response) => {
    return Array.isArray(response.data) && response.data.length <= maxLength;
  },
  arrayContains: (value) => (response) => {
    return Array.isArray(response.data) && response.data.includes(value);
  },
  arrayNotContains: (value) => (response) => {
    return Array.isArray(response.data) && !response.data.includes(value);
  },

  // header validators
  hasHeader: (headerName) => (response) => {
    return (
      response.headers &&
      response.headers[headerName.toLowerCase()] !== undefined
    );
  },
  headerEquals: (headerName, value) => (response) => {
    return (
      response.headers && response.headers[headerName.toLowerCase()] === value
    );
  },
  headerMatches: (headerName, regex) => (response) => {
    const headerValue =
      response.headers && response.headers[headerName.toLowerCase()];
    return typeof headerValue === "string" && regex.test(headerValue);
  },

  // content type validators
  hasContentType: (response) =>
    response.headers && response.headers["content-type"],
  isJson: (response) => {
    const contentType = response.headers && response.headers["content-type"];
    return contentType && contentType.includes("application/json");
  },
  isXml: (response) => {
    const contentType = response.headers && response.headers["content-type"];
    return (
      contentType &&
      (contentType.includes("application/xml") ||
        contentType.includes("text/xml"))
    );
  },
  isHtml: (response) => {
    const contentType = response.headers && response.headers["content-type"];
    return contentType && contentType.includes("text/html");
  },

  // schema validators
  schema: (schema) => (response) => {
    const validator = new Validator();
    return validator.validateSchema(schema, response.data);
  },

  // combination validators
  and:
    (...validators) =>
    async (response) => {
      const validator = new Validator();
      for (const v of validators) {
        const result = await validator.validate(v, response);
        if (!result) return false;
      }
      return true;
    },

  or:
    (...validators) =>
    async (response) => {
      const validator = new Validator();
      for (const v of validators) {
        const result = await validator.validate(v, response);
        if (result) return true;
      }
      return false;
    },

  not: (validatorToNegate) => async (response) => {
    const validator = new Validator();
    const result = await validator.validate(validatorToNegate, response);
    return !result;
  },

  // utility validators
  custom: (validationFn) => validationFn,
  always: () => () => true,
  never: () => () => false,
};

module.exports = { Validator, validators };
