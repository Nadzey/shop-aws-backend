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
    console.log(
      "Received messages from SQS:",
      JSON.stringify(event, null, 2)
    );

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
              description: { S: description },
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
    }).flat(); // Flatten array

    await dynamoDBClient.send(
      new TransactWriteItemsCommand({ TransactItems: transactItems })
    );

    console.log("Products saved in DynamoDB!");

    // Notify via SNS
    await snsClient.send(
      new PublishCommand({
        TopicArn: SNS_TOPIC_ARN,
        Message: `New ${event.Records.length} products added.`,
        Subject: "Product Import Notification",
      })
    );

    console.log("SNS notification sent!");

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Products saved successfully!" }),
    };
  } catch (error) {
    console.error("Error processing batch:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
