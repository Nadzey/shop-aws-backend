const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({ region: "us-east-1" });

const handler = async (event) => {
  try {
    // Parse request body
    const { title, description, price, count } = JSON.parse(event.body);
    if (!title || !price || count === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required fields: title, price, count",
        }),
      };
    }

    const id = uuidv4();

    // Add product to PRODUCTS_TABLE
    await client.send(
      new PutItemCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Item: {
          id: { S: id },
          title: { S: title },
          description: { S: description || "" },
          price: { N: price.toString() },
        },
      })
    );

    // Add stock information to STOCKS_TABLE
    await client.send(
      new PutItemCommand({
        TableName: process.env.STOCKS_TABLE,
        Item: {
          product_id: { S: id },
          count: { N: count.toString() },
        },
      })
    );

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "Product created successfully!", id }),
    };
  } catch (error) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

module.exports = { handler };
