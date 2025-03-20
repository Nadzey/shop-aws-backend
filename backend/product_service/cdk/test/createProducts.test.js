const { handler } = require("../../lambda/createProduct");
const {
  DynamoDBClient,
  TransactWriteItemsCommand,
} = require("@aws-sdk/client-dynamodb");
const { v4: uuidv4 } = require("uuid");

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

jest.mock("uuid", () => ({
  v4: jest.fn(() => "test-uuid"),
}));

describe("createProduct Lambda Function", () => {
  let mockDynamoDB;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoDB = new DynamoDBClient();
  });

  test("should create a product successfully", async () => {
    mockDynamoDB.send.mockResolvedValueOnce({});

    const event = {
      body: JSON.stringify({
        title: "Test Product",
        description: "Test Description",
        price: 25.99,
        count: 5,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({
      message: "Product created successfully!",
      id: "test-uuid",
    });

    expect(mockDynamoDB.send).toHaveBeenCalledWith(
      expect.any(TransactWriteItemsCommand)
    );
  });

  test("should return 400 for missing required fields", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 25.99,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Invalid input. Title, price, and count are required.",
    });

    expect(mockDynamoDB.send).not.toHaveBeenCalled();
  });

  test("should return 400 for negative count", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        description: "Test Description",
        price: 25.99,
        count: -1,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "Invalid input. Title, price, and count are required.",
    });

    expect(mockDynamoDB.send).not.toHaveBeenCalled();
  });

  test("should return 500 on DynamoDB error", async () => {
    mockDynamoDB.send.mockRejectedValue(new Error("DynamoDB error"));

    const event = {
      body: JSON.stringify({
        title: "Test Product",
        description: "Test Description",
        price: 25.99,
        count: 5,
      }),
    };

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      error: "Internal Server Error",
    });

    expect(mockDynamoDB.send).toHaveBeenCalledWith(
      expect.any(TransactWriteItemsCommand)
    );
  });
});
