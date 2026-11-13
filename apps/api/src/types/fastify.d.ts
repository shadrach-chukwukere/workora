import type { FastifyRequest } from "fastify";
import type { AuthedUser } from "../middleware/authenticate.js";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: AuthedUser;
  }
}

export {};
