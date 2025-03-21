import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from "aws-lambda";
import * as dotenv from "dotenv";

dotenv.config();  // Load environment variables from .env file

export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  console.log("Authorization Event:", JSON.stringify(event, null, 2));

  if (!event.authorizationToken) {
    console.log("No Authorization header received.");
    throw new Error("Unauthorized");
  }

  try {
    const tokenParts = event.authorizationToken.split(" ");
    if (tokenParts[0] !== "Basic" || !tokenParts[1]) {
      console.log("Invalid Authorization format.");
      throw new Error("Unauthorized");
    }

    // Decode Base64 credentials
    const decodedCredentials = Buffer.from(tokenParts[1], "base64").toString("utf-8");
    const [username, password] = decodedCredentials.split(":");

    console.log(`Received Username: ${username}`);
    console.log(`Received Password: ${password}`);

    // Check credentials
    const expectedPassword = process.env[username];  // Fetch from .env file
    if (!expectedPassword || expectedPassword !== password) {
      console.log("Invalid credentials.");
      throw new Error("Unauthorized");
    }

    console.log("Authorization successful!");

    // Generate IAM policy
    return generatePolicy(username, event.methodArn, "Allow");
  } catch (error) {
    if (error instanceof Error) {
      console.log("Authorization Error: ", error.message);
    } else {
      console.log("Authorization Error: An unknown error occurred.");
    }
    throw new Error("Unauthorized");
  }
}

// IAM Policy Generator
const generatePolicy = (principalId: string, resource: string, effect: "Allow" | "Deny" = "Allow"): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
};
