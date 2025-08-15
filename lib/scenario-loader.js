const path = require("path");
const fs = require("fs");

class ScenarioLoader {
  constructor(scenariosDir = "./scenarios") {
    this.scenariosDir = path.resolve(scenariosDir);
  }

  loadScenario(scenarioName) {
    const scenarioPath = this.getScenarioPath(scenarioName);

    if (!fs.existsSync(scenarioPath)) {
      throw new Error(`Scenario file not found: ${scenarioPath}`);
    }

    try {
      // clear require cache to allow reloading
      delete require.cache[require.resolve(scenarioPath)];
      const scenario = require(scenarioPath);

      // validate scenario structure
      this.validateScenario(scenario, scenarioName);

      return scenario;
    } catch (error) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error(
          `Failed to load scenario '${scenarioName}': Module not found`
        );
      }
      throw new Error(
        `Failed to load scenario '${scenarioName}': ${error.message}`
      );
    }
  }

  loadScenarioFromFile(filePath) {
    const fullPath = path.resolve(filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Scenario file not found: ${fullPath}`);
    }

    try {
      delete require.cache[require.resolve(fullPath)];
      const scenario = require(fullPath);

      const scenarioName = path.basename(filePath, path.extname(filePath));
      this.validateScenario(scenario, scenarioName);

      return scenario;
    } catch (error) {
      throw new Error(
        `Failed to load scenario from '${filePath}': ${error.message}`
      );
    }
  }

  loadScenarioFromObject(scenarioConfig, name = "inline-scenario") {
    this.validateScenario(scenarioConfig, name);
    return scenarioConfig;
  }

  listScenarios() {
    if (!fs.existsSync(this.scenariosDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.scenariosDir);
      return files
        .filter((file) => file.endsWith(".js"))
        .map((file) => path.basename(file, ".js"))
        .sort();
    } catch (error) {
      throw new Error(`Failed to list scenarios: ${error.message}`);
    }
  }

  getScenarioPath(scenarioName) {
    return path.join(this.scenariosDir, `${scenarioName}.js`);
  }

  validateScenario(scenario, scenarioName) {
    if (!scenario || typeof scenario !== "object") {
      throw new Error(`Invalid scenario '${scenarioName}': must be an object`);
    }

    if (!scenario.name || typeof scenario.name !== "string") {
      throw new Error(
        `Invalid scenario '${scenarioName}': missing or invalid 'name' property`
      );
    }

    if (!scenario.steps || !Array.isArray(scenario.steps)) {
      throw new Error(
        `Invalid scenario '${scenarioName}': missing or invalid 'steps' array`
      );
    }

    if (scenario.steps.length === 0) {
      throw new Error(
        `Invalid scenario '${scenarioName}': 'steps' array cannot be empty`
      );
    }

    // validate each step
    scenario.steps.forEach((step, index) => {
      this.validateStep(step, index, scenarioName);
    });

    return true;
  }

  validateStep(step, stepIndex, scenarioName) {
    const stepNumber = stepIndex + 1;

    if (!step || typeof step !== "object") {
      throw new Error(
        `Invalid step ${stepNumber} in scenario '${scenarioName}': must be an object`
      );
    }

    if (!step.name || typeof step.name !== "string") {
      throw new Error(
        `Invalid step ${stepNumber} in scenario '${scenarioName}': missing or invalid 'name' property`
      );
    }

    // for http steps (default type)
    if (!step.type || step.type === "http") {
      if (!step.method || typeof step.method !== "string") {
        throw new Error(
          `Invalid step '${step.name}' in scenario '${scenarioName}': missing or invalid 'method' property`
        );
      }

      if (!step.url || typeof step.url !== "string") {
        throw new Error(
          `Invalid step '${step.name}' in scenario '${scenarioName}': missing or invalid 'url' property`
        );
      }

      const validMethods = [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
      ];
      if (!validMethods.includes(step.method.toUpperCase())) {
        throw new Error(
          `Invalid step '${step.name}' in scenario '${scenarioName}': invalid HTTP method '${step.method}'`
        );
      }
    }

    // validate optional properties if present
    if (
      step.validate &&
      typeof step.validate !== "function" &&
      typeof step.validate !== "string" &&
      typeof step.validate !== "object"
    ) {
      throw new Error(
        `Invalid step '${step.name}' in scenario '${scenarioName}': 'validate' must be a function, string, or object`
      );
    }

    if (step.extract && typeof step.extract !== "object") {
      throw new Error(
        `Invalid step '${step.name}' in scenario '${scenarioName}': 'extract' must be an object`
      );
    }

    if (step.transform && typeof step.transform !== "function") {
      throw new Error(
        `Invalid step '${step.name}' in scenario '${scenarioName}': 'transform' must be a function`
      );
    }

    return true;
  }

  // helper method to create scenario from template
  createScenarioFromTemplate(name, template = "basic") {
    const templates = {
      basic: {
        name: name,
        description: `Basic scenario: ${name}`,
        steps: [
          {
            name: "step1",
            method: "GET",
            url: "/api/example",
            validate: (response) => response.status === 200,
            extract: {
              // add extraction rules here
            },
          },
        ],
      },

      crud: {
        name: name,
        description: `CRUD operations scenario: ${name}`,
        steps: [
          {
            name: "create",
            method: "POST",
            url: "/api/items",
            body: { name: "Test Item" },
            validate: (response) => response.status === 201,
            extract: { itemId: "data.id" },
          },
          {
            name: "read",
            method: "GET",
            url: "/api/items/{itemId}",
            validate: (response) => response.status === 200,
          },
          {
            name: "update",
            method: "PUT",
            url: "/api/items/{itemId}",
            body: { name: "Updated Item" },
            validate: (response) => response.status === 200,
          },
          {
            name: "delete",
            method: "DELETE",
            url: "/api/items/{itemId}",
            validate: (response) => response.status === 204,
          },
        ],
      },

      auth: {
        name: name,
        description: `Authentication scenario: ${name}`,
        steps: [
          {
            name: "login",
            method: "POST",
            url: "/api/auth/login",
            body: {
              username: "testuser",
              password: "testpass",
            },
            validate: (response) =>
              response.status === 200 && response.data.token,
            extract: { authToken: "data.token" },
          },
          {
            name: "getProfile",
            method: "GET",
            url: "/api/auth/profile",
            headers: {
              Authorization: "Bearer {authToken}",
            },
            validate: (response) => response.status === 200,
          },
        ],
      },
    };

    if (!templates[template]) {
      throw new Error(
        `Unknown template: ${template}. Available templates: ${Object.keys(
          templates
        ).join(", ")}`
      );
    }

    return templates[template];
  }

  // check if scenarios directory exists and create it if needed
  ensureScenariosDirectory() {
    if (!fs.existsSync(this.scenariosDir)) {
      fs.mkdirSync(this.scenariosDir, { recursive: true });
    }
  }

  // get scenario metadata without loading the full scenario
  getScenarioMetadata(scenarioName) {
    try {
      const scenario = this.loadScenario(scenarioName);
      return {
        name: scenario.name,
        description: scenario.description || "",
        stepCount: scenario.steps ? scenario.steps.length : 0,
        stepNames: scenario.steps ? scenario.steps.map((s) => s.name) : [],
      };
    } catch (error) {
      return {
        name: scenarioName,
        description: "Failed to load",
        stepCount: 0,
        stepNames: [],
        error: error.message,
      };
    }
  }

  // search scenarios by name or description
  searchScenarios(query) {
    const allScenarios = this.listScenarios();
    const searchTerm = query.toLowerCase();

    return allScenarios.filter((scenarioName) => {
      const metadata = this.getScenarioMetadata(scenarioName);
      return (
        metadata.name.toLowerCase().includes(searchTerm) ||
        metadata.description.toLowerCase().includes(searchTerm) ||
        metadata.stepNames.some((stepName) =>
          stepName.toLowerCase().includes(searchTerm)
        )
      );
    });
  }
}

module.exports = { ScenarioLoader };
