import { db } from "./src/database/connection.js";
import * as service from "./src/modules/payments/service.js";
import { MembershipError } from "./src/modules/payments/repository.js";

async function main() {
  const dbi = await db();
  const users = await dbi.selectFrom("users").select(["id"]).limit(1).execute();
  const clientId = users[0]!.id;
  console.log("client:", clientId);

  // find a project owned by this user, publish it, submit a proposal from another freelancer, accept it, create milestone, submit, initialize demo payment, authorize it
  const project = await dbi
    .selectFrom("projects")
    .select(["id", "client_id", "status"])
    .where("client_id", "=", clientId)
    .limit(1)
    .executeTakeFirst();
  console.log("project:", project);

  const payments = await dbi.selectFrom("payments").selectAll().limit(1).execute();
  console.log("payments sample:", payments);

  const milestonePayments = await dbi
    .selectFrom("payments")
    .selectAll()
    .where("milestone_id", "is not", null)
    .limit(1)
    .execute();
  console.log("milestone payments:", milestonePayments);

  for (const payment of milestonePayments) {
    try {
      console.log("attempting to authorize payment", payment.id);
      const result = await service.authorizeDemoPayment(dbi, payment.id);
      console.log("outcome:", result.outcome);
    } catch (error) {
      console.error("ERROR authorizing:", error);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
