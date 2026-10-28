/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "controllers-no-models-or-repositories",
      comment: "Controllers must only depend on services, interfaces, mappers, utils, errors, and express",
      severity: "error",
      from: { path: "^src/controllers" },
      to: { path: "^src/(models|repositories)" },
    },
    {
      name: "services-no-express-or-mongoose",
      comment: "Services must be pure business logic and never depend directly on express or mongoose",
      severity: "error",
      from: { path: "^src/services" },
      to: { path: "(node_modules/(express|mongoose)|src/models)" },
    },
    {
      name: "services-no-controllers-or-routes",
      comment: "Services must not depend on higher layers (controllers or routes)",
      severity: "error",
      from: { path: "^src/services" },
      to: { path: "^src/(controllers|routes)" },
    },
    {
      name: "repositories-no-controllers-or-services",
      comment: "Repositories must only interact with models, interfaces, config, and utils",
      severity: "error",
      from: { path: "^src/repositories" },
      to: { path: "^src/(controllers|services|routes)" },
    },
    {
      name: "routes-no-models-or-repositories",
      comment: "Routes must only map paths to controller methods and attach middleware",
      severity: "error",
      from: { path: "^src/routes" },
      to: { path: "^src/(models|repositories|services)" },
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
  },
};
