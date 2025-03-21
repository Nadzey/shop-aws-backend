const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");

const dynamoDBClient = new DynamoDBClient({ region: "us-east-1" });
const snsClient = new SNSClient({ region: "us-east-1" });

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const STOCKS_TABLE = process.env.STOCKS_TABLE;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
  try {
    console.log("Received messages from SQS:", JSON.stringify(event, null, 2));

    // Prepare batch write for DynamoDB
    const transactItems = event.Records.map((record) => {
      const { title, description, price, count } = JSON.parse(record.body);
      const id = uuidv4();

      return [
        {
          Put: {
            TableName: PRODUCTS_TABLE,
            Item: {
              id: { S: id },
              title: { S: title },
              description: { S: description || "No description" },
              price: { N: price.toString() },
            },
          },
        },
        {
          Put: {
            TableName: STOCKS_TABLE,
            Item: {
              product_id: { S: id },
              count: { N: count.toString() },
            },
          },
        },
      ];
    }).flat(); // Flatten the array

    // Write to DynamoDB
    await dynamoDBClient.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems })
    );

    console.log("Products saved in DynamoDB!");

    // Send SNS notifications
    await Promise.all(
      event.Records.map(async (record) => {
        const { title, price, count } = JSON.parse(record.body);

        try {
          await snsClient.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Message: `New product added: ${title}`,
              Subject: "Product Import Notification",
              MessageAttributes: {
                price: { DataType: "Number", StringValue: price.toString() },
                count: { DataType: "Number", StringValue: count.toString() },
                category: { DataType: "String", StringValue: "General" },
              },
            })
          );
          console.log(`SNS Notification Sent for ${title}`);
        } catch (snsError) {
          console.error(`Error sending SNS for ${title}:`, snsError);
        }
      })
    );

    console.log("All SNS notifications sent!");

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Products saved successfully!" }),
    };
  } catch (error) {
    console.error("Error processing batch:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
