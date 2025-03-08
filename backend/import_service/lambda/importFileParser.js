const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const csv = require("csv-parser");
const dynamodb = new AWS.DynamoDB.DocumentClient();

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME;
const STOCKS_TABLE = process.env.STOCKS_TABLE_NAME;

if (!PRODUCTS_TABLE || !STOCKS_TABLE) {
  console.error(
    "❌ Missing DynamoDB table names. Check environment variables."
  );
  throw new Error("Missing DynamoDB table names");
}

module.exports.handler = async (event) => {
  try {
    console.log("✅ Received event:", JSON.stringify(event, null, 2));

    if (!event.Records || event.Records.length === 0 || !event.Records[0].s3) {
      console.error("❌ Invalid event format. Expected an S3 event.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid event format. Expected an S3 event.",
        }),
      };
    }

    const record = event.Records[0];
    const bucket = record.s3.bucket.name;
    const key = record.s3.object.key;

    console.log(`📂 Fetching file from S3: ${bucket}/${key}`);

    const s3Stream = s3
      .getObject({ Bucket: bucket, Key: key })
      .createReadStream();

    let results = []; // ✅ Now properly declared outside async scope
    let promises = []; // ✅ Store all async DynamoDB writes

    return new Promise((resolve, reject) => {
      s3Stream
        .pipe(csv({ separator: "," }))
        .on("data", (row) => {
          console.log("📝 Raw CSV Row:", row);

          if (!row.Title || !row.Price || !row.Count) {
            console.warn("⚠️ Skipping invalid row:", row);
            return;
          }

          const product_id = AWS.util.uuid.v4();
          const product = {
            id: product_id,
            title: String(row.Title).trim(),
            description: row.Description
              ? String(row.Description).trim()
              : "No description",
            price: parseFloat(row.Price) || 0,
          };

          const stock = {
            product_id: product_id,
            count: parseInt(row.Count, 10) || 0,
          };

          console.log("✅ Parsed product:", JSON.stringify(product));
          console.log("✅ Parsed stock:", JSON.stringify(stock));

          // ✅ Store promises and make sure `results.push()` happens after a successful insert
          const productPromise = dynamodb
            .put({ TableName: PRODUCTS_TABLE, Item: product })
            .promise();
          const stockPromise = dynamodb
            .put({ TableName: STOCKS_TABLE, Item: stock })
            .promise();

          promises.push(
            Promise.all([productPromise, stockPromise])
              .then(() => {
                results.push(product);
              })
              .catch((dbError) => {
                console.error("❌ Error inserting into DynamoDB:", dbError);
              })
          );
        })
        .on("end", async () => {
          await Promise.all(promises); // ✅ Ensure all DB writes complete before finishing
          console.log(
            `✅ CSV Parsing Complete. Processed rows: ${results.length}`
          );

          resolve({
            statusCode: 200,
            body: JSON.stringify({
              message: "CSV processed successfully and stored in DynamoDB.",
              products: results,
            }),
          });
        })
        .on("error", (error) => {
          console.error("❌ CSV Parsing Error:", error);
          reject({
            statusCode: 500,
            body: JSON.stringify({
              error: "CSV Parsing Failed",
              details: error.message,
            }),
          });
        });
    });
  } catch (error) {
    console.error("❌ Processing error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
