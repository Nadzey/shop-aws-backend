import { v4 as uuidv4 } from "uuid";
import { handler } from "../lambda/createProduct";
import { DynamoDBClient, TransactWriteItemsCommand } from "@aws-sdk/client-dynamodb";

jest.mock("@aws-sdk/client-dynamodb", () => {
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockSend })),
    TransactWriteItemsCommand: jest.fn(),
  };
});

describe("createProduct Lambda Function", () => {
  let mockDynamoDB: any;

  beforeEach(() => {
    mockDynamoDB = new DynamoDBClient();
    (mockDynamoDB.send as jest.Mock).mockReset();
  });

  test("should create a product successfully", async () => {
    (mockDynamoDB.send as jest.Mock).mockResolvedValueOnce({});

    console.log("Generated UUID:", uuidv4());

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

    expect(mockDynamoDB.send).toHaveBeenCalledWith(
      expect.any(TransactWriteItemsCommand)
    );
  });

  test("should return 400 for missing required fields", async () => {
    const event = {
      body: JSON.stringify({
        title: "Test Product",
        price: 25.99,
        // Missing "count"
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
    (mockDynamoDB.send as jest.Mock).mockRejectedValue(new Error("DynamoDB error"));

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
    expect(JSON.parse(response.body)).toEqual({ error: "Internal Server Error" });

    expect(mockDynamoDB.send).toHaveBeenCalledWith(
      expect.any(TransactWriteItemsCommand)
    );
  });
});
