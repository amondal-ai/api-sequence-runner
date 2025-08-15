/**
 * Example API Scenario Runner scenario
 * This demonstrates the basic usage of API Scenario Runner
 */

module.exports = {
  name: "Example API Workflow",
  description: "Demonstrates creating, reading, updating, and deleting a user",

  steps: [
    // Step 1: create a new user
    {
      name: "createUser",
      method: "POST",
      url: "/api/users",
      body: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        age: 30,
      },
      validate: (response) => {
        return response.status === 201 && response.data.id;
      },
      extract: {
        userId: "data.id",
        userEmail: "data.email",
      },
    },

    // Step 2: get the created user
    {
      name: "getUser",
      method: "GET",
      url: "/api/users/{userId}",
      validate: (response) => {
        return response.status === 200 && response.data.email === "{userEmail}";
      },
      extract: {
        userName: "data.firstName",
      },
    },

    // Step 3: update the user
    {
      name: "updateUser",
      method: "PUT",
      url: "/api/users/{userId}",
      body: {
        firstName: "{userName}",
        lastName: "Smith",
        email: "{userEmail}",
        age: 31,
      },
      validate: (response) => response.status === 200,
    },

    // Step 4: verify the update
    {
      name: "verifyUpdate",
      method: "GET",
      url: "/api/users/{userId}",
      validate: (response) => {
        return (
          response.status === 200 &&
          response.data.lastName === "Smith" &&
          response.data.age === 31
        );
      },
    },

    // Step 5: delete the user
    {
      name: "deleteUser",
      method: "DELETE",
      url: "/api/users/{userId}",
      validate: (response) => response.status === 204,
    },

    // Step 6: verify deletion
    {
      name: "verifyDeletion",
      method: "GET",
      url: "/api/users/{userId}",
      validate: (response) => response.status === 404,
    },
  ],
};
