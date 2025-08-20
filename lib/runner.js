const { ApiClient } = require("./api-client");
const { Validator } = require("./validator");
const { Extractor } = require("./extractor");

class ScenarioRunner {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:3000";
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;
    this.requestDelay = options.requestDelay || 0;

    // initialize components
    this.apiClient = new ApiClient(this.baseUrl, {
      timeout: options.timeout || 10000,
      headers: options.headers || {},
    });

    this.validator = new Validator();
    this.extractor = new Extractor();

    // plugin system
    this.customValidators = new Map();
    this.customExtractors = new Map();
    this.stepTypes = new Map();
    this.middleware = {
      beforeStep: [],
      afterStep: [],
      beforeScenario: [],
      afterScenario: [],
    };
    this.reporters = new Map();

    // set request delay if specified
    if (this.requestDelay > 0) {
      this.apiClient.setRequestDelay(this.requestDelay);
    }
  }

  // main method to run a scenario configuration
  async runScenarioConfig(scenario, configVariables = {}) {
    try {
      console.log(`\n🚀 Running scenario: ${scenario.name}`);

      if (scenario.description) {
        console.log(`📝 Description: ${scenario.description}`);
      }

      if (this.dryRun) {
        console.log("🔍 DRY RUN MODE - No actual API calls will be made\n");
      }

      // run beforeScenario middleware
      await this.runMiddleware("beforeScenario", scenario);

      // initialize context for storing extracted variables
      const context = { ...configVariables };
      const results = [];

      // log available variables if verbose
      if (this.verbose && Object.keys(context).length > 0) {
        console.log("📋 Available config variables:", Object.keys(context));
      }

      // execute steps sequentially
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        const stepNumber = i + 1;

        console.log(`\n--- Step ${stepNumber}: ${step.name} ---`);

        try {
          // run beforeStep middleware
          await this.runMiddleware("beforeStep", step, context);

          const result = await this.executeStep(step, context);
          results.push({ step: step.name, success: true, result });

          // run afterStep middleware
          await this.runMiddleware("afterStep", step, context, result);

          if (this.verbose) {
            console.log("✅ Step completed successfully");
            console.log("📊 Response summary:", this.summarizeResponse(result));
          } else {
            console.log("✅ Success");
          }
        } catch (error) {
          console.error(`❌ Step failed: ${error.message}`);
          results.push({
            step: step.name,
            success: false,
            error: error.message,
          });

          // stop execution on first failure
          throw new Error(
            `Scenario failed at step ${stepNumber}: ${step.name}`
          );
        }
      }

      // run afterScenario middleware
      await this.runMiddleware("afterScenario", scenario, context, results);

      // generate reports
      await this.generateReports(scenario.name, results, context);

      // print summary
      this.printSummary(scenario.name, results, context);
    } catch (error) {
      console.error(`\n💥 Scenario execution failed: ${error.message}`);
      throw error;
    }
  }

  async executeStep(step, context) {
    // check for custom step types
    if (step.type && this.stepTypes.has(step.type)) {
      const customHandler = this.stepTypes.get(step.type);
      return await customHandler(step, context);
    }

    // default HTTP step execution
    return await this.executeHttpStep(step, context);
  }

  async executeHttpStep(step, context) {
    // substitute variables in URL and body
    const url = this.substituteVariables(step.url, context);
    let body = step.body
      ? this.substituteVariables(step.body, context)
      : undefined;

    // apply transformation if provided
    if (step.transform && typeof step.transform === "function") {
      body = step.transform(body, context);
    }

    // merge headers: API client defaults + step-specific headers
    // (step headers take precedence)
    const stepHeaders = step.headers
      ? this.substituteVariables(step.headers, context)
      : {};
    const mergedHeaders = {
      ...this.apiClient.client.defaults.headers,
      ...stepHeaders,
    };

    if (this.verbose) {
      console.log(`🔗 ${step.method} ${url}`);
      if (body) {
        console.log("📤 Request body:", JSON.stringify(body, null, 2));
      }
      if (Object.keys(stepHeaders).length > 0) {
        console.log("📋 Step headers:", stepHeaders);
      }
    }

    let response;

    if (this.dryRun) {
      // mock response for dry run
      response = {
        status: 200,
        data: { id: "mock-id-" + Date.now(), message: "dry run" },
        headers: {},
      };
      console.log("🎭 Mock response (dry run)");
    } else {
      // make actual API call
      response = await this.apiClient.request(step.method, url, body, {
        headers: mergedHeaders,
      });
    }

    if (this.verbose) {
      console.log(`🔗 ${step.method} ${url}`);
      if (response) {
        console.log("📤 Response status:", response.status);
        console.log(
          "📤 Response headers:",
          JSON.stringify(response.headers, null, 2)
        );
        console.log(
          "📤 Response body:",
          JSON.stringify(response.data, null, 2)
        );
      }
    }

    // run validation
    if (step.validate) {
      const isValid = await this.validateResponse(step.validate, response);
      if (!isValid) {
        throw new Error(`Validation failed for step: ${step.name}`);
      }
    }

    // extract variables from response
    if (step.extract) {
      const extracted = this.extractFromResponse(step.extract, response);
      Object.assign(context, extracted);

      if (this.verbose && Object.keys(extracted).length > 0) {
        console.log("📋 Extracted variables:", extracted);
      }
    }

    return response;
  }

  async validateResponse(validator, response) {
    // check for custom validators first
    if (typeof validator === "string" && this.customValidators.has(validator)) {
      const customValidator = this.customValidators.get(validator);
      return await customValidator(response);
    }

    return await this.validator.validate(validator, response);
  }

  extractFromResponse(extractor, response) {
    // handle custom extractors
    const processedExtractor = {};

    for (const [key, value] of Object.entries(extractor)) {
      if (typeof value === "string" && this.customExtractors.has(value)) {
        const customExtractor = this.customExtractors.get(value);
        processedExtractor[key] = customExtractor;
      } else {
        processedExtractor[key] = value;
      }
    }

    return this.extractor.extract(processedExtractor, response);
  }

  substituteVariables(obj, context) {
    if (typeof obj === "string") {
      return obj.replace(/\{([A-Za-z0-9-_.]+)\}/g, (match, key) => {
        if (context.hasOwnProperty(key)) {
          return context[key];
        }
        return match; // keep original if variable not found
      });
    }

    if (typeof obj === "object" && obj !== null && obj.func && obj.params) {
      // this is an extractor function call - execute it
      return obj.func(...obj.params);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.substituteVariables(item, context));
    }

    if (typeof obj === "object" && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value, context);
      }
      return result;
    }

    return obj;
  }

  summarizeResponse(response) {
    return {
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : [],
      dataSize: response.data ? JSON.stringify(response.data).length : 0,
    };
  }

  printSummary(scenarioName, results, context) {
    console.log("\n" + "=".repeat(50));
    console.log(`📋 SCENARIO SUMMARY: ${scenarioName}`);
    console.log("=".repeat(50));

    const successful = results.filter((r) => r.success).length;
    const total = results.length;

    console.log(`✅ Successful steps: ${successful}/${total}`);

    if (successful === total) {
      console.log("🎉 All steps completed successfully!");
    } else {
      console.log("❌ Some steps failed");
    }

    if (Object.keys(context).length > 0) {
      console.log("\n📊 Final context variables:");
      Object.entries(context).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    console.log("\n" + "=".repeat(50));
  }

  // plugin system methods
  addValidator(name, validatorFn) {
    this.customValidators.set(name, validatorFn);
  }

  addExtractor(name, extractorFn) {
    this.customExtractors.set(name, extractorFn);
  }

  addStepType(type, handlerFn) {
    this.stepTypes.set(type, handlerFn);
  }

  use(hookName, middlewareFn) {
    if (this.middleware[hookName]) {
      this.middleware[hookName].push(middlewareFn);
    } else {
      throw new Error(`Unknown middleware hook: ${hookName}`);
    }
  }

  addReporter(name, reporterFn) {
    this.reporters.set(name, reporterFn);
  }

  async runMiddleware(hookName, ...args) {
    const middlewares = this.middleware[hookName] || [];
    for (const middleware of middlewares) {
      await middleware(...args);
    }
  }

  async generateReports(scenarioName, results, context) {
    const reportData = {
      scenarioName,
      results,
      context,
      timestamp: new Date().toISOString(),
      summary: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    };

    for (const [name, reporter] of this.reporters) {
      try {
        await reporter(reportData);
      } catch (error) {
        console.warn(`Report generation failed for ${name}:`, error.message);
      }
    }
  }

  // configuration methods
  setAuthToken(token) {
    this.apiClient.setAuthToken(token);
  }

  setHeaders(headers) {
    this.apiClient.setHeaders(headers);
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = baseUrl;
    this.apiClient = new ApiClient(baseUrl, {
      timeout: this.apiClient.client.defaults.timeout,
      headers: this.apiClient.client.defaults.headers,
    });
  }
}

module.exports = { ScenarioRunner };
