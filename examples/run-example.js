#!/usr/bin/env node

/**
 * Example usage of API Sequence Runner as a library
 */

const { ScenarioRunner, validators, extractors } = require("../lib");

async function runExample() {
  console.log("🚀 API Sequence Runner Library Example\n");

  // create a scenario runner
  const runner = new ScenarioRunner({
    baseUrl: "https://jsonplaceholder.typicode.com",
    verbose: true,
    dryRun: false, // Set to true to test without making real calls
  });

  // add custom middleware
  runner.use("beforeStep", (step, context) => {
    console.log(`🔄 About to execute: ${step.name}`);
  });

  runner.use("afterStep", (step, context, result) => {
    console.log(`✅ Completed: ${step.name} - Status: ${result.status}`);
  });

  // define a test scenario
  const scenario = {
    name: "JSONPlaceholder API Test",
    description: "Test scenario using JSONPlaceholder API",

    steps: [
      // step 1: get all posts
      {
        name: "getAllPosts",
        method: "GET",
        url: "/posts",
        validate: validators.and(validators.status(200), validators.isArray),
        extract: {
          totalPosts: extractors.computed((response) => response.data.length),
          firstPostId: "data[0].id",
        },
      },

      // step 2: get a specific post
      {
        name: "getSpecificPost",
        method: "GET",
        url: "/posts/{firstPostId}",
        validate: (response) => {
          return (
            response.status === 200 &&
            response.data.id.toString() === "{firstPostId}"
          );
        },
        extract: {
          postTitle: "data.title",
          authorId: "data.userId",
        },
      },

      // step 3: get author details
      {
        name: "getAuthor",
        method: "GET",
        url: "/users/{authorId}",
        validate: validators.status(200),
        extract: {
          authorName: "data.name",
          authorEmail: "data.email",
        },
      },

      // step 4: create a new post
      {
        name: "createPost",
        method: "POST",
        url: "/posts",
        body: {
          title: "Test Post from API Sequence Runner",
          body: "This post was created by API Sequence Runner example",
          userId: "{authorId}",
        },
        validate: validators.status(201),
        extract: {
          newPostId: "data.id",
        },
      },

      // step 5: update the created post
      {
        name: "updatePost",
        method: "PUT",
        url: "/posts/{newPostId}",
        body: {
          id: "{newPostId}",
          title: "Updated Test Post",
          body: "This post was updated by API Sequence Runner",
          userId: "{authorId}",
        },
        validate: validators.status(200),
      },

      // step 6: delete the post
      {
        name: "deletePost",
        method: "DELETE",
        url: "/posts/{newPostId}",
        validate: validators.status(200),
      },
    ],
  };

  try {
    // run the scenario
    await runner.runScenarioConfig(scenario);

    console.log("\n🎉 Example completed successfully!");
    console.log("\nThis example demonstrated:");
    console.log("- Sequential API calls");
    console.log("- Data extraction and variable substitution");
    console.log("- Built-in and custom validators");
    console.log("- Middleware hooks");
    console.log("- CRUD operations");
  } catch (error) {
    console.error("\n❌ Example failed:", error.message);
    process.exit(1);
  }
}

// run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

module.exports = { runExample };
