const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  try {
    const { productId } = event.pathParameters;
    console.log("Deleting product:", productId);

    const params = {
      TransactItems: [
        {
          Delete: {
            TableName: process.env.PRODUCTS_TABLE,
            Key: { id: { S: productId } },
          },
        },
        {
          Delete: {
            TableName: process.env.STOCKS_TABLE,
            Key: { product_id: { S: productId } },
          },
        },
      ],
    };

    await client.send(new TransactWriteItemsCommand(params));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify({ message: "Product deleted successfully!" }),
    };
  } catch (error) {
    console.error("Lambda Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
