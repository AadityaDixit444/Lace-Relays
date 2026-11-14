import { saveObservations } from "../lib/storage";
import { journeyFixtures } from "./fixtures";
if (
  process.env.NODE_ENV === "production" ||
  process.env.SHOW_TEST_FIXTURES !== "1"
)
  throw new Error(
    "Fixture seeding is only allowed in an explicitly enabled local test environment.",
  );
saveObservations(journeyFixtures())
  .then(() =>
    console.log(
      "Labelled test fixtures seeded into the selected local database. These are not retailer prices.",
    ),
  )
  .catch(() => {
    console.error("Fixture seeding failed");
    process.exitCode = 1;
  });
