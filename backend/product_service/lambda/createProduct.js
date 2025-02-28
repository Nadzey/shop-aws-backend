const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

const client = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  try {
    console.log("Received request:", event.body);

    // Parse and validate request body
    const { title, description, price, count } = JSON.parse(event.body);

    if (!title || !price || count === undefined || count < 0) {
      console.error("ERROR: Missing or invalid fields", {
        title,
        price,
        count,
      });
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid input. Title, price, and count are required.",
        }),
      };
    }

    const id = uuidv4();

    // Prepare transaction for atomic writes
    const params = {
      TransactItems: [
        {
          Put: {
            TableName: process.env.PRODUCTS_TABLE,
            Item: {
              id: { S: id },
              title: { S: title },
              description: { S: description || "No description available" },
              price: { N: price.toString() },
            },
          },
        },
        {
          Put: {
            TableName: process.env.STOCKS_TABLE,
            Item: {
              product_id: { S: id },
              count: { N: count.toString() },
            },
          },
        },
      ],
    };

    // Execute transaction
    await client.send(new TransactWriteItemsCommand(params));

    console.log("Product created:", { id, title, price, count });

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: "Product created successfully!", id }),
    };
  } catch (error) {
    console.error("Lambda Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
