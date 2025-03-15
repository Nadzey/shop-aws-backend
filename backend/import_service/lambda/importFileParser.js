const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const csv = require("csv-parser");

const SQS_URL = process.env.SQS_URL;

module.exports.handler = async (event) => {
  try {
    console.log("Received event:", JSON.stringify(event, null, 2));

    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    console.log(`Fetching file from S3: ${bucket}/${key}`);

    const s3Stream = s3
      .getObject({ Bucket: bucket, Key: key })
      .createReadStream();

    return new Promise((resolve, reject) => {
      s3Stream
        .pipe(csv({ separator: "," }))
        .on("data", async (row) => {
          console.log("Parsed row:", row);

          const message = JSON.stringify({
            title: row.Title,
            description: row.Description || "No description",
            price: parseFloat(row.Price) || 0,
            count: parseInt(row.Count, 10) || 0,
          });

          await sqs
            .sendMessage({
              QueueUrl: SQS_URL,
              MessageBody: message,
            })
            .promise();
        })
        .on("end", () => {
          console.log("File processing complete.");
          resolve();
        })
        .on("error", (error) => {
          console.error("Error parsing CSV:", error);
          reject(error);
        });
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
