require("dotenv").config();

exports.handler = async function (event) {
  console.log("Authorization Event:", JSON.stringify(event, null, 2));

  if (!event.authorizationToken) {
    console.log("No Authorization header received.");
    return generatePolicy("user", event.methodArn, "Deny");
  }

  try {
    const tokenParts = event.authorizationToken.split(" ");
    if (tokenParts[0] !== "Basic" || !tokenParts[1]) {
      console.log("Invalid Authorization format.");
      return generatePolicy("user", event.methodArn, "Deny");
    }

    const decodedCredentials = Buffer.from(tokenParts[1], "base64").toString(
      "utf-8"
    );
    const [username, password] = decodedCredentials.split(":");

    console.log("Received Username:", username);

    const expectedPassword = process.env[username];

    if (!expectedPassword || expectedPassword !== password) {
      console.log("Invalid credentials.");
      return generatePolicy(username, event.methodArn, "Deny");
    }

    console.log("Authorization successful!");
    return generatePolicy(username, event.methodArn, "Allow");
  } catch (error) {
    console.error("Authorization Error:", error);
    return generatePolicy("user", event.methodArn, "Deny");
  }
};

function generatePolicy(principalId, resource, effect = "Allow") {
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
}
