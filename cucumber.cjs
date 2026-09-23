module.exports = {
  default: {
    paths: ["tests/automation/bdd/*.feature"],
    import: ["tests/automation/bdd/steps.mjs"],
    format: ["progress", "json:automation-results/cucumber.json", "allure-cucumberjs/reporter"],
    formatOptions: { resultsDir: "automation-results/allure-results" },
    parallel: 1,
    retry: 0,
  },
};
