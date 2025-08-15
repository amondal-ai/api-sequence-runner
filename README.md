# API Sequence Runner

A simple, powerful tool for orchestrating sequential API calls with data flow between requests.

## 🚀 Features

- **Sequential API Execution**: Execute API calls in a defined sequence
- **Data Flow**: Pass data between API calls using variable extraction
- **Flexible Validation**: Built-in and custom response validation
- **Dry Run Mode**: Test scenarios without making actual API calls
- **Configuration-Driven**: Define scenarios using simple JavaScript objects
- **CLI & Library**: Use as a command-line tool or integrate into your code
- **Plugin System**: Extend functionality with custom validators, extractors, and step types
- **Environment Support**: Different configurations for different environments

## 📦 Installation

### Global Installation (CLI)

```bash
npm install -g api-sequence-runner
```

### Local Installation (Library)

```bash
npm install api-sequence-runner
```

## 🎯 Quick Start

### 1. Initialize a new project

```bash
api-sequence-runner init
```

### 2. Create your first scenario

```bash
api-sequence-runner create-scenario user-management
```

### 3. Edit the scenario file

```javascript
// scenarios/user-management.js
module.exports = {
  name: "User Management Flow",
  description: "Create and manage a user account",

  steps: [
    {
      name: "createUser",
      method: "POST",
      url: "/api/users",
      body: {
        name: "John Doe",
        email: "john@example.com",
      },
      validate: (response) => response.status === 201,
      extract: {
        userId: "data.id",
      },
    },
    {
      name: "getUser",
      method: "GET",
      url: "/api/users/{userId}",
      validate: (response) => response.status === 200,
    },
  ],
};
```

### 4. Run the scenario

```bash
api-sequence-runner run user-management --base-url https://api.example.com
```

## 📖 Usage

### Command Line Interface

```bash
# Run a specific scenario
api-sequence-runner run scenario-name

# Run with custom base URL
api-sequence-runner run scenario-name --base-url https://api.example.com

# Dry run (no actual API calls)
api-sequence-runner run scenario-name --dry-run

# Verbose output
api-sequence-runner run scenario-name --verbose

# Run all scenarios
api-sequence-runner run-all

# List available scenarios
api-sequence-runner list

# Create a new scenario
api-sequence-runner create-scenario my-scenario
```

### Library Usage

```javascript
const { ScenarioRunner } = require("api-sequence-runner");

const runner = new ScenarioRunner({
  baseUrl: "https://api.example.com",
  timeout: 10000,
});

const scenario = {
  name: "API Test",
  steps: [
    {
      name: "healthCheck",
      method: "GET",
      url: "/health",
      validate: (response) => response.status === 200,
    },
  ],
};

await runner.runScenarioConfig(scenario);
```

## 📚 Documentation

### Scenario Structure

A scenario is a JavaScript object with the following structure:

```javascript
module.exports = {
  name: "Scenario Name", // Required: Human-readable name
  description: "What this does", // Optional: Description

  steps: [
    // Required: Array of steps
    {
      name: "stepName", // Required: Step identifier
      method: "POST", // Required: HTTP method
      url: "/api/endpoint", // Required: URL (supports variables)

      body: {
        // Optional: Request body
        key: "value",
        userId: "{extractedUserId}", // Use extracted variables
      },

      headers: {
        // Optional: Custom headers
        Authorization: "Bearer {token}",
      },

      validate: (response) => {
        // Optional: Validation function
        return response.status === 200;
      },

      extract: {
        // Optional: Extract variables
        userId: "data.id", // Simple path extraction
        token: "data.auth.token", // Nested path extraction
      },

      transform: (body, context) => {
        // Optional: Transform request body
        return { ...body, timestamp: Date.now() };
      },
    },
  ],
};
```

### Variable Extraction

Extract data from responses to use in subsequent steps:

```javascript
// Simple extraction
extract: {
  userId: "data.id",
  userEmail: "data.email"
}

// Complex extraction
extract: {
  processedValue: {
    path: "data.value",
    transform: (value) => value.toUpperCase(),
    default: "DEFAULT"
  }
}

// Using built-in extractors
const { extractors } = require('api-sequence-runner');

extract: {
  id: extractors.path("data.id"),
  timestamp: extractors.computed(() => Date.now())
}
```

### Validation

Multiple ways to validate responses:

```javascript
// Function validation
validate: (response) => response.status === 200

// Built-in validators
const { validators } = require('api-sequence-runner');

validate: validators.status(200)
validate: validators.and(
  validators.status(200),
  validators.hasField("data.id")
)

// Object validation (multiple checks)
validate: {
  statusCheck: (response) => response.status === 200,
  dataCheck: (response) => response.data.id !== null
}
```

### Environment Configuration

Create environment-specific configurations:

```javascript
// config/api-config.js
module.exports = {
  environments: {
    local: {
      baseUrl: "http://localhost:3000",
    },
    staging: {
      baseUrl: "https://staging-api.example.com",
    },
  },
};
```

Use with CLI:

```bash
api-sequence-runner run scenario --config config/api-config.js --base-url staging
```

## 🔧 Advanced Features

### Custom Validators

```javascript
const runner = new ScenarioRunner();

runner.addValidator("isEven", (response) => {
  return response.data.value % 2 === 0;
});

// Use in scenario
validate: "isEven";
```

### Custom Extractors

```javascript
runner.addExtractor("lastArrayItem", (response) => {
  const array = response.data;
  return Array.isArray(array) ? array[array.length - 1] : null;
});

// Use in scenario
extract: {
  lastItem: "lastArrayItem";
}
```

### Middleware

```javascript
runner.use("beforeStep", (step, context) => {
  console.log(`Executing: ${step.name}`);
});

runner.use("afterStep", (step, context, result) => {
  console.log(`Completed: ${step.name} with status ${result.status}`);
});
```

### Custom Step Types

```javascript
runner.addStepType('database', async (step, context) => {
  // Custom database operations
  const result = await executeDbQuery(step.query);
  return { status: 200, data: result };
});

// Use in scenario
{
  type: "database",
  name: "seedData",
  query: "INSERT INTO users (name) VALUES ('Test User')"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 [Documentation](https://github.com/yourusername/api-sequence-runner/wiki)
- 🐛 [Issue Tracker](https://github.com/yourusername/api-sequence-runner/issues)
- 💬 [Discussions](https://github.com/yourusername/api-sequence-runner/discussions)

## 🙏 Acknowledgments

- Inspired by Postman Collections and REST testing tools
- Built for developers who need simple, maintainable API orchestration

---

**Happy API Testing! 🚀**
