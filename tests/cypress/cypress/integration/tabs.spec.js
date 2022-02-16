describe("Navigation bugs", function () {
  beforeEach(() => {
    cy.loginByPassword(Cypress.env("auth_email"), Cypress.env("auth_password"));
  });

  it("Displays tabs content after returning to workbench", function () {
    const fbLabel = "File Browser";
    const kgLabel = "Knowledge Graph Statistics";

    cy.log('Click on "File Browser" tab 5 times');
    Cypress._.times(5, () => cy.clickMenuItem(fbLabel));
    cy.getActiveTab().contains("h1", fbLabel);
    cy.screenshot();

    cy.log(`Navigating away to ${kgLabel} section`);
    cy.clickMenuItem(kgLabel);
    cy.contains(".module-title", kgLabel).should("be.visible");
    cy.screenshot();

    cy.log("Navigate back to the Workbench tab");
    cy.clickMenuItem("Workbench");
    cy.getActiveTab().contains("h1", fbLabel);
    cy.screenshot();
  });
});
