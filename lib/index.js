/**
 * API Sequence Runner - Main entry point
 * A simple, yet powerful tool for orchestrating sequential API calls
 */

const { ScenarioRunner } = require("./runner");
const { ApiClient } = require("./api-client");
const { Validator, validators } = require("./validator");
const { Extractor, extractors } = require("./extractor");
const { ScenarioLoader } = require("./scenario-loader");

// main exports
module.exports = {
  // for scenarios (most common usage)
  validators, // all validation functions
  extractors, // random data generators + advanced extraction

  // core classes
  ScenarioRunner,
  ApiClient,
  Validator,
  Extractor,
  ScenarioLoader,

  // helper factories
  createRunner: (options) => new ScenarioRunner(options),
  createValidator: () => new Validator(),
  createExtractor: () => new Extractor(),
  createLoader: (scenariosDir) => new ScenarioLoader(scenariosDir),

  // version
  version: require("../package.json").version,
};

// convenience factory function
module.exports.createFlow = function (options = {}) {
  return new ScenarioRunner(options);
};
