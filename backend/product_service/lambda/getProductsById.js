const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

const handler = async (event) => {
  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing productId" }),
      };
    }

    const productData = await client.send(
      new GetItemCommand({
        TableName: "products",
        Key: { id: { S: productId } },
      })
    );

    const stockData = await client.send(
      new GetItemCommand({
        TableName: "stocks",
        Key: { product_id: { S: productId } },
      })
    );

    if (!productData.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: productData.Item.id.S,
        title: productData.Item.title.S,
        description: productData.Item.description.S,
        price: Number(productData.Item.price.N),
        count: stockData.Item ? Number(stockData.Item.count.N) : 0,
      }),
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
