const { DynamoDBClient, PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");
const products = require("./lambda/products");

const client = new DynamoDBClient({ region: "us-east-1" });

async function seedDB() {
  try {
    for (const product of products) {
      // Generate a new UUID instead of using the predefined `id`
      const id = uuidv4();
      const count = Math.floor(Math.random() * 10) + 1;

      // Debugging - Check each product before inserting
      console.log(`Processing product: ${JSON.stringify(product)}`);

      if (!product.title || !product.price) {
        console.error(
          `ERROR: Missing fields in product: ${JSON.stringify(product)}`
        );
        continue; // Skip this item if required fields are missing
      }

      // Add product to "products" table
      await client.send(
        new PutItemCommand({
          TableName: "products",
          Item: {
            id: { S: id }, // New UUID
            title: { S: product.title },
            description: {
              S: product.description || "No description available",
            }, // Default description
            price: { N: product.price.toString() },
            image: { S: product.image || "https://via.placeholder.com/200" }, // Default image if missing
          },
        })
      );

      // Add stock to "stocks" table
      await client.send(
        new PutItemCommand({
          TableName: "stocks",
          Item: {
            product_id: { S: id },
            count: { N: count.toString() },
          },
        })
      );

      console.log(`Added product: ${product.title}, Stock: ${count}`);
    }

    console.log("Tables populated successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedDB();
