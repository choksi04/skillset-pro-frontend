import { Configuration, LogLevel } from "@azure/msal-browser";

const AZURE_CLIENT_ID = "73d693d2-7990-4e0f-ab1b-4f3b26648a3e";
const AZURE_TENANT_ID = "ea6c052c-f910-4b0a-a2a0-9e5179c0e9fb";

export const msalConfig: Configuration = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    navigateToLoginRequestUrl: true,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error("[MSAL]", message);
      },
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};
