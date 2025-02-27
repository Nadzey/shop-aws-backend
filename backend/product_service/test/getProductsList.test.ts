import { handler } from "../lambda/getProductsList";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

// Correct Jest mock
jest.mock("@aws-sdk/client-dynamodb", () => {
  const mockSend = jest.fn();
  return {
    DynamoDBClient: jest.fn(() => ({ send: mockSend })),
    ScanCommand: jest.fn(),
  };
});

describe("getProductsList Lambda Function", () => {
  let mockDynamoDB: any;

  beforeEach(() => {
    mockDynamoDB = new DynamoDBClient();
    (mockDynamoDB.send as jest.Mock).mockReset();
  });

  test("should return a list of products with stock count", async () => {
    (mockDynamoDB.send as jest.Mock)
      .mockResolvedValueOnce({
        Items: [
          {
            id: { S: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" },
            title: { S: "Royal Canin Feline Health Nutrition" },
            price: { N: "33.99" },
          },
        ],
      })
      .mockResolvedValueOnce({
        Items: [{ product_id: { S: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2" }, count: { N: "2" } }],
      });

    const response = await handler();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toEqual([
      {
        id: "8c223f3d-bda3-4ea9-9185-cee09a55dcb2",
        title: "Royal Canin Feline Health Nutrition",
        description: "No Description",
        price: 33.99,
        count: 2,
      },
    ]);
  });

  test("should return an empty array if no products are found", async () => {
    mockDynamoDB.send.mockResolvedValue({ Items: [] });

    const response = await handler();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([]);
  });

  test("should return a product with count as 0 if stock is not found", async () => {
    mockDynamoDB.send.mockImplementation((command: any) => {
      if (command instanceof ScanCommand) {
        if (command.input?.TableName === process.env.PRODUCTS_TABLE) {
          return Promise.resolve({
            Items: [
              {
                id: { S: "123" },
                title: { S: "Product A" },
                description: { S: "Description A" },
                price: { N: "20.99" },
              },
            ],
          });
        }
        if (command.input?.TableName === process.env.STOCKS_TABLE) {
          return Promise.resolve({ Items: [] });
        }
      }
      return Promise.resolve({ Items: [] });
    });
  
    const response = await handler();
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
  
    expect(body).toEqual([
      {
        id: "123",
        title: "Product A",
        description: "Description A",
        price: 20.99,
        count: 0, // Stock data missing, so count should be 0
      },
    ]);
  });
  
  test("should return a 500 error if DynamoDB throws an error", async () => {
    mockDynamoDB.send.mockRejectedValue(new Error("DynamoDB error"));

    const response = await handler();
    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: "Internal Server Error" });
  });
});
