const { handler } = require("../../lambda/getProductsById");
const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");

// Mock AWS SDK
jest.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: jest.fn(() => ({
      send: jest.fn(), // Properly mock the `send` method
    })),
    TransactWriteItemsCommand: jest.fn(),
    ScanCommand: jest.fn(),
    GetItemCommand: jest.fn(),
  };
});

describe("getProductsById Lambda Function", () => {
  let mockDynamoDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoDB = new DynamoDBClient();
  });

  test("should return a single product when a valid ID is provided", async () => {
    // Mock DynamoDB response
    mockDynamoDB.send.mockResolvedValueOnce({
      Item: {
        id: { S: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" },
        title: { S: "Test Product" },
        price: { N: "25.99" },
        description: { S: "Test Description" },
      },
    });

    const event = {
      pathParameters: { productId: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" },
    };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const product = JSON.parse(response.body);
    expect(product).toEqual({
      id: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2",
      title: "Test Product",
      price: 25.99,
      description: "Test Description",
    });

    expect(mockDynamoDB.send).toHaveBeenCalledWith(expect.any(GetItemCommand));
  });

  test("should return 404 if product is not found", async () => {
    // Mock DynamoDB response for product not found
    mockDynamoDB.send.mockResolvedValueOnce({});

    const event = { pathParameters: { productId: "999" } };
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("message", "Product not found");

    expect(mockDynamoDB.send).toHaveBeenCalledWith(expect.any(GetItemCommand));
  });

  test("should return 500 on DynamoDB error", async () => {
    // Simulate DynamoDB failure
    mockDynamoDB.send.mockRejectedValueOnce(new Error("DynamoDB Error"));

    const event = {
      pathParameters: { productId: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" },
    };
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: "Internal Server Error",
    });

    expect(mockDynamoDB.send).toHaveBeenCalledWith(expect.any(GetItemCommand));
  });
});
