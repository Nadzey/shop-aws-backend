const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const sqs = new AWS.SQS();
const csv = require("csv-parser");

const SQS_URL = process.env.SQS_URL;

async function moveFileToParsed(bucket, key) {
  const parsedKey = key.replace("uploaded/", "parsed/");
  try {
    await s3.copyObject({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: parsedKey,
    }).promise();

    await s3.deleteObject({
      Bucket: bucket,
      Key: key,
    }).promise();

    console.log(`File moved to: ${parsedKey}`);
  } catch (error) {
    console.error("Error moving file:", error);
  }
}

module.exports.handler = async (event) => {
  try {
    console.log("Received event:", JSON.stringify(event, null, 2));

    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    const s3Stream = s3.getObject({ Bucket: bucket, Key: key }).createReadStream();

    return new Promise((resolve, reject) => {
      const messages = [];

      s3Stream
        .pipe(csv({ separator: "," }))
        .on("data", async (row) => {
          const message = JSON.stringify({
            title: row.Title,
            description: row.Description || "No description",
            price: parseFloat(row.Price) || 0,
            count: parseInt(row.Count, 10) || 0,
          });

          messages.push(
            sqs.sendMessage({ QueueUrl: SQS_URL, MessageBody: message }).promise()
          );
        })
        .on("end", async () => {
          await Promise.all(messages);
          await moveFileToParsed(bucket, key);
          console.log("File processing complete.");
          resolve({
            statusCode: 200,
            body: JSON.stringify({ message: "Success" }),
          });
        })
        .on("error", (error) => {
          console.error("Error parsing CSV:", error);
          reject({
            statusCode: 500,
            body: JSON.stringify({ error: "CSV parsing failed" }),
          });
        });
    });
  } catch (error) {
    console.error("Error processing file:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
