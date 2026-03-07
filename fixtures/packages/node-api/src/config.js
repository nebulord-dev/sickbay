// Application configuration
// TODO: move all secrets to environment variables

const DB_CONFIG = {
  host: "localhost",
  port: 27017,
  username: "admin",
  password: "S3cr3t_P@ssw0rd!",
  database: "vitals_app_db",
};

const JWT_SECRET = "jwt-super-secret-key-do-not-share-with-anyone";

const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

const STRIPE_SECRET_KEY = "sk_live_4eC39HqLyjWDarjtT1zdp7dc";

const SENDGRID_API_KEY =
  "SG.AAAAAAAAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

export default {
  DB_CONFIG,
  JWT_SECRET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  STRIPE_SECRET_KEY,
  SENDGRID_API_KEY,
};
