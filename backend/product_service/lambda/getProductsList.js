const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "us-east-1" });

const handler = async () => {
  try {
    const productsData = await client.send(
      new ScanCommand({ TableName: process.env.PRODUCTS_TABLE })
    );
    const stocksData = await client.send(
      new ScanCommand({ TableName: process.env.STOCKS_TABLE })
    );

    const productItems = productsData.Items || [];
    const stockItems = stocksData.Items || [];

    const products = productItems.map((item) => ({
      id: item.id?.S || "N/A",
      title: item.title?.S || "No Title",
      description: item.description?.S || "No Description",
      price: item.price?.N ? Number(item.price.N) : 0,
      count: stockItems.find((s) => s.product_id?.S === item.id?.S)?.count?.N
        ? Number(
            stockItems.find((s) => s.product_id?.S === item.id?.S)?.count.N
          )
        : 0,
    }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, GET",
      },
      body: JSON.stringify(products),
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
