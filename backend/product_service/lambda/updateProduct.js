const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

exports.handler = async (event) => {
  try {
    const { productId } = event.pathParameters;
    const { title, description, price, count } = JSON.parse(event.body);

    console.log("Updating product:", {
      productId,
      title,
      description,
      price,
      count,
    });

    if (!title || !price || count === undefined || count < 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid input. Title, price, and count are required.",
        }),
      };
    }

    const params = {
      TransactItems: [
        {
          Update: {
            TableName: process.env.PRODUCTS_TABLE,
            Key: { id: { S: productId } },
            UpdateExpression:
              "SET title = :title, description = :description, price = :price",
            ExpressionAttributeValues: {
              ":title": { S: title },
              ":description": { S: description || "No description available" },
              ":price": { N: price.toString() },
            },
          },
        },
        {
          Update: {
            TableName: process.env.STOCKS_TABLE,
            Key: { product_id: { S: productId } },
            UpdateExpression: "SET #cnt = :count",
            ExpressionAttributeNames: { "#cnt": "count" },
            ExpressionAttributeValues: {
              ":count": { N: count.toString() },
            },
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
      },
      body: JSON.stringify({
        message: "Product updated successfully!",
        productId,
      }),
    };
  } catch (error) {
    console.error("Lambda Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
