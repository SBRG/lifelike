// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
Cypress.Commands.add("loginByPassword", (email, password) => {
  cy.log(`Logging in as ${email}`);
  cy.request("POST", Cypress.env("auth_login_url"), { email, password }).then(
    ({ body }) => {
      cy.debug(`Login response: ${JSON.stringify(body)}`);
      const { accessToken, refreshToken, user } = body;
      const auth = { loggedIn: true, targetUrl: "/", user };
      window.localStorage.setItem("auth", JSON.stringify(auth));
      window.localStorage.setItem("authId", user.id);
      window.localStorage.setItem("expires_at", accessToken.exp);
      window.localStorage.setItem("access_jwt", accessToken.token);
      window.localStorage.setItem("refresh_jwt", refreshToken.token);
    }
  );

  // Navigate to workbench
  return cy.visit("/workspaces/local");
});

Cypress.Commands.add("clickMenuItem", (item) => {
  return cy.get(`[ngbtooltip="${item}`).click();
});

Cypress.Commands.add("getActiveTab", () => {
  return cy.get('[ng-reflect-active="true"]').should("be.visible");
});
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
