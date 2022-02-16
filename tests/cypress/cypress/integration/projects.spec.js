/// <reference types="cypress" />

const projectName = Cypress.env("existing_project_name") || "CAG-Center";

describe("Projects", () => {
  beforeEach(() => {
    cy.loginByPassword(Cypress.env("auth_email"), Cypress.env("auth_password"));
  });

  it("shows project list", () => {
    cy.clickMenuItem("Workbench");
    cy.getActiveTab().contains("h1", "File Browser");

    // Should have a list of projects
    cy.get("app-browser-project-list .tile a").should("have.length.above", 10);

    cy.screenshot();
    cy.percySnapshot();
  });

  it("shows project files", () => {
    cy.visit(`/projects/${projectName}`);

    // Should have a list of files
    cy.get("app-object-list tr").should("have.length.above", 10);

    cy.screenshot();
    cy.percySnapshot();
  });

  it("shows project entity cloud", () => {
    cy.visit(`/projects/${projectName}`);

    // Should have a list of files
    cy.get("[ngbtooltip='Entity Cloud'").should("be.visible").click();
    cy.contains("button", "For entire project").click();

    // There should be more that 10 entities in the word cluud
    cy.get("app-word-cloud svg text", { timeout: 60000 })
      .should("have.length.above", 10)
      .wait(2000);

    cy.screenshot();
    cy.percySnapshot();
  });
});
