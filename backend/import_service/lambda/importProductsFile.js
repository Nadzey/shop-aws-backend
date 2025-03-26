const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({ region: "us-east-1" });

module.exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event, null, 2));

  try {
    const rawName = event.queryStringParameters?.name;
    console.log("Received name param:", rawName);

    // Clean up name if wrapped in quotes (common issue with curl/API Gateway test)
    const fileName = rawName?.replace(/^"|"$/g, ""); // removes surrounding quotes

    if (!fileName) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
        },
        body: JSON.stringify({ error: "Missing 'name' query parameter" }),
      };
    }

    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: `uploaded/${fileName}`,
      ContentType: "text/csv",
    };

    const command = new PutObjectCommand(params);
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
      },
      body: JSON.stringify({ url: signedUrl }),
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,GET,POST",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
