/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accounting from "../accounting.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as bankAccounts from "../bankAccounts.js";
import type * as bookings from "../bookings.js";
import type * as companies from "../companies.js";
import type * as companyEmails from "../companyEmails.js";
import type * as gateway from "../gateway.js";
import type * as http from "../http.js";
import type * as locations from "../locations.js";
import type * as payments from "../payments.js";
import type * as paymentsGateway from "../paymentsGateway.js";
import type * as roles from "../roles.js";
import type * as routes from "../routes.js";
import type * as settings from "../settings.js";
import type * as trips from "../trips.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accounting: typeof accounting;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  bankAccounts: typeof bankAccounts;
  bookings: typeof bookings;
  companies: typeof companies;
  companyEmails: typeof companyEmails;
  gateway: typeof gateway;
  http: typeof http;
  locations: typeof locations;
  payments: typeof payments;
  paymentsGateway: typeof paymentsGateway;
  roles: typeof roles;
  routes: typeof routes;
  settings: typeof settings;
  trips: typeof trips;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
