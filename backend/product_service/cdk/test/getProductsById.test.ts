const getProductsById = require("../lambda/getProductsById");

describe("getProductsById Lambda Function", () => {
  test("should return a single product when a valid ID is provided", async () => {
    const event = { pathParameters: { productId: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" } };
    const response = await getProductsById.handler(event);

    expect(response.statusCode).toBe(200);
    const product = JSON.parse(response.body);
    expect(product).toHaveProperty("id", "8c223f3d-bda3-4ea9-9185-cee09a55dcb2");
    expect(product).toHaveProperty("title");
    expect(product).toHaveProperty("price");
  });

  test("should return 404 if product is not found", async () => {
    const event = { pathParameters: { productId: "999" } };
    const response = await getProductsById.handler(event);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("message", "Product not found");
  });
});
