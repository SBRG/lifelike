/// <reference types="cypress" />

const projectName = "CAG-Center";

describe("Projects", () => {
  beforeEach(() => {
    cy.login();
  });

  it("shows project list", () => {
    cy.visit("/projects");

    cy.contains("h1", "File Browser").should("be.visible");

    // Should have a list of projects
    cy.get("app-browser-project-list .tile a").should("have.length.above", 10);

    cy.screenshot();
  });

  it("shows project files", () => {
    cy.visit(`/projects/${projectName}`);

    // Should have a list of files
    cy.get("app-object-list tr").should("have.length.above", 10);

    cy.screenshot();
  });

  it("shows project entity cloud", () => {
    cy.visit(`/projects/${projectName}`);

    // Should have a list of files
    cy.get("[ngbtooltip='Entity Cloud'").should("be.visible").click();
    cy.contains("button", "For entire project").click();

    // There should be more that 10 entities in the word cluud
    cy.get("app-word-cloud svg text", { timeout: 30000 })
      .should("have.length.above", 10)
      .wait(1000);

    cy.screenshot();
  });
});
