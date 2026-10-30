/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are forbidden",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "services-must-not-import-express-or-mongoose",
      severity: "error",
      comment: "Services must be decoupled from HTTP (Express) and Database driver (Mongoose)",
      from: {
        path: "^src/services",
      },
      to: {
        path: "(express|mongoose)",
      },
    },
    {
      name: "controllers-must-not-import-models-or-repositories",
      severity: "error",
      comment: "Controllers must only invoke services and not access repositories or models directly",
      from: {
        path: "^src/controllers",
      },
      to: {
        path: "^src/(models|repositories)",
      },
    },
    {
      name: "repositories-must-not-import-services-or-controllers",
      severity: "error",
      comment: "Repositories must not depend on services, controllers or routes",
      from: {
        path: "^src/repositories",
      },
      to: {
        path: "^src/(services|controllers|routes)",
      },
    },
    {
      name: "models-must-not-import-business-layers",
      severity: "error",
      comment: "Models should only define schemas/indexes and not import services, repositories, or controllers",
      from: {
        path: "^src/models",
      },
      to: {
        path: "^src/(services|controllers|repositories|routes)",
      },
    },
    {
      name: "routes-must-not-bypass-controllers",
      severity: "error",
      comment: "Routes should map paths to controllers and not import repositories or models directly",
      from: {
        path: "^src/routes",
      },
      to: {
        path: "^src/(models|repositories)",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "./tsconfig.json",
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};

